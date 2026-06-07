import { useState, useEffect, useRef, useCallback } from 'react';
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

  const closeFnRef = useRef(() => onClose());

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (!dlg.open) dlg.showModal();
    const existHandler = e => { e.preventDefault(); closeFnRef.current(); };
    dlg.addEventListener('cancel', existHandler);
    return () => {
      dlg.removeEventListener('cancel', existHandler);
      if (dlg.open) dlg.close();
    };
  }, []);

  const getPxValues = () => (unit === 'px' ? { w: Number(widthVal), h: Number(heightVal) } : { w: Math.round(origW * Number(widthVal)/100), h: Math.round(origH * Number(heightVal)/100) });

  const { w: newW, h: newH } = getPxValues();
  const newMpx = (isFinite(newW * newH) && newW > 0 ? (newW * newH) / 1_000_000 : 0).toFixed(2);

  const chW = v => { setWidthVal(v); if(linked && origW && origH && +v) setHeightVal(unit==='px' ? String(Math.round(+v*origH/origW)) : v); setErrors({}); };
  const chH = v => { setHeightVal(v); if(linked && origW && origH && +v) setWidthVal(unit==='px' ? String(Math.round(+v*origW/origH)) : v); setErrors({}); };

  const handleApply = async () => {
    const nW=+widthVal, nH=+heightVal;
    if(isNaN(nW)||nW!==Math.floor(nW)||nW<1||(unit==='px'&&nW>16000)) return setErrors({width:'Неккоректно'});
    if(isNaN(nH)||nH!==Math.floor(nH)||nH<1||(unit==='px'&&nH>16000)) return setErrors({height:'Неккоректно'});
    setIsProcessing(true);
    const { w, h } = getPxValues();
    try {
      await onApply(w, h, method);
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  return (
    <dialog ref={dialogRef} className={styles.dialog}>
      <div className={styles.header}>
        <span className={styles.title}>Изменение размера</span>
        <button className={styles.closeBtn} onClick={() => onClose()} disabled={isProcessing}>✕</button>
      </div>

      <div className={styles.body}>
        <div className={styles.mpxRow}>
          <div className={styles.mpxBox}><span>До</span> <strong>{origMpx} Мп</strong></div>
          <div className={styles.mpxBox}><span>После</span> <strong>{newMpx} Мп</strong></div>
        </div>

        <div className={styles.row}>
          <label htmlFor="rz_unit" className={styles.label}>Единицы</label>
          <select id="rz_unit" className={styles.select} value={unit} disabled={isProcessing} onChange={e => { const nv = e.target.value; if(nv!==unit){ setWidthVal(nv==='%'?'100':String(origW)); setHeightVal(nv==='%'?'100':String(origH)); } setUnit(nv);}}>
            <option value="px">Пиксели</option><option value="%">Проценты</option>
          </select>
        </div>

        <div className={styles.row}>
          <label htmlFor="rz_wid" className={styles.label}>Ширина</label>
          <input id="rz_wid" type="number" min="1" className={styles.input} disabled={isProcessing} value={widthVal} onChange={e=>chW(e.target.value)} />
        </div>

        <div className={styles.row}>
          <label htmlFor="rz_hgt" className={styles.label}>Высота</label>
          <input id="rz_hgt" type="number" min="1" className={styles.input} disabled={isProcessing} value={heightVal} onChange={e=>chH(e.target.value)} />
        </div>

        <div className={styles.row}>
          <label htmlFor="rz_lk" className={styles.checkLabel} style={{ marginLeft: 120 }}>
            <input id="rz_lk" type="checkbox" checked={linked} onChange={e=>setLinked(e.target.checked)} disabled={isProcessing} /> Сохранять пропорции
          </label>
        </div>

        <div className={styles.row}>
          <label htmlFor="rz_mt" className={styles.label}>Метод</label>
          <select id="rz_mt" className={styles.select} value={method} onChange={e=>setMethod(e.target.value)} disabled={isProcessing}>
            {Object.values(INTERPOLATION_METHODS).map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.btnCancel} onClick={()=>onClose()} disabled={isProcessing}>Отмена</button>
        <button className={styles.btnApply} onClick={handleApply} disabled={isProcessing}>{isProcessing?'Wait':'Применить'}</button>
      </div>
    </dialog>
  );
}