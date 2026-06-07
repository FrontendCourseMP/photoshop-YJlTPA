/**
 * Запускает построение гистограмм в worker.
 * Возвращает Promise<{ master, r, g, b, alpha }>.
 */
import { runInWorker } from './workerPool';

export async function buildHistogramsAsync(imageData) {
  // slice() нужен — после transfer буфер в главном потоке станет детачен
  const copy = imageData.data.slice();
  return runInWorker(
    'buildHistograms',
    { data: copy },
    [copy.buffer]
  );
}