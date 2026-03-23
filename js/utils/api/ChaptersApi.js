/**
 * CHAPTERS API — Главы
 */

/** @type {Object<string, Function>} */
export const ChaptersApi = {
  /** Список глав (мета, без контента) */
  async getChapters(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/chapters`);
  },

  /** Добавить главу */
  async createChapter(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/chapters`, { method: 'POST', body: data });
  },

  /** Глава с метаданными */
  async getChapter(bookId, chapterId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/chapters/${chapterId}`);
  },

  /** Обновить главу */
  async updateChapter(bookId, chapterId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/chapters/${chapterId}`, { method: 'PATCH', body: data });
  },

  /** Удалить главу */
  async deleteChapter(bookId, chapterId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/chapters/${chapterId}`, { method: 'DELETE' });
  },

  /** Изменить порядок глав */
  async reorderChapters(bookId, chapterIds) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/chapters/reorder`, { method: 'PATCH', body: { chapterIds } });
  },

  /** HTML-контент главы */
  async getChapterContent(bookId, chapterId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/chapters/${chapterId}/content`);
  },
};
