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
  if (channelCount === 1) return [{ id: 'gray', label: 'Gray', color: null }];
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

export function buildChannelPreview(sourceData, channelId) {
  const { data, width, height } = sourceData;
  const out = new Uint8ClampedArray(data.length);

  for (let i = 0; i < data.length; i += 4) {
    switch (channelId) {
      case 'r':
        out[i] = data[i]; out[i+1] = 0; out[i+2] = 0;
        break;
      case 'g':
        out[i] = 0; out[i+1] = data[i+1]; out[i+2] = 0;
        break;
      case 'b':
        out[i] = 0; out[i+1] = 0; out[i+2] = data[i+2];
        break;
      case 'alpha': {
        const v = data[i+3];
        out[i] = out[i+1] = out[i+2] = v;
        break;
      }
      default: {
        const v = (data[i] * 76 + data[i+1] * 150 + data[i+2] * 28) >> 8;
        out[i] = out[i+1] = out[i+2] = v;
      }
    }
    out[i+3] = 255;
  }
  return new ImageData(out, width, height);
}

export function applyChannelMask(sourceData, activeChannels, channelCount, overrideLuts = null) {
  const { data, width, height } = sourceData;
  const out = new Uint8ClampedArray(data.length);

  const useR = activeChannels.has('r');
  const useG = activeChannels.has('g');
  const useB = activeChannels.has('b');
  const useAlpha = activeChannels.has('alpha');
  const useGray = activeChannels.has('gray');
  const onlyAlpha = activeChannels.size === 1 && useAlpha;

  const rLut = overrideLuts?.r;
  const gLut = overrideLuts?.g;
  const bLut = overrideLuts?.b;
  const aLut = overrideLuts?.alpha;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];

    if (overrideLuts) {
      r = rLut[r]; g = gLut[g]; b = bLut[b]; a = aLut[a];
    }

    if (activeChannels.size === 0) {
      out[i] = out[i+1] = out[i+2] = 0; out[i+3] = 255;
      continue;
    }

    if (onlyAlpha) {
      out[i] = out[i+1] = out[i+2] = a; out[i+3] = 255;
      continue;
    }

    if (channelCount <= 2) {
      const gray = (r * 76 + g * 150 + b * 28) >> 8;
      const gv = useGray ? gray : 0;
      out[i] = out[i+1] = out[i+2] = gv;
      out[i+3] = (channelCount === 2) ? (useAlpha ? a : 255) : 255;
    } else {
      out[i]   = useR ? r : 0;
      out[i+1] = useG ? g : 0;
      out[i+2] = useB ? b : 0;
      out[i+3] = (channelCount === 4) ? (useAlpha ? a : 255) : 255;
    }
  }
  return new ImageData(out, width, height);
}