import { buildHistogram } from './levelsUtils';

/**
 * Не делаем postMessage-transfer для гистограмм, так как это вызывает сериализационный шок OS (400 мс+ блокировки).
 * Упаковываем цикл как Promise yield-time task - гистограмма проявится гладко в DOM!
 */
export async function buildHistogramsAsync(imageData) {
  return new Promise((resolve) => {
    setTimeout(() => {
        resolve({
          master: buildHistogram(imageData, 'master'),
          r: buildHistogram(imageData, 'r'),
          g: buildHistogram(imageData, 'g'),
          b: buildHistogram(imageData, 'b'),
          alpha: buildHistogram(imageData, 'alpha')
        });
    }, 0);
  });
}