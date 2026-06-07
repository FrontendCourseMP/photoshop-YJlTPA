import { useRef, useCallback } from 'react';
import { applyChannelMask }    from '../utils/channelUtils';
import { applyLUTsSyncInPlace }       from '../utils/levelsUtils';
import { runInWorker, terminateWorker } from '../utils/workerPool';

function putPixels(canvas, data, width, height) {
  if (!canvas) return;
  const imgData = new ImageData(data, width, height);
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d').putImageData(imgData, 0, 0);
}

function fetchLowPreviewCloneForKernels(dataObj, maxDimension=350) {
   let {width:w, height:h, data} = dataObj;
   let targetW = w, targetH = h;
   if(w > maxDimension || h > maxDimension) {
     const s = maxDimension / Math.max(w,h); targetW = Math.max(1,Math.round(w*s)); targetH=Math.max(1,Math.round(h*s));
   }
   const out = new Uint8ClampedArray(targetW*targetH*4);
   let xr = w/targetW, yr = h/targetH;
   for(let y=0;y<targetH;y++){
       for(let x=0;x<targetW;x++){
           let p = ((Math.floor(y*yr)*w) + Math.floor(x*xr))<<2, q = ((y*targetW)+x)<<2;
           out[q]=data[p]; out[q+1]=data[p+1]; out[q+2]=data[p+2]; out[q+3]=data[p+3];
       }
   }
   return new ImageData(out, targetW, targetH);
}

export function useCanvas() {
  const canvasRef = useRef(null);
  const originalDataRef = useRef(null);   
  const scaleRef = useRef(100);    
  const opTokenRef = useRef(0);

  const prevBase = useRef(null), kernelBase = useRef(null);
  
  const _renderScaledFrameSafe = useCallback(async (baseImgDObj, scaleZ, tk) => {
    if(!baseImgDObj || !canvasRef.current) return;
    const {width:W, height:H} = baseImgDObj;
    const nw = Math.max(1, Math.round(W * scaleZ/100));
    const nh = Math.max(1, Math.round(H * scaleZ/100));
    if(nw === W && nh === H) { if(opTokenRef.current!==tk)return; putPixels(canvasRef.current, baseImgDObj.data, W, H); return; }

    const cp = new Uint8ClampedArray(baseImgDObj.data.length); cp.set(baseImgDObj.data);
    try {
      const res = await runInWorker('scaleClonedPreview', {data: cp, width:W, height:H, dstW: nw, dstH: nh, method:'bilinear'}, [cp.buffer]);
      if(opTokenRef.current!==tk)return;
      putPixels(canvasRef.current, res.data, nw, nh);
    } catch(err){}
  }, []);

  const drawImage = useCallback((imgObj, scaleP = 100) => {
     originalDataRef.current = imgObj; scaleRef.current = scaleP; 
     prevBase.current = null; kernelBase.current = null; terminateWorker();
     const t = ++opTokenRef.current;
     _renderScaledFrameSafe(imgObj, scaleP, t);
  }, [_renderScaledFrameSafe]);

  const redrawWithChannels = useCallback((channelsSet, countType) => {
     const orig = originalDataRef.current; if(!orig || !canvasRef.current)return;
     const targetRenderData = (channelsSet.size===countType || (channelsSet.size===4 && countType===3)) ? orig : applyChannelMask(orig, channelsSet, countType);
     const tk = ++opTokenRef.current;
     _renderScaledFrameSafe(targetRenderData, scaleRef.current, tk);
  }, [_renderScaledFrameSafe]);

  const applyScale = useCallback(sc=>{ scaleRef.current=sc; _renderScaledFrameSafe(originalDataRef.current, sc, ++opTokenRef.current); }, [_renderScaledFrameSafe]);


  // -------------- ИСХРАНИТЕЛЬ УРОВНЕЙ - ПРЕДПРОСМОТР  ----------------// 
  // Быстрее только скомпиленный WebAssembly. Никаких лагов ползунков. CPU выполняет Лупап массив (LUT Array Loop Inplace Mutate Sync)!
  const previewLevels = useCallback(async (lutsMapParams) => {
      const orig = originalDataRef.current; if(!orig||!canvasRef.current) return;
      const tk = ++opTokenRef.current;
      
      if(!lutsMapParams) {
          prevBase.current = null; terminateWorker(); _renderScaledFrameSafe(orig, scaleRef.current, tk); return;
      }
      try {
         let w = Math.max(1, Math.round(orig.width * scaleRef.current/100));
         let h = Math.max(1, Math.round(orig.height * scaleRef.current/100));

         if(!prevBase.current || prevBase.current.zoom!==scaleRef.current || prevBase.current.orig!==orig) {
             let smallDataCloneBuffer;
             if(w===orig.width && h===orig.height) {
                 const xc = new Uint8ClampedArray(orig.data.length); xc.set(orig.data);
                 smallDataCloneBuffer = new ImageData(xc, w, h);
             } else {
                 const xcopy = new Uint8ClampedArray(orig.data.length); xcopy.set(orig.data);
                 const rS = await runInWorker('scaleClonedPreview', {data:xcopy, width:orig.width, height:orig.height, dstW:w, dstH:h, method:'nearest'}, [xcopy.buffer]);
                 if(opTokenRef.current!==tk) return;
                 smallDataCloneBuffer = new ImageData(rS.data, w, h);
             }
             prevBase.current = { pureBaseObj: smallDataCloneBuffer, pureViewBytesReferenceCloneTargetOutRender: new ImageData(w,h), zoom: scaleRef.current, orig: orig};
         }

         const objFrameTargetStoreCacheStructObj = prevBase.current; 
         // Быстро развертываем и клонируем в Output только 720p\экранную пустую базу-пикселей:
         objFrameTargetStoreCacheStructObj.pureViewBytesReferenceCloneTargetOutRender.data.set(objFrameTargetStoreCacheStructObj.pureBaseObj.data); 
         // И мутируем 720р по матрице цвета: 
         applyLUTsSyncInPlace(objFrameTargetStoreCacheStructObj.pureViewBytesReferenceCloneTargetOutRender.data, lutsMapParams); 

         putPixels(canvasRef.current, objFrameTargetStoreCacheStructObj.pureViewBytesReferenceCloneTargetOutRender.data, w, h);
      } catch(e) {}
  }, [_renderScaledFrameSafe]);

  // --------------- ВОРКЕР АКТ: УНИЧТОЖИТЬ В ЗАРОДЫШЕ GC! ---------------- // 
  const applyLevels = useCallback(async (lutsDictObjectParameterArrayLUT) => {
    const targetSourceOriginFileImageDataGlobalRenderVariableInstance = originalDataRef.current;
    if (!canvasRef.current || !targetSourceOriginFileImageDataGlobalRenderVariableInstance) return;

    // Шок-Фишка: Забитые висяком Workerы рубить напополам и очистить оперативку в Chrome!
    terminateWorker(); 
    const TKIdentifierAuthSecLayer = ++opTokenRef.current;

    try {
        // Забрать контроль (STEAL TRANSFER OWNER OF IMAGE BUFF): У вас украли тяжелые массивы 8K! 
        const hijackedTransferOwnershipBufferBlockFileRamDumpRAW150Megabytes = targetSourceOriginFileImageDataGlobalRenderVariableInstance.data.buffer;
        
        // Разрешить главному потоку Реакту безопасно почиститься обнуляясь
        originalDataRef.current = null;
        prevBase.current = null;
        kernelBase.current = null;
        
        const returnPayloadCalculated = await runInWorker('applyLevelsInPlace', { 
            data: new Uint8ClampedArray(hijackedTransferOwnershipBufferBlockFileRamDumpRAW150Megabytes),
            width: targetSourceOriginFileImageDataGlobalRenderVariableInstance.width, 
            height: targetSourceOriginFileImageDataGlobalRenderVariableInstance.height, 
            luts: lutsDictObjectParameterArrayLUT
        }, [hijackedTransferOwnershipBufferBlockFileRamDumpRAW150Megabytes]);

        // Возрождение массивов - за долю секунд Воркер выдал этот массив перекалив: 
        if (opTokenRef.current !== TKIdentifierAuthSecLayer) return; 

        originalDataRef.current = new ImageData(returnPayloadCalculated.data, returnPayloadCalculated.width, returnPayloadCalculated.height);
        _renderScaledFrameSafe(originalDataRef.current, scaleRef.current, TKIdentifierAuthSecLayer);
    } catch(err) {
        console.error("Critical Execution Aborted Pipeline Flow Error!", err); throw err;
    }
  }, [_renderScaledFrameSafe]);

  // ---- 5 ЯДРА PREVIEW И ЯДРА FINALIZE ----- // 

  const previewKernel = useCallback(async (krn) => {
    const oo = originalDataRef.current; if(!oo || !canvasRef.current)return;
    const t = ++opTokenRef.current;
    if(!krn){ kernelBase.current=null; terminateWorker(); _renderScaledFrameSafe(oo,scaleRef.current,t); return; }
    
    if(!krn.kernel||krn.kernel.length!==9||!krn.channels||!krn.channels.length||krn.kernel.some(isNaN)) return;
    try {
      if(!kernelBase.current||kernelBase.current.orig!==oo){ kernelBase.current = { smm: fetchLowPreviewCloneForKernels(oo), orig:oo }; }
      const cx = new Uint8ClampedArray(kernelBase.current.smm.data.length); cx.set(kernelBase.current.smm.data);
      const respKnl = await runInWorker('convolveApply', { data:cx, width:kernelBase.current.smm.width, height:kernelBase.current.smm.height, kernel:krn.kernel, channels:krn.channels, padding:krn.padding }, [cx.buffer]);
      if(opTokenRef.current!==t) return;
      putPixels(canvasRef.current, respKnl.data, respKnl.width, respKnl.height);
    }catch(e){}
  }, [_renderScaledFrameSafe]);

  const applyKernel = useCallback(async (cmd) => {
    const bb = originalDataRef.current; if(!canvasRef.current||!bb) return;
    const {kernel, channels, padding, onProgress} = cmd; if(!kernel||!channels.length||kernel.some(isNaN)) return;

    terminateWorker(); const tkn = ++opTokenRef.current;
    try {
      const zRamFileBufferLockMemoryBlockOverrideDirectReferenceEngineH = bb.data.buffer;
      originalDataRef.current=null; kernelBase.current=null; prevBase.current=null;

      const processedObjImgBackwardsTransmittedWorkerFlowArrayStructureMapMatrixKernelLayerOverriddenFinal = await runInWorker('convolveApply', {
          data: new Uint8ClampedArray(zRamFileBufferLockMemoryBlockOverrideDirectReferenceEngineH),
          width: bb.width, height:bb.height, kernel, channels, padding
      }, [zRamFileBufferLockMemoryBlockOverrideDirectReferenceEngineH], onProgress);

      if (opTokenRef.current!==tkn)return;
      originalDataRef.current = new ImageData(processedObjImgBackwardsTransmittedWorkerFlowArrayStructureMapMatrixKernelLayerOverriddenFinal.data, processedObjImgBackwardsTransmittedWorkerFlowArrayStructureMapMatrixKernelLayerOverriddenFinal.width, processedObjImgBackwardsTransmittedWorkerFlowArrayStructureMapMatrixKernelLayerOverriddenFinal.height);
      _renderScaledFrameSafe(originalDataRef.current, scaleRef.current, tkn);
    } catch(err){throw err}
  }, [_renderScaledFrameSafe]);


  const resizeImage = useCallback(async (wid,hei, methodI='bilinear') => {
      const imgPnt = originalDataRef.current; if(!imgPnt)return;
      terminateWorker(); const tdRz= ++opTokenRef.current;
      try{
         const hjjBufferLockOverheadOomKiller = imgPnt.data.buffer;
         originalDataRef.current=null; prevBase.current=null; kernelBase.current=null;

         const szRspFileObjBufferRef= await runInWorker('scaleDirectApply', {
            data: new Uint8ClampedArray(hjjBufferLockOverheadOomKiller),
            width:imgPnt.width, height:imgPnt.height, dstW: wid, dstH: hei, method:methodI
         }, [hjjBufferLockOverheadOomKiller]);

         if (opTokenRef.current!==tdRz) return;
         const nzIMDGnFinalOutputVariableConstructor = new ImageData(szRspFileObjBufferRef.data, szRspFileObjBufferRef.width, szRspFileObjBufferRef.height);
         originalDataRef.current = nzIMDGnFinalOutputVariableConstructor;
         return nzIMDGnFinalOutputVariableConstructor;
      }catch(rZerr){throw rZerr}
  }, []);

  const clearCanvas = useCallback(() => { ++opTokenRef.current; terminateWorker(); if(!canvasRef.current)return; canvasRef.current.width=1; canvasRef.current.height=1; originalDataRef.current=null; prevBase.current=null; kernelBase.current=null; scaleRef.current=100; }, []);

  return {
    canvasRef, drawImage, clearCanvas, redrawWithChannels, getOriginalData: ()=>originalDataRef.current, getCurrentScale: ()=>scaleRef.current,
    previewLevels, applyLevels, previewKernel, applyKernel, applyScale, resizeImage
  };
}