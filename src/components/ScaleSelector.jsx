import { useRef } from 'react';
import { SCALE_MIN, SCALE_MAX, SCALE_PRESETS, clampScale } from '../utils/scaleUtils';
import styles from './ScaleSelector.module.css';

export default function ScaleSelector({ scale, onChange, disabled }) {
  const rafRef = useRef(null);

  const handleSelect = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) onChange(val);
  };

  const handleRange = (e) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      onChange(val);
    });
  };

  const handleMinus = () => {
    const next = [...SCALE_PRESETS].reverse().find(p => p < scale);
    onChange(clampScale(next !== undefined ? next : scale - 10));
  };

  const handlePlus = () => {
    const next = SCALE_PRESETS.find(p => p > scale);
    onChange(clampScale(next !== undefined ? next : scale + 10));
  };

  const isPreset = SCALE_PRESETS.includes(scale);

  return (
    <div className={styles.wrap}>
      <label className={styles.label}>Масштаб</label>

      <button className={styles.stepBtn} onClick={handleMinus}
        disabled={disabled || scale <= SCALE_MIN} title="Уменьшить масштаб">−</button>

      <select className={styles.select} value={isPreset ? scale : ''}
        onChange={handleSelect} disabled={disabled}>
        {!isPreset && <option value="">—</option>}
        {SCALE_PRESETS.map(p => <option key={p} value={p}>{p}%</option>)}
      </select>

      <input type="range" className={styles.range}
        min={SCALE_MIN} max={SCALE_MAX} value={scale}
        onChange={handleRange} disabled={disabled} />

      <button className={styles.stepBtn} onClick={handlePlus}
        disabled={disabled || scale >= SCALE_MAX} title="Увеличить масштаб">+</button>

      <span className={styles.value}>{scale}%</span>
    </div>
  );
}