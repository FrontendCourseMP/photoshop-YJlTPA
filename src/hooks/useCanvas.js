import { useRef, useCallback } from 'react';
import { applyChannelMask }    from '../utils/channelUtils';
import { runInWorker }         from '../utils/workerPool';

/** Максимальная сторона уменьшенной копии для предпросмотра свёртки. */
const MAX_PREVIEW_DIM = 300;

/**
 * Рисует готовый Uint8ClampedArray на canvas.
 * Вызывается только в главном потоке.
 */
function putPixels(canvas, data, width, height) {
  if (!canvas) return;
  const imageData = new ImageData(data, width, height);
  canvas.width    = width;
  canvas.height   = height;
  canvas.getContext('2d').putImageData(imageData, 0, 0);
}

/**
 * Уменьшает ImageData до maxDim по большей стороне (nearest neighbour, быстро).
 *
 * ВАЖНО: ВСЕГДА возвращает новый ImageData с независимым буфером,
 * даже если изображение уже достаточно маленькое.
 * Это гарантирует, что передача copy.buffer как transferable
 * никогда не детачит буфер оригинала.
 */
function makeShrunkCopy(imageData, maxDim) {
  const { width: w, height: h, data } = imageData;

  let dstW, dstH;
  if (w <= maxDim && h <= maxDim) {
    // Изображение уже маленькое — просто копируем данные
    dstW = w;
    dstH = h;
    const dst = new Uint8ClampedArray(data.length);
    dst.set(data); // set() копирует побайтово, буфер у dst независимый
    return new ImageData(dst, dstW, dstH);
  }

  // Масштабируем nearest neighbour
  const scale = maxDim / Math.max(w, h);
  dstW = Math.max(1, Math.round(w * scale));
  dstH = Math.max(1, Math.round(h * scale));
  const dst  = new Uint8ClampedArray(dstW * dstH * 4);
  const xR   = w / dstW;
  const yR   = h / dstH;

  for (let y = 0; y < dstH; y++) {
    const srcRow = Math.floor(y * yR) * w;
    const dstRow = y * dstW;
    for (let x = 0; x < dstW; x++) {
      const s = (srcRow + Math.floor(x * xR)) << 2;
      const d = (dstRow + x) << 2;
      dst[d]     = data[s];
      dst[d + 1] = data[s + 1];
      dst[d + 2] = data[s + 2];
      dst[d + 3] = data[s + 3];
    }
  }
  return new ImageData(dst, dstW, dstH);
}

export function useCanvas() {
  const canvasRef       = useRef(null);
  const originalDataRef = useRef(null);   // оригинал (полный размер)
  const scaleRef        = useRef(100);    // текущий масштаб %
  const skipRedrawRef   = useRef(false);
  // Монотонно растущий токен для отмены устаревших async-операций
  const opTokenRef      = useRef(0);

  // ─── Внутренняя: масштабирует imageData и рисует на canvas ────────────────
  const _drawScaled = useCallback(async (imageData, scalePct, token) => {
    if (!imageData || !canvasRef.current) return;

    const targetW = Math.max(1, Math.round(imageData.width  * scalePct / 100));
    const targetH = Math.max(1, Math.round(imageData.height * scalePct / 100));

    if (targetW === imageData.width && targetH === imageData.height) {
      // Масштаб 100% — рисуем напрямую без worker
      if (opTokenRef.current !== token) return;
      putPixels(canvasRef.current, imageData.data, targetW, targetH);
      return;
    }

    // Масштабируем в worker (zero-copy через transferable)
    // Копируем данные, чтобы не детачить буфер оригинала
    const copy = new Uint8ClampedArray(imageData.data.length);
    copy.set(imageData.data);

    try {
      const result = await runInWorker(
        'scale',
        { data: copy, width: imageData.width, height: imageData.height, dstW: targetW, dstH: targetH, method: 'bilinear' },
        [copy.buffer]
      );
      if (opTokenRef.current !== token) return;
      putPixels(canvasRef.current, result.data, result.width, result.height);
    } catch (err) {
      if (opTokenRef.current !== token) return;
      console.warn('_drawScaled error:', err);
    }
  }, []);

  // ─── Первичная отрисовка после загрузки ───────────────────────────────────
  const drawImage = useCallback((imageData, scalePct = 100) => {
    originalDataRef.current = imageData;
    scaleRef.current        = scalePct;
    const token = ++opTokenRef.current;
    _drawScaled(imageData, scalePct, token);
  }, [_drawScaled]);

  // ─── Перерисовка при смене активных каналов ───────────────────────────────
  const redrawWithChannels = useCallback((activeChannels, channelCount) => {
    if (skipRedrawRef.current) {
      skipRedrawRef.current = false;
      return;
    }
    const original = originalDataRef.current;
    if (!canvasRef.current || !original) return;

    const allIds = channelCount <= 2
      ? (channelCount === 1 ? ['gray'] : ['gray', 'alpha'])
      : (channelCount === 3 ? ['r', 'g', 'b'] : ['r', 'g', 'b', 'alpha']);
    const allActive = allIds.every(id => activeChannels.has(id));

    // applyChannelMask синхронный и быстрый
    const source = allActive
      ? original
      : applyChannelMask(original, activeChannels, channelCount);

    const token = ++opTokenRef.current;
    _drawScaled(source, scaleRef.current, token);
  }, [_drawScaled]);

  // ─── Смена масштаба из ScaleSelector ──────────────────────────────────────
  const applyScale = useCallback((scalePct) => {
    const original = originalDataRef.current;
    if (!original) return;
    scaleRef.current = scalePct;
    const token = ++opTokenRef.current;
    _drawScaled(original, scalePct, token);
  }, [_drawScaled]);

  // ─── Превью уровней ───────────────────────────────────────────────────────
  const previewLevels = useCallback(async (luts) => {
    const original = originalDataRef.current;
    if (!canvasRef.current || !original) return;

    const token = ++opTokenRef.current;

    if (!luts) {
      _drawScaled(original, scaleRef.current, token);
      return;
    }

    try {
      const copy = new Uint8ClampedArray(original.data.length);
      copy.set(original.data);

      const result = await runInWorker(
        'applyLUTs',
        {
          data:   copy,
          width:  original.width,
          height: original.height,
          lutR:   luts.r,
          lutG:   luts.g,
          lutB:   luts.b,
          lutA:   luts.a,
        },
        [copy.buffer]
      );
      if (opTokenRef.current !== token) return;

      const targetW = Math.max(1, Math.round(original.width  * scaleRef.current / 100));
      const targetH = Math.max(1, Math.round(original.height * scaleRef.current / 100));

      if (targetW === original.width && targetH === original.height) {
        putPixels(canvasRef.current, result.data, result.width, result.height);
      } else {
        const copy2 = new Uint8ClampedArray(result.data.length);
        copy2.set(result.data);
        const scaled = await runInWorker(
          'scale',
          { data: copy2, width: result.width, height: result.height, dstW: targetW, dstH: targetH, method: 'bilinear' },
          [copy2.buffer]
        );
        if (opTokenRef.current !== token) return;
        putPixels(canvasRef.current, scaled.data, scaled.width, scaled.height);
      }
    } catch (err) {
      if (opTokenRef.current !== token) return;
      console.warn('previewLevels error:', err);
    }
  }, [_drawScaled]);

  // ─── Деструктивное применение уровней ─────────────────────────────────────
  const applyLevels = useCallback(async (luts) => {
    const original = originalDataRef.current;
    if (!canvasRef.current || !original) return;

    const token = ++opTokenRef.current;

    try {
      const copy = new Uint8ClampedArray(original.data.length);
      copy.set(original.data);

      const result = await runInWorker(
        'applyLUTs',
        {
          data:   copy,
          width:  original.width,
          height: original.height,
          lutR:   luts.r,
          lutG:   luts.g,
          lutB:   luts.b,
          lutA:   luts.a,
        },
        [copy.buffer]
      );
      if (opTokenRef.current !== token) return;

      originalDataRef.current = new ImageData(result.data, result.width, result.height);
      skipRedrawRef.current   = true;
      _drawScaled(originalDataRef.current, scaleRef.current, token);
    } catch (err) {
      if (opTokenRef.current !== token) return;
      console.error('applyLevels error:', err);
      throw err;
    }
  }, [_drawScaled]);

  // ─── Предпросмотр свёртки — на уменьшенной копии, мгновенно ──────────────
  const previewKernel = useCallback(async (params) => {
    const original = originalDataRef.current;
    if (!canvasRef.current || !original) return;

    // Сброс — показываем оригинал
    if (!params) {
      const token = ++opTokenRef.current;
      _drawScaled(original, scaleRef.current, token);
      return;
    }

    const { kernel, channels, padding } = params;

    // Валидация
    if (!kernel || kernel.length !== 9) return;
    if (kernel.some(v => !isFinite(v) || isNaN(v))) return;
    if (!channels || channels.length === 0) return;

    const token = ++opTokenRef.current;

    try {
      // makeShrunkCopy ВСЕГДА возвращает независимый буфер —
      // передача copy.buffer как transferable безопасна для original
      const small = makeShrunkCopy(original, MAX_PREVIEW_DIM);

      // small.data.buffer — буфер small (независимый), передаём его в worker
      // После transfer small.data.buffer детачируется, но original — нет
      const result = await runInWorker(
        'convolve',
        {
          data:     small.data,
          width:    small.width,
          height:   small.height,
          kernel,
          channels,
          padding,
        },
        [small.data.buffer] // ← передаём буфер small, НЕ копируем ещё раз
      );
      if (opTokenRef.current !== token) return;

      putPixels(canvasRef.current, result.data, result.width, result.height);
    } catch (err) {
      if (opTokenRef.current !== token) return;
      console.warn('previewKernel error:', err);
    }
  }, [_drawScaled]);

  // ─── Деструктивное применение свёртки (полный размер) ─────────────────────
  const applyKernel = useCallback(async ({ kernel, channels, padding, onProgress }) => {
    const original = originalDataRef.current;
    if (!canvasRef.current || !original) return;

    if (!kernel || kernel.length !== 9) return;
    if (kernel.some(v => !isFinite(v) || isNaN(v))) return;
    if (!channels || channels.length === 0) return;

    const token = ++opTokenRef.current;

    try {
      // Копируем данные оригинала для передачи в worker
      const copy = new Uint8ClampedArray(original.data.length);
      copy.set(original.data);

      const result = await runInWorker(
        'convolve',
        {
          data:     copy,
          width:    original.width,
          height:   original.height,
          kernel,
          channels,
          padding,
        },
        [copy.buffer],
        onProgress
      );
      if (opTokenRef.current !== token) return;

      originalDataRef.current = new ImageData(result.data, result.width, result.height);
      skipRedrawRef.current   = true;
      _drawScaled(originalDataRef.current, scaleRef.current, token);
    } catch (err) {
      if (opTokenRef.current !== token) return;
      console.error('applyKernel error:', err);
      throw err;
    }
  }, [_drawScaled]);

  // ─── Деструктивный ресайз ─────────────────────────────────────────────────
  const resizeImage = useCallback(async (width, height, methodId = 'bilinear') => {
    const original = originalDataRef.current;
    if (!original) return null;

    const token = ++opTokenRef.current;

    try {
      const copy = new Uint8ClampedArray(original.data.length);
      copy.set(original.data);

      const result = await runInWorker(
        'scale',
        {
          data:   copy,
          width:  original.width,
          height: original.height,
          dstW:   width,
          dstH:   height,
          method: methodId,
        },
        [copy.buffer]
      );
      if (opTokenRef.current !== token) return null;

      const resized = new ImageData(result.data, result.width, result.height);
      originalDataRef.current = resized;
      skipRedrawRef.current   = true;
      return resized;
    } catch (err) {
      if (opTokenRef.current !== token) return null;
      console.error('resizeImage error:', err);
      throw err;
    }
  }, []);

  // ─── Сброс ────────────────────────────────────────────────────────────────
  const clearCanvas = useCallback(() => {
    ++opTokenRef.current; // все текущие async-операции устаревают
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    canvas.width            = 1;
    canvas.height           = 1;
    originalDataRef.current = null;
    scaleRef.current        = 100;
  }, []);

  const getOriginalData = useCallback(() => originalDataRef.current, []);
  const getCurrentScale = useCallback(() => scaleRef.current, []);

  return {
    canvasRef,
    drawImage,
    clearCanvas,
    redrawWithChannels,
    getOriginalData,
    getCurrentScale,
    previewLevels,
    applyLevels,
    previewKernel,
    applyKernel,
    applyScale,
    resizeImage,
  };
}