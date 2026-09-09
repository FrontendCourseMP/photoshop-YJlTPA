import { useState, useEffect, useRef } from 'react';
import { INTERPOLATION_METHODS } from '../utils/interpolation';
import styles from './ResizeDialog.module.css';

export default function ResizeDialog({ imageData, onApply, onClose }) {
  const dialogRef = useRef(null);

  const origW = imageData?.width ?? 0;
  const origH = imageData?.height ?? 0;
  const origMpx = ((origW * origH) / 1_000_000).toFixed(2);

  const [unit, setUnit] = useState('px');
  const [widthVal, setWidthVal] = useState(String(origW));
  const [heightVal, setHeightVal] = useState(String(origH));
  const [linked, setLinked] = useState(true);
  const [method, setMethod] = useState('bilinear');
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Перетаскивание (Draggable)
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialPosX: 0, initialPosY: 0 });

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (!dlg.open) {
      dlg.showModal();
    }
    const existHandler = (e) => {
      e.preventDefault();
      onClose();
    };
    dlg.addEventListener('cancel', existHandler);
    return () => {
      dlg.removeEventListener('cancel', existHandler);
      if (dlg.open) dlg.close();
    };
  }, [onClose]);

  const handleMouseDownHeader = (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPosX: pos.x,
      initialPosY: pos.y,
    };

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const dy = moveEvent.clientY - dragStartRef.current.startY;
      setPos({
        x: dragStartRef.current.initialPosX + dx,
        y: dragStartRef.current.initialPosY + dy,
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const getPxValues = () => (
    unit === 'px'
      ? { w: Number(widthVal), h: Number(heightVal) }
      : { w: Math.round(origW * Number(widthVal) / 100), h: Math.round(origH * Number(heightVal) / 100) }
  );

  const { w: newW, h: newH } = getPxValues();
  const newMpx = (isFinite(newW * newH) && newW > 0 ? (newW * newH) / 1_000_000 : 0).toFixed(2);

  const chW = (v) => {
    setWidthVal(v);
    if (linked && origW && origH && +v) {
      setHeightVal(unit === 'px' ? String(Math.round(+v * origH / origW)) : v);
    }
    setErrorMsg('');
  };

  const chH = (v) => {
    setHeightVal(v);
    if (linked && origW && origH && +v) {
      setWidthVal(unit === 'px' ? String(Math.round(+v * origW / origH)) : v);
    }
    setErrorMsg('');
  };

  const handleApply = async () => {
    const { w, h } = getPxValues();
    if (isNaN(w) || w !== Math.floor(w) || w < 1 || w > 16000) {
      setErrorMsg('Некорректная ширина (1-16000 px)');
      return;
    }
    if (isNaN(h) || h !== Math.floor(h) || h < 1 || h > 16000) {
      setErrorMsg('Некорректная высота (1-16000 px)');
      return;
    }
    setIsProcessing(true);
    try {
      await onApply(w, h, method);
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
    >
      <div
        className={styles.header}
        onMouseDown={handleMouseDownHeader}
        title="Зажмите для перетаскивания окна"
      >
        <div className={styles.headerTitleWrap}>
          <span className={styles.dragIcon}>⠿</span>
          <span className={styles.title}>Изменение размера</span>
        </div>
        <button className={styles.closeBtn} onClick={() => onClose()} disabled={isProcessing}>✕</button>
      </div>

      <div className={styles.body}>
        <div className={styles.mpxRow}>
          <div className={styles.mpxBox}>
            <span className={styles.mpxLabel}>До</span>
            <span className={styles.mpxValue}>{origMpx} Мп</span>
          </div>
          <span className={styles.mpxArrow}>→</span>
          <div className={styles.mpxBox}>
            <span className={styles.mpxLabel}>После</span>
            <span className={styles.mpxValue}>{newMpx} Мп</span>
          </div>
        </div>

        <div className={styles.row}>
          <label htmlFor="rz_unit" className={styles.label}>Единицы</label>
          <select
            id="rz_unit"
            className={styles.select}
            value={unit}
            disabled={isProcessing}
            onChange={(e) => {
              const nv = e.target.value;
              if (nv !== unit) {
                setWidthVal(nv === '%' ? '100' : String(origW));
                setHeightVal(nv === '%' ? '100' : String(origH));
              }
              setUnit(nv);
            }}
          >
            <option value="px">Пиксели</option>
            <option value="%">Проценты</option>
          </select>
        </div>

        <div className={styles.row}>
          <label htmlFor="rz_wid" className={styles.label}>Ширина</label>
          <div className={styles.inputWrap}>
            <input
              id="rz_wid"
              type="number"
              min="1"
              className={`${styles.input} ${errorMsg ? styles.inputError : ''}`}
              disabled={isProcessing}
              value={widthVal}
              onChange={(e) => chW(e.target.value)}
            />
            <span className={styles.unit}>{unit}</span>
          </div>
        </div>

        <div className={styles.row}>
          <label htmlFor="rz_hgt" className={styles.label}>Высота</label>
          <div className={styles.inputWrap}>
            <input
              id="rz_hgt"
              type="number"
              min="1"
              className={`${styles.input} ${errorMsg ? styles.inputError : ''}`}
              disabled={isProcessing}
              value={heightVal}
              onChange={(e) => chH(e.target.value)}
            />
            <span className={styles.unit}>{unit}</span>
          </div>
        </div>

        {errorMsg && <div className={styles.error}>{errorMsg}</div>}

        <div className={styles.row}>
          <label htmlFor="rz_lk" className={styles.checkLabel} style={{ marginLeft: 110 }}>
            <input
              id="rz_lk"
              type="checkbox"
              checked={linked}
              onChange={(e) => setLinked(e.target.checked)}
              disabled={isProcessing}
            />
            Сохранять пропорции
          </label>
        </div>

        <div className={styles.row}>
          <label htmlFor="rz_mt" className={styles.label}>Метод</label>
          <div className={styles.interpolationWrap}>
            <select
              id="rz_mt"
              className={styles.select}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              disabled={isProcessing}
            >
              {Object.values(INTERPOLATION_METHODS).map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <span className={styles.tooltip} title={INTERPOLATION_METHODS[method]?.tooltip}>
              ⓘ
              <span className={styles.tooltipText}>{INTERPOLATION_METHODS[method]?.tooltip}</span>
            </span>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.btnCancel} onClick={() => onClose()} disabled={isProcessing}>Отмена</button>
        <button className={styles.btnApply} onClick={handleApply} disabled={isProcessing}>
          {isProcessing ? <span className={styles.spinner} /> : 'Применить'}
        </button>
      </div>
    </dialog>
  );
}