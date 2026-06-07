import { useState, useCallback } from 'react';
import Toolbar from './components/Toolbar';
import CanvasArea from './components/CanvasArea';
import StatusBar from './components/StatusBar';
import { useCanvas } from './hooks/useCanvas';
import { loadImage } from './utils/imageLoader';
import { downloadAsPNG, downloadAsJPEG, downloadAsGB7 } from './utils/imageDownloader';
import styles from './App.module.css';

export default function App() {
  const { canvasRef, drawImage, clearCanvas } = useCanvas();
  const [imageInfo, setImageInfo] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileLoad = useCallback(async (file) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await loadImage(file);
      drawImage(result.imageData);
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
    } finally {
      setIsLoading(false);
    }
  }, [drawImage, clearCanvas]);

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
      />
      <CanvasArea
        canvasRef={canvasRef}
        hasImage={!!imageInfo}
        onDrop={handleFileLoad}
        isLoading={isLoading}
      />
      <StatusBar imageInfo={imageInfo} error={error} />
    </div>
  );
}