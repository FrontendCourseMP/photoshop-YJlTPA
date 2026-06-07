import { useRef } from 'react';
import styles from './Toolbar.module.css';

const ACCEPT = '.png,.jpg,.jpeg,.gb7';

export default function Toolbar({ onFileLoad, onDownload, hasImage, isLoading }) {
  const inputRef = useRef(null);

  const handleBrowse = () => inputRef.current?.click();

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) { onFileLoad(file); e.target.value = ''; }
  };

  return (
    <div className={styles.toolbar}>
      <div className={styles.brand}>
        <div className={styles.brandMark}>
          <div className={styles.brandMarkInner} />
        </div>
        <div>
          <div className={styles.brandName}>PhotoLab</div>
          <div className={styles.brandSub}>Photoshop</div>
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <span className={styles.groupLabel}>Открыть</span>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleBrowse}
          disabled={isLoading}
        >
          {isLoading ? 'Загрузка...' : '+ Файл'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleChange}
          style={{ display: 'none' }}
        />
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <span className={styles.groupLabel}>Сохранить как</span>
        <button
          className={styles.btn}
          onClick={() => onDownload('png')}
          disabled={!hasImage || isLoading}
        >
          PNG
        </button>
        <button
          className={styles.btn}
          onClick={() => onDownload('jpg')}
          disabled={!hasImage || isLoading}
        >
          JPG
        </button>
        <button
          className={`${styles.btn} ${styles.btnAccent}`}
          onClick={() => onDownload('gb7')}
          disabled={!hasImage || isLoading}
        >
          GB7
        </button>
      </div>
    </div>
  );
}