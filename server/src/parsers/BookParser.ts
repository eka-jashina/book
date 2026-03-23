/**
 * BookParser
 *
 * Фасад для серверных парсеров электронных книг (EPUB, FB2, DOCX, DOC, TXT).
 * Определяет формат файла и делегирует парсинг соответствующему модулю.
 */

import { parseTxt } from './TxtParser.js';
import { parseDoc } from './DocParser.js';
import { parseDocx } from './DocxParser.js';
import { parseEpub } from './EpubParser.js';
import { parseFb2 } from './Fb2Parser.js';
import { AppError } from '../middleware/errorHandler.js';
import type { ParsedBook } from './parserUtils.js';

export type { ParsedBook, ParsedChapter } from './parserUtils.js';

/**
 * Определить формат файла и распарсить.
 * Оборачивает каждый парсер в try/catch — при ошибке выбрасывает AppError(422).
 */
export async function parseBook(buffer: Buffer, filename: string): Promise<ParsedBook> {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();

  try {
    switch (ext) {
      case '.epub': return await parseEpub(buffer, filename);
      case '.fb2':  return parseFb2(buffer, filename);
      case '.txt':  return parseTxt(buffer, filename);
      case '.docx': return await parseDocx(buffer, filename);
      case '.doc':  return parseDoc(buffer, filename);
      default:
        throw new AppError(400, `Неподдерживаемый формат: ${ext}. Допустимы .epub, .fb2, .docx, .doc, .txt`);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    throw new AppError(422, `Ошибка парсинга файла (${ext}): ${message}`, 'PARSE_ERROR');
  }
}
