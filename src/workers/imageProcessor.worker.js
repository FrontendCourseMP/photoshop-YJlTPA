/**
 * Web Worker для тяжёлых пиксельных операций.
 *
 * Протокол:
 *   → { id, type, payload }
 *   ← { id, result }       — финальный результат
 *   ← { id, progress }     — промежуточный прогресс (только для convolve)
 *   ← { id, error }        — ошибка
 */

// ─── Nearest Neighbor ────────────────────────────────────────────────────────
function nearestNeighbor(srcData, srcW, srcH, dstW, dstH) {
  const dst    = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    const srcRow = Math.floor(y * yRatio) * srcW;
    const dstRow = y * dstW;
    for (let x = 0; x < dstW; x++) {
      const s = (srcRow + Math.floor(x * xRatio)) << 2;
      const d = (dstRow + x) << 2;
      dst[d]     = srcData[s];
      dst[d + 1] = srcData[s + 1];
      dst[d + 2] = srcData[s + 2];
      dst[d + 3] = srcData[s + 3];
    }
  }
  return dst;
}

// ─── Bilinear ────────────────────────────────────────────────────────────────
function bilinear(srcData, srcW, srcH, dstW, dstH) {
  const dst    = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    const gy   = y * yRatio;
    const y0   = gy | 0;
    const y1   = y0 + 1 < srcH ? y0 + 1 : y0;
    const fy   = gy - y0;
    const ify  = 1 - fy;
    const row0 = y0 * srcW;
    const row1 = y1 * srcW;
    const dstRow = y * dstW;
    for (let x = 0; x < dstW; x++) {
      const gx  = x * xRatio;
      const x0  = gx | 0;
      const x1  = x0 + 1 < srcW ? x0 + 1 : x0;
      const fx  = gx - x0;
      const ifx = 1 - fx;
      const i00 = (row0 + x0) << 2;
      const i10 = (row0 + x1) << 2;
      const i01 = (row1 + x0) << 2;
      const i11 = (row1 + x1) << 2;
      const d   = (dstRow + x) << 2;
      const w00 = ifx * ify;
      const w10 = fx  * ify;
      const w01 = ifx * fy;
      const w11 = fx  * fy;
      dst[d]     = (srcData[i00]     * w00 + srcData[i10]     * w10 + srcData[i01]     * w01 + srcData[i11]     * w11 + 0.5) | 0;
      dst[d + 1] = (srcData[i00 + 1] * w00 + srcData[i10 + 1] * w10 + srcData[i01 + 1] * w01 + srcData[i11 + 1] * w11 + 0.5) | 0;
      dst[d + 2] = (srcData[i00 + 2] * w00 + srcData[i10 + 2] * w10 + srcData[i01 + 2] * w01 + srcData[i11 + 2] * w11 + 0.5) | 0;
      dst[d + 3] = (srcData[i00 + 3] * w00 + srcData[i10 + 3] * w10 + srcData[i01 + 3] * w01 + srcData[i11 + 3] * w11 + 0.5) | 0;
    }
  }
  return dst;
}

// ─── LUT ─────────────────────────────────────────────────────────────────────
function applyLUTs(srcData, lutR, lutG, lutB, lutA) {
  const len = srcData.length;
  const out = new Uint8ClampedArray(len);
  for (let i = 0; i < len; i += 4) {
    out[i]     = lutR[srcData[i]];
    out[i + 1] = lutG[srcData[i + 1]];
    out[i + 2] = lutB[srcData[i + 2]];
    out[i + 3] = lutA[srcData[i + 3]];
  }
  return out;
}

// ─── Гистограмма ─────────────────────────────────────────────────────────────
function buildAllHistograms(srcData) {
  const len    = srcData.length;
  const master = new Uint32Array(256);
  const r      = new Uint32Array(256);
  const g      = new Uint32Array(256);
  const b      = new Uint32Array(256);
  const alpha  = new Uint32Array(256);
  for (let i = 0; i < len; i += 4) {
    const rv = srcData[i];
    const gv = srcData[i + 1];
    const bv = srcData[i + 2];
    const av = srcData[i + 3];
    r[rv]++;
    g[gv]++;
    b[bv]++;
    alpha[av]++;
    master[(76 * rv + 150 * gv + 30 * bv) >> 8]++;
  }
  return { master, r, g, b, alpha };
}

// ─── Свёртка (Convolution) — оптимизированная ────────────────────────────────
//
// Центр (99%+ пикселей) обрабатывается без единого if и без вызовов функций.
// Граница (1px рамка) — отдельно, с getSamplePadded, но их ничтожно мало.

function getSamplePadded(data, w, h, x, y, ch, paddingMode) {
  if (x >= 0 && x < w && y >= 0 && y < h) {
    return data[(y * w + x) * 4 + ch];
  }
  if (paddingMode === 0) return 0;    // black
  if (paddingMode === 1) return 255;  // white
  // replicate
  const cx = x < 0 ? 0 : x >= w ? w - 1 : x;
  const cy = y < 0 ? 0 : y >= h ? h - 1 : y;
  return data[(cy * w + cx) * 4 + ch];
}

function convolve(id, data, w, h, kernel, channels, padding) {
  const out = new Uint8ClampedArray(data.length);
  out.set(data);

  const paddingMode = padding === 'black' ? 0 : padding === 'white' ? 1 : 2;

  const k0 = kernel[0], k1 = kernel[1], k2 = kernel[2];
  const k3 = kernel[3], k4 = kernel[4], k5 = kernel[5];
  const k6 = kernel[6], k7 = kernel[7], k8 = kernel[8];

  const nch = channels.length;
  const REPORT_EVERY = Math.max(1, Math.floor(h * 0.05));

  // ── Центр (без граничных проверок) ──
  for (let y = 1; y < h - 1; y++) {
    const rowPrev = (y - 1) * w;
    const rowCurr =  y      * w;
    const rowNext = (y + 1) * w;

    for (let x = 1; x < w - 1; x++) {
      const p00 = (rowPrev + x - 1) << 2;
      const p01 = (rowPrev + x    ) << 2;
      const p02 = (rowPrev + x + 1) << 2;
      const p10 = (rowCurr + x - 1) << 2;
      const p11 = (rowCurr + x    ) << 2;
      const p12 = (rowCurr + x + 1) << 2;
      const p20 = (rowNext + x - 1) << 2;
      const p21 = (rowNext + x    ) << 2;
      const p22 = (rowNext + x + 1) << 2;

      for (let ci = 0; ci < nch; ci++) {
        const ch = channels[ci];
        const acc =
          k0 * data[p00 + ch] +
          k1 * data[p01 + ch] +
          k2 * data[p02 + ch] +
          k3 * data[p10 + ch] +
          k4 * data[p11 + ch] +
          k5 * data[p12 + ch] +
          k6 * data[p20 + ch] +
          k7 * data[p21 + ch] +
          k8 * data[p22 + ch];

        out[p11 + ch] = acc < 0 ? 0 : acc > 255 ? 255 : acc;
      }
    }

    if (y % REPORT_EVERY === 0) {
      self.postMessage({ id, progress: Math.round((y / h) * 100) });
    }
  }

  // ── Граница (1px рамка) ──
  const borderPixels = [];
  for (let x = 0; x < w; x++) borderPixels.push([x, 0]);
  for (let x = 0; x < w; x++) borderPixels.push([x, h - 1]);
  for (let y = 1; y < h - 1; y++) {
    borderPixels.push([0, y]);
    borderPixels.push([w - 1, y]);
  }

  for (let bi = 0; bi < borderPixels.length; bi++) {
    const [x, y] = borderPixels[bi];
    const base = (y * w + x) * 4;
    for (let ci = 0; ci < nch; ci++) {
      const ch = channels[ci];
      let acc = 0, ki = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          acc += kernel[ki++] * getSamplePadded(data, w, h, x + kx, y + ky, ch, paddingMode);
        }
      }
      out[base + ch] = acc < 0 ? 0 : acc > 255 ? 255 : acc;
    }
  }

  self.postMessage({ id, progress: 100 });
  return out;
}

// ─── Диспетчер ───────────────────────────────────────────────────────────────
self.onmessage = function (e) {
  const { id, type, payload } = e.data;
  try {
    let result;
    let transfer = [];

    if (type === 'scale') {
      const { data, width, height, dstW, dstH, method } = payload;
      const fn  = method === 'nearest' ? nearestNeighbor : bilinear;
      const out = fn(data, width, height, dstW, dstH);
      result    = { data: out, width: dstW, height: dstH };
      transfer  = [out.buffer];

    } else if (type === 'applyLUTs') {
      const { data, lutR, lutG, lutB, lutA } = payload;
      const out = applyLUTs(data, lutR, lutG, lutB, lutA);
      result    = { data: out, width: payload.width, height: payload.height };
      transfer  = [out.buffer];

    } else if (type === 'buildHistograms') {
      const { data } = payload;
      const hists = buildAllHistograms(data);
      result   = hists;
      transfer = [
        hists.master.buffer,
        hists.r.buffer,
        hists.g.buffer,
        hists.b.buffer,
        hists.alpha.buffer,
      ];

    } else if (type === 'convolve') {
      const { data, width, height, kernel, channels, padding } = payload;
      const out = convolve(id, data, width, height, kernel, channels, padding);
      result    = { data: out, width, height };
      transfer  = [out.buffer];

    } else {
      throw new Error(`Unknown task type: ${type}`);
    }

    self.postMessage({ id, result }, transfer);

  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};