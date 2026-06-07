import { useState, useEffect, useRef, useCallback } from 'react';
import { KERNEL_PRESETS, DEFAULT_PRESET_ID, isIdentityKernel } from '../utils/kernelPresets';
import styles from './KernelDialog.module.css';

const CHANNEL_OPTIONS = [
  { id: 'r',     label: 'R (Red)'   },
  { id: 'g',     label: 'G (Green)' },
  { id: 'b',     label: 'B (Blue)'  },
  { id: 'alpha', label: 'A (Alpha)' },
];

const PADDING_OPTIONS = [
  { id: 'black',     label: 'Заполнение чёрным' },
  { id: 'white',     label: 'Заполнение белым'  },
  { id: 'replicate', label: 'Копирование края'  },
];

function formatKernelValue(v) {
  if (Number.isInteger(v)) return String(v);
  if (v !== 0) {
    const inv = 1 / v;
    const rounded = Math.round(inv);
    if (Math.abs(rounded - inv) < 1e-9 && rounded > 0) {
      return `1/${rounded}`;
    }
  }
  return parseFloat(v.toFixed(6)).toString();
}

function parseKernelStr(str) {
  const s = str.trim();
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 2) {
      const a = parseFloat(parts[0]);
      const b = parseFloat(parts[1]);
      if (!isNaN(a) && !isNaN(b) && b !== 0) return a / b;
    }
    return NaN;
  }
  return parseFloat(s);
}

function parseKernelStrings(strs) {
  const errIndices = [];
  const vals = strs.map((s, i) => {
    const v = parseKernelStr(s);
    if (isNaN(v)) { errIndices.push(i); return 0; }
    return v;
  });
  return { vals, errIndices };
}

export default function KernelDialog({ imageData, onApply, onClose, onPreview }) {
  const dialogRef = useRef(null);
  const rafRef    = useRef(null);

  const defaultPreset = KERNEL_PRESETS.find(p => p.id === DEFAULT_PRESET_ID);

  const [presetId,   setPresetId]   = useState(DEFAULT_PRESET_ID);
  const [kernelStrs, setKernelStrs] = useState(() => defaultPreset.kernel.map(formatKernelValue));
  const [channels,   setChannels]   = useState(() => new Set(['r', 'g', 'b']));
  const [padding,    setPadding]    = useState('black');
  const [preview,    setPreview]    = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [errIndices, setErrIndices] = useState([]);

  const stateRef = useRef({ kernelStrs, channels, padding, preview });
  useEffect(() => {
    stateRef.current = { kernelStrs, channels, padding, preview };
  });

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    dlg.showModal();
    const handleClose = () => onClose();
    dlg.addEventListener('close', handleClose);
    return () => dlg.removeEventListener('close', handleClose);
  }, [onClose]);

  const getChannelIndices = useCallback((ch) => {
    return [...ch]
      .map(c => ['r', 'g', 'b', 'alpha'].indexOf(c))
      .filter(i => i !== -1);
  }, []);

  const schedulePreview = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;

      const { kernelStrs: ks, channels: ch, padding: pd, preview: pv } = stateRef.current;
      if (!pv) return;

      const { vals, errIndices: errs } = parseKernelStrings(ks);
      if (errs.length > 0) return;

      if (isIdentityKernel(vals)) {
        onPreview(null);
        return;
      }

      const chIndices = getChannelIndices(ch);
      if (chIndices.length === 0) return;

      onPreview({ kernel: vals, channels: chIndices, padding: pd });
    });
  }, [onPreview, getChannelIndices]);

  useEffect(() => {
    if (!preview) {
      onPreview(null);
      return;
    }
    schedulePreview();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [kernelStrs, channels, padding, preview]);

  const handlePresetChange = useCallback((id) => {
    if (id === 'custom') return;
    setPresetId(id);
    const preset = KERNEL_PRESETS.find(p => p.id === id);
    if (preset) {
      setKernelStrs(preset.kernel.map(formatKernelValue));
      setErrIndices([]);
    }
  }, []);

  const handleCellChange = useCallback((i, val) => {
    setKernelStrs(prev => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
    setPresetId('custom');
    setErrIndices([]);
  }, []);

  const handleChannelToggle = useCallback((id) => {
    setChannels(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    const preset = KERNEL_PRESETS.find(p => p.id === DEFAULT_PRESET_ID);
    setPresetId(DEFAULT_PRESET_ID);
    setKernelStrs(preset.kernel.map(formatKernelValue));
    setChannels(new Set(['r', 'g', 'b']));
    setPadding('black');
    setErrIndices([]);
  }, []);

  const handleApply = useCallback(async () => {
    const { vals, errIndices: errs } = parseKernelStrings(kernelStrs);
    if (errs.length > 0) {
      setErrIndices(errs);
      return;
    }

    const chIndices = getChannelIndices(channels);
    if (chIndices.length === 0) return;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setIsApplying(true);
    setProgress(0);

    try {
      await onApply({
        kernel:     vals,
        channels:   chIndices,
        padding,
        onProgress: (pct) => setProgress(pct),
      });
    } catch (err) {
      console.error('KernelDialog apply error:', err);
      setIsApplying(false);
    }
  }, [kernelStrs, channels, padding, onApply, getChannelIndices]);

  const handleClose = useCallback(() => {
    if (isApplying) return;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    onPreview(null);
    dialogRef.current?.close();
  }, [isApplying, onPreview]);

  const handlePreviewToggle = useCallback((e) => {
    const checked = e.target.checked;
    setPreview(checked);
    if (!checked) onPreview(null);
  }, [onPreview]);

  const { errIndices: liveErrIndices } = parseKernelStrings(kernelStrs);
  const hasErrors = errIndices.length > 0 || liveErrIndices.length > 0;
  const highlightedErrors = errIndices.length > 0 ? errIndices : liveErrIndices;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClick={(e) => { if (e.target === dialogRef.current) handleClose(); }}
    >
      <div className={styles.inner} onClick={(e) => e.stopPropagation()}>

        <div className={styles.header}>
          <span className={styles.title}>Фильтрация ядром (Kernel)</span>
          <button className={styles.closeBtn} onClick={handleClose} disabled={isApplying}>
            ✕
          </button>
        </div>

        <div className={styles.body}>

          <div className={styles.row}>
            <label htmlFor="kernel-preset-select" className={styles.label}>Пресет</label>
            <select
              id="kernel-preset-select"
              name="preset"
              className={styles.select}
              value={presetId}
              onChange={(e) => handlePresetChange(e.target.value)}
              disabled={isApplying}
            >
              {KERNEL_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
              {presetId === 'custom' && (
                <option value="custom" disabled>— Пользовательское —</option>
              )}
            </select>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Ядро свёртки 3 × 3</div>
            <div className={styles.kernelGrid}>
              {kernelStrs.map((val, i) => (
                <div key={i} className={styles.cellWrapper}>
                  <label htmlFor={`kernel-cell-${i}`} className={styles.visuallyHiddenLabel}>
                    Ячейка ядра {Math.floor(i / 3) + 1}x{(i % 3) + 1}
                  </label>
                  <input
                    id={`kernel-cell-${i}`}
                    name={`kernelCell-${i}`}
                    type="text"
                    inputMode="decimal"
                    className={[
                      styles.kernelCell,
                      highlightedErrors.includes(i) ? styles.kernelCellError : '',
                    ].join(' ')}
                    value={val}
                    onChange={(e) => handleCellChange(i, e.target.value)}
                    disabled={isApplying}
                    title={`Позиция [${Math.floor(i / 3)}, ${i % 3}]`}
                  />
                </div>
              ))}
            </div>
            {hasErrors && (
              <div className={styles.kernelError}>
                Некорректные значения. Введите числа или дроби (например: 0.5 / -1 / 1/16)
              </div>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Применить к каналам</div>
            <div className={styles.channelRow}>
              {CHANNEL_OPTIONS.map((ch) => (
                <label key={ch.id} htmlFor={`kernel-ch-${ch.id}`} className={styles.checkLabel}>
                  <input
                    id={`kernel-ch-${ch.id}`}
                    name={`kernelCh-${ch.id}`}
                    type="checkbox"
                    checked={channels.has(ch.id)}
                    onChange={() => handleChannelToggle(ch.id)}
                    disabled={isApplying}
                  />
                  {ch.label}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.row}>
            <label htmlFor="kernel-padding-select" className={styles.label}>Обработка края</label>
            <select
              id="kernel-padding-select"
              name="padding"
              className={styles.select}
              value={padding}
              onChange={(e) => setPadding(e.target.value)}
              disabled={isApplying}
            >
              {PADDING_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.previewRow}>
            <label htmlFor="kernel-preview-checkbox" className={styles.checkLabel}>
              <input
                id="kernel-preview-checkbox"
                name="preview"
                type="checkbox"
                checked={preview}
                onChange={handlePreviewToggle}
                disabled={isApplying}
              />
              Предпросмотр (быстро, на уменьшенной копии ≤300px)
            </label>
          </div>

          {isApplying && (
            <div className={styles.progressWrap}>
              <div className={styles.progressLabel}>
                Обработка полного изображения… {progress}%
              </div>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressBar}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

        </div>

        <div className={styles.footer}>
          <button
            className={styles.btnSecondary}
            onClick={handleReset}
            disabled={isApplying}
          >
            Сброс
          </button>

          <div style={{ flex: 1 }} />

          <button
            className={styles.btnSecondary}
            onClick={handleClose}
            disabled={isApplying}
          >
            Закрыть
          </button>

          <button
            className={styles.btnPrimary}
            onClick={handleApply}
            disabled={isApplying || hasErrors}
          >
            {isApplying
              ? <span className={styles.spinner} />
              : 'Применить'
            }
          </button>
        </div>

      </div>
    </dialog>
  );
}