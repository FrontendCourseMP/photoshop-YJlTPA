import { useEffect, useRef, useState, useCallback } from 'react';
import { buildAllLUTs, defaultLevelsParams }        from '../utils/levelsUtils';
import { buildHistogramsAsync }                     from '../utils/workerHistogram';
import styles from './LevelsDialog.module.css';

const CHANNELS = [
  { id: 'master', label: 'Master (RGB)' },
  { id: 'r',      label: 'Red' },
  { id: 'g',      label: 'Green' },
  { id: 'b',      label: 'Blue' },
  { id: 'alpha',  label: 'Alpha' },
];

function initParams() {
  const d = defaultLevelsParams();
  return { master: {...d}, r: {...d}, g: {...d}, b: {...d}, alpha: {...d} };
}

function drawHistogram(canvas, hist, logScale, channelId) {
  const ctx = canvas.getContext('2d');
  const W   = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, W, H);

  let maxRaw = 0;
  for (let i = 1; i < 255; i++) if (hist[i] > maxRaw) maxRaw = hist[i];
  if (maxRaw === 0) maxRaw = Math.max(...hist);
  if (maxRaw === 0) return;

  const maxVal = logScale ? Math.log1p(maxRaw) : maxRaw;
  const cMap = { r: 'rgba(224, 85, 85, 0.75)', g: 'rgba(61, 154, 80, 0.75)', b: 'rgba(37, 99, 190, 0.75)', alpha: 'rgba(170, 170, 170, 0.6)', master: 'rgba(200, 200, 200, 0.65)' };
  
  ctx.fillStyle = cMap[channelId] || cMap.master;
  ctx.beginPath();
  ctx.moveTo(0, H);
  
  for (let i = 0; i < 256; i++) {
    const val = logScale ? Math.log1p(hist[i]) : hist[i];
    const norm = Math.min(1, val / maxVal);
    ctx.lineTo(i * (W / 255), H - norm * (H - 4));
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
}

export default function LevelsDialog({ imageData, onApply, onCancel, onPreview }) {
  const [channel,  setChannel]  = useState('master');
  const [params,   setParams]   = useState(initParams);
  const [logScale, setLogScale] = useState(false);
  const [preview,  setPreview]  = useState(true);

  const histCanvasRef = useRef(null);
  const rafPreviewRef = useRef(null);
  const dialogRef     = useRef(null);
  
  const handleCancelRef = useRef(() => {}); // Хранитель безопасного метода

  // Безопасное подключение чисто через React Component Tree Unmounting
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (!dlg.open) dlg.showModal();

    // Браузер генерит событие 'cancel' при нажатии "Escape". Ловим и обрубаем на наш cancel.
    const cancelEvt = (e) => { e.preventDefault(); handleCancelRef.current(); };
    dlg.addEventListener('cancel', cancelEvt);

    return () => {
      dlg.removeEventListener('cancel', cancelEvt);
      // Авто-деструкция HTML элемента если App.js поменял state "уже не отображать этот блок".
      if (dlg.open) dlg.close();
    };
  }, []);

  useEffect(() => {
    if (!imageData) return;
    buildHistogramsAsync(imageData).then(hists => {
      if (histCanvasRef.current) drawHistogram(histCanvasRef.current, hists[channel], logScale, channel);
    });
  }, [imageData, channel, logScale]);

  const schedulePreview = useCallback((p, isPrevOn) => {
    if (!isPrevOn) return;
    if (rafPreviewRef.current) cancelAnimationFrame(rafPreviewRef.current);
    rafPreviewRef.current = requestAnimationFrame(() => {
      onPreview(buildAllLUTs(p));
      rafPreviewRef.current = null;
    });
  }, [onPreview]);

  useEffect(() => {
    if (!preview) onPreview(null);
    else schedulePreview(params, true);
    return () => rafPreviewRef.current && cancelAnimationFrame(rafPreviewRef.current);
  }, [params, preview, schedulePreview, onPreview]);

  const setChParam = useCallback((k, v) => setParams(prev => {
    const ch = { ...prev[channel] };
    if (k === 'inBlack') ch.inBlack = Math.min(v, ch.inWhite - 1);
    else if (k === 'inWhite') ch.inWhite = Math.max(v, ch.inBlack + 1);
    else ch[k] = v;
    return { ...prev, [channel]: ch };
  }), [channel]);

  // Главная связка Cancel Ref
  handleCancelRef.current = useCallback(() => {
    if (rafPreviewRef.current) cancelAnimationFrame(rafPreviewRef.current);
    onPreview(null);
    onCancel();
  }, [onPreview, onCancel]);

  const handleApplyClick = useCallback(() => {
    if (rafPreviewRef.current) cancelAnimationFrame(rafPreviewRef.current);
    onApply(buildAllLUTs(params)); // Закроется уже от родительского React state false
  }, [onApply, params]);

  const cur = params[channel];

  return (
    <dialog ref={dialogRef} className={styles.dialog}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.title}>Уровни (Levels)</span>
          <button className={styles.closeBtn} onClick={handleCancelRef.current}>×</button>
        </div>

        <div className={styles.row}>
          <label htmlFor="chSel" className={styles.label}>Канал</label>
          <select id="chSel" className={styles.select} value={channel} onChange={e => setChannel(e.target.value)}>
            {CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        <div className={styles.histWrap}><canvas ref={histCanvasRef} className={styles.histCanvas} width={256} height={100} /></div>

        <div className={styles.scaleRow}>
          <label htmlFor="logScaleId" className={styles.checkLabel}>
            <input id="logScaleId" type="checkbox" checked={logScale} onChange={e => setLogScale(e.target.checked)} /> Логарифмическая шкала
          </label>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Входные уровни</div>
          <TripleSlider black={cur.inBlack} white={cur.inWhite} gamma={cur.gamma} onChange={setChParam} />
          
          <div className={styles.inputRow}>
            <div className={styles.inputGroup}>
              <label htmlFor="num-blk" className={styles.inputLabel}>Чёрная</label>
              <input id="num-blk" type="number" min={0} max={254} className={styles.numInput} value={cur.inBlack} onChange={e => setChParam('inBlack', +e.target.value)} />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="num-gam" className={styles.inputLabel}>Гамма</label>
              <input id="num-gam" type="number" min={0.1} max={9.9} step={0.1} className={styles.numInput} value={cur.gamma.toFixed(1)} onChange={e => {const v=+e.target.value; if(v)setChParam('gamma', v)}} />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="num-wht" className={styles.inputLabel}>Белая</label>
              <input id="num-wht" type="number" min={1} max={255} className={styles.numInput} value={cur.inWhite} onChange={e => setChParam('inWhite', +e.target.value)} />
            </div>
          </div>
        </div>

        <div className={styles.previewRow}>
          <label htmlFor="pTog" className={styles.checkLabel}>
            <input id="pTog" type="checkbox" checked={preview} onChange={e=>setPreview(e.target.checked)} /> Предпросмотр (в реал. времени)
          </label>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnSecondary} onClick={() => setParams({...params, [channel]: defaultLevelsParams()})}>Сброс кан.</button>
          <button className={styles.btnSecondary} onClick={() => setParams(initParams())}>Сброс всех</button>
          <div style={{ flex: 1 }} />
          <button className={styles.btnSecondary} onClick={handleCancelRef.current}>Отмена</button>
          <button className={styles.btnPrimary} onClick={handleApplyClick}>Применить</button>
        </div>
      </div>
    </dialog>
  );
}

// ──────────────────────────────── Triple Slider Fixes ───────────────────────────────────
function TripleSlider({ black, white, gamma, onChange }) {
  const tRef = useRef(), bRef = useRef(), gRef = useRef(), wRef = useRef();
  const stRef = useRef({ black, white, gamma, onChange });
  useEffect(() => { stRef.current = { black, white, gamma, onChange }; });

  const pct = v => (v / 255) * 100;
  const midVal = black + (white - black) * Math.pow(0.5, 1.0 / gamma);

  useEffect(() => {
    const bindEvt = (refObj, mk) => {
      const f = e => { e.preventDefault(); startD(mk, e); };
      if(refObj.current) refObj.current.addEventListener('touchstart', f, { passive: false });
      return f;
    };
    const f1 = bindEvt(bRef, 'black'), f2 = bindEvt(gRef, 'gamma'), f3 = bindEvt(wRef, 'white');
    return () => {
      bRef.current?.removeEventListener('touchstart', f1);
      gRef.current?.removeEventListener('touchstart', f2);
      wRef.current?.removeEventListener('touchstart', f3);
    };
  }, []);

  function startD(mk, evInitial) {
    function onMove(e) {
      if(!tRef.current) return;
      e.preventDefault();
      const cli = e.touches ? e.touches[0].clientX : e.clientX;
      const rec = tRef.current.getBoundingClientRect();
      const raw = Math.round(Math.max(0, Math.min(1, (cli - rec.left)/rec.width))*255);
      const { black:b, white:w, onChange:cb } = stRef.current;
      
      if(mk === 'black') cb('inBlack', Math.max(0, Math.min(w-1, raw)));
      else if(mk === 'white') cb('inWhite', Math.max(b+1, Math.min(255, raw)));
      else {
        if(w - b <= 0) return;
        const gV = Math.max(0.1, Math.min(9.9, Math.log(0.5) / Math.log(Math.max(0.001, Math.min(0.999, (raw - b) / (w - b))))));
        cb('gamma', parseFloat(gV.toFixed(2)));
      }
    }
    const up = () => ['mousemove','mouseup','touchmove','touchend'].forEach(n => window.removeEventListener(n, mk==='black'?onMove:up)); // pseudo wrapper code simplifier below is explicit
    function kill() {
       window.removeEventListener('mousemove', onMove);
       window.removeEventListener('mouseup', kill);
       window.removeEventListener('touchmove', onMove);
       window.removeEventListener('touchend', kill);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', kill);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', kill);
  }

  return (
    <div className={styles.tripleSliderWrap}>
      <div className={styles.gradientTrack} ref={tRef}>
        <div ref={bRef} className={`${styles.marker} ${styles.markerBlack}`} style={{ left:`${pct(black)}%` }} onMouseDown={e => {e.preventDefault(); startD('black')}}>
          <div className={styles.markerArrowDown} style={{ borderTopColor: '#ffffff' }} /><div className={styles.markerVal}>{black}</div>
        </div>
        <div ref={gRef} className={`${styles.marker} ${styles.markerGamma}`} style={{ left:`${pct(midVal)}%` }} onMouseDown={e => {e.preventDefault(); startD('gamma')}}>
          <div className={styles.markerArrowDown} style={{ borderTopColor: '#f0c040' }} /><div className={styles.markerVal} style={{color:'#f0c040'}}>{gamma.toFixed(1)}</div>
        </div>
        <div ref={wRef} className={`${styles.marker} ${styles.markerWhite}`} style={{ left:`${pct(white)}%` }} onMouseDown={e => {e.preventDefault(); startD('white')}}>
          <div className={styles.markerArrowDown} style={{ borderTopColor: '#888' }} /><div className={styles.markerVal}>{white}</div>
        </div>
      </div>
    </div>
  );
}