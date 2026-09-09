function bilinearScale(src, sw, sh, dw, dh) {
  const out = new Uint8ClampedArray(dw * dh * 4);
  const xr = sw / dw, yr = sh / dh;

  for (let y = 0; y < dh; y++) {
    let gy = y * yr, y0 = gy | 0, y1 = y0 + 1 < sh ? y0 + 1 : y0, fy = gy - y0, ify = 1 - fy;
    const r0 = y0 * sw, r1 = y1 * sw;
    const destBase = y * dw;

    for (let x = 0; x < dw; x++) {
      let gx = x * xr, x0 = gx | 0, x1 = x0 + 1 < sw ? x0 + 1 : x0, fx = gx - x0, ifx = 1 - fx;
      const d = (destBase + x) << 2;
      const i00 = (r0 + x0) << 2, i10 = (r0 + x1) << 2;
      const i01 = (r1 + x0) << 2, i11 = (r1 + x1) << 2;
      const w00 = ifx * ify, w10 = fx * ify, w01 = ifx * fy, w11 = fx * fy;

      out[d]     = (src[i00]     * w00 + src[i10]     * w10 + src[i01]     * w01 + src[i11]     * w11 + 0.5) | 0;
      out[d + 1] = (src[i00 + 1] * w00 + src[i10 + 1] * w10 + src[i01 + 1] * w01 + src[i11 + 1] * w11 + 0.5) | 0;
      out[d + 2] = (src[i00 + 2] * w00 + src[i10 + 2] * w10 + src[i01 + 2] * w01 + src[i11 + 2] * w11 + 0.5) | 0;
      out[d + 3] = (src[i00 + 3] * w00 + src[i10 + 3] * w10 + src[i01 + 3] * w01 + src[i11 + 3] * w11 + 0.5) | 0;
    }
  }
  return out;
}

function nearestScale(src, sw, sh, dw, dh) {
  const out = new Uint8ClampedArray(dw * dh * 4);
  const xr = sw / dw, yr = sh / dh;
  for (let y = 0; y < dh; y++) {
    const sy = Math.floor(y * yr) * sw;
    const db = y * dw;
    for (let x = 0; x < dw; x++) {
      const i = (sy + Math.floor(x * xr)) << 2;
      const d = (db + x) << 2;
      out[d]     = src[i];
      out[d + 1] = src[i + 1];
      out[d + 2] = src[i + 2];
      out[d + 3] = src[i + 3];
    }
  }
  return out;
}

function samplePadded(data, w, h, x, y, ch, paddingMode) {
  if (x >= 0 && x < w && y >= 0 && y < h) return data[(y * w + x) * 4 + ch];
  if (paddingMode === 0) return 0;
  if (paddingMode === 1) return 255;
  const cx = x < 0 ? 0 : x >= w ? w - 1 : x;
  const cy = y < 0 ? 0 : y >= h ? h - 1 : y;
  return data[(cy * w + cx) * 4 + ch];
}

self.onmessage = function (e) {
  const { id, type, payload } = e.data;

  try {
    let result;
    let transferBuffer = [];

    if (type === 'applyLevelsInPlace') {
      const { data, width, height, luts } = payload;
      const len = data.length;
      const lr = luts.r, lg = luts.g, lb = luts.b, la = luts.a;
      for (let i = 0; i < len; i += 4) {
        data[i]     = lr[data[i]];
        data[i + 1] = lg[data[i + 1]];
        data[i + 2] = lb[data[i + 2]];
        data[i + 3] = la[data[i + 3]];
      }
      result = { data, width, height };
      transferBuffer = [data.buffer];
    }

    else if (type === 'convolveApply') {
      const { data, width: w, height: h, kernel, channels, padding } = payload;
      const out = new Uint8ClampedArray(data.length);
      out.set(data);

      const pMod = padding === 'black' ? 0 : padding === 'white' ? 1 : 2;
      const nch = channels.length;
      const RP_E = Math.max(1, Math.floor(h * 0.05));
      const k0 = kernel[0], k1 = kernel[1], k2 = kernel[2];
      const k3 = kernel[3], k4 = kernel[4], k5 = kernel[5];
      const k6 = kernel[6], k7 = kernel[7], k8 = kernel[8];

      for (let y = 1; y < h - 1; y++) {
        const rP = (y - 1) * w, rC = y * w, rN = (y + 1) * w;
        for (let x = 1; x < w - 1; x++) {
          for (let ci = 0; ci < nch; ci++) {
            const chKey = channels[ci];
            const isGrayMode = chKey === 'gray' || chKey === -1;
            const readCh = isGrayMode ? 0 : chKey;

            let sum = 0;
            sum += data[((rP + x - 1) << 2) + readCh] * k0 + data[((rP + x) << 2) + readCh] * k1 + data[((rP + x + 1) << 2) + readCh] * k2;
            sum += data[((rC + x - 1) << 2) + readCh] * k3 + data[((rC + x) << 2) + readCh] * k4 + data[((rC + x + 1) << 2) + readCh] * k5;
            sum += data[((rN + x - 1) << 2) + readCh] * k6 + data[((rN + x) << 2) + readCh] * k7 + data[((rN + x + 1) << 2) + readCh] * k8;
            const clamped = sum < 0 ? 0 : sum > 255 ? 255 : Math.round(sum);

            if (isGrayMode) {
              out[((rC + x) << 2)]     = clamped;
              out[((rC + x) << 2) + 1] = clamped;
              out[((rC + x) << 2) + 2] = clamped;
            } else {
              out[((rC + x) << 2) + chKey] = clamped;
            }
          }
        }
        if (y % RP_E === 0) self.postMessage({ id, progress: Math.round((y / h) * 100) });
      }

      const bps = [];
      for (let x = 0; x < w; x++) {
        bps.push([x, 0]);
        bps.push([x, h - 1]);
      }
      for (let y = 1; y < h - 1; y++) {
        bps.push([0, y]);
        bps.push([w - 1, y]);
      }

      for (let i = 0; i < bps.length; i++) {
        const x = bps[i][0], y = bps[i][1], db = (y * w + x) << 2;
        for (let ci = 0; ci < nch; ci++) {
          const chKey = channels[ci];
          const isGrayMode = chKey === 'gray' || chKey === -1;
          const readChannel = isGrayMode ? 0 : chKey;
          let sum = 0, ki = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              sum += kernel[ki++] * samplePadded(data, w, h, x + kx, y + ky, readChannel, pMod);
            }
          }
          const clamped = sum < 0 ? 0 : sum > 255 ? 255 : Math.round(sum);
          if (isGrayMode) {
            out[db]     = clamped;
            out[db + 1] = clamped;
            out[db + 2] = clamped;
          } else {
            out[db + chKey] = clamped;
          }
        }
      }

      self.postMessage({ id, progress: 100 });
      result = { data: out, width: w, height: h };
      transferBuffer = [out.buffer];
    }

    else if (type === 'scaleDirectApply' || type === 'scaleClonedPreview') {
      const { data, width, height, dstW, dstH, method } = payload;
      const out = method === 'nearest'
        ? nearestScale(data, width, height, dstW, dstH)
        : bilinearScale(data, width, height, dstW, dstH);
      result = { data: out, width: dstW, height: dstH };
      transferBuffer = [out.buffer];
    }

    else {
      throw new Error('Unknown method ' + type);
    }

    self.postMessage({ id, result }, transferBuffer);

  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};