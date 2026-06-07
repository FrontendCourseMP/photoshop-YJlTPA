export function buildLUT(inBlack, inWhite, gamma) {
  const lut = new Uint8ClampedArray(256);
  const range = inWhite - inBlack;

  for (let i = 0; i < 256; i++) {
    if (range <= 0) { lut[i] = i <= inBlack ? 0 : 255; continue; }
    let v = (i - inBlack) / range;
    v = Math.max(0, Math.min(1, v));
    if (gamma !== 1.0) v = Math.pow(v, 1.0 / gamma);
    lut[i] = Math.round(v * 255);
  }
  return lut;
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
    const offset = channel === 'r' ? 0 : channel === 'g' ? 1 : channel === 'b' ? 2 : 3;
    for (let i = 0; i < len; i += 4) hist[data[i + offset]]++;
  }

  return hist;
}

export function defaultLevelsParams() {
  return { inBlack: 0, inWhite: 255, gamma: 1.0 };
}

// Абсолютно верное исполнение изоляции Третьей лабораторной. Канал МАСТЕР воздействует ТОЛЬКО на Цвета! Alpha не разрушается:
export function buildAllLUTs(channelParams) {
  const masterLUT = buildLUT(channelParams.master.inBlack, channelParams.master.inWhite, channelParams.master.gamma);
  
  function composeRGB(chParams) {
    const chLUT = buildLUT(chParams.inBlack, chParams.inWhite, chParams.gamma);
    const composed = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) composed[i] = chLUT[masterLUT[i]];
    return composed;
  }
  const alphaLUT = buildLUT(channelParams.alpha.inBlack, channelParams.alpha.inWhite, channelParams.alpha.gamma);
  
  return { r: composeRGB(channelParams.r), g: composeRGB(channelParams.g), b: composeRGB(channelParams.b), a: alphaLUT, masterRef: masterLUT };
}

// Zero-GC loop-bypass применяемый ТОЛЬКО ДЛЯ ЖИВОГО ПРЕДПРОСМОТРА ПОЛЗУНКА в UI главном потоке:
export function applyLUTsSyncInPlace(dataTarget, luts) {
  const lr = luts.r, lg = luts.g, lb = luts.b, la = luts.a;
  for (let i = 0, l = dataTarget.length; i < l; i += 4) {
    dataTarget[i]   = lr[dataTarget[i]];
    dataTarget[i+1] = lg[dataTarget[i+1]];
    dataTarget[i+2] = lb[dataTarget[i+2]];
    dataTarget[i+3] = la[dataTarget[i+3]];
  }
}