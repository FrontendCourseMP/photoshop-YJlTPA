import { useEffect, useRef, useState, useCallback } from 'react';
import { buildAllLUTs, defaultLevelsParams } from '../utils/levelsUtils';
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
  return {
    master: { ...d },
    r:      { ...d },
    g:      { ...d },
    b:      { ...d },
    alpha:  { ...d },
  };
}

function drawHistogram(canvas, hist, logScale, channelId) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, W, H);

  let maxRaw = 0;
  for (let i = 0; i < hist.length; i++) {
    if (hist[i] > maxRaw) maxRaw = hist[i];
  }
  if (maxRaw === 0) return;

  const maxVal = logScale ? Math.log1p(maxRaw) : maxRaw;
  const colors = { r: '#e05555', g: '#3d9a50', b: '#2563be', alpha: '#aaaaaa', master: '#cccccc' };
  const barColor = colors[channelId] || '#cccccc';
  const barW = W / 256;

  ctx.fillStyle = barColor;
  for (let i = 0; i < 256; i++) {
    const val = logScale ? Math.log1p(hist[i]) : hist[i];
    const h = Math.round((val / maxVal) * (H - 2));
    if (h <= 0) continue;
    ctx.fillRect(Math.floor(i * barW), H - h, Math.ceil(barW) + 1, h);
  }
}

function buildAllHistograms(imageData) {
  const data = imageData.data;
  const len = data.length;
  const master = new Uint32Array(256);
  const r      = new Uint32Array(256);
  const g      = new Uint32Array(256);
  const b      = new Uint32Array(256);
  const alpha  = new Uint32Array(256);

  for (let i = 0; i < len; i += 4) {
    const rv = data[i];
    const gv = data[i + 1];
    const bv = data[i + 2];
    const av = data[i + 3];
    r[rv]++;
    g[gv]++;
    b[bv]++;
    alpha[av]++;
    master[(76 * rv + 150 * gv + 30 * bv) >> 8]++;
  }
  return { master, r, g, b, alpha };
}

export default function LevelsDialog({ imageData, onApply, onCancel, onPreview }) {
  const [channel, setChannel] = useState('master');
  const [params, setParams]   = useState(initParams);
  const [logScale, setLogScale] = useState(false);
  const [preview, setPreview]   = useState(true);

  const histCanvasRef = useRef(null);
  const rafPreviewRef = useRef(null);
  const dialogRef     = useRef(null);

  // Актуальные значения без stale closure — читаем в колбэках напрямую
  const paramsRef  = useRef(params);
  const previewRef = useRef(preview);
  useEffect(() => { paramsRef.current  = params;  }, [params]);
  useEffect(() => { previewRef.current = preview; }, [preview]);

  const histogramsRef = useRef(null);
  const imageDataRef  = useRef(null);

  // Открываем нативный <dialog>
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    dlg.showModal();
    const handleClose = () => onCancel();
    dlg.addEventListener('close', handleClose);
    return () => dlg.removeEventListener('close', handleClose);
  }, [onCancel]);

  // Гистограммы — пересчёт только при смене imageData
  useEffect(() => {
    if (!imageData) { histogramsRef.current = null; imageDataRef.current = null; return; }
    if (imageDataRef.current === imageData) return;
    histogramsRef.current = buildAllHistograms(imageData);
    imageDataRef.current = imageData;
  }, [imageData]);

  useEffect(() => {
    if (!histCanvasRef.current || !histogramsRef.current) return;
    drawHistogram(histCanvasRef.current, histogramsRef.current[channel], logScale, channel);
  }, [channel, logScale, imageData]);

  // Превью — срабатывает при изменении params через слайдеры/инпуты
  useEffect(() => {
    if (!preview) { onPreview(null); return; }
    if (rafPreviewRef.current) cancelAnimationFrame(rafPreviewRef.current);
    rafPreviewRef.current = requestAnimationFrame(() => {
      onPreview(buildAllLUTs(params));
    });
    return () => { if (rafPreviewRef.current) cancelAnimationFrame(rafPreviewRef.current); };
  }, [params, preview, onPreview]);

  // Немедленное превью с конкретными params — используется в сбросе.
  // Нельзя полагаться на useEffect выше: между setParams и эффектом
  // React может сделать батч рендеров и RAF отменится cleanup'ом.
  const applyPreviewNow = useCallback((nextParams) => {
    if (!previewRef.current) return;
    if (rafPreviewRef.current) cancelAnimationFrame(rafPreviewRef.current);
    rafPreviewRef.current = requestAnimationFrame(() => {
      onPreview(buildAllLUTs(nextParams));
    });
  }, [onPreview]);

  const setChannelParam = useCallback((key, value) => {
    setParams(prev => {
      const ch = { ...prev[channel] };
      if (key === 'inBlack') {
        ch.inBlack = Math.min(value, ch.inWhite - 1);
      } else if (key === 'inWhite') {
        ch.inWhite = Math.max(value, ch.inBlack + 1);
      } else {
        ch[key] = value;
      }
      return { ...prev, [channel]: ch };
    });
  }, [channel]);

  // Сброс текущего канала — вычисляем next локально и сразу кидаем превью
  const handleReset = useCallback(() => {
    const next = { ...paramsRef.current, [channel]: defaultLevelsParams() };
    setParams(next);
    applyPreviewNow(next);
  }, [channel, applyPreviewNow]);

  // Сброс всех каналов
  const handleResetAll = useCallback(() => {
    const next = initParams();
    setParams(next);
    applyPreviewNow(next);
  }, [applyPreviewNow]);

  const handlePreviewToggle = useCallback((e) => {
    const checked = e.target.checked;
    setPreview(checked);
    if (!checked) onPreview(null);
  }, [onPreview]);

  const handleApply = useCallback(() => {
    if (rafPreviewRef.current) { cancelAnimationFrame(rafPreviewRef.current); rafPreviewRef.current = null; }
    dialogRef.current?.close();
    onApply(buildAllLUTs(paramsRef.current));
  }, [onApply]);

  const handleCancel = useCallback(() => {
    if (rafPreviewRef.current) { cancelAnimationFrame(rafPreviewRef.current); rafPreviewRef.current = null; }
    onPreview(null);
    dialogRef.current?.close();
  }, [onPreview]);

  const handleDialogClick = useCallback((e) => {
    if (e.target === dialogRef.current) handleCancel();
  }, [handleCancel]);

  const cur = params[channel];

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClick={handleDialogClick}>
      <div className={styles.inner} onClick={e => e.stopPropagation()}>

        <div className={styles.header}>
          <span className={styles.title}>Уровни (Levels)</span>
          <button className={styles.closeBtn} onClick={handleCancel}>×</button>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Канал</label>
          <select className={styles.select} value={channel} onChange={e => setChannel(e.target.value)}>
            {CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        <div className={styles.histWrap}>
          <canvas ref={histCanvasRef} className={styles.histCanvas} width={256} height={100} />
        </div>

        <div className={styles.scaleRow}>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={logScale} onChange={e => setLogScale(e.target.checked)} />
            Логарифмическая шкала
          </label>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Входные уровни</div>
          <TripleSlider black={cur.inBlack} white={cur.inWhite} gamma={cur.gamma} onChange={setChannelParam} />
          <div className={styles.inputRow}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Чёрная точка</label>
              <input type="number" min={0} max={254} className={styles.numInput} value={cur.inBlack}
                onChange={e => setChannelParam('inBlack', Math.max(0, Math.min(254, +e.target.value)))} />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Гамма</label>
              <input type="number" min={0.1} max={9.9} step={0.1} className={styles.numInput} value={cur.gamma.toFixed(1)}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setChannelParam('gamma', Math.max(0.1, Math.min(9.9, v))); }} />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Белая точка</label>
              <input type="number" min={1} max={255} className={styles.numInput} value={cur.inWhite}
                onChange={e => setChannelParam('inWhite', Math.max(1, Math.min(255, +e.target.value)))} />
            </div>
          </div>
        </div>

        <div className={styles.previewRow}>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={preview} onChange={handlePreviewToggle} />
            Предпросмотр (реальное время)
          </label>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnSecondary} onClick={handleReset}>Сброс канала</button>
          <button className={styles.btnSecondary} onClick={handleResetAll}>Сброс всего</button>
          <div style={{ flex: 1 }} />
          <button className={styles.btnSecondary} onClick={handleCancel}>Отмена</button>
          <button className={styles.btnPrimary} onClick={handleApply}>Применить</button>
        </div>

      </div>
    </dialog>
  );
}

/* ─── TripleSlider ─────────────────────────────────────────────────────────── */
function TripleSlider({ black, white, gamma, onChange }) {
  const trackRef = useRef(null);
  const blackRef = useRef(null);
  const gammaRef = useRef(null);
  const whiteRef = useRef(null);

  const stateRef = useRef({ black, white, gamma, onChange });
  useEffect(() => { stateRef.current = { black, white, gamma, onChange }; });

  const pct    = (v) => (v / 255) * 100;
  const midVal = black + (white - black) * Math.pow(0.5, 1.0 / gamma);

  useEffect(() => {
    const nodes = [
      { el: blackRef.current, marker: 'black' },
      { el: gammaRef.current, marker: 'gamma' },
      { el: whiteRef.current, marker: 'white' },
    ];
    function makeHandler(marker) {
      return function onTouchStart(e) { e.preventDefault(); startDragLogic(marker, e); };
    }
    const handlers = nodes.map(({ el, marker }) => {
      const fn = makeHandler(marker);
      el?.addEventListener('touchstart', fn, { passive: false });
      return { el, fn };
    });
    return () => { handlers.forEach(({ el, fn }) => el?.removeEventListener('touchstart', fn)); };
  }, []);

  function getValueFromX(clientX) {
    const track = trackRef.current;
    if (!track) return 0;
    const rect  = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * 255);
  }

  function startDragLogic(marker, e) {
    function onMove(ev) {
      ev.preventDefault();
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const raw = getValueFromX(clientX);
      const { black: b, white: w, onChange: cb } = stateRef.current;
      if (marker === 'black') {
        cb('inBlack', Math.max(0, Math.min(w - 1, raw)));
      } else if (marker === 'white') {
        cb('inWhite', Math.max(b + 1, Math.min(255, raw)));
      } else if (marker === 'gamma') {
        const range = w - b;
        if (range <= 0) return;
        const frac = Math.max(0.001, Math.min(0.999, (raw - b) / range));
        const newGamma = Math.log(0.5) / Math.log(frac);
        cb('gamma', parseFloat(Math.max(0.1, Math.min(9.9, newGamma)).toFixed(2)));
      }
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend',  onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend',  onUp);
  }

  function handleMouseDown(marker, e) { e.preventDefault(); startDragLogic(marker, e); }

  return (
    <div className={styles.tripleSliderWrap}>
      <div className={styles.gradientTrack} ref={trackRef}>
        <div ref={blackRef} className={`${styles.marker} ${styles.markerBlack}`}
          style={{ left: `${pct(black)}%` }} onMouseDown={e => handleMouseDown('black', e)}
          title={`Чёрная точка: ${black}`}>
          <div className={styles.markerArrowDown} style={{ borderTopColor: '#ffffff' }} />
          <div className={styles.markerVal}>{black}</div>
        </div>
        <div ref={gammaRef} className={`${styles.marker} ${styles.markerGamma}`}
          style={{ left: `${pct(midVal)}%` }} onMouseDown={e => handleMouseDown('gamma', e)}
          title={`Гамма: ${gamma.toFixed(2)}`}>
          <div className={styles.markerArrowDown} style={{ borderTopColor: '#f0c040' }} />
          <div className={styles.markerVal} style={{ color: '#f0c040' }}>{gamma.toFixed(1)}</div>
        </div>
        <div ref={whiteRef} className={`${styles.marker} ${styles.markerWhite}`}
          style={{ left: `${pct(white)}%` }} onMouseDown={e => handleMouseDown('white', e)}
          title={`Белая точка: ${white}`}>
          <div className={styles.markerArrowDown} style={{ borderTopColor: '#888' }} />
          <div className={styles.markerVal}>{white}</div>
        </div>
      </div>
    </div>
  );
}