import { useState, useEffect, useRef } from 'react';
import { INTERPOLATION_METHODS } from '../utils/interpolation';
import styles from './ResizeDialog.module.css';

export default function ResizeDialog({ imageData, onApply, onClose }) {
  const dialogRef = useRef(null);

  const origW   = imageData?.width  ?? 0;
  const origH   = imageData?.height ?? 0;
  const origMpx = ((origW * origH) / 1_000_000).toFixed(2);

  const [unit,         setUnit]         = useState('px');
  const [widthVal,     setWidthVal]     = useState(String(origW));
  const [heightVal,    setHeightVal]    = useState(String(origH));
  const [linked,       setLinked]       = useState(true);
  const [method,       setMethod]       = useState('bilinear');
  const [errors,       setErrors]       = useState({});
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => { dialogRef.current?.showModal(); }, []);

  const handleUnitChange = (e) => {
    const newUnit = e.target.value;
    if (newUnit === '%' && unit === 'px') { setWidthVal('100'); setHeightVal('100'); }
    else if (newUnit === 'px' && unit === '%') { setWidthVal(String(origW)); setHeightVal(String(origH)); }
    setUnit(newUnit);
    setErrors({});
  };

  const getPxValues = () => {
    if (unit === 'px') return { w: Number(widthVal), h: Number(heightVal) };
    return {
      w: Math.round(origW * Number(widthVal)  / 100),
      h: Math.round(origH * Number(heightVal) / 100),
    };
  };

  const { w: newW, h: newH } = getPxValues();
  const newMpx = (isFinite(newW * newH) && newW > 0 ? (newW * newH) / 1_000_000 : 0).toFixed(2);

  const handleWidthChange = (val) => {
    setWidthVal(val);
    if (linked && origW && origH) {
      const num = Number(val);
      if (!isNaN(num) && num > 0)
        setHeightVal(unit === 'px' ? String(Math.round(num * origH / origW)) : val);
    }
    setErrors(e => ({ ...e, width: null }));
  };

  const handleHeightChange = (val) => {
    setHeightVal(val);
    if (linked && origW && origH) {
      const num = Number(val);
      if (!isNaN(num) && num > 0)
        setWidthVal(unit === 'px' ? String(Math.round(num * origW / origH)) : val);
    }
    setErrors(e => ({ ...e, height: null }));
  };

  const validate = () => {
    const errs = {};
    const wNum = Number(widthVal);
    const hNum = Number(heightVal);
    if (!widthVal || isNaN(wNum) || wNum !== Math.floor(wNum))
      errs.width = 'Введите целое число';
    else if (unit === 'px' && (wNum < 1 || wNum > 16000))
      errs.width = 'От 1 до 16000 px';
    else if (unit === '%' && (wNum < 1 || wNum > 1000))
      errs.width = 'От 1% до 1000%';

    if (!heightVal || isNaN(hNum) || hNum !== Math.floor(hNum))
      errs.height = 'Введите целое число';
    else if (unit === 'px' && (hNum < 1 || hNum > 16000))
      errs.height = 'От 1 до 16000 px';
    else if (unit === '%' && (hNum < 1 || hNum > 1000))
      errs.height = 'От 1% до 1000%';
    return errs;
  };

  const handleApply = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const { w, h } = getPxValues();
    setIsProcessing(true);
    try {
      // onApply возвращает Promise (async в App.jsx)
      await onApply(w, h, method);
      dialogRef.current?.close();
      onClose();
    } catch (err) {
      console.error('Resize error:', err);
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    if (isProcessing) return;
    dialogRef.current?.close();
    onClose();
  };

  const methodList = Object.values(INTERPOLATION_METHODS);

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={handleCancel}>
      <div className={styles.header}>
        <span className={styles.title}>Изменение размера</span>
        <button className={styles.closeBtn} onClick={handleCancel} disabled={isProcessing}>✕</button>
      </div>

      <div className={styles.body}>
        <div className={styles.mpxRow}>
          <div className={styles.mpxBox}>
            <span className={styles.mpxLabel}>До</span>
            <span className={styles.mpxValue}>{origMpx} Мпкс</span>
            <span className={styles.mpxSub}>{origW} × {origH}</span>
          </div>
          <div className={styles.mpxArrow}>→</div>
          <div className={styles.mpxBox}>
            <span className={styles.mpxLabel}>После</span>
            <span className={styles.mpxValue}>{newMpx} Мпкс</span>
            <span className={styles.mpxSub}>
              {isFinite(newW) && newW > 0 ? `${newW} × ${newH}` : '—'}
            </span>
          </div>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Единицы</label>
          <select className={styles.select} value={unit} onChange={handleUnitChange} disabled={isProcessing}>
            <option value="px">Пиксели</option>
            <option value="%">Проценты</option>
          </select>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Ширина</label>
          <div className={styles.inputWrap}>
            <input className={`${styles.input} ${errors.width ? styles.inputError : ''}`}
              type="number" value={widthVal} min={1} disabled={isProcessing}
              onChange={e => handleWidthChange(e.target.value)} />
            <span className={styles.unit}>{unit}</span>
          </div>
          {errors.width && <span className={styles.error}>{errors.width}</span>}
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Высота</label>
          <div className={styles.inputWrap}>
            <input className={`${styles.input} ${errors.height ? styles.inputError : ''}`}
              type="number" value={heightVal} min={1} disabled={isProcessing}
              onChange={e => handleHeightChange(e.target.value)} />
            <span className={styles.unit}>{unit}</span>
          </div>
          {errors.height && <span className={styles.error}>{errors.height}</span>}
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Пропорции</label>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={linked} disabled={isProcessing}
              onChange={e => setLinked(e.target.checked)} />
            Сохранять соотношение сторон
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Интерполяция</label>
          <div className={styles.interpolationWrap}>
            <select className={styles.select} value={method} disabled={isProcessing}
              onChange={e => setMethod(e.target.value)}>
              {methodList.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <div className={styles.tooltip}>
              ℹ️
              <span className={styles.tooltipText}>{INTERPOLATION_METHODS[method]?.tooltip}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        {isProcessing && <span className={styles.processingText}>Обработка в фоне…</span>}
        <button className={styles.btnCancel} onClick={handleCancel} disabled={isProcessing}>Отмена</button>
        <button className={styles.btnApply}  onClick={handleApply}  disabled={isProcessing}>
          {isProcessing ? <span className={styles.spinner} /> : 'Применить'}
        </button>
      </div>
    </dialog>
  );
}