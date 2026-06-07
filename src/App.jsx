import { useState, useCallback, useEffect, useRef } from 'react';
import Toolbar       from './components/Toolbar';
import CanvasArea    from './components/CanvasArea';
import ChannelPanel  from './components/ChannelPanel';
import StatusBar     from './components/StatusBar';
import ResizeDialog  from './components/ResizeDialog';
import LevelsDialog  from './components/LevelsDialog';
import KernelDialog  from './components/KernelDialog';
import ScaleSelector from './components/ScaleSelector';
import { useCanvas } from './hooks/useCanvas';
import { loadImage } from './utils/imageLoader';
import { downloadAsPNG, downloadAsJPEG, downloadAsGB7 } from './utils/imageDownloader';
import { getChannelCount, getChannelDescriptors }       from './utils/channelUtils';
import { rgbToLab }  from './utils/colorUtils';
import { fitScale }  from './utils/scaleUtils';
import styles        from './App.module.css';

export default function App() {
  const {
    canvasRef,
    drawImage,
    clearCanvas,
    redrawWithChannels,
    getOriginalData,
    previewLevels,
    applyLevels,
    previewKernel,
    applyKernel,
    applyScale,
    resizeImage,
  } = useCanvas();

  const [imageInfo, setImageInfo]   = useState(null);
  const [error, setError]           = useState(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [scale, setScale]           = useState(100);

  const [channelDescriptors, setChannelDescriptors] = useState(null);
  const [activeChannels, setActiveChannels]         = useState(new Set());
  const [channelCount, setChannelCount]             = useState(0);

  const [pipetteActive, setPipetteActive] = useState(false);
  const [colorInfo, setColorInfo]         = useState(null);

  const [showLevelsDialog,  setShowLevelsDialog]  = useState(false);
  const [showResizeDialog,  setShowResizeDialog]  = useState(false);
  const [showKernelDialog,  setShowKernelDialog]  = useState(false);

  const [isBusy, setIsBusy] = useState(false);

  const areaRef = useRef(null);

  // ─── Загрузка файла ───────────────────────────────────────────────────────
  const handleFileLoad = useCallback(async (file) => {
    setIsLoading(true);
    setError(null);
    setColorInfo(null);
    setPipetteActive(false);
    setShowLevelsDialog(false);
    setShowResizeDialog(false);
    setShowKernelDialog(false);

    try {
      const result = await loadImage(file);
      let initialScale = 100;
      if (areaRef.current) {
        const { clientWidth, clientHeight } = areaRef.current;
        initialScale = fitScale(result.width, result.height, clientWidth, clientHeight);
      }
      drawImage(result.imageData, initialScale);
      setScale(initialScale);

      const count = getChannelCount(result.imageData);
      const descs = getChannelDescriptors(count);
      setChannelCount(count);
      setChannelDescriptors(descs);
      setActiveChannels(new Set(descs.map(d => d.id)));

      setImageInfo({
        fileName:   result.fileName,
        format:     result.format,
        width:      result.width,
        height:     result.height,
        colorDepth: result.colorDepth,
      });
    } catch (err) {
      setError(err.message);
      clearCanvas();
      setImageInfo(null);
      setChannelDescriptors(null);
    } finally {
      setIsLoading(false);
    }
  }, [drawImage, clearCanvas]);

  // ─── Масштаб ──────────────────────────────────────────────────────────────
  const handleScaleChange = useCallback((newScale) => {
    setScale(newScale);
    applyScale(newScale);
  }, [applyScale]);

  // ─── Каналы ───────────────────────────────────────────────────────────────
  const handleChannelToggle = useCallback((channelId) => {
    setActiveChannels(prev => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId); else next.add(channelId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!imageInfo || channelCount === 0) return;
    redrawWithChannels(activeChannels, channelCount);
  }, [activeChannels, channelCount, imageInfo, redrawWithChannels]);

  // ─── Пипетка ──────────────────────────────────────────────────────────────
  const handlePipetteClick = useCallback((x, y) => {
    const original = getOriginalData();
    if (!original) return;
    const cx = Math.max(0, Math.min(x, original.width  - 1));
    const cy = Math.max(0, Math.min(y, original.height - 1));
    const idx = (cy * original.width + cx) * 4;
    const r = original.data[idx], g = original.data[idx+1],
          b = original.data[idx+2], a = original.data[idx+3];
    if (r === undefined) return;
    setColorInfo({ x: cx, y: cy, r, g, b, a, lab: rgbToLab(r, g, b) });
  }, [getOriginalData]);

  // ─── Уровни ───────────────────────────────────────────────────────────────
  const handleLevelsApply = useCallback(async (luts) => {
    setIsBusy(true);
    try { await applyLevels(luts); }
    finally { setIsBusy(false); setShowLevelsDialog(false); }
  }, [applyLevels]);

  const handleLevelsCancel = useCallback(() => {
    previewLevels(null);
    setShowLevelsDialog(false);
  }, [previewLevels]);

  // ─── Ресайз ───────────────────────────────────────────────────────────────
  const handleResizeApply = useCallback(async (width, height, methodId) => {
    setIsBusy(true);
    try {
      const resized = await resizeImage(width, height, methodId);
      if (!resized) return;
      let newScale = 100;
      if (areaRef.current) {
        const { clientWidth, clientHeight } = areaRef.current;
        newScale = fitScale(resized.width, resized.height, clientWidth, clientHeight);
      }
      applyScale(newScale);
      setScale(newScale);
      setImageInfo(prev => ({ ...prev, width: resized.width, height: resized.height }));
      const count = getChannelCount(resized);
      const descs = getChannelDescriptors(count);
      setChannelCount(count);
      setChannelDescriptors(descs);
      setActiveChannels(new Set(descs.map(d => d.id)));
    } finally {
      setIsBusy(false);
      setShowResizeDialog(false);
    }
  }, [resizeImage, applyScale]);

  // ─── Ядро свёртки ─────────────────────────────────────────────────────────
  const handleKernelApply = useCallback(async (params) => {
    setIsBusy(true);
    try { await applyKernel(params); }
    finally { setIsBusy(false); setShowKernelDialog(false); }
  }, [applyKernel]);

  const handleKernelClose = useCallback(() => {
    previewKernel(null);
    setShowKernelDialog(false);
  }, [previewKernel]);

  // ─── Скачивание ───────────────────────────────────────────────────────────
  const handleDownload = useCallback((format) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageInfo) return;
    const name = imageInfo.fileName;
    if (format === 'png')      downloadAsPNG(canvas, name);
    else if (format === 'jpg') downloadAsJPEG(canvas, name);
    else if (format === 'gb7') downloadAsGB7(canvas, name);
  }, [canvasRef, imageInfo]);

  return (
    <div className={styles.app}>
      <Toolbar
        onFileLoad={handleFileLoad}
        onDownload={handleDownload}
        hasImage={!!imageInfo}
        isLoading={isLoading || isBusy}
        pipetteActive={pipetteActive}
        onPipetteToggle={() => { setPipetteActive(p => !p); setColorInfo(null); }}
        onLevelsOpen={() => setShowLevelsDialog(true)}
        onResizeOpen={() => setShowResizeDialog(true)}
        onKernelOpen={() => setShowKernelDialog(true)}
      />

      <div className={styles.workspace}>
        <CanvasArea
          ref={areaRef}
          canvasRef={canvasRef}
          hasImage={!!imageInfo}
          onDrop={handleFileLoad}
          isLoading={isLoading}
          isBusy={isBusy}
          pipetteActive={pipetteActive}
          onPipetteClick={handlePipetteClick}
          colorInfo={colorInfo}
          onColorInfoClose={() => setColorInfo(null)}
          scale={scale}
        />
        {imageInfo && (
          <ChannelPanel
            imageData={getOriginalData()}
            descriptors={channelDescriptors}
            activeChannels={activeChannels}
            onToggle={handleChannelToggle}
          />
        )}
      </div>

      <StatusBar imageInfo={imageInfo} error={error}>
        <ScaleSelector scale={scale} onChange={handleScaleChange} disabled={isBusy} />
      </StatusBar>

      {showLevelsDialog && imageInfo && (
        <LevelsDialog
          imageData={getOriginalData()}
          onApply={handleLevelsApply}
          onCancel={handleLevelsCancel}
          onPreview={previewLevels}
        />
      )}

      {showResizeDialog && imageInfo && (
        <ResizeDialog
          imageData={getOriginalData()}
          onApply={handleResizeApply}
          onClose={() => setShowResizeDialog(false)}
        />
      )}

      {showKernelDialog && imageInfo && (
        <KernelDialog
          imageData={getOriginalData()}
          onApply={handleKernelApply}
          onClose={handleKernelClose}
          onPreview={previewKernel}
        />
      )}
    </div>
  );
}