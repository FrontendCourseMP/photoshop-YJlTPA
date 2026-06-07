import { useRef } from 'react';
import styles from './Toolbar.module.css';

const ACCEPT = '.png,.jpg,.jpeg,.gb7';

export default function Toolbar({ onFileLoad, onDownload, hasImage, isLoading, pipetteActive, onPipetteToggle, onLevelsOpen, onResizeOpen }) {
  const inputRef = useRef(null);
  const handleBrowse = () => inputRef.current?.click();
  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) { onFileLoad(file); e.target.value = ''; }
  };

  return (
    <div className={styles.toolbar}>
      <div className={styles.brand}>
        <div className={styles.brandMark}><div className={styles.brandMarkInner} /></div>
        <div>
          <div className={styles.brandName}>PhotoLab</div>
          <div className={styles.brandSub}>Лаб. работа №4</div>
        </div>
      </div>
      <div className={styles.divider} />
      <div className={styles.group}>
        <span className={styles.groupLabel}>Открыть</span>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleBrowse} disabled={isLoading}>
          {isLoading ? 'Загрузка...' : '+ Файл'}
        </button>
        <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleChange} style={{ display: 'none' }} />
      </div>
      <div className={styles.divider} />
      <div className={styles.group}>
        <span className={styles.groupLabel}>Инструменты</span>
        <button
          className={`${styles.btn} ${pipetteActive ? styles.btnActive : ''}`}
          onClick={onPipetteToggle}
          disabled={!hasImage || isLoading}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"
            style={{ marginRight: 5, verticalAlign: 'middle', display: 'inline-block' }}>
            <path d="M9.5 1.5 L12.5 4.5 L5 12 L2 12 L2 9 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
            <path d="M7.5 3.5 L10.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Пипетка
        </button>
        <button className={styles.btn} onClick={onLevelsOpen} disabled={!hasImage || isLoading}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"
            style={{ marginRight: 5, verticalAlign: 'middle', display: 'inline-block' }}>
            <rect x="1" y="8" width="3" height="5" rx="1" fill="currentColor" opacity="0.5"/>
            <rect x="5.5" y="4" width="3" height="9" rx="1" fill="currentColor" opacity="0.75"/>
            <rect x="10" y="1" width="3" height="12" rx="1" fill="currentColor"/>
          </svg>
          Уровни
        </button>
        <button className={styles.btn} onClick={onResizeOpen} disabled={!hasImage || isLoading}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"
            style={{ marginRight: 5, verticalAlign: 'middle', display: 'inline-block' }}>
            <path d="M2 6 L2 2 L6 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M12 8 L12 12 L8 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M2 2 L12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Размер
        </button>
      </div>
      <div className={styles.divider} />
      <div className={styles.group}>
        <span className={styles.groupLabel}>Сохранить как</span>
        <button className={styles.btn} onClick={() => onDownload('png')} disabled={!hasImage || isLoading}>PNG</button>
        <button className={styles.btn} onClick={() => onDownload('jpg')} disabled={!hasImage || isLoading}>JPG</button>
        <button className={`${styles.btn} ${styles.btnAccent}`} onClick={() => onDownload('gb7')} disabled={!hasImage || isLoading}>GB7</button>
      </div>
    </div>
  );
}