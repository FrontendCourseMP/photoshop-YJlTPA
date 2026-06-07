/**
 * Синглтон Web Worker с поддержкой progress-сообщений.
 *
 * Каждая задача имеет уникальный id.
 * Промежуточные { id, progress } сообщения вызывают onProgress-колбэк.
 * Финальное { id, result } или { id, error } завершает Promise.
 */

let _worker    = null;
const _pending = new Map(); // id → { resolve, reject, onProgress? }
let   _idCounter = 0;

function getWorker() {
  if (_worker) return _worker;

  _worker = new Worker(
    new URL('../workers/imageProcessor.worker.js', import.meta.url),
    { type: 'module' }
  );

  _worker.onmessage = (e) => {
    const { id, result, error, progress } = e.data;
    const pending = _pending.get(id);
    if (!pending) return; // задача отменена или уже завершена

    // Промежуточный прогресс — вызываем колбэк и НЕ удаляем из _pending
    if (progress !== undefined) {
      if (pending.onProgress) pending.onProgress(progress);
      return;
    }

    // Финальный ответ — удаляем из очереди и разрешаем/отклоняем Promise
    _pending.delete(id);
    if (error) pending.reject(new Error(error));
    else       pending.resolve(result);
  };

  _worker.onerror = (e) => {
    console.error('Worker crashed:', e);
    for (const [, { reject }] of _pending) {
      reject(new Error('Worker crashed: ' + e.message));
    }
    _pending.clear();
    _worker = null; // пересоздадим при следующем запросе
  };

  return _worker;
}

/**
 * Отправляет задачу в worker и возвращает Promise.
 *
 * @param {string}        type       — тип задачи ('scale', 'convolve', ...)
 * @param {object}        payload    — данные для задачи
 * @param {ArrayBuffer[]} transfer   — буферы для zero-copy передачи
 * @param {function}      [onProgress] — (pct: 0-100) => void, только для 'convolve'
 * @returns {Promise<any>}
 */
export function runInWorker(type, payload, transfer = [], onProgress) {
  return new Promise((resolve, reject) => {
    const id     = ++_idCounter;
    const worker = getWorker();
    _pending.set(id, { resolve, reject, onProgress });
    worker.postMessage({ id, type, payload }, transfer);
  });
}

/**
 * Отменяет задачу — результат будет проигнорирован (Promise зависнет).
 * Используется редко; в основном мы используем token-систему в useCanvas.
 */
export function cancelTask(id) {
  _pending.delete(id);
}