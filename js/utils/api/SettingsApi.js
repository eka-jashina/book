/**
 * SETTINGS API — Настройки
 */

/** @type {Object<string, Function>} */
export const SettingsApi = {
  /** Глобальные настройки */
  async getSettings() {
    return this._fetchWithRetry('/api/v1/settings');
  },

  /** Обновить глобальные настройки */
  async updateSettings(data) {
    return this._fetchWithRetry('/api/v1/settings', { method: 'PATCH', body: data });
  },

  /** Дефолтные настройки книги */
  async getDefaultSettings(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/default-settings`);
  },

  /** Обновить дефолтные настройки книги */
  async updateDefaultSettings(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/default-settings`, { method: 'PATCH', body: data });
  },
};
