/**
 * BaseParser — утилиты для парсеров книг (клиентская сторона).
 *
 * Реэкспортирует платформо-независимые утилиты из @shared/parsers:
 * - validateZipSize — защита от ZIP-бомб
 * - findZipFile — поиск файла в ZIP с fallback-стратегиями
 * - createChapter — стандартное создание объекта главы
 * - wrapChapterHtml — оборачивание контента в <article>
 * - titleFromFilename — извлечение заголовка из имени файла
 */

export {
  MAX_DECOMPRESSED_SIZE,
  validateZipSize,
  findZipFile,
  createChapter,
  wrapChapterHtml,
  titleFromFilename,
} from '@shared/parsers/baseParser.js';
