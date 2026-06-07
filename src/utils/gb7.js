/**
 * Кодек формата GrayBit-7 (GB7)
 *
 * Структура файла:
 *   Байты 0-3:   Сигнатура 0x47 0x42 0x37 0x1D (GB7·)
 *   Байт  4:     Версия (0x01)
 *   Байт  5:     Флаг (бит 0 = наличие маски)
 *   Байты 6-7:   Ширина big-endian uint16
 *   Байты 8-9:   Высота big-endian uint16
 *   Байты 10-11: Зарезервировано 0x0000
 *   Байты 12+:   Пиксели, 1 байт каждый
 *     Биты 6-0:  яркость 0-127
 *     Бит 7:     маска (1=непрозрачный, 0=прозрачный)
 */

const SIGNATURE = [0x47, 0x42, 0x37, 0x1D];
const VERSION = 0x01;
const HEADER_SIZE = 12;

export function decodeGB7(buffer) {
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== SIGNATURE[i]) {
      throw new Error(
        `Неверная сигнатура файла: ожидается 47 42 37 1D, ` +
        `получено ${bytes[0].toString(16)} ${bytes[1].toString(16)} ` +
        `${bytes[2].toString(16)} ${bytes[3].toString(16)}`
      );
    }
  }

  const version = bytes[4];
  if (version !== VERSION) {
    throw new Error(`Неподдерживаемая версия GB7: ${version}`);
  }

  const flagByte = bytes[5];
  const hasMask = (flagByte & 0x01) === 1;

  // big-endian
  const width  = (bytes[6] << 8) | bytes[7];
  const height = (bytes[8] << 8) | bytes[9];

  if (width === 0 || height === 0) {
    throw new Error('Файл содержит изображение с нулевыми размерами');
  }

  const pixelCount = width * height;
  if (bytes.length - HEADER_SIZE < pixelCount) {
    throw new Error(`Файл повреждён: нужно ${pixelCount} байт пикселей, доступно ${bytes.length - HEADER_SIZE}`);
  }

  const rgba = new Uint8ClampedArray(pixelCount * 4);

  for (let i = 0; i < pixelCount; i++) {
    const byte = bytes[HEADER_SIZE + i];
    const gray7 = byte & 0x7F;
    const gray8 = Math.round((gray7 / 127) * 255);
    const maskBit = (byte >> 7) & 0x01;
    const alpha = hasMask ? (maskBit === 1 ? 255 : 0) : 255;

    const o = i * 4;
    rgba[o]     = gray8;
    rgba[o + 1] = gray8;
    rgba[o + 2] = gray8;
    rgba[o + 3] = alpha;
  }

  return { width, height, hasMask, imageData: new ImageData(rgba, width, height) };
}

export function encodeGB7(imageData) {
  const { width, height, data } = imageData;
  const pixelCount = width * height;

  let hasMask = false;
  for (let i = 0; i < pixelCount; i++) {
    if (data[i * 4 + 3] < 255) { hasMask = true; break; }
  }

  const fileBytes = new Uint8Array(HEADER_SIZE + pixelCount);

  fileBytes[0] = 0x47;
  fileBytes[1] = 0x42;
  fileBytes[2] = 0x37;
  fileBytes[3] = 0x1D;
  fileBytes[4] = VERSION;
  fileBytes[5] = hasMask ? 0x01 : 0x00;
  fileBytes[6] = (width >> 8) & 0xFF;
  fileBytes[7] = width & 0xFF;
  fileBytes[8] = (height >> 8) & 0xFF;
  fileBytes[9] = height & 0xFF;
  fileBytes[10] = 0x00;
  fileBytes[11] = 0x00;

  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const gray = Math.round(0.299 * data[o] + 0.587 * data[o+1] + 0.114 * data[o+2]);
    const gray7 = Math.round((gray / 255) * 127);
    const maskBit = data[o + 3] > 128 ? 1 : 0;
    fileBytes[HEADER_SIZE + i] = (maskBit << 7) | (gray7 & 0x7F);
  }

  return fileBytes;
}

export function isGB7(buffer) {
  if (buffer.byteLength < 4) return false;
  const b = new Uint8Array(buffer, 0, 4);
  return b[0] === 0x47 && b[1] === 0x42 && b[2] === 0x37 && b[3] === 0x1D;
}