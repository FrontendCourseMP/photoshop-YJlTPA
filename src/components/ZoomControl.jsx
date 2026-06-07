import styles from './ZoomControl.module.css';

const PRESETS = [12, 25, 33, 50, 67, 75, 100, 150, 200, 300];

export default function ZoomControl({ zoom, onChange, disabled }) {
  const pct = Math.round(zoom * 100);

  const handleSelect = (e) => {
    onChange(Number(e.target.value) / 100);
  };

  const handleRange = (e) => {
    // range: 0–100 → zoom 0.12–3.0 (логарифмическая шкала для удобства)
    const t = Number(e.target.value) / 100;
    const raw = 0.12 * Math.pow(3.0 / 0.12, t);
    onChange(Math.round(raw * 100) / 100);
  };

  // Перевод zoom обратно в позицию range
  const rangeVal = Math.round(
    (Math.log(zoom / 0.12) / Math.log(3.0 / 0.12)) * 100
  );

  return (
    <div className={styles.wrap}>
      <select
        className={styles.select}
        value={PRESETS.includes(pct) ? pct : ''}
        onChange={handleSelect}
        disabled={disabled}
      >
        {!PRESETS.includes(pct) && (
          <option value="">{pct}%</option>
        )}
        {PRESETS.map(p => (
          <option key={p} value={p}>{p}%</option>
        ))}
      </select>
      <input
        className={styles.range}
        type="range"
        min={0}
        max={100}
        value={rangeVal}
        onChange={handleRange}
        disabled={disabled}
      />
      <span className={styles.label}>{pct}%</span>
    </div>
  );
}