import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { buildAllLUTs, defaultLevelsParams } from '../utils/levelsUtils';
import { buildHistogramsAsync } from '../utils/workerHistogram';
import styles from './LevelsDialog.module.css';

function initParams() {
  const d = defaultLevelsParams();
  return { master: { ...d }, r: { ...d }, g: { ...d }, b: { ...d }, alpha: { ...d } };
}

function drawHistogram(canvas, hist, logScale, channelId) {
  if (!canvas || !hist) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, W, H);

  let maxRaw = 0;
  for (let i = 1; i < 255; i++) if (hist[i] > maxRaw) maxRaw = hist[i];
  if (maxRaw === 0) maxRaw = Math.max(...hist);
  if (maxRaw === 0) return;

  const maxVal = logScale ? Math.log1p(maxRaw) : maxRaw;
  const cMap = {
    r: 'rgba(224, 85, 85, 0.75)',
    g: 'rgba(61, 154, 80, 0.75)',
    b: 'rgba(37, 99, 190, 0.75)',
    alpha: 'rgba(170, 170, 170, 0.6)',
    master: 'rgba(200, 200, 200, 0.65)',
    gray: 'rgba(200, 200, 200, 0.65)'
  };

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

export default function LevelsDialog({ imageData, channelCount = 3, onApply, onCancel, onPreview }) {
  const availableChannels = useMemo(() => {
    if (channelCount === 1) {
      return [{ id: 'master', label: 'Gray (Master)' }];
    }
    if (channelCount === 2) {
      return [
        { id: 'master', label: 'Gray (Master)' },
        { id: 'alpha',  label: 'Alpha' }
      ];
    }
    if (channelCount === 3) {
      return [
        { id: 'master', label: 'Master (RGB)' },
        { id: 'r',      label: 'Red' },
        { id: 'g',      label: 'Green' },
        { id: 'b',      label: 'Blue' }
      ];
    }
    return [
      { id: 'master', label: 'Master (RGB)' },
      { id: 'r',      label: 'Red' },
      { id: 'g',      label: 'Green' },
      { id: 'b',      label: 'Blue' },
      { id: 'alpha',  label: 'Alpha' }
    ];
  }, [channelCount]);

  const [channel, setChannel] = useState('master');
  const [params, setParams] = useState(initParams);
  const [logScale, setLogScale] = useState(false);
  const [preview, setPreview] = useState(true);

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialPosX: 0, initialPosY: 0 });

  const histCanvasRef = useRef(null);
  const rafPreviewRef = useRef(null);
  const dialogRef = useRef(null);

  const handleCancel = useCallback(() => {
    if (rafPreviewRef.current) cancelAnimationFrame(rafPreviewRef.current);
    onPreview(null);
    onCancel();
  }, [onPreview, onCancel]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (!dlg.open) {
      dlg.showModal();
    }

    const cancelEvt = (e) => {
      e.preventDefault();
      handleCancel();
    };
    dlg.addEventListener('cancel', cancelEvt);

    return () => {
      dlg.removeEventListener('cancel', cancelEvt);
      if (dlg.open) dlg.close();
    };
  }, [handleCancel]);

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

  useEffect(() => {
    if (!imageData) return;
    buildHistogramsAsync(imageData).then(hists => {
      const histKey = channel === 'gray' ? 'master' : channel;
      if (histCanvasRef.current && hists[histKey]) {
        drawHistogram(histCanvasRef.current, hists[histKey], logScale, channel);
      }
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
    return () => {
      if (rafPreviewRef.current) cancelAnimationFrame(rafPreviewRef.current);
    };
  }, [params, preview, schedulePreview, onPreview]);

  const setChParam = useCallback((k, v) => setParams(prev => {
    const activeKey = availableChannels.some(c => c.id === channel) ? channel : 'master';
    const ch = { ...prev[activeKey] };
    if (k === 'inBlack') ch.inBlack = Math.min(v, ch.inWhite - 1);
    else if (k === 'inWhite') ch.inWhite = Math.max(v, ch.inBlack + 1);
    else ch[k] = v;
    return { ...prev, [activeKey]: ch };
  }), [channel, availableChannels]);

  const handleApplyClick = useCallback(() => {
    if (rafPreviewRef.current) cancelAnimationFrame(rafPreviewRef.current);
    onApply(buildAllLUTs(params));
  }, [onApply, params]);

  const activeChannelKey = availableChannels.some(c => c.id === channel) ? channel : 'master';
  const cur = params[activeChannelKey] || defaultLevelsParams();

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
    >
      <div className={styles.inner}>
        <div
          className={styles.header}
          onMouseDown={handleMouseDownHeader}
          title="Зажмите для перетаскивания окна"
        >
          <div className={styles.headerTitleWrap}>
            <span className={styles.dragIcon}>⠿</span>
            <span className={styles.title}>Уровни (Levels)</span>
          </div>
          <button className={styles.closeBtn} onClick={handleCancel}>×</button>
        </div>

        <div className={styles.row}>
          <label htmlFor="chSel" className={styles.label}>Канал</label>
          <select id="chSel" className={styles.select} value={activeChannelKey} onChange={e => setChannel(e.target.value)}>
            {availableChannels.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        <div className={styles.histWrap}>
          <canvas ref={histCanvasRef} className={styles.histCanvas} width={256} height={100} />
        </div>

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
              <input id="num-gam" type="number" min={0.1} max={9.9} step={0.1} className={styles.numInput} value={cur.gamma.toFixed(1)} onChange={e => { const v = +e.target.value; if (v) setChParam('gamma', v); }} />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="num-wht" className={styles.inputLabel}>Белая</label>
              <input id="num-wht" type="number" min={1} max={255} className={styles.numInput} value={cur.inWhite} onChange={e => setChParam('inWhite', +e.target.value)} />
            </div>
          </div>
        </div>

        <div className={styles.previewRow}>
          <label htmlFor="pTog" className={styles.checkLabel}>
            <input id="pTog" type="checkbox" checked={preview} onChange={e => setPreview(e.target.checked)} /> Предпросмотр (в реал. времени)
          </label>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnSecondary} onClick={() => setParams({ ...params, [activeChannelKey]: defaultLevelsParams() })}>Сброс кан.</button>
          <button className={styles.btnSecondary} onClick={() => setParams(initParams())}>Сброс всех</button>
          <div style={{ flex: 1 }} />
          <button className={styles.btnSecondary} onClick={handleCancel}>Отмена</button>
          <button className={styles.btnPrimary} onClick={handleApplyClick}>Применить</button>
        </div>
      </div>
    </dialog>
  );
}

function TripleSlider({ black, white, gamma, onChange }) {
  const tRef = useRef(null);
  const bRef = useRef(null);
  const gRef = useRef(null);
  const wRef = useRef(null);

  const stRef = useRef({ black, white, gamma, onChange });
  useEffect(() => { stRef.current = { black, white, gamma, onChange }; });

  const pct = v => (v / 255) * 100;
  
  // Правильная позиция маркера гаммы: при gamma > 1.0 ползунок смещается влево (осветление), при gamma < 1.0 — вправо (затемнение)
  const gFactor = Math.pow(0.5, gamma);
  const midVal = black + (white - black) * (1 - gFactor);

  useEffect(() => {
    const bNode = bRef.current;
    const gNode = gRef.current;
    const wNode = wRef.current;

    const f1 = e => { e.preventDefault(); startD('black'); };
    const f2 = e => { e.preventDefault(); startD('gamma'); };
    const f3 = e => { e.preventDefault(); startD('white'); };

    if (bNode) bNode.addEventListener('touchstart', f1, { passive: false });
    if (gNode) gNode.addEventListener('touchstart', f2, { passive: false });
    if (wNode) wNode.addEventListener('touchstart', f3, { passive: false });

    return () => {
      if (bNode) bNode.removeEventListener('touchstart', f1);
      if (gNode) gNode.removeEventListener('touchstart', f2);
      if (wNode) wNode.removeEventListener('touchstart', f3);
    };
  }, []);

  function startD(mk) {
    function onMove(e) {
      if (!tRef.current) return;
      e.preventDefault();
      const cli = e.touches ? e.touches[0].clientX : e.clientX;
      const rec = tRef.current.getBoundingClientRect();
      const raw = Math.round(Math.max(0, Math.min(1, (cli - rec.left) / rec.width)) * 255);
      const { black: b, white: w, onChange: cb } = stRef.current;

      if (mk === 'black') cb('inBlack', Math.max(0, Math.min(w - 1, raw)));
      else if (mk === 'white') cb('inWhite', Math.max(b + 1, Math.min(255, raw)));
      else {
        if (w - b <= 0) return;
        const normPos = Math.max(0.01, Math.min(0.99, (raw - b) / (w - b)));
        // Сдвиг влево (normPos < 0.5) увеличивает гамму (> 1), осветляя изображение
        const gV = Math.log(1 - normPos) / Math.log(0.5);
        cb('gamma', parseFloat(Math.max(0.1, Math.min(9.9, gV)).toFixed(2)));
      }
    }
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
        <div ref={bRef} className={`${styles.marker} ${styles.markerBlack}`} style={{ left: `${pct(black)}%` }} onMouseDown={e => { e.preventDefault(); startD('black'); }}>
          <div className={styles.markerArrowDown} style={{ borderTopColor: '#ffffff' }} /><div className={styles.markerVal}>{black}</div>
        </div>
        <div ref={gRef} className={`${styles.marker} ${styles.markerGamma}`} style={{ left: `${pct(midVal)}%` }} onMouseDown={e => { e.preventDefault(); startD('gamma'); }}>
          <div className={styles.markerArrowDown} style={{ borderTopColor: '#f0c040' }} /><div className={styles.markerVal} style={{ color: '#f0c040' }}>{gamma.toFixed(1)}</div>
        </div>
        <div ref={wRef} className={`${styles.marker} ${styles.markerWhite}`} style={{ left: `${pct(white)}%` }} onMouseDown={e => { e.preventDefault(); startD('white'); }}>
          <div className={styles.markerArrowDown} style={{ borderTopColor: '#888' }} /><div className={styles.markerVal}>{white}</div>
        </div>
      </div>
    </div>
  );
}