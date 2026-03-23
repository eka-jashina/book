/**
 * TxtParser
 *
 * Парсер TXT-файлов.
 * Разбивает текст на абзацы по пустым строкам.
 */

import { escapeHtml, type ParsedBook } from './parserUtils.js';
import { createChapter, wrapChapterHtml, titleFromFilename } from './BaseParser.js';

/**
 * Парсинг TXT из Buffer
 */
export function parseTxt(buffer: Buffer, filename: string): ParsedBook {
  const text = buffer.toString('utf-8');
  const title = titleFromFilename(filename);

  if (!text.trim()) {
    throw new Error('Файл пуст');
  }

  // Разделить на абзацы по пустым строкам
  const paragraphs = text.split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  const html = paragraphs
    .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  return {
    title,
    author: '',
    chapters: [createChapter(0, title, wrapChapterHtml(title, html))],
  };
}
