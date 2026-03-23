/**
 * SHARED PARSER UTILITIES
 *
 * Платформо-независимые утилиты для парсеров книг.
 * Используются и клиентом (js/admin/parsers/), и сервером (server/src/parsers/).
 *
 * DOM-зависимые функции (parseXml, parseHtml) остаются в платформенных модулях,
 * здесь — только чистые функции без зависимостей от DOM API.
 */

/**
 * Экранирование HTML-сущностей
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Получить текстовое содержимое элемента по CSS-селектору
 * @param {Document} doc — DOM-документ (браузерный или jsdom)
 * @param {string} selector — CSS-селектор
 * @returns {string}
 */
export function getTextContent(doc, selector) {
  const el = doc.querySelector(selector);
  return el?.textContent?.trim() || '';
}
