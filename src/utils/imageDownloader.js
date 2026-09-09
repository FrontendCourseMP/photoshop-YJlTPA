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

function createFullCanvas(imageData) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function downloadAsPNG(imageData, fileName) {
  const canvas = createFullCanvas(imageData);
  canvas.toBlob((blob) => {
    if (blob) saveBlob(blob, `${stripExt(fileName)}.png`);
  }, 'image/png');
}

export function downloadAsJPEG(imageData, fileName, quality = 0.92) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const temp = createFullCanvas(imageData);
  ctx.drawImage(temp, 0, 0);

  canvas.toBlob((blob) => {
    if (blob) saveBlob(blob, `${stripExt(fileName)}.jpg`);
  }, 'image/jpeg', quality);
}

export function downloadAsGB7(imageData, fileName) {
  const bytes = encodeGB7(imageData);
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  saveBlob(blob, `${stripExt(fileName)}.gb7`);
}
