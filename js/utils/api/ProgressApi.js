/**
 * PROGRESS API — Прогресс чтения
 */

/** @type {Object<string, Function>} */
export const ProgressApi = {
  /** Получить прогресс чтения */
  async getProgress(bookId) {
    try {
      const result = await this._fetchWithRetry(`/api/v1/books/${bookId}/progress`);
      // Сервер возвращает { progress: { page, font, ... } } — извлекаем вложенный объект
      return result?.progress ?? result;
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  /** Сохранить прогресс чтения (upsert) */
  async saveProgress(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/progress`, { method: 'PUT', body: data });
  },

  /** Сохранить сессию чтения */
  async saveReadingSession(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/reading-sessions`, { method: 'POST', body: data });
  },

  /** Получить историю сессий чтения */
  async getReadingSessions(bookId, { limit = 50, offset = 0 } = {}) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/reading-sessions?limit=${limit}&offset=${offset}`);
  },

  /** Получить статистику чтения по книге */
  async getReadingStats(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/reading-sessions/stats`);
  },
};
