import ColorInfo from './ColorInfo';
import styles from './CanvasArea.module.css';

export default function CanvasArea({
  canvasRef,
  hasImage,
  onDrop,
  isLoading,
  pipetteActive,
  onPipetteClick,
  colorInfo,
  onColorInfoClose,
}) {
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

    // Пересчёт координат клика с учётом масштабирования canvas через CSS
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const cx = Math.max(0, Math.min(x, canvas.width - 1));
    const cy = Math.max(0, Math.min(y, canvas.height - 1));

    onPipetteClick(cx, cy);
  };

  return (
    <div
      className={styles.area}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {!hasImage && !isLoading && (
        <div className={styles.placeholder}>
          <div className={styles.placeholderBox}>
            <div className={styles.placeholderIcon}>
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                <rect
                  x="3" y="3" width="46" height="46" rx="8"
                  stroke="#888" strokeWidth="1.5" strokeDasharray="5 3"
                />
                <path
                  d="M26 16v20M16 26h20"
                  stroke="#888" strokeWidth="2" strokeLinecap="round"
                />
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
}