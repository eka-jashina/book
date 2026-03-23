/**
 * API ERROR
 *
 * Структурированная ошибка HTTP-запроса.
 */

export class ApiError extends Error {
  /**
   * @param {number} status - HTTP status code
   * @param {string} message - Сообщение об ошибке
   * @param {Object} [details] - Дополнительные детали (Zod-ошибки и т.д.)
   */
  constructor(status, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}
