import { decodeGB7, isGB7 } from './gb7.js';
import { getChannelCount, getChannelDescriptors } from './channelUtils.js';

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
          const chCount = result.hasMask ? 2 : 1;
          const descriptors = getChannelDescriptors(chCount);

          resolve({
            imageData: result.imageData,
            width: result.width,
            height: result.height,
            colorDepth: result.hasMask
              ? '8 бит (7 бит серый + 1 бит маска)'
              : '7 бит (оттенки серого)',
            fileName: file.name,
            format: 'GB7',
            channelCount: chCount,
            channelDescriptors: descriptors,
            hasMask: result.hasMask
          });
        } else {
          const blob = new Blob([buffer], { type: file.type || `image/${ext}` });
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

            const format = (ext === 'jpeg' || ext === 'jpg') ? 'JPG' : ext.toUpperCase();
            const chCount = getChannelCount(imageData, format, false);
            const descriptors = getChannelDescriptors(chCount);

            let colorDepth = '24 бит (RGB)';
            if (format === 'JPG' || format === 'JPEG') {
              colorDepth = chCount === 1 ? '8 бит (оттенки серого)' : '24 бит (RGB, без Alpha)';
            } else if (chCount === 4) {
              colorDepth = '32 бит (24 бит RGB + 8 бит Alpha)';
            } else if (chCount === 3) {
              colorDepth = '24 бит (RGB, без Alpha)';
            } else if (chCount === 2) {
              colorDepth = '16 бит (8 бит Gray + 8 бит Alpha)';
            } else if (chCount === 1) {
              colorDepth = '8 бит (оттенки серого)';
            }

            resolve({
              imageData,
              width: img.naturalWidth,
              height: img.naturalHeight,
              colorDepth,
              fileName: file.name,
              format,
              channelCount: chCount,
              channelDescriptors: descriptors,
              hasMask: false
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