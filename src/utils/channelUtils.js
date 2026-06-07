// Определение типа изображения и генерация данных для панели каналов

export function getChannelCount(imageData) {
  const { data, width, height } = imageData;
  const pixelCount = width * height;

  let hasColor = false;
  let hasAlpha = false;

  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];
    if (r !== g || g !== b) hasColor = true;
    if (a < 255) hasAlpha = true;
    if (hasColor && hasAlpha) break;
  }

  if (!hasColor && !hasAlpha) return 1;
  if (!hasColor && hasAlpha)  return 2;
  if (hasColor  && !hasAlpha) return 3;
  return 4;
}

export function getChannelDescriptors(channelCount) {
  if (channelCount === 1) {
    return [{ id: 'gray', label: 'Gray', color: null }];
  }
  if (channelCount === 2) {
    return [
      { id: 'gray',  label: 'Gray',  color: null },
      { id: 'alpha', label: 'Alpha', color: null },
    ];
  }
  if (channelCount === 3) {
    return [
      { id: 'r', label: 'Red',   color: '#e05555' },
      { id: 'g', label: 'Green', color: '#3d9a50' },
      { id: 'b', label: 'Blue',  color: '#2563be' },
    ];
  }
  return [
    { id: 'r',     label: 'Red',   color: '#e05555' },
    { id: 'g',     label: 'Green', color: '#3d9a50' },
    { id: 'b',     label: 'Blue',  color: '#2563be' },
    { id: 'alpha', label: 'Alpha', color: null },
  ];
}

// Grayscale-превью одного канала для миниатюры
export function buildChannelPreview(sourceData, channelId) {
  const { data, width, height } = sourceData;
  const pixelCount = width * height;
  const out = new Uint8ClampedArray(pixelCount * 4);

  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];
    let v = 0;

    switch (channelId) {
      case 'r':     v = r; break;
      case 'g':     v = g; break;
      case 'b':     v = b; break;
      case 'alpha': v = a; break;
      case 'gray':
      default:      v = Math.round(0.299 * r + 0.587 * g + 0.114 * b); break;
    }

    out[i * 4]     = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }

  return new ImageData(out, width, height);
}

// Применяет маску активных каналов, не трогает оригинал
export function applyChannelMask(sourceData, activeChannels, channelCount) {
  const { data, width, height } = sourceData;
  const pixelCount = width * height;
  const out = new Uint8ClampedArray(pixelCount * 4);

  const useR     = activeChannels.has('r');
  const useG     = activeChannels.has('g');
  const useB     = activeChannels.has('b');
  const useAlpha = activeChannels.has('alpha');
  const useGray  = activeChannels.has('gray');

  const onlyAlpha = activeChannels.size === 1 && useAlpha;

  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];

    // ОТРЕДАКТИРОВАНО: При полном выключении рисунок становится
    // абсолютно чёрным цветом без альфы (R,G,B = 0 | Alpha = 255)
    if (activeChannels.size === 0) {
      out[i * 4]     = 0;
      out[i * 4 + 1] = 0;
      out[i * 4 + 2] = 0;
      out[i * 4 + 3] = 255;
      continue;
    }

    if (onlyAlpha) {
      out[i * 4]     = a;
      out[i * 4 + 1] = a;
      out[i * 4 + 2] = a;
      out[i * 4 + 3] = 255;
      continue;
    }

    if (channelCount <= 2) {
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      const gv = useGray ? gray : 0;
      out[i * 4]     = gv;
      out[i * 4 + 1] = gv;
      out[i * 4 + 2] = gv;
      out[i * 4 + 3] = (channelCount === 2) ? (useAlpha ? a : 255) : 255;
    } else {
      out[i * 4]     = useR ? r : 0;
      out[i * 4 + 1] = useG ? g : 0;
      out[i * 4 + 2] = useB ? b : 0;
      out[i * 4 + 3] = (channelCount === 4) ? (useAlpha ? a : 255) : 255;
    }
  }

  return new ImageData(out, width, height);
}