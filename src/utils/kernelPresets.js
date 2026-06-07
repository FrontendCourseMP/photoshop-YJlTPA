/**
 * Предустановки ядер свёртки 3×3.
 *
 * kernel — массив из 9 чисел, порядок: строки слева-направо, сверху-вниз:
 *   [0] [1] [2]
 *   [3] [4] [5]
 *   [6] [7] [8]
 */

export const KERNEL_PRESETS = [
  {
    id:     'identity',
    label:  'Тождественное отображение',
    kernel: [
      0, 0, 0,
      0, 1, 0,
      0, 0, 0,
    ],
  },
  {
    id:     'sharpen',
    label:  'Повышение резкости',
    kernel: [
       0, -1,  0,
      -1,  5, -1,
       0, -1,  0,
    ],
  },
  {
    id:     'gaussian',
    label:  'Фильтр Гаусса 3×3',
    kernel: [
      1 / 16, 2 / 16, 1 / 16,
      2 / 16, 4 / 16, 2 / 16,
      1 / 16, 2 / 16, 1 / 16,
    ],
  },
  {
    id:     'box_blur',
    label:  'Прямоугольное размытие',
    kernel: [
      1 / 9, 1 / 9, 1 / 9,
      1 / 9, 1 / 9, 1 / 9,
      1 / 9, 1 / 9, 1 / 9,
    ],
  },
  {
    id:     'prewitt_x',
    label:  'Оператор Прюитта (горизонт.)',
    kernel: [
      -1, 0, 1,
      -1, 0, 1,
      -1, 0, 1,
    ],
  },
  {
    id:     'prewitt_y',
    label:  'Оператор Прюитта (вертикал.)',
    kernel: [
      -1, -1, -1,
       0,  0,  0,
       1,  1,  1,
    ],
  },
];

export const DEFAULT_PRESET_ID = 'identity';

/** Проверяет, является ли ядро тождественным (не меняет изображение). */
export function isIdentityKernel(kernel) {
  if (!kernel || kernel.length !== 9) return false;
  for (let i = 0; i < 9; i++) {
    const expected = i === 4 ? 1 : 0;
    if (Math.abs(kernel[i] - expected) > 1e-9) return false;
  }
  return true;
}