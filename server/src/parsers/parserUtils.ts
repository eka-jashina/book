/**
 * Утилиты для серверных парсеров книг.
 *
 * Платформо-независимые функции реэкспортируются из shared/parsers.
 * DOM-зависимые функции (parseXml, parseHtml) реализованы здесь
 * с использованием jsdom вместо браузерного DOMParser.
 */

import { JSDOM } from 'jsdom';

// Реэкспорт из shared
export {
  escapeHtml,
  getTextContent,
} from '../../../shared/parsers/parserUtils.js';

/**
 * Парсинг XML-строки (jsdom)
 */
export function parseXml(xmlString: string): Document {
  const dom = new JSDOM(xmlString, { contentType: 'application/xml' });
  const doc = dom.window.document;

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    // Попробовать как text/html если XML-парсинг не удался
    const htmlDom = new JSDOM(xmlString, { contentType: 'text/html' });
    return htmlDom.window.document;
  }

  return doc;
}

/**
 * Парсинг HTML-строки (jsdom)
 */
export function parseHtml(htmlString: string): Document {
  const dom = new JSDOM(htmlString, { contentType: 'text/html' });
  return dom.window.document;
}

/** Результат парсинга книги */
export interface ParsedBook {
  title: string;
  author: string;
  chapters: ParsedChapter[];
}

/** Глава книги */
export interface ParsedChapter {
  id: string;
  title: string;
  html: string;
}
