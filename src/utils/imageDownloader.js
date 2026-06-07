import { encodeGB7 } from './gb7.js';

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stripExt(fileName) {
  return fileName.replace(/\.[^/.]+$/, '');
}

export function downloadAsPNG(canvas, fileName) {
  canvas.toBlob((blob) => saveBlob(blob, `${stripExt(fileName)}.png`), 'image/png');
}

export function downloadAsJPEG(canvas, fileName, quality = 0.92) {
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);
  flat.toBlob((blob) => saveBlob(blob, `${stripExt(fileName)}.jpg`), 'image/jpeg', quality);
}

export function downloadAsGB7(canvas, fileName) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bytes = encodeGB7(imageData);
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  saveBlob(blob, `${stripExt(fileName)}.gb7`);
}