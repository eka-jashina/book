/**
 * SHARED PARSERS
 *
 * Общая библиотека утилит для парсеров книг.
 * Используется клиентом (js/admin/parsers/) и сервером (server/src/parsers/).
 *
 * Содержит только платформо-независимый код — без зависимостей от DOM API.
 * DOM-зависимые функции (parseXml, parseHtml) реализованы в платформенных модулях.
 */
export { escapeHtml, getTextContent } from './parserUtils.js';
export {
  MAX_DECOMPRESSED_SIZE,
  validateZipSize,
  findZipFile,
  createChapter,
  wrapChapterHtml,
  titleFromFilename,
} from './baseParser.js';
