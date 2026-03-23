/**
 * APPEARANCE API — Внешний вид
 */

/** @type {Object<string, Function>} */
export const AppearanceApi = {
  /** Настройки внешнего вида */
  async getAppearance(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/appearance`);
  },

  /** Обновить общие настройки (fontMin, fontMax) */
  async updateAppearance(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/appearance`, { method: 'PATCH', body: data });
  },

  /** Обновить тему (light/dark) */
  async updateAppearanceTheme(bookId, theme, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/appearance/${theme}`, { method: 'PATCH', body: data });
  },
};
