import { decodeGB7, isGB7 } from './gb7.js';

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));

    reader.onload = async (e) => {
      const buffer = e.target.result;
      const ext = file.name.split('.').pop().toLowerCase();

      try {
        if (ext === 'gb7' || isGB7(buffer)) {
          const result = decodeGB7(buffer);
          resolve({
            imageData: result.imageData,
            width: result.width,
            height: result.height,
            colorDepth: result.hasMask
              ? '8 бит (7 бит серый + 1 бит маска)'
              : '7 бит (оттенки серого)',
            fileName: file.name,
            format: 'GB7',
          });
        } else {
          const blob = new Blob([buffer], { type: file.type || 'image/' + ext });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve({
              imageData,
              width: img.naturalWidth,
              height: img.naturalHeight,
              colorDepth: '24 бит (RGB) + 8 бит Alpha',
              fileName: file.name,
              format: ext.toUpperCase(),
            });
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Не удалось декодировать изображение'));
          };
          img.src = url;
        }
      } catch (err) {
        reject(err);
      }
    };

    reader.readAsArrayBuffer(file);
  });
}