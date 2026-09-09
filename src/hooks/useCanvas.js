import { useRef, useCallback } from 'react';
import { applyChannelMask } from '../utils/channelUtils';
import { applyLUTsSyncInPlace } from '../utils/levelsUtils';
import { runInWorker, terminateWorker } from '../utils/workerPool';

function putPixels(canvas, data, width, height) {
  if (!canvas) return;
  const imgData = new ImageData(data, width, height);
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(imgData, 0, 0);
}

export function useCanvas() {
  const canvasRef = useRef(null);
  const originalDataRef = useRef(null);
  const scaleRef = useRef(100);
  const opTokenRef = useRef(0);

  const prevBase = useRef(null);
  const kernelBase = useRef(null);

  const _renderScaledFrameSafe = useCallback(async (baseImgDObj, scaleZ, tk) => {
    if (!baseImgDObj || !canvasRef.current) return;
    const { width: W, height: H } = baseImgDObj;
    const nw = Math.max(1, Math.round((W * scaleZ) / 100));
    const nh = Math.max(1, Math.round((H * scaleZ) / 100));
    if (nw === W && nh === H) {
      if (opTokenRef.current !== tk) return;
      putPixels(canvasRef.current, baseImgDObj.data, W, H);
      return;
    }

    const cp = new Uint8ClampedArray(baseImgDObj.data.length);
    cp.set(baseImgDObj.data);
    try {
      const res = await runInWorker('scaleClonedPreview', { data: cp, width: W, height: H, dstW: nw, dstH: nh, method: 'bilinear' }, [cp.buffer]);
      if (opTokenRef.current !== tk) return;
      putPixels(canvasRef.current, res.data, nw, nh);
    } catch {
      // Отменённая операция
    }
  }, []);

  const drawImage = useCallback((imgObj, scaleP = 100) => {
    originalDataRef.current = imgObj;
    scaleRef.current = scaleP;
    prevBase.current = null;
    kernelBase.current = null;
    terminateWorker();
    const t = ++opTokenRef.current;
    _renderScaledFrameSafe(imgObj, scaleP, t);
  }, [_renderScaledFrameSafe]);

  const redrawWithChannels = useCallback((channelsSet, countType) => {
    const orig = originalDataRef.current;
    if (!orig || !canvasRef.current) return;
    const targetRenderData = (channelsSet.size === countType || (channelsSet.size === 4 && countType === 3))
      ? orig
      : applyChannelMask(orig, channelsSet, countType);
    const tk = ++opTokenRef.current;
    _renderScaledFrameSafe(targetRenderData, scaleRef.current, tk);
  }, [_renderScaledFrameSafe]);

  const applyScale = useCallback(sc => {
    scaleRef.current = sc;
    _renderScaledFrameSafe(originalDataRef.current, sc, ++opTokenRef.current);
  }, [_renderScaledFrameSafe]);

  const previewLevels = useCallback(async (luts) => {
    const orig = originalDataRef.current;
    if (!orig || !canvasRef.current) return;
    const tk = ++opTokenRef.current;

    if (!luts) {
      prevBase.current = null;
      terminateWorker();
      _renderScaledFrameSafe(orig, scaleRef.current, tk);
      return;
    }
    try {
      const w = Math.max(1, Math.round((orig.width * scaleRef.current) / 100));
      const h = Math.max(1, Math.round((orig.height * scaleRef.current) / 100));

      if (!prevBase.current || prevBase.current.zoom !== scaleRef.current || prevBase.current.orig !== orig) {
        let previewBuffer;
        if (w === orig.width && h === orig.height) {
          const xc = new Uint8ClampedArray(orig.data.length);
          xc.set(orig.data);
          previewBuffer = new ImageData(xc, w, h);
        } else {
          const xcopy = new Uint8ClampedArray(orig.data.length);
          xcopy.set(orig.data);
          const rS = await runInWorker('scaleClonedPreview', { data: xcopy, width: orig.width, height: orig.height, dstW: w, dstH: h, method: 'nearest' }, [xcopy.buffer]);
          if (opTokenRef.current !== tk) return;
          previewBuffer = new ImageData(rS.data, w, h);
        }
        prevBase.current = { baseObj: previewBuffer, renderTarget: new ImageData(w, h), zoom: scaleRef.current, orig };
      }

      const obj = prevBase.current;
      obj.renderTarget.data.set(obj.baseObj.data);
      applyLUTsSyncInPlace(obj.renderTarget.data, luts);
      putPixels(canvasRef.current, obj.renderTarget.data, w, h);
    } catch {
      // Отменённая операция
    }
  }, [_renderScaledFrameSafe]);

  const applyLevels = useCallback(async (luts) => {
    const target = originalDataRef.current;
    if (!canvasRef.current || !target) return;

    terminateWorker();
    const tk = ++opTokenRef.current;

    const copyData = new Uint8ClampedArray(target.data.length);
    copyData.set(target.data);

    try {
      prevBase.current = null;
      kernelBase.current = null;

      const res = await runInWorker('applyLevelsInPlace', {
        data: copyData,
        width: target.width,
        height: target.height,
        luts
      }, [copyData.buffer]);

      if (opTokenRef.current !== tk) return;

      originalDataRef.current = new ImageData(res.data, res.width, res.height);
      _renderScaledFrameSafe(originalDataRef.current, scaleRef.current, tk);
    } catch (err) {
      console.error('applyLevels error:', err);
      throw err;
    }
  }, [_renderScaledFrameSafe]);

  const previewKernel = useCallback(async (krn) => {
    const orig = originalDataRef.current;
    if (!orig || !canvasRef.current) return;
    const t = ++opTokenRef.current;
    if (!krn) {
      kernelBase.current = null;
      terminateWorker();
      _renderScaledFrameSafe(orig, scaleRef.current, t);
      return;
    }

    if (!krn.kernel || krn.kernel.length !== 9 || !krn.channels || !krn.channels.length || krn.kernel.some(isNaN)) return;
    try {
      const w = Math.max(1, Math.round((orig.width * scaleRef.current) / 100));
      const h = Math.max(1, Math.round((orig.height * scaleRef.current) / 100));

      if (!kernelBase.current || kernelBase.current.zoom !== scaleRef.current || kernelBase.current.orig !== orig) {
        let frameBuffer;
        if (w === orig.width && h === orig.height) {
          const xc = new Uint8ClampedArray(orig.data.length);
          xc.set(orig.data);
          frameBuffer = new ImageData(xc, w, h);
        } else {
          const xcopy = new Uint8ClampedArray(orig.data.length);
          xcopy.set(orig.data);
          const rS = await runInWorker('scaleClonedPreview', { data: xcopy, width: orig.width, height: orig.height, dstW: w, dstH: h, method: 'nearest' }, [xcopy.buffer]);
          if (opTokenRef.current !== t) return;
          frameBuffer = new ImageData(rS.data, w, h);
        }
        kernelBase.current = { baseFrame: frameBuffer, zoom: scaleRef.current, orig };
      }

      const cx = new Uint8ClampedArray(kernelBase.current.baseFrame.data.length);
      cx.set(kernelBase.current.baseFrame.data);

      const respKnl = await runInWorker('convolveApply', {
        data: cx,
        width: w,
        height: h,
        kernel: krn.kernel,
        channels: krn.channels,
        padding: krn.padding
      }, [cx.buffer]);

      if (opTokenRef.current !== t) return;
      putPixels(canvasRef.current, respKnl.data, w, h);
    } catch {
      // Отменённая операция
    }
  }, [_renderScaledFrameSafe]);

  const applyKernel = useCallback(async (cmd) => {
    const orig = originalDataRef.current;
    if (!canvasRef.current || !orig) return;
    const { kernel, channels, padding, onProgress } = cmd;
    if (!kernel || !channels.length || kernel.some(isNaN)) return;

    terminateWorker();
    const tkn = ++opTokenRef.current;

    const copyData = new Uint8ClampedArray(orig.data.length);
    copyData.set(orig.data);

    kernelBase.current = null;
    prevBase.current = null;

    const res = await runInWorker('convolveApply', {
      data: copyData,
      width: orig.width,
      height: orig.height,
      kernel,
      channels,
      padding
    }, [copyData.buffer], onProgress);

    if (opTokenRef.current !== tkn) return;
    originalDataRef.current = new ImageData(res.data, res.width, res.height);
    _renderScaledFrameSafe(originalDataRef.current, scaleRef.current, tkn);
  }, [_renderScaledFrameSafe]);

  const resizeImage = useCallback(async (width, height, method = 'bilinear') => {
    const orig = originalDataRef.current;
    if (!orig) return;
    terminateWorker();
    const tdRz = ++opTokenRef.current;

    const copyData = new Uint8ClampedArray(orig.data.length);
    copyData.set(orig.data);

    prevBase.current = null;
    kernelBase.current = null;

    const res = await runInWorker('scaleDirectApply', {
      data: copyData,
      width: orig.width,
      height: orig.height,
      dstW: width,
      dstH: height,
      method
    }, [copyData.buffer]);

    if (opTokenRef.current !== tdRz) return;
    const resized = new ImageData(res.data, res.width, res.height);
    originalDataRef.current = resized;
    return resized;
  }, []);

  const clearCanvas = useCallback(() => {
    ++opTokenRef.current;
    terminateWorker();
    if (!canvasRef.current) return;
    canvasRef.current.width = 1;
    canvasRef.current.height = 1;
    originalDataRef.current = null;
    prevBase.current = null;
    kernelBase.current = null;
    scaleRef.current = 100;
  }, []);

  return {
    canvasRef,
    drawImage,
    clearCanvas,
    redrawWithChannels,
    getOriginalData: () => originalDataRef.current,
    getCurrentScale: () => scaleRef.current,
    previewLevels,
    applyLevels,
    previewKernel,
    applyKernel,
    applyScale,
    resizeImage
  };
}