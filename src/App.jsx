import { useState, useCallback, useEffect } from 'react';
import Toolbar from './components/Toolbar';
import CanvasArea from './components/CanvasArea';
import ChannelPanel from './components/ChannelPanel';
import StatusBar from './components/StatusBar';
import { useCanvas } from './hooks/useCanvas';
import { loadImage } from './utils/imageLoader';
import { downloadAsPNG, downloadAsJPEG, downloadAsGB7 } from './utils/imageDownloader';
import { getChannelCount, getChannelDescriptors } from './utils/channelUtils';
import { rgbToLab } from './utils/colorUtils';
import styles from './App.module.css';

export default function App() {
  const { canvasRef, drawImage, clearCanvas, redrawWithChannels, getOriginalData } = useCanvas();
  const [imageInfo, setImageInfo] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Лаб 2: каналы
  const [channelDescriptors, setChannelDescriptors] = useState(null);
  const [activeChannels, setActiveChannels] = useState(new Set());
  const [channelCount, setChannelCount] = useState(0);

  // Лаб 2: пипетка
  const [pipetteActive, setPipetteActive] = useState(false);
  const [colorInfo, setColorInfo] = useState(null);

  const handleFileLoad = useCallback(async (file) => {
    setIsLoading(true);
    setError(null);
    setColorInfo(null);
    setPipetteActive(false);
    try {
      const result = await loadImage(file);
      drawImage(result.imageData);

      const count = getChannelCount(result.imageData);
      const descs = getChannelDescriptors(count);
      setChannelCount(count);
      setChannelDescriptors(descs);
      setActiveChannels(new Set(descs.map(d => d.id)));

      setImageInfo({
        fileName: result.fileName,
        format: result.format,
        width: result.width,
        height: result.height,
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

  const handleChannelToggle = useCallback((channelId) => {
    setActiveChannels(prev => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        // Убрали проверку if (next.size === 1) return prev; 
        // чтобы можно было отключать вообще все каналы
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
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
    const r = original.data[idx];
    const g = original.data[idx + 1];
    const b = original.data[idx + 2];
    const a = original.data[idx + 3];
    const lab = rgbToLab(r, g, b);
    setColorInfo({ x, y, r, g, b, a, lab });
  }, [getOriginalData]);

  const handleDownload = useCallback((format) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageInfo) return;
    const name = imageInfo.fileName;
    if (format === 'png') downloadAsPNG(canvas, name);
    else if (format === 'jpg') downloadAsJPEG(canvas, name);
    else if (format === 'gb7') downloadAsGB7(canvas, name);
  }, [canvasRef, imageInfo]);

  return (
    <div className={styles.app}>
      <Toolbar
        onFileLoad={handleFileLoad}
        onDownload={handleDownload}
        hasImage={!!imageInfo}
        isLoading={isLoading}
        pipetteActive={pipetteActive}
        onPipetteToggle={() => {
          setPipetteActive(p => !p);
          setColorInfo(null);
        }}
      />
      <div className={styles.workspace}>
        <CanvasArea
          canvasRef={canvasRef}
          hasImage={!!imageInfo}
          onDrop={handleFileLoad}
          isLoading={isLoading}
          pipetteActive={pipetteActive}
          onPipetteClick={handlePipetteClick}
          colorInfo={colorInfo}
          onColorInfoClose={() => setColorInfo(null)}
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
      <StatusBar imageInfo={imageInfo} error={error} />
    </div>
  );
}