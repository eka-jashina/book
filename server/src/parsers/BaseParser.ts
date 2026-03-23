/**
 * BaseParser — утилиты для серверных парсеров книг.
 *
 * Реэкспортирует платформо-независимые утилиты из shared/parsers.
 * TypeScript-обёртки сохраняют типизацию для серверного кода.
 */

import type { ParsedChapter } from './parserUtils.js';
import type JSZip from 'jszip';

// Реэкспорт из shared (платформо-независимая логика)
import {
  MAX_DECOMPRESSED_SIZE as _MAX_DECOMPRESSED_SIZE,
  validateZipSize as _validateZipSize,
  findZipFile as _findZipFile,
  createChapter as _createChapter,
  wrapChapterHtml as _wrapChapterHtml,
  titleFromFilename as _titleFromFilename,
} from '../../../shared/parsers/baseParser.js';

/** Максимальный суммарный размер распакованных данных (100 MB) */
export const MAX_DECOMPRESSED_SIZE = _MAX_DECOMPRESSED_SIZE;

/**
 * Проверить суммарный размер распакованных файлов в ZIP-архиве (защита от ZIP-бомб).
 */
export const validateZipSize: (zip: JSZip) => Promise<void> = _validateZipSize;

/**
 * Поиск файла в ZIP-архиве с несколькими fallback-стратегиями.
 */
export const findZipFile: (zip: JSZip, path: string) => JSZip.JSZipObject | null = _findZipFile;

/**
 * Создать объект главы в стандартном формате.
 */
export const createChapter: (index: number, title: string, html: string) => ParsedChapter = _createChapter;

/**
 * Обернуть контент в стандартную HTML-структуру главы.
 */
export const wrapChapterHtml: (title: string, content: string) => string = _wrapChapterHtml;

/**
 * Извлечь заголовок из имени файла (без расширения).
 */
export const titleFromFilename: (filename: string) => string = _titleFromFilename;
