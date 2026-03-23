/**
 * TxtParser
 *
 * Парсер TXT-файлов.
 * Разбивает текст на абзацы по пустым строкам.
 */

import { escapeHtml } from './parserUtils.js';
import { createChapter, wrapChapterHtml, titleFromFilename } from './BaseParser.js';

/**
 * Парсинг TXT файла
 * @param {File} file
 * @returns {Promise<import('../BookParser.js').ParsedBook>}
 */
export async function parseTxt(file) {
  const text = await file.text();
  const title = titleFromFilename(file.name);

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
