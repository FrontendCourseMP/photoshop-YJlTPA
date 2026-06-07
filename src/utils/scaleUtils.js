/** Диапазон масштабов в % */
export const SCALE_MIN = 12;
export const SCALE_MAX = 300;

/** Пресеты для выпадающего списка в инфопанели */
export const SCALE_PRESETS = [12, 25, 33, 50, 67, 75, 100, 150, 200, 300];

/**
 * Вычисляет начальный масштаб так, чтобы изображение помещалось
 * в контейнер с отступом padding с каждой стороны,
 * не выходя за диапазон SCALE_MIN..SCALE_MAX.
 */
export function fitScale(imgW, imgH, containerW, containerH, padding = 50) {
  const availW = containerW - padding * 2;
  const availH = containerH - padding * 2;
  if (availW <= 0 || availH <= 0) return 100;

  const scaleW = (availW / imgW) * 100;
  const scaleH = (availH / imgH) * 100;
  const scale  = Math.min(scaleW, scaleH);

  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(scale)));
}

/**
 * Клампит масштаб в допустимый диапазон [SCALE_MIN, SCALE_MAX].
 */
export function clampScale(value) {
  const n = parseFloat(value);
  if (isNaN(n)) return 100;
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(n)));
}