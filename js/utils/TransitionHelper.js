/**
 * TRANSITION HELPER
 * Утилита для ожидания CSS transitions.
 *
 * Особенности:
 * - Промисификация CSS transition событий
 * - Поддержка AbortSignal для отмены ожидания
 * - Таймаут как страховка от зависания
 * - Фильтрация по имени свойства
 */

export class TransitionHelper {
  /**
   * Ожидать завершения CSS transition на элементе
   * @param {HTMLElement} element - DOM-элемент с анимацией
   * @param {string|null} propertyName - Имя CSS-свойства для отслеживания (null = любое)
   * @param {number} timeout - Максимальное время ожидания в мс
   * @param {AbortSignal|null} signal - Сигнал для отмены ожидания
   * @returns {Promise<void>} Резолвится по завершении transition или таймауту
   * @throws {DOMException} AbortError если операция отменена
   */
  static waitFor(element, propertyName, timeout, signal = null) {
    return new Promise((resolve, reject) => {
      // Проверяем, не отменена ли операция ещё до старта
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }

      let resolved = false;
      let timeoutId = null;

      // Очистка слушателей при любом завершении
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        element.removeEventListener("transitionend", handler);
        signal?.removeEventListener("abort", onAbort);
      };

      // Успешное завершение (transition или таймаут)
      const done = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve();
      };

      // Обработчик события transitionend
      const handler = (e) => {
        // Игнорируем события от дочерних элементов
        if (e.target !== element) return;
        // Фильтруем по имени свойства если указано
        if (propertyName && e.propertyName !== propertyName) return;
        done();
      };

      // Обработчик отмены операции
      const onAbort = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        reject(new DOMException("Aborted", "AbortError"));
      };

      element.addEventListener("transitionend", handler);
      // Таймаут как страховка если transition не сработает
      timeoutId = setTimeout(done, timeout);
      signal?.addEventListener("abort", onAbort);
    });
  }
}
