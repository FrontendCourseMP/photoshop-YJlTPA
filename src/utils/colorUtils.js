// Конвертация RGB (0-255) в CIE L*a*b* через XYZ, белая точка D65

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToXyz(r, g, b) {
  // Матрица sRGB -> XYZ D65
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
  return { x, y, z };
}

function xyzToLab(x, y, z) {
  const xn = 0.95047;
  const yn = 1.00000;
  const zn = 1.08883;

  function f(t) {
    return t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + (16 / 116);
  }

  const fx = f(x / xn);
  const fy = f(y / yn);
  const fz = f(z / zn);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bStar = 200 * (fy - fz);

  return { L, a, b: bStar };
}

export function rgbToLab(r, g, b) {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  const { x, y, z } = linearToXyz(rl, gl, bl);
  return xyzToLab(x, y, z);
}