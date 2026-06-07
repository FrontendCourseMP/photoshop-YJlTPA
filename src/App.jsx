import { useState, useCallback, useEffect, useRef } from 'react';
import Toolbar from './components/Toolbar';
import CanvasArea from './components/CanvasArea';
import ChannelPanel from './components/ChannelPanel';
import StatusBar from './components/StatusBar';
import LevelsDialog from './components/LevelsDialog';
import { useCanvas } from './hooks/useCanvas';
import { loadImage } from './utils/imageLoader';
import { downloadAsPNG, downloadAsJPEG, downloadAsGB7 } from './utils/imageDownloader';
import { getChannelCount, getChannelDescriptors } from './utils/channelUtils';
import { rgbToLab } from './utils/colorUtils';
import styles from './App.module.css';

// Быстрое уменьшение изображения для нужд интерфейса (гистограммы, миниатюры)
// Оригинал на главном Canvas остается нетронутым и полноразмерным.
function downsampleCanvas(canvas, maxDim = 512) {
  if (!canvas) return null;
  const w = canvas.width;
  const h = canvas.height;
  if (w <= maxDim && h <= maxDim) {
    try {
      const ctx = canvas.getContext('2d');
      return ctx.getImageData(0, 0, w, h);
    } catch (e) {
      return null;
    }
  }

  let nw = w;
  let nh = h;
  if (w > h) {
    if (w > maxDim) {
      nh = Math.round((h * maxDim) / w);
      nw = maxDim;
    }
  } else {
    if (h > maxDim) {
      nw = Math.round((w * maxDim) / h);
      nh = maxDim;
    }
  }

  try {
    const offscreen = document.createElement('canvas');
    offscreen.width = nw;
    offscreen.height = nh;
    const oCtx = offscreen.getContext('2d');
    oCtx.drawImage(canvas, 0, 0, nw, nh);
    return oCtx.getImageData(0, 0, nw, nh);
  } catch (e) {
    return null;
  }
}

export default function App() {
  const { canvasRef, drawImage, clearCanvas, redrawWithChannels, getOriginalData, previewLevels, applyLevels } = useCanvas();

  const [imageInfo, setImageInfo] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [channelDescriptors, setChannelDescriptors] = useState(null);
  const [activeChannels, setActiveChannels] = useState(new Set());
  const [channelCount, setChannelCount] = useState(0);
  const [pipetteActive, setPipetteActive] = useState(false);
  const [colorInfo, setColorInfo] = useState(null);
  const [levelsOpen, setLevelsOpen] = useState(false);

  const [imageDataForPanel, setImageDataForPanel] = useState(null);

  const handleFileLoad = useCallback(async (file) => {
    setIsLoading(true); setError(null); setColorInfo(null);
    setPipetteActive(false); setLevelsOpen(false);
    try {
      const result = await loadImage(file);
      drawImage(result.imageData);
      const count = getChannelCount(result.imageData);
      const descs = getChannelDescriptors(count);
      setChannelCount(count);
      setChannelDescriptors(descs);
      setActiveChannels(new Set(descs.map(d => d.id)));
      
      // Подготавливаем легковесную копию для панелей
      const panelData = downsampleCanvas(canvasRef.current);
      setImageDataForPanel(panelData || result.imageData);

      setImageInfo({ fileName: result.fileName, format: result.format, width: result.width, height: result.height, colorDepth: result.colorDepth });
    } catch (err) {
      setError(err.message); clearCanvas(); setImageInfo(null);
      setChannelDescriptors(null); setImageDataForPanel(null);
    } finally { setIsLoading(false); }
  }, [drawImage, clearCanvas]);

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

  const handlePipetteClick = useCallback((x, y) => {
    const original = getOriginalData();
    if (!original) return;
    const idx = (y * original.width + x) * 4;
    const r = original.data[idx], g = original.data[idx+1], b = original.data[idx+2], a = original.data[idx+3];
    setColorInfo({ x, y, r, g, b, a, lab: rgbToLab(r, g, b) });
  }, [getOriginalData]);

  const handleDownload = useCallback((format) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageInfo) return;
    const name = imageInfo.fileName;
    if (format === 'png') downloadAsPNG(canvas, name);
    else if (format === 'jpg') downloadAsJPEG(canvas, name);
    else if (format === 'gb7') downloadAsGB7(canvas, name);
  }, [canvasRef, imageInfo]);

  const handleLevelsApply = useCallback((luts) => {
    // 1. Применяем LUT к полноразмерному изображению
    applyLevels(luts);

    // 2. Закрываем диалог (убирает LevelsDialog из DOM)
    setLevelsOpen(false);

    // 3. Получаем легковесную копию обновленного изображения для панели
    // Обновление происходит синхронно в одном батче рендера React без setTimeout
    const panelData = downsampleCanvas(canvasRef.current);
    setImageDataForPanel(panelData || getOriginalData());
  }, [applyLevels, getOriginalData]);

  return (
    <div className={styles.app}>
      <Toolbar
        onFileLoad={handleFileLoad} onDownload={handleDownload}
        hasImage={!!imageInfo} isLoading={isLoading}
        pipetteActive={pipetteActive}
        onPipetteToggle={() => { setPipetteActive(p => !p); setColorInfo(null); }}
        onLevelsOpen={() => setLevelsOpen(true)}
      />
      <div className={styles.workspace}>
        <CanvasArea canvasRef={canvasRef} hasImage={!!imageInfo} onDrop={handleFileLoad}
          isLoading={isLoading} pipetteActive={pipetteActive} onPipetteClick={handlePipetteClick}
          colorInfo={colorInfo} onColorInfoClose={() => setColorInfo(null)} />
        {imageInfo && (
          <ChannelPanel imageData={imageDataForPanel} descriptors={channelDescriptors}
            activeChannels={activeChannels} onToggle={handleChannelToggle} />
        )}
      </div>
      <StatusBar imageInfo={imageInfo} error={error} />
      {levelsOpen && (
        <LevelsDialog
          imageData={imageDataForPanel}
          onPreview={previewLevels}
          onApply={handleLevelsApply}
          onCancel={() => { previewLevels(null); setLevelsOpen(false); }}
        />
      )}
    </div>
  );
}