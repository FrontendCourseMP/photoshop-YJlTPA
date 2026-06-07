import styles from './CanvasArea.module.css';

export default function CanvasArea({ canvasRef, hasImage, onDrop, isLoading }) {
  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && onDrop) onDrop(file);
  };

  return (
    <div className={styles.area} onDragOver={handleDragOver} onDrop={handleDrop}>
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
        className={styles.canvas}
        style={{ display: hasImage ? 'block' : 'none' }}
      />
    </div>
  );
}