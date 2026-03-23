/**
 * ERROR HANDLER
 * Централизованная обработка и отображение ошибок.
 *
 * Особенности:
 * - Категоризация ошибок (network / validation / runtime)
 * - Показ ошибок пользователю через UI-элемент
 * - Автоматическое скрытие через настраиваемый таймаут
 * - Fallback на динамический элемент если UI недоступен
 * - Логирование в консоль с категорией для отладки
 */

import { getConfig } from '../config.js';

/**
 * Категории ошибок для классификации и логирования
 */
export const ErrorCategory = Object.freeze({
  NETWORK: 'network',
  VALIDATION: 'validation',
  RUNTIME: 'runtime',
});

export class ErrorHandler {
  static _hideTimer = null;

  /**
   * Автоматически определить категорию ошибки
   * @param {*} error - Объект ошибки
   * @returns {string} Категория из ErrorCategory
   */
  static classify(error) {
    if (!error) return ErrorCategory.RUNTIME;

    // Сетевые ошибки
    if (error instanceof TypeError && error.message === 'Failed to fetch') return ErrorCategory.NETWORK;
    if (error.name === 'AbortError') return ErrorCategory.NETWORK;
    if (typeof error === 'object' && typeof error.status === 'number') return ErrorCategory.NETWORK;

    // Валидационные ошибки
    if (error instanceof RangeError) return ErrorCategory.VALIDATION;
    if (error instanceof URIError) return ErrorCategory.VALIDATION;
    if (error instanceof SyntaxError) return ErrorCategory.VALIDATION;
    if (typeof error === 'object' && error.name === 'ValidationError') return ErrorCategory.VALIDATION;

    return ErrorCategory.RUNTIME;
  }

  /**
   * Показать сообщение об ошибке пользователю
   * @param {string} message - Текст ошибки для отображения
   */
  static show(message) {
    const error = document.getElementById('errorMessage');
    const text = document.getElementById('errorText');

    // Fallback на старое поведение если элементы не найдены
    if (!error || !text) {
      console.error('Error message container not found in DOM');
      this._showFallback(message);
      return;
    }

    // Отменяем предыдущий таймаут чтобы не накапливались
    clearTimeout(this._hideTimer);

    text.textContent = message;
    error.hidden = false;

    // Автоматически скрываем через заданный таймаут
    this._hideTimer = setTimeout(() => {
      error.hidden = true;
      this._hideTimer = null;
    }, getConfig().UI.ERROR_HIDE_TIMEOUT);
  }

  /**
   * Обработать ошибку: классифицировать, залогировать и показать пользователю
   * @param {Error} error - Объект ошибки
   * @param {string} userMessage - Сообщение для пользователя
   * @param {string} [category] - Категория из ErrorCategory (авто-определяется если не указана)
   */
  static handle(error, userMessage = "Произошла ошибка", category) {
    const cat = category || this.classify(error);
    console.error(`[${cat}] Error:`, error);
    this.show(userMessage);
  }

  /**
   * Fallback-отображение ошибки через динамический элемент
   * Используется если основной UI-элемент недоступен
   * @private
   * @param {string} message - Текст ошибки
   */
  static _showFallback(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;
    errorDiv.setAttribute("role", "alert");
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), getConfig().UI.ERROR_HIDE_TIMEOUT);
  }
}
