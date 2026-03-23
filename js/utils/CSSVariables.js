/**
 * CSS VARIABLES READER
 * Кэшированное чтение CSS custom properties.
 *
 * Особенности:
 * - Ленивая инициализация computedStyle
 * - Кэширование значений для производительности
 * - Поддержка числовых значений и временных интервалов
 * - Автоматическая конвертация единиц времени (s → ms)
 */

class CSSVariables {
  /**
   * @param {HTMLElement} element - Элемент для чтения стилей (по умолчанию :root)
   */
  constructor(element = document.documentElement) {
    this.element = element;
    this._cache = new Map();
    this._computedStyle = null;
  }

  /**
   * Ленивый геттер для computed style
   * @returns {CSSStyleDeclaration}
   */
  get computedStyle() {
    if (!this._computedStyle) {
      this._computedStyle = getComputedStyle(this.element);
    }
    return this._computedStyle;
  }

  /**
   * Сбросить кэш (вызывать при смене темы или resize)
   */
  invalidateCache() {
    this._cache.clear();
    this._computedStyle = null;
  }

  /**
   * Получить строковое значение CSS переменной
   * @param {string} name - Имя переменной (например, '--bg-color')
   * @param {string|null} fallback - Значение по умолчанию
   * @returns {string|null}
   */
  get(name, fallback = null) {
    if (this._cache.has(name)) {
      return this._cache.get(name);
    }
    const value = this.computedStyle.getPropertyValue(name).trim();
    const result = value || fallback;
    this._cache.set(name, result);
    return result;
  }

  /**
   * Получить числовое значение CSS переменной
   * @param {string} name - Имя переменной
   * @param {number} fallback - Значение по умолчанию
   * @returns {number}
   */
  getNumber(name, fallback = 0) {
    const value = this.get(name);
    if (!value) return fallback;
    return parseFloat(value) || fallback;
  }

  /**
   * Получить временной интервал в миллисекундах
   * @param {string} name - Имя переменной (--timing-*)
   * @param {number} fallback - Значение по умолчанию в мс
   * @returns {number} Время в миллисекундах
   */
  getTime(name, fallback = 0) {
    const value = this.get(name);
    if (!value) return fallback;
    // Поддержка форматов: "240ms", "0.24s", "240"
    if (value.endsWith("ms")) return parseFloat(value) || fallback;
    if (value.endsWith("s")) return (parseFloat(value) || 0) * 1000;
    return parseFloat(value) || fallback;
  }
}

export const cssVars = new CSSVariables();
export { CSSVariables };
