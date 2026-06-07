let _worker    = null;
const _pending = new Map(); 
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
    if (!pending) return; 

    if (progress !== undefined) {
      if (pending.onProgress) pending.onProgress(progress);
      return;
    }

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
    _worker = null;
  };

  return _worker;
}

export function runInWorker(type, payload, transfer = [], onProgress) {
  return new Promise((resolve, reject) => {
    const id     = ++_idCounter;
    const worker = getWorker();
    _pending.set(id, { resolve, reject, onProgress });
    worker.postMessage({ id, type, payload }, transfer);
  });
}

/** 
 * Агрессивный терминатор пулов - гарант "отжатия" тормозов
 * При закрытии модалок мы жестко рубим старые процессы.
 */
export function terminateWorker() {
  if (_worker) {
    _worker.terminate();
    _worker = null;
  }
  for (const [id, { reject }] of _pending) {
    reject(new Error('Process strictly cleaned. Bypass overhead GC.'));
  }
  _pending.clear();
}