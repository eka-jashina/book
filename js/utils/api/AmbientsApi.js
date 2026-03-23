/**
 * AMBIENTS API — Эмбиенты
 */

/** @type {Object<string, Function>} */
export const AmbientsApi = {
  /** Список эмбиентов */
  async getAmbients(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/ambients`);
  },

  /** Добавить эмбиент */
  async createAmbient(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/ambients`, { method: 'POST', body: data });
  },

  /** Обновить эмбиент */
  async updateAmbient(bookId, ambientId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/ambients/${ambientId}`, { method: 'PATCH', body: data });
  },

  /** Удалить эмбиент */
  async deleteAmbient(bookId, ambientId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/ambients/${ambientId}`, { method: 'DELETE' });
  },

  /** Изменить порядок эмбиентов */
  async reorderAmbients(bookId, ambientIds) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/ambients/reorder`, { method: 'PATCH', body: { ambientIds } });
  },
};
