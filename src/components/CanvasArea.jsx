import { forwardRef, useCallback, useEffect } from 'react';
import ColorInfo from './ColorInfo';
import { clampScale, SCALE_PRESETS } from '../utils/scaleUtils';
import styles from './CanvasArea.module.css';

const CanvasArea = forwardRef(function CanvasArea({
  canvasRef,
  hasImage,
  onDrop,
  isLoading,
  pipetteActive,
  onPipetteClick,
  colorInfo,
  onColorInfoClose,
  scale,         // масштаб в % (например 50, 100, 200)
  onScaleChange, // колбэк для Ctrl+колесо
}, ref) {
  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && onDrop) onDrop(file);
  };

  const handleCanvasClick = (e) => {
    if (!pipetteActive || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // CSS-пиксели → координаты в оригинальном изображении
    // canvas.width = origWidth * (scale/100)
    // origX = (cssX / rect.width) * canvas.width / (scale/100)
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    const origX = Math.floor((cssX / rect.width) * canvas.width / ((scale ?? 100) / 100));
    const origY = Math.floor((cssY / rect.height) * canvas.height / ((scale ?? 100) / 100));

    onPipetteClick(origX, origY);
  };

  // Ctrl + колесо мыши → масштаб
  const handleWheel = useCallback((e) => {
    if (!e.ctrlKey || !onScaleChange) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    if (delta > 0) {
      const next = SCALE_PRESETS.find(p => p > scale);
      if (next !== undefined) onScaleChange(next);
    } else {
      const next = [...SCALE_PRESETS].reverse().find(p => p < scale);
      if (next !== undefined) onScaleChange(next);
    }
  }, [scale, onScaleChange]);

  // passive: false нужен чтобы можно было e.preventDefault()
  useEffect(() => {
    const el = ref && typeof ref === 'object' ? ref.current : null;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [ref, handleWheel]);

  return (
    <div
      ref={ref}
      className={styles.area}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {!hasImage && !isLoading && (
        <div className={styles.placeholder}>
          <div className={styles.placeholderBox}>
            <div className={styles.placeholderIcon}>
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                <rect x="3" y="3" width="46" height="46" rx="8"
                  stroke="#888" strokeWidth="1.5" strokeDasharray="5 3" />
                <path d="M26 16v20M16 26h20"
                  stroke="#888" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <p className={styles.placeholderTitle}>Перетащите файл сюда</p>
            <p className={styles.placeholderSub}>или нажмите «+ Файл» в панели выше</p>
            <div className={styles.placeholderFormats}>
              <span className={styles.tag}>PNG</span>
              <span className={styles.tag}>JPG</span>
              <span className={`${styles.tag} ${styles.tagAccent}`}>GB7</span>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className={styles.placeholder}>
          <div className={styles.placeholderBox}>
            <div className={styles.spinner} />
            <p className={styles.placeholderSub}>Обработка файла...</p>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className={`${styles.canvas} ${pipetteActive ? styles.canvasPipette : ''}`}
        style={{ display: hasImage ? 'block' : 'none' }}
        onClick={handleCanvasClick}
      />

      {colorInfo && (
        <ColorInfo info={colorInfo} onClose={onColorInfoClose} />
      )}
    </div>
  );
});

export default CanvasArea;