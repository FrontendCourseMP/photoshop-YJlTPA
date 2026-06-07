/**
 * Nearest Neighbor interpolation
 * Быстрый, пиксельный эффект. Хорош для pixel-art.
 */
function nearestNeighbor(srcData, srcW, srcH, dstW, dstH) {
  const dst = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const srcIdx = (srcY * srcW + srcX) * 4;
      const dstIdx = (y * dstW + x) * 4;
      dst[dstIdx]     = srcData[srcIdx];
      dst[dstIdx + 1] = srcData[srcIdx + 1];
      dst[dstIdx + 2] = srcData[srcIdx + 2];
      dst[dstIdx + 3] = srcData[srcIdx + 3];
    }
  }
  return new ImageData(dst, dstW, dstH);
}

/**
 * Bilinear interpolation
 * Плавный результат, стандарт для масштабирования фото.
 */
function bilinear(srcData, srcW, srcH, dstW, dstH) {
  const dst = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const gx = x * xRatio;
      const gy = y * yRatio;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const y1 = Math.min(y0 + 1, srcH - 1);
      const fx = gx - x0;
      const fy = gy - y0;

      const i00 = (y0 * srcW + x0) * 4;
      const i10 = (y0 * srcW + x1) * 4;
      const i01 = (y1 * srcW + x0) * 4;
      const i11 = (y1 * srcW + x1) * 4;

      const dstIdx = (y * dstW + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top    = srcData[i00 + c] * (1 - fx) + srcData[i10 + c] * fx;
        const bottom = srcData[i01 + c] * (1 - fx) + srcData[i11 + c] * fx;
        dst[dstIdx + c] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
  }
  return new ImageData(dst, dstW, dstH);
}

/**
 * Универсальная точка входа — сюда легко добавить новые методы.
 * По умолчанию используется билинейная интерполяция.
 */
export const INTERPOLATION_METHODS = {
  bilinear: {
    id: 'bilinear',
    label: 'Билинейная',
    tooltip: 'Усредняет 4 соседних пикселя. Даёт плавный результат без резких границ. Подходит для фотографий.',
    fn: bilinear,
  },
  nearest: {
    id: 'nearest',
    label: 'Ближайший сосед',
    tooltip: 'Копирует ближайший пиксель без смешивания. Быстрый, сохраняет чёткие границы. Подходит для pixel-art.',
    fn: nearestNeighbor,
  },
};

/**
 * Масштабирует ImageData до указанных размеров выбранным методом.
 * По умолчанию — билинейная интерполяция.
 */
export function scaleImage(imageData, dstW, dstH, methodId = 'bilinear') {
  const method = INTERPOLATION_METHODS[methodId];
  if (!method) throw new Error(`Unknown interpolation method: ${methodId}`);
  return method.fn(imageData.data, imageData.width, imageData.height, dstW, dstH);
}