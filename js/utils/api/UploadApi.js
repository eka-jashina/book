/**
 * UPLOAD API — Загрузка файлов
 */

/** @type {Object<string, Function>} */
export const UploadApi = {
  /** Загрузить шрифт */
  async uploadFont(file) {
    const form = new FormData();
    form.append('file', file);
    return this._fetchWithRetry('/api/v1/upload/font', { method: 'POST', body: form });
  },

  /** Загрузить звук */
  async uploadSound(file) {
    const form = new FormData();
    form.append('file', file);
    return this._fetchWithRetry('/api/v1/upload/sound', { method: 'POST', body: form });
  },

  /** Загрузить изображение */
  async uploadImage(file) {
    const form = new FormData();
    form.append('file', file);
    return this._fetchWithRetry('/api/v1/upload/image', { method: 'POST', body: form });
  },

  /** Загрузить книгу (парсинг на сервере) */
  async uploadBook(file) {
    const form = new FormData();
    form.append('file', file);
    return this._fetchWithRetry('/api/v1/upload/book', { method: 'POST', body: form });
  },
};
