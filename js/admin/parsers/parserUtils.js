/**
 * Утилиты для парсеров книг (клиентская сторона)
 *
 * Платформо-независимые функции реэкспортируются из @shared/parsers.
 * DOM-зависимые функции (parseXml, parseHtml) реализованы здесь
 * с использованием браузерного DOMParser API.
 */

// Реэкспорт из shared
export { escapeHtml, getTextContent } from '@shared/parsers/parserUtils.js';

/**
 * Парсинг XML-строки (браузерный DOMParser)
 * @param {string} xmlString
 * @returns {Document}
 */
export function parseXml(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    // Попробовать как text/html если XML-парсинг не удался
    return parser.parseFromString(xmlString, 'text/html');
  }

  return doc;
}

/**
 * Парсинг HTML-строки (браузерный DOMParser)
 * @param {string} htmlString
 * @returns {Document}
 */
export function parseHtml(htmlString) {
  const parser = new DOMParser();
  return parser.parseFromString(htmlString, 'text/html');
}
