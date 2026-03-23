/**
 * SHARED BASE PARSER
 *
 * Платформо-независимые утилиты для парсеров книжных форматов (ZIP-based).
 * Используются и клиентом (js/admin/parsers/), и сервером (server/src/parsers/).
 *
 * Содержит:
 * - validateZipSize — защита от ZIP-бомб
 * - findZipFile — поиск файла в ZIP с fallback-стратегиями
 * - createChapter — стандартное создание объекта главы
 * - wrapChapterHtml — оборачивание контента в <article>
 * - titleFromFilename — извлечение заголовка из имени файла
 */

import { escapeHtml } from './parserUtils.js';

/** Максимальный суммарный размер распакованных данных (100 MB) */
export const MAX_DECOMPRESSED_SIZE = 100 * 1024 * 1024;

/**
 * Проверить суммарный размер распакованных файлов в ZIP-архиве (защита от ZIP-бомб).
 * @param {import('jszip')} zip
 * @throws {Error} Если суммарный размер превышает лимит
 */
export async function validateZipSize(zip) {
  let totalSize = 0;
  for (const [, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const entryData = entry._data;
    if (entryData && entryData.uncompressedSize !== undefined && entryData.uncompressedSize !== null) {
      totalSize += entryData.uncompressedSize;
    }
    if (totalSize > MAX_DECOMPRESSED_SIZE) {
      throw new Error(
        `Распакованный размер архива превышает лимит (${Math.round(MAX_DECOMPRESSED_SIZE / 1024 / 1024)} МБ). ` +
        `Возможно, файл повреждён.`
      );
    }
  }
}

/**
 * Поиск файла в ZIP-архиве с несколькими fallback-стратегиями:
 * 1. Точное совпадение
 * 2. URL-декодированный путь
 * 3. URL-кодированный путь
 * 4. Регистронезависимый поиск
 * 5. Декодированный + регистронезависимый
 *
 * @param {import('jszip')} zip
 * @param {string} path — путь к файлу внутри архива
 * @returns {import('jszip').JSZipObject | null}
 */
export function findZipFile(zip, path) {
  // Убираем фрагмент (#section) и начальный слеш
  const noFragment = path.split('#')[0];
  const cleanPath = noFragment.startsWith('/') ? noFragment.substring(1) : noFragment;

  // 1. Точное совпадение
  let file = zip.file(cleanPath);
  if (file) return file;

  // 2. URL-декодированный путь (OPF: %D0%93%D0%BB%D0%B0%D0%B2%D0%B0.xhtml → ZIP: Глава.xhtml)
  try {
    const decoded = decodeURIComponent(cleanPath);
    if (decoded !== cleanPath) {
      file = zip.file(decoded);
      if (file) return file;
    }
  } catch { /* невалидный URI при декодировании */ }

  // 3. URL-кодированный путь (OPF: Глава.xhtml → ZIP: %D0%93...xhtml)
  try {
    const encoded = cleanPath.split('/').map(p => encodeURIComponent(p)).join('/');
    if (encoded !== cleanPath) {
      file = zip.file(encoded);
      if (file) return file;
    }
  } catch { /* ошибка кодирования пути */ }

  // 4. Регистронезависимый поиск (некоторые архиваторы меняют регистр)
  const lowerPath = cleanPath.toLowerCase();
  for (const [name, entry] of Object.entries(zip.files)) {
    if (!entry.dir && name.toLowerCase() === lowerPath) {
      return entry;
    }
  }

  // 5. Также попробовать декодированный вариант регистронезависимо
  try {
    const decodedLower = decodeURIComponent(cleanPath).toLowerCase();
    if (decodedLower !== lowerPath) {
      for (const [name, entry] of Object.entries(zip.files)) {
        if (!entry.dir && name.toLowerCase() === decodedLower) {
          return entry;
        }
      }
    }
  } catch { /* ошибка декодирования при регистронезависимом поиске */ }

  return null;
}

/**
 * Создать объект главы в стандартном формате.
 * @param {number} index — порядковый номер (0-based)
 * @param {string} title — заголовок главы
 * @param {string} html — HTML-контент главы
 * @returns {{ id: string, title: string, html: string }}
 */
export function createChapter(index, title, html) {
  return {
    id: `chapter_${index + 1}`,
    title,
    html,
  };
}

/**
 * Обернуть контент в стандартную HTML-структуру главы.
 * @param {string} title — заголовок главы
 * @param {string} content — внутренний HTML
 * @returns {string}
 */
export function wrapChapterHtml(title, content) {
  return `<article>\n<h2>${escapeHtml(title)}</h2>\n${content}\n</article>`;
}

/**
 * Извлечь заголовок из имени файла (без расширения).
 * @param {string} filename
 * @returns {string}
 */
export function titleFromFilename(filename) {
  return filename.replace(/\.[^.]+$/, '');
}
