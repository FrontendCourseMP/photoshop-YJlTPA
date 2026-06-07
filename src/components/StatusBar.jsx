import styles from './StatusBar.module.css';

export default function StatusBar({ imageInfo, error }) {
  if (error) {
    return (
      <div className={`${styles.bar} ${styles.barError}`}>
        <span className={styles.errorIcon}>✕</span>
        <span>{error}</span>
      </div>
    );
  }

  if (!imageInfo) {
    return (
      <div className={styles.bar}>
        <span className={styles.hint}>Откройте файл для начала работы</span>
      </div>
    );
  }

  const { fileName, format, width, height, colorDepth } = imageInfo;

  return (
    <div className={styles.bar}>
      <span className={styles.item}>
        <span className={styles.label}>файл</span>
        {fileName}
      </span>
      <span className={styles.sep} />
      <span className={styles.item}>
        <span className={styles.label}>формат</span>
        <span className={styles.badge}>{format}</span>
      </span>
      <span className={styles.sep} />
      <span className={styles.item}>
        <span className={styles.label}>размер</span>
        {width} × {height} пкс
      </span>
      <span className={styles.sep} />
      <span className={styles.item}>
        <span className={styles.label}>глубина цвета</span>
        {colorDepth}
      </span>
      <span className={styles.sep} />
      <span className={styles.item}>
        <span className={styles.label}>мегапикселей</span>
        {(width * height / 1_000_000).toFixed(2)} Мп
      </span>
    </div>
  );
}