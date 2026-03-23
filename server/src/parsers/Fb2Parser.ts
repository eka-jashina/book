/**
 * Fb2Parser
 *
 * Парсер FB2-файлов.
 * Извлекает главы, метаданные и изображения из FB2 (XML-формат).
 */

import { JSDOM } from 'jsdom';
import { escapeHtml, parseXml, type ParsedBook, type ParsedChapter } from './parserUtils.js';
import { titleFromFilename } from './BaseParser.js';

const { Node: NodeType } = new JSDOM('').window;
const TEXT_NODE = NodeType.TEXT_NODE;
const ELEMENT_NODE = NodeType.ELEMENT_NODE;

/** Max nesting depth for recursive section/content parsing (prevents stack overflow). */
const MAX_DEPTH = 50;

export function parseFb2(buffer: Buffer, filename: string): ParsedBook {
  const text = readBufferWithEncoding(buffer);
  const doc = parseXml(text);

  // Метаданные
  const titleInfo = doc.querySelector('title-info');
  const title = getFb2Text(titleInfo, 'book-title') || titleFromFilename(filename);
  const authorFirst = getFb2Text(titleInfo, 'author first-name') || '';
  const authorMiddle = getFb2Text(titleInfo, 'author middle-name') || '';
  const authorLast = getFb2Text(titleInfo, 'author last-name') || '';
  const author = [authorFirst, authorMiddle, authorLast].filter(Boolean).join(' ');

  // Загрузить встроенные изображения
  const imageMap = loadFb2Images(doc);

  // Извлечь главы из <body>
  const bodyEl = doc.querySelector('body');
  if (!bodyEl) {
    throw new Error('Не найден элемент <body> в FB2');
  }

  const chapters = parseFb2Sections(bodyEl, imageMap);

  if (chapters.length === 0) {
    const allContent = convertFb2AllContent(bodyEl, imageMap);

    if (!allContent.trim()) {
      throw new Error('Не удалось извлечь текст из FB2');
    }

    chapters.push({
      id: 'chapter_1',
      title: title || 'Глава 1',
      html: `<article>\n<h2>${escapeHtml(title || 'Глава 1')}</h2>\n${allContent}\n</article>`,
    });
  }

  return { title, author, chapters };
}

// --- Кодировка ---

function readBufferWithEncoding(buffer: Buffer): string {
  const peekBytes = buffer.subarray(0, 512);
  const ascii = Array.from(peekBytes, b => String.fromCharCode(b)).join('');
  const match = ascii.match(/encoding=["']([^"']+)["']/i);

  if (match) {
    const encoding = match[1].trim();
    try {
      const decoder = new TextDecoder(encoding);
      return decoder.decode(buffer);
    } catch {
      // Неизвестная кодировка — продолжим с UTF-8
    }
  }

  return new TextDecoder('utf-8').decode(buffer);
}

// --- Изображения ---

function loadFb2Images(doc: Document): Map<string, string> {
  const imageMap = new Map<string, string>();

  for (const binary of doc.querySelectorAll('binary')) {
    const id = binary.getAttribute('id');
    const contentType = binary.getAttribute('content-type') || 'image/jpeg';
    const base64 = binary.textContent?.trim();
    if (id && base64) {
      const dataUrl = `data:${contentType};base64,${base64}`;
      imageMap.set(id, dataUrl);
      imageMap.set(`#${id}`, dataUrl);
    }
  }

  return imageMap;
}

// --- Секции и главы ---

function parseFb2Sections(bodyEl: Element, imageMap: Map<string, string>): ParsedChapter[] {
  const sections = bodyEl.querySelectorAll(':scope > section');
  const chapters: ParsedChapter[] = [];

  if (sections.length === 0) {
    const html = convertFb2Elements(bodyEl, imageMap);
    if (html.trim()) {
      chapters.push({
        id: 'chapter_1',
        title: 'Глава 1',
        html: `<article>\n<h2>Глава 1</h2>\n${html}\n</article>`,
      });
    }
    return chapters;
  }

  let chapterIndex = 0;

  for (const section of sections) {
    const result = parseFb2Section(section, imageMap, chapterIndex);
    for (const ch of result) {
      chapterIndex++;
      ch.id = `chapter_${chapterIndex}`;
      if (!ch.title) ch.title = `Глава ${chapterIndex}`;
      chapters.push(ch);
    }
  }

  return chapters;
}

function parseFb2Section(section: Element, imageMap: Map<string, string>, baseIndex: number, depth = 0): ParsedChapter[] {
  if (depth > MAX_DEPTH) return [];

  const subSections = section.querySelectorAll(':scope > section');

  const titleEl = section.querySelector(':scope > title');
  const sectionTitle = titleEl ? extractFb2Title(titleEl) : '';

  if (subSections.length > 0) {
    const results: ParsedChapter[] = [];
    let idx = baseIndex;

    const preamble = convertFb2DirectContent(section, imageMap);
    if (preamble.trim()) {
      results.push({
        id: '',
        title: sectionTitle,
        html: `<article>\n<h2>${escapeHtml(sectionTitle || `Глава ${idx + 1}`)}</h2>\n${preamble}\n</article>`,
      });
      idx++;
    }

    for (const sub of subSections) {
      const subResults = parseFb2Section(sub, imageMap, idx, depth + 1);
      results.push(...subResults);
      idx += subResults.length;
    }

    return results;
  }

  const content = convertFb2Elements(section, imageMap);
  if (!content.trim()) return [];

  return [{
    id: '',
    title: sectionTitle,
    html: `<article>\n<h2>${escapeHtml(sectionTitle || `Глава ${baseIndex + 1}`)}</h2>\n${content}\n</article>`,
  }];
}

function extractFb2Title(titleEl: Element): string {
  const parts: string[] = [];
  for (const p of titleEl.querySelectorAll('p')) {
    const text = p.textContent?.trim();
    if (text) parts.push(text);
  }
  return parts.join('. ') || titleEl.textContent?.trim() || '';
}

// --- Конвертация элементов ---

function convertFb2DirectContent(section: Element, imageMap: Map<string, string>): string {
  const parts: string[] = [];

  for (const child of section.children) {
    if (child.tagName.toLowerCase() === 'section') continue;
    if (child.tagName.toLowerCase() === 'title') continue;
    parts.push(convertFb2Element(child, imageMap));
  }

  return parts.filter(Boolean).join('\n');
}

function convertFb2Elements(section: Element, imageMap: Map<string, string>): string {
  const parts: string[] = [];

  for (const child of section.children) {
    if (child.tagName.toLowerCase() === 'title') continue;
    if (child.tagName.toLowerCase() === 'section') continue;
    parts.push(convertFb2Element(child, imageMap));
  }

  return parts.filter(Boolean).join('\n');
}

function convertFb2Element(el: Element, imageMap: Map<string, string>): string {
  const tag = el.tagName.toLowerCase();

  if (tag === 'p') {
    const inner = convertFb2Inline(el, imageMap);
    if (!inner.trim()) return '';
    return `<p>${inner}</p>`;
  }

  if (tag === 'empty-line') return '<p>&nbsp;</p>';

  if (tag === 'subtitle') {
    return `<h2>${escapeHtml(el.textContent?.trim() || '')}</h2>`;
  }

  if (tag === 'epigraph' || tag === 'cite') {
    const parts: string[] = [];
    for (const child of el.children) {
      parts.push(convertFb2Element(child, imageMap));
    }
    return `<blockquote>${parts.filter(Boolean).join('\n')}</blockquote>`;
  }

  if (tag === 'poem') return convertFb2Poem(el, imageMap);

  if (tag === 'image') {
    const href = el.getAttribute('l:href') || el.getAttribute('xlink:href') || el.getAttribute('href') || '';
    const dataUrl = imageMap.get(href) || imageMap.get(href.replace('#', ''));
    if (dataUrl) return `<img src="${dataUrl}" alt="">`;
    return '';
  }

  if (tag === 'table') {
    return `<p>${escapeHtml(el.textContent?.trim() || '')}</p>`;
  }

  if (tag === 'text-author') {
    return `<p><em>${escapeHtml(el.textContent?.trim() || '')}</em></p>`;
  }

  if (tag === 'annotation') {
    const parts: string[] = [];
    for (const child of el.children) {
      parts.push(convertFb2Element(child, imageMap));
    }
    return parts.filter(Boolean).join('\n');
  }

  const text = el.textContent?.trim();
  if (text) return `<p>${escapeHtml(text)}</p>`;

  return '';
}

function convertFb2Inline(el: Element, imageMap: Map<string, string>): string {
  let result = '';

  for (const node of el.childNodes) {
    if (node.nodeType === TEXT_NODE) {
      result += escapeHtml(node.textContent || '');
      continue;
    }

    if (node.nodeType !== ELEMENT_NODE) continue;

    const child = node as Element;
    const tag = child.tagName.toLowerCase();

    if (tag === 'emphasis') {
      result += `<em>${convertFb2Inline(child, imageMap)}</em>`;
    } else if (tag === 'strong') {
      result += `<strong>${convertFb2Inline(child, imageMap)}</strong>`;
    } else if (tag === 'strikethrough') {
      result += `<s>${convertFb2Inline(child, imageMap)}</s>`;
    } else if (tag === 'a') {
      result += convertFb2Inline(child, imageMap);
    } else if (tag === 'image') {
      const href = child.getAttribute('l:href') || child.getAttribute('xlink:href') || child.getAttribute('href') || '';
      const dataUrl = imageMap.get(href) || imageMap.get(href.replace('#', ''));
      if (dataUrl) result += `<img src="${dataUrl}" alt="">`;
    } else if (tag === 'sup') {
      result += `<sup>${convertFb2Inline(child, imageMap)}</sup>`;
    } else if (tag === 'sub') {
      result += `<sub>${convertFb2Inline(child, imageMap)}</sub>`;
    } else {
      result += escapeHtml(node.textContent || '');
    }
  }

  return result;
}

function convertFb2Poem(poemEl: Element, imageMap: Map<string, string>): string {
  const lines: string[] = [];

  for (const child of poemEl.children) {
    const tag = child.tagName.toLowerCase();

    if (tag === 'title') {
      lines.push(`<h2>${escapeHtml(child.textContent?.trim() || '')}</h2>`);
    } else if (tag === 'stanza') {
      for (const v of child.querySelectorAll('v')) {
        lines.push(`<p>${convertFb2Inline(v, imageMap)}</p>`);
      }
      lines.push('<p>&nbsp;</p>');
    } else if (tag === 'text-author') {
      lines.push(`<p><em>${escapeHtml(child.textContent?.trim() || '')}</em></p>`);
    } else if (tag === 'epigraph') {
      lines.push(convertFb2Element(child, imageMap));
    }
  }

  return lines.filter(Boolean).join('\n');
}

function convertFb2AllContent(bodyEl: Element, imageMap: Map<string, string>, depth = 0): string {
  if (depth > MAX_DEPTH) return '';

  const parts: string[] = [];

  for (const child of bodyEl.children) {
    const tag = child.tagName.toLowerCase();
    if (tag === 'section') {
      parts.push(convertFb2AllContent(child, imageMap, depth + 1));
    } else if (tag === 'title') {
      parts.push(`<h2>${escapeHtml(child.textContent?.trim() || '')}</h2>`);
    } else {
      parts.push(convertFb2Element(child, imageMap));
    }
  }

  return parts.filter(Boolean).join('\n');
}

// --- Утилиты ---

function getFb2Text(parent: Element | null, selector: string): string {
  if (!parent) return '';
  const el = parent.querySelector(selector);
  return el?.textContent?.trim() || '';
}
