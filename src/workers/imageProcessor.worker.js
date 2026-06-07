/**
 * Web Worker для тяжёлых пиксельных операций.
 * Запускается в отдельном потоке — главный поток не блокируется.
 *
 * Протокол сообщений:
 *   → { id, type, payload }
 *   ← { id, result } | { id, error }
 */

// ─── Nearest Neighbor ─────────────────────────────────────────────────────────
function nearestNeighbor(srcData, srcW, srcH, dstW, dstH) {
  const dst    = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    const srcY   = Math.floor(y * yRatio);
    const srcRow = srcY * srcW;
    const dstRow = y   * dstW;
    for (let x = 0; x < dstW; x++) {
      const srcX   = Math.floor(x * xRatio);
      const srcIdx = (srcRow + srcX) << 2;
      const dstIdx = (dstRow + x)   << 2;
      dst[dstIdx]     = srcData[srcIdx];
      dst[dstIdx + 1] = srcData[srcIdx + 1];
      dst[dstIdx + 2] = srcData[srcIdx + 2];
      dst[dstIdx + 3] = srcData[srcIdx + 3];
    }
  }
  return dst;
}

// ─── Bilinear ─────────────────────────────────────────────────────────────────
function bilinear(srcData, srcW, srcH, dstW, dstH) {
  const dst    = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    const gy = y * yRatio;
    const y0 = gy | 0;                          // Math.floor быстрее через |0
    const y1 = y0 + 1 < srcH ? y0 + 1 : y0;
    const fy = gy - y0;
    const ify = 1 - fy;

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

      const dstIdx = (dstRow + x) << 2;

      // Развёртка вручную быстрее чем цикл по c=0..3
      const w00 = ifx * ify;
      const w10 = fx  * ify;
      const w01 = ifx * fy;
      const w11 = fx  * fy;

      dst[dstIdx]     = (srcData[i00]     * w00 + srcData[i10]     * w10 + srcData[i01]     * w01 + srcData[i11]     * w11 + 0.5) | 0;
      dst[dstIdx + 1] = (srcData[i00 + 1] * w00 + srcData[i10 + 1] * w10 + srcData[i01 + 1] * w01 + srcData[i11 + 1] * w11 + 0.5) | 0;
      dst[dstIdx + 2] = (srcData[i00 + 2] * w00 + srcData[i10 + 2] * w10 + srcData[i01 + 2] * w01 + srcData[i11 + 2] * w11 + 0.5) | 0;
      dst[dstIdx + 3] = (srcData[i00 + 3] * w00 + srcData[i10 + 3] * w10 + srcData[i01 + 3] * w01 + srcData[i11 + 3] * w11 + 0.5) | 0;
    }
  }
  return dst;
}

// ─── LUT ──────────────────────────────────────────────────────────────────────
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

// ─── Гистограмма ──────────────────────────────────────────────────────────────
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

// ─── Диспетчер ────────────────────────────────────────────────────────────────
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
      result  = hists;
      transfer = [
        hists.master.buffer,
        hists.r.buffer,
        hists.g.buffer,
        hists.b.buffer,
        hists.alpha.buffer,
      ];

    } else {
      throw new Error(`Unknown task type: ${type}`);
    }

    self.postMessage({ id, result }, transfer);

  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};