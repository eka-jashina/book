/**
 * FONTS API — Декоративные и шрифты для чтения
 */

/** @type {Object<string, Function>} */
export const FontsApi = {
  // ── Декоративный шрифт (per-book) ──────────

  /** Получить декоративный шрифт */
  async getDecorativeFont(bookId) {
    try {
      return await this._fetchWithRetry(`/api/v1/books/${bookId}/decorative-font`);
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  /** Установить декоративный шрифт (upsert) */
  async setDecorativeFont(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/decorative-font`, { method: 'PUT', body: data });
  },

  /** Удалить декоративный шрифт */
  async deleteDecorativeFont(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/decorative-font`, { method: 'DELETE' });
  },

  // ── Шрифты для чтения (global) ─────────────

  /** Список шрифтов */
  async getFonts() {
    return this._fetchWithRetry('/api/v1/fonts');
  },

  /** Добавить шрифт */
  async createFont(data) {
    return this._fetchWithRetry('/api/v1/fonts', { method: 'POST', body: data });
  },

  /** Обновить шрифт */
  async updateFont(fontId, data) {
    return this._fetchWithRetry(`/api/v1/fonts/${fontId}`, { method: 'PATCH', body: data });
  },

  /** Удалить шрифт */
  async deleteFont(fontId) {
    return this._fetchWithRetry(`/api/v1/fonts/${fontId}`, { method: 'DELETE' });
  },

  /** Изменить порядок шрифтов */
  async reorderFonts(fontIds) {
    return this._fetchWithRetry('/api/v1/fonts/reorder', { method: 'PATCH', body: { fontIds } });
  },
};
