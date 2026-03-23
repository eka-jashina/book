/**
 * BookParser
 *
 * Фасад для парсеров электронных книг (EPUB, FB2, DOCX, DOC, TXT).
 * Определяет формат файла и делегирует парсинг соответствующему модулю.
 *
 * Каждая глава преобразуется в HTML-формат, совместимый с ридером:
 * <article><h2>Заголовок</h2><p>Текст...</p></article>
 *
 * После парсинга HTML каждой главы проходит через DOMPurify-санитизацию
 * для защиты от XSS при загрузке недоверенных файлов.
 */

import { parseEpub } from './parsers/EpubParser.js';
import { parseFb2 } from './parsers/Fb2Parser.js';
import { parseTxt } from './parsers/TxtParser.js';
import { parseDocx } from './parsers/DocxParser.js';
import { parseDoc } from './parsers/DocParser.js';
import { HTMLSanitizer } from '../utils/HTMLSanitizer.js';

// ─── Magic bytes (сигнатуры файлов) ──────────────────────────────────────────

/** Известные сигнатуры форматов */
const SIGNATURES = {
  /** ZIP-архив (EPUB, DOCX) */
  zip: new Uint8Array([0x50, 0x4B, 0x03, 0x04]),
  /** OLE2 Compound Document (DOC) */
  ole2: new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]),
};

/**
 * Прочитать первые N байт файла.
 * @param {File} file
 * @param {number} n
 * @returns {Promise<Uint8Array>}
 */
async function readFileHead(file, n) {
  const blob = file.slice(0, n);
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Проверить совпадение начальных байт с сигнатурой.
 * @param {Uint8Array} bytes
 * @param {Uint8Array} signature
 * @returns {boolean}
 */
function matchesSignature(bytes, signature) {
  if (bytes.length < signature.length) return false;
  return signature.every((b, i) => bytes[i] === b);
}

/**
 * Валидация magic bytes файла перед парсингом.
 *
 * Проверяет соответствие реального содержимого файла его расширению.
 * Защищает от подмены формата (напр. переименованный .exe → .epub).
 *
 * При невозможности проверки (среда без File API) — пропускает валидацию.
 *
 * @param {File} file
 * @param {string} ext - Расширение (lowercase, с точкой)
 */
async function validateMagicBytes(file, ext) {
  try {
    // TXT — текстовый формат, нет бинарной сигнатуры
    if (ext === '.txt') return;

    // FB2 — XML-формат, проверяем что начинается с '<'
    if (ext === '.fb2') {
      const head = await readFileHead(file, 256);
      const text = new TextDecoder('utf-8', { fatal: false }).decode(head);
      const trimmed = text.trimStart();
      if (trimmed.length > 0 && !trimmed.startsWith('<')) {
        throw new Error('Файл не является валидным FB2 (ожидается XML)');
      }
      return;
    }

    // EPUB / DOCX — ZIP-архивы
    if (ext === '.epub' || ext === '.docx') {
      const head = await readFileHead(file, 4);
      if (!matchesSignature(head, SIGNATURES.zip)) {
        throw new Error(
          `Файл не является валидным ${ext.slice(1).toUpperCase()} (неверная сигнатура файла)`
        );
      }
      return;
    }

    // DOC — OLE2 Compound Document
    if (ext === '.doc') {
      const head = await readFileHead(file, 8);
      if (!matchesSignature(head, SIGNATURES.ole2)) {
        throw new Error('Файл не является валидным DOC (неверная сигнатура файла)');
      }
    }
  } catch (err) {
    // Ошибки валидации сигнатуры — пробрасываем
    if (err.message.includes('сигнатура') || err.message.includes('FB2')) {
      throw err;
    }
    // Ошибки чтения файла (нет File API, etc.) — пропускаем валидацию
  }
}

/** Ленивая инициализация санитайзера (один экземпляр на модуль) */
let _sanitizer = null;
function getSanitizer() {
  if (!_sanitizer) {
    _sanitizer = new HTMLSanitizer();
  }
  return _sanitizer;
}

/**
 * Результат парсинга книги
 * @typedef {Object} ParsedBook
 * @property {string} title - Заголовок книги
 * @property {string} author - Автор
 * @property {ParsedChapter[]} chapters - Массив глав
 */

/**
 * Глава книги
 * @typedef {Object} ParsedChapter
 * @property {string} id - Уникальный идентификатор
 * @property {string} title - Заголовок главы
 * @property {string} html - HTML-контент главы
 */

/**
 * Санитизировать HTML глав после парсинга (защита от XSS).
 * @param {ParsedBook} result
 * @returns {ParsedBook}
 */
function sanitizeParsedBook(result) {
  const sanitizer = getSanitizer();
  for (const chapter of result.chapters) {
    if (chapter.html) {
      chapter.html = sanitizer.sanitize(chapter.html);
    }
  }
  return result;
}

export class BookParser {
  /**
   * Определить формат файла и распарсить
   * @param {File} file - Загруженный файл
   * @returns {Promise<ParsedBook>}
   */
  static async parse(file) {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    // Валидация magic bytes перед парсингом (защита от подмены формата)
    await validateMagicBytes(file, ext);

    let result;
    switch (ext) {
      case '.epub': result = await parseEpub(file); break;
      case '.fb2':  result = await parseFb2(file); break;
      case '.txt':  result = await parseTxt(file); break;
      case '.docx': result = await parseDocx(file); break;
      case '.doc':  result = await parseDoc(file); break;
      default:
        throw new Error(`Неподдерживаемый формат: ${ext}. Допустимы .epub, .fb2, .docx, .doc, .txt`);
    }

    return sanitizeParsedBook(result);
  }
}
