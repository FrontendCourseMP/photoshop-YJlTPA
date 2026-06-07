import { useState, useCallback, useRef } from 'react';
import { scaleImage } from '../utils/interpolation';
import { SCALE_MIN, SCALE_MAX } from '../utils/scaleUtils';

/**
 * Вычисляет начальный zoom в долях (0.12–3.0),
 * чтобы изображение вписалось в контейнер с отступом 50px.
 */
export function calcInitialZoom(imgW, imgH, containerW, containerH) {
  const availW = containerW - 100;
  const availH = containerH - 100;
  if (availW <= 0 || availH <= 0) return 1;

  const minZoom = SCALE_MIN / 100;
  const maxZoom = SCALE_MAX / 100;
  const zoom    = Math.min(availW / imgW, availH / imgH, maxZoom);
  return Math.max(zoom, minZoom);
}

export function useZoom() {
  const [zoom, setZoom]   = useState(1);
  const methodRef         = useRef('bilinear');

  /**
   * Рисует imageData на canvas с заданным zoom-коэффициентом.
   * methodId — 'bilinear' | 'nearest'. По умолчанию 'bilinear'.
   */
  const applyZoom = useCallback((imageData, canvas, zoomValue, methodId = 'bilinear') => {
    if (!imageData || !canvas) return;
    methodRef.current = methodId;

    const dstW = Math.max(1, Math.round(imageData.width  * zoomValue));
    const dstH = Math.max(1, Math.round(imageData.height * zoomValue));

    const scaled      = scaleImage(imageData, dstW, dstH, methodId);
    canvas.width      = scaled.width;
    canvas.height     = scaled.height;
    canvas.getContext('2d').putImageData(scaled, 0, 0);
  }, []);

  /**
   * Меняет zoom, возвращает скляванное значение.
   */
  const changeZoom = useCallback((newZoom) => {
    const minZoom = SCALE_MIN / 100;
    const maxZoom = SCALE_MAX / 100;
    const clamped = Math.max(minZoom, Math.min(maxZoom, newZoom));
    setZoom(clamped);
    return clamped;
  }, []);

  return { zoom, setZoom, changeZoom, applyZoom };
}