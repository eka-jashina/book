/**
 * SOUNDS API — Звуки
 */

/** @type {Object<string, Function>} */
export const SoundsApi = {
  /** Звуки книги */
  async getSounds(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/sounds`);
  },

  /** Обновить звуки */
  async updateSounds(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/sounds`, { method: 'PATCH', body: data });
  },
};
