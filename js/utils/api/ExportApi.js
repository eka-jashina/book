/**
 * EXPORT API — Экспорт/Импорт + Health
 */

/** @type {Object<string, Function>} */
export const ExportApi = {
  /** Экспорт всей конфигурации */
  async exportConfig() {
    return this._fetchWithRetry('/api/v1/export');
  },

  /** Импорт конфигурации */
  async importConfig(data) {
    return this._fetchWithRetry('/api/v1/import', { method: 'POST', body: data });
  },

  /** Проверка здоровья сервера */
  async health() {
    return this._fetch('/api/health');
  },
};
