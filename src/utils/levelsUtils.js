export function buildLUT(inBlack, inWhite, gamma) {
  const lut = new Uint8ClampedArray(256);
  const range = inWhite - inBlack;

  for (let i = 0; i < 256; i++) {
    if (range <= 0) {
      lut[i] = i <= inBlack ? 0 : 255;
      continue;
    }
    let v = (i - inBlack) / range;
    v = Math.max(0, Math.min(1, v));
    if (gamma !== 1.0) {
      v = Math.pow(v, 1.0 / gamma);
    }
    lut[i] = Math.round(v * 255);
  }

  return lut;
}

export function applyLUTs(src, luts) {
  const srcData = src.data;
  const len = srcData.length;
  const out = new Uint8ClampedArray(len);

  const lutR = luts.r;
  const lutG = luts.g;
  const lutB = luts.b;
  const lutA = luts.a;

  // Обычный последовательный цикл оптимален для JIT-компиляторов браузера.
  // Они автоматически применяют векторизацию (SIMD) на низком уровне.
  for (let i = 0; i < len; i += 4) {
    out[i]     = lutR[srcData[i]];
    out[i + 1] = lutG[srcData[i + 1]];
    out[i + 2] = lutB[srcData[i + 2]];
    out[i + 3] = lutA[srcData[i + 3]];
  }

  return new ImageData(out, src.width, src.height);
}

export function buildHistogram(imageData, channel) {
  const hist = new Uint32Array(256);
  const data = imageData.data;
  const len = data.length;

  if (channel === 'master') {
    for (let i = 0; i < len; i += 4) {
      const lum = (76 * data[i] + 150 * data[i + 1] + 30 * data[i + 2]) >> 8;
      hist[lum]++;
    }
  } else {
    const offset = channel === 'r' ? 0
                 : channel === 'g' ? 1
                 : channel === 'b' ? 2
                 : 3;
    for (let i = 0; i < len; i += 4) {
      hist[data[i + offset]]++;
    }
  }

  return hist;
}

export function defaultLevelsParams() {
  return { inBlack: 0, inWhite: 255, gamma: 1.0 };
}

export function buildAllLUTs(channelParams) {
  const masterLUT = buildLUT(
    channelParams.master.inBlack,
    channelParams.master.inWhite,
    channelParams.master.gamma,
  );

  function compose(chParams) {
    const chLUT = buildLUT(chParams.inBlack, chParams.inWhite, chParams.gamma);
    const composed = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      composed[i] = chLUT[masterLUT[i]];
    }
    return composed;
  }

  return {
    r: compose(channelParams.r),
    g: compose(channelParams.g),
    b: compose(channelParams.b),
    a: compose(channelParams.alpha),
  };
}