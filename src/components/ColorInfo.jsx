import styles from './ColorInfo.module.css';

export default function ColorInfo({ info, onClose }) {
  if (!info) return null;

  const { x, y, r, g, b, a, lab } = info;

  const toHex = (v) => v.toString(16).padStart(2, '0').toUpperCase();
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

  return (
    <div className={styles.popup}>
      <div className={styles.header}>
        <span className={styles.title}>Пипетка</span>
        <button className={styles.close} onClick={onClose} title="Закрыть">✕</button>
      </div>

      <div className={styles.swatchWrap}>
        <div
          className={styles.colorSwatch}
          style={{ backgroundColor: `rgba(${r},${g},${b},${(a / 255).toFixed(2)})` }}
        />
      </div>

      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.label}>Позиция</span>
          <span className={styles.value}>X: {x}, Y: {y}</span>
        </div>
        <div className={styles.sep} />
        <div className={styles.row}>
          <span className={styles.label}>R</span>
          <span className={styles.value}>{r}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>G</span>
          <span className={styles.value}>{g}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>B</span>
          <span className={styles.value}>{b}</span>
        </div>
        {a < 255 && (
          <div className={styles.row}>
            <span className={styles.label}>A</span>
            <span className={styles.value}>{a}</span>
          </div>
        )}
        <div className={styles.row}>
          <span className={styles.label}>HEX</span>
          <span className={`${styles.value} ${styles.mono}`}>{hex}</span>
        </div>
        <div className={styles.sep} />
        <div className={styles.row}>
          <span className={styles.label}>CIE L*</span>
          <span className={styles.value}>{lab.L.toFixed(1)}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>CIE a*</span>
          <span className={styles.value}>{lab.a.toFixed(1)}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>CIE b*</span>
          <span className={styles.value}>{lab.b.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}