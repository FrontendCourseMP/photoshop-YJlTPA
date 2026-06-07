import { useRef, useCallback } from 'react';
import { applyChannelMask }    from '../utils/channelUtils';
import { runInWorker }         from '../utils/workerPool';

/**
 * Вспомогательная: рисует готовый Uint8ClampedArray на canvas.
 * Вызывается только в главном потоке (DOM).
 */
function putPixels(canvas, data, width, height) {
  if (!canvas) return;
  const imageData = new ImageData(data, width, height);
  canvas.width  = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(imageData, 0, 0);
}

export function useCanvas() {
  const canvasRef       = useRef(null);
  const originalDataRef = useRef(null);   // оригинал (полный размер)
  const scaleRef        = useRef(100);    // текущий масштаб %
  const skipRedrawRef   = useRef(false);
  // Токен для отмены текущей async-операции
  const opTokenRef      = useRef(0);

  // ─── Внутренняя: масштабирует оригинал и рисует на canvas ─────────────────
  const _drawScaled = useCallback(async (imageData, scalePct, token) => {
    if (!imageData || !canvasRef.current) return;

    const targetW = Math.max(1, Math.round(imageData.width  * scalePct / 100));
    const targetH = Math.max(1, Math.round(imageData.height * scalePct / 100));

    let pixels;
    if (targetW === imageData.width && targetH === imageData.height) {
      // Масштаб 100% — нет смысла интерполировать
      pixels = imageData.data;
      // Не передаём буфер в worker (он нам ещё нужен!)
      if (opTokenRef.current !== token) return;
      putPixels(canvasRef.current, pixels, targetW, targetH);
    } else {
      // Передаём КОПИЮ данных в worker (zero-copy через transfer)
      const copy = imageData.data.slice();
      const result = await runInWorker(
        'scale',
        { data: copy, width: imageData.width, height: imageData.height, dstW: targetW, dstH: targetH, method: 'bilinear' },
        [copy.buffer]
      );
      // Проверяем актуальность токена — если пришёл новый запрос, игнорируем
      if (opTokenRef.current !== token) return;
      putPixels(canvasRef.current, result.data, result.width, result.height);
    }
  }, []);

  // ─── Публичное API ─────────────────────────────────────────────────────────

  /** Первичная отрисовка после загрузки. */
  const drawImage = useCallback((imageData, scalePct = 100) => {
    originalDataRef.current = imageData;
    scaleRef.current        = scalePct;
    const token = ++opTokenRef.current;
    _drawScaled(imageData, scalePct, token);
  }, [_drawScaled]);

  /** Перерисовка при смене каналов (синхронно для простых масок, async для scale). */
  const redrawWithChannels = useCallback((activeChannels, channelCount) => {
    if (skipRedrawRef.current) { skipRedrawRef.current = false; return; }
    const original = originalDataRef.current;
    if (!canvasRef.current || !original) return;

    const allIds = channelCount <= 2
      ? (channelCount === 1 ? ['gray'] : ['gray', 'alpha'])
      : (channelCount === 3 ? ['r', 'g', 'b'] : ['r', 'g', 'b', 'alpha']);
    const allActive = allIds.every(id => activeChannels.has(id));

    // applyChannelMask быстрый (просто маска), делаем в главном потоке
    const source = allActive
      ? original
      : applyChannelMask(original, activeChannels, channelCount);

    const token = ++opTokenRef.current;
    _drawScaled(source, scaleRef.current, token);
  }, [_drawScaled]);

  /** Смена масштаба (из ScaleSelector). */
  const applyScale = useCallback((scalePct) => {
    const original = originalDataRef.current;
    if (!original) return;
    scaleRef.current = scalePct;
    const token = ++opTokenRef.current;
    _drawScaled(original, scalePct, token);
  }, [_drawScaled]);

  /**
   * Превью уровней — вызывается из LevelsDialog при каждом движении слайдера.
   * luts === null → сброс к оригиналу.
   * Возвращает Promise.
   */
  const previewLevels = useCallback(async (luts) => {
    const original = originalDataRef.current;
    if (!canvasRef.current || !original) return;

    const token = ++opTokenRef.current;

    if (!luts) {
      _drawScaled(original, scaleRef.current, token);
      return;
    }

    // LUT применяем в worker (быстро, но не блокируем UI)
    const copy = original.data.slice();
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

    // Масштабируем результат тоже в worker
    const targetW = Math.max(1, Math.round(original.width  * scaleRef.current / 100));
    const targetH = Math.max(1, Math.round(original.height * scaleRef.current / 100));

    if (targetW === original.width && targetH === original.height) {
      putPixels(canvasRef.current, result.data, result.width, result.height);
    } else {
      const copy2 = result.data.slice();
      const scaled = await runInWorker(
        'scale',
        { data: copy2, width: result.width, height: result.height, dstW: targetW, dstH: targetH, method: 'bilinear' },
        [copy2.buffer]
      );
      if (opTokenRef.current !== token) return;
      putPixels(canvasRef.current, scaled.data, scaled.width, scaled.height);
    }
  }, [_drawScaled]);

  /** Деструктивное применение уровней. Возвращает Promise. */
  const applyLevels = useCallback(async (luts) => {
    const original = originalDataRef.current;
    if (!canvasRef.current || !original) return;

    const token  = ++opTokenRef.current;
    const copy   = original.data.slice();
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

    // Сохраняем новый оригинал
    originalDataRef.current = new ImageData(result.data, result.width, result.height);
    skipRedrawRef.current   = true;

    // Рисуем с текущим масштабом
    _drawScaled(originalDataRef.current, scaleRef.current, token);
  }, [_drawScaled]);

  /**
   * Деструктивный ресайз. Возвращает Promise<ImageData>.
   * App вызовет applyScale отдельно.
   */
  const resizeImage = useCallback(async (width, height, methodId = 'bilinear') => {
    const original = originalDataRef.current;
    if (!original) return null;

    const token = ++opTokenRef.current;
    const copy  = original.data.slice();
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
  }, []);

  const clearCanvas = useCallback(() => {
    ++opTokenRef.current; // отменяем все текущие async-операции
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
    applyScale,
    resizeImage,
  };
}