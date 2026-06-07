/**
 * Пул Web Worker'ов.
 * Держит N worker'ов, раздаёт им задачи через Promise.
 * Отменяемые задачи: если новая задача того же типа приходит до завершения старой,
 * старая игнорируется (актуально для превью уровней).
 */

let _worker = null;
const _pending = new Map(); // id → { resolve, reject }
let   _idCounter = 0;

function getWorker() {
  if (_worker) return _worker;
  // Vite поддерживает ?worker синтаксис, но нам нужен обычный URL для гибкости
  _worker = new Worker(new URL('../workers/imageProcessor.worker.js', import.meta.url), {
    type: 'module',
  });
  _worker.onmessage = (e) => {
    const { id, result, error } = e.data;
    const pending = _pending.get(id);
    if (!pending) return; // задача была отменена
    _pending.delete(id);
    if (error) pending.reject(new Error(error));
    else       pending.resolve(result);
  };
  _worker.onerror = (e) => {
    console.error('Worker error:', e);
    // Отклоняем все ожидающие задачи
    for (const [id, { reject }] of _pending) {
      reject(new Error('Worker crashed'));
    }
    _pending.clear();
    _worker = null; // сбросим, чтобы пересоздать при следующем вызове
  };
  return _worker;
}

/**
 * Отправляет задачу в worker и возвращает Promise.
 * @param {string} type
 * @param {object} payload
 * @param {ArrayBuffer[]} transfer - буферы для zero-copy передачи
 * @returns {Promise}
 */
export function runInWorker(type, payload, transfer = []) {
  return new Promise((resolve, reject) => {
    const id     = ++_idCounter;
    const worker = getWorker();
    _pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload }, transfer);
  });
}

/**
 * Отменяет задачу по id (результат будет проигнорирован).
 */
export function cancelTask(id) {
  _pending.delete(id);
}