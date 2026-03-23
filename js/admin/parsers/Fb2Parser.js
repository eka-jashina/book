/**
 * Fb2Parser
 *
 * Парсер FB2-файлов.
 * Извлекает главы, метаданные и изображения из FB2 (XML-формат).
 */

import { escapeHtml, parseXml } from './parserUtils.js';
import { titleFromFilename } from './BaseParser.js';

/** Максимальная глубина рекурсии при парсинге вложенных секций */
const MAX_SECTION_DEPTH = 100;

/**
 * Парсинг FB2 файла
 * @param {File} file
 * @returns {Promise<import('../BookParser.js').ParsedBook>}
 */
export async function parseFb2(file) {
  const text = await readFileWithEncoding(file);
  const doc = parseXml(text);

  // Метаданные
  const titleInfo = doc.querySelector('title-info');
  const title = getFb2Text(titleInfo, 'book-title') || titleFromFilename(file.name);
  const authorFirst = getFb2Text(titleInfo, 'author first-name') || '';
  const authorMiddle = getFb2Text(titleInfo, 'author middle-name') || '';
  const authorLast = getFb2Text(titleInfo, 'author last-name') || '';
  const author = [authorFirst, authorMiddle, authorLast].filter(Boolean).join(' ');

  // Загрузить встроенные изображения (binary)
  const imageMap = loadFb2Images(doc);

  // Извлечь главы из <body>
  const bodyEl = doc.querySelector('body');
  if (!bodyEl) {
    throw new Error('Не найден элемент <body> в FB2');
  }

  const chapters = parseFb2Sections(bodyEl, imageMap);

  // Fallback: если не удалось разбить на главы — весь body как одна глава
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

/**
 * Прочитать файл с автоопределением кодировки из XML-декларации.
 * Многие FB2-файлы используют windows-1251, а file.text() по умолчанию UTF-8.
 */
async function readFileWithEncoding(file) {
  const buffer = await file.arrayBuffer();

  // Считываем первые байты как ASCII для поиска encoding в XML-декларации
  const peekBytes = new Uint8Array(buffer.slice(0, 512));
  const ascii = Array.from(peekBytes, b => String.fromCharCode(b)).join('');
  const match = ascii.match(/encoding=["']([^"']+)["']/i);

  if (match) {
    const encoding = match[1].trim();
    try {
      return new TextDecoder(encoding).decode(buffer);
    } catch (err) {
      console.debug(`Fb2Parser: неизвестная кодировка "${encoding}", fallback на UTF-8`, err);
    }
  }

  return new TextDecoder('utf-8').decode(buffer);
}

// --- Изображения ---

/**
 * Загрузить изображения из FB2 binary-секций
 */
export function loadFb2Images(doc) {
  const imageMap = new Map();

  for (const binary of doc.querySelectorAll('binary')) {
    const id = binary.getAttribute('id');
    const contentType = binary.getAttribute('content-type') || 'image/jpeg';
    const base64 = binary.textContent.trim();
    if (id && base64) {
      const dataUrl = `data:${contentType};base64,${base64}`;
      imageMap.set(id, dataUrl);
      imageMap.set(`#${id}`, dataUrl);
    }
  }

  return imageMap;
}

// --- Секции и главы ---

/**
 * Извлечь главы из FB2 <body>
 */
function parseFb2Sections(bodyEl, imageMap) {
  const sections = bodyEl.querySelectorAll(':scope > section');
  const chapters = [];

  if (sections.length === 0) {
    // Нет секций — всё тело как одна глава
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

/**
 * Парсить одну FB2 секцию (рекурсивно для вложенных секций)
 * @param {Element} section
 * @param {Map} imageMap
 * @param {number} baseIndex
 * @param {number} [depth=0] — текущая глубина рекурсии (защита от stack overflow)
 */
function parseFb2Section(section, imageMap, baseIndex, depth = 0) {
  if (depth > MAX_SECTION_DEPTH) {
    // Слишком глубокая вложенность — извлечь как плоский контент
    const content = convertFb2Elements(section, imageMap);
    if (!content.trim()) return [];
    return [{
      id: '',
      title: `Глава ${baseIndex + 1}`,
      html: `<article>\n<h2>${escapeHtml(`Глава ${baseIndex + 1}`)}</h2>\n${content}\n</article>`,
    }];
  }

  const subSections = section.querySelectorAll(':scope > section');

  // Заголовок секции
  const titleEl = section.querySelector(':scope > title');
  const sectionTitle = titleEl ? extractFb2Title(titleEl) : '';

  if (subSections.length > 0) {
    // Есть подсекции — каждая станет отдельной главой
    const results = [];
    let idx = baseIndex;

    // Контент до первой подсекции (если есть)
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

  // Нет подсекций — это листовая секция (одна глава)
  const content = convertFb2Elements(section, imageMap);
  if (!content.trim()) return [];

  return [{
    id: '',
    title: sectionTitle,
    html: `<article>\n<h2>${escapeHtml(sectionTitle || `Глава ${baseIndex + 1}`)}</h2>\n${content}\n</article>`,
  }];
}

/**
 * Извлечь заголовок из FB2 <title>
 */
export function extractFb2Title(titleEl) {
  const parts = [];
  for (const p of titleEl.querySelectorAll('p')) {
    const text = p.textContent.trim();
    if (text) parts.push(text);
  }
  return parts.join('. ') || titleEl.textContent.trim();
}

// --- Конвертация элементов ---

/**
 * Конвертировать только непосредственный контент секции (без вложенных section)
 */
function convertFb2DirectContent(section, imageMap) {
  const parts = [];

  for (const child of section.children) {
    if (child.tagName.toLowerCase() === 'section') continue;
    if (child.tagName.toLowerCase() === 'title') continue;
    parts.push(convertFb2Element(child, imageMap));
  }

  return parts.filter(Boolean).join('\n');
}

/**
 * Конвертировать все элементы FB2 секции в HTML
 */
function convertFb2Elements(section, imageMap) {
  const parts = [];

  for (const child of section.children) {
    if (child.tagName.toLowerCase() === 'title') continue;
    if (child.tagName.toLowerCase() === 'section') continue;
    parts.push(convertFb2Element(child, imageMap));
  }

  return parts.filter(Boolean).join('\n');
}

/**
 * Конвертировать один FB2-элемент в HTML
 */
export function convertFb2Element(el, imageMap) {
  const tag = el.tagName.toLowerCase();

  if (tag === 'p') {
    const inner = convertFb2Inline(el, imageMap);
    if (!inner.trim()) return '';
    return `<p>${inner}</p>`;
  }

  if (tag === 'empty-line') {
    return '<p>&nbsp;</p>';
  }

  if (tag === 'subtitle') {
    return `<h2>${escapeHtml(el.textContent.trim())}</h2>`;
  }

  if (tag === 'epigraph') {
    const parts = [];
    for (const child of el.children) {
      parts.push(convertFb2Element(child, imageMap));
    }
    return `<blockquote>${parts.filter(Boolean).join('\n')}</blockquote>`;
  }

  if (tag === 'cite') {
    const parts = [];
    for (const child of el.children) {
      parts.push(convertFb2Element(child, imageMap));
    }
    return `<blockquote>${parts.filter(Boolean).join('\n')}</blockquote>`;
  }

  if (tag === 'poem') {
    return convertFb2Poem(el, imageMap);
  }

  if (tag === 'image') {
    const href = el.getAttribute('l:href') || el.getAttribute('xlink:href') || el.getAttribute('href') || '';
    const dataUrl = imageMap.get(href) || imageMap.get(href.replace('#', ''));
    if (dataUrl) {
      return `<img src="${dataUrl}" alt="">`;
    }
    return '';
  }

  if (tag === 'table') {
    return `<p>${escapeHtml(el.textContent.trim())}</p>`;
  }

  if (tag === 'text-author') {
    return `<p><em>${escapeHtml(el.textContent.trim())}</em></p>`;
  }

  if (tag === 'annotation') {
    const parts = [];
    for (const child of el.children) {
      parts.push(convertFb2Element(child, imageMap));
    }
    return parts.filter(Boolean).join('\n');
  }

  // Прочее — текст
  const text = el.textContent.trim();
  if (text) return `<p>${escapeHtml(text)}</p>`;

  return '';
}

/**
 * Конвертировать inline FB2-контент
 */
export function convertFb2Inline(el, imageMap) {
  let result = '';

  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += escapeHtml(node.textContent);
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const tag = node.tagName.toLowerCase();

    if (tag === 'emphasis') {
      result += `<em>${convertFb2Inline(node, imageMap)}</em>`;
    } else if (tag === 'strong') {
      result += `<strong>${convertFb2Inline(node, imageMap)}</strong>`;
    } else if (tag === 'strikethrough') {
      result += `<s>${convertFb2Inline(node, imageMap)}</s>`;
    } else if (tag === 'a') {
      result += convertFb2Inline(node, imageMap);
    } else if (tag === 'image') {
      const href = node.getAttribute('l:href') || node.getAttribute('xlink:href') || node.getAttribute('href') || '';
      const dataUrl = imageMap.get(href) || imageMap.get(href.replace('#', ''));
      if (dataUrl) {
        result += `<img src="${dataUrl}" alt="">`;
      }
    } else if (tag === 'sup') {
      result += `<sup>${convertFb2Inline(node, imageMap)}</sup>`;
    } else if (tag === 'sub') {
      result += `<sub>${convertFb2Inline(node, imageMap)}</sub>`;
    } else {
      result += escapeHtml(node.textContent);
    }
  }

  return result;
}

/**
 * Конвертировать FB2 <poem>
 */
function convertFb2Poem(poemEl, imageMap) {
  const lines = [];

  for (const child of poemEl.children) {
    const tag = child.tagName.toLowerCase();

    if (tag === 'title') {
      lines.push(`<h2>${escapeHtml(child.textContent.trim())}</h2>`);
    } else if (tag === 'stanza') {
      for (const v of child.querySelectorAll('v')) {
        lines.push(`<p>${convertFb2Inline(v, imageMap)}</p>`);
      }
      lines.push('<p>&nbsp;</p>');
    } else if (tag === 'text-author') {
      lines.push(`<p><em>${escapeHtml(child.textContent.trim())}</em></p>`);
    } else if (tag === 'epigraph') {
      lines.push(convertFb2Element(child, imageMap));
    }
  }

  return lines.filter(Boolean).join('\n');
}

/**
 * Конвертировать всё содержимое FB2 body в HTML (включая вложенные секции)
 * Используется как fallback, когда не удалось разбить на главы
 * @param {Element} bodyEl
 * @param {Map} imageMap
 * @param {number} [depth=0] — текущая глубина рекурсии (защита от stack overflow)
 */
function convertFb2AllContent(bodyEl, imageMap, depth = 0) {
  if (depth > MAX_SECTION_DEPTH) return '';

  const parts = [];

  for (const child of bodyEl.children) {
    const tag = child.tagName.toLowerCase();
    if (tag === 'section') {
      // Рекурсивно извлечь содержимое секции
      parts.push(convertFb2AllContent(child, imageMap, depth + 1));
    } else if (tag === 'title') {
      parts.push(`<h2>${escapeHtml(child.textContent.trim())}</h2>`);
    } else {
      parts.push(convertFb2Element(child, imageMap));
    }
  }

  return parts.filter(Boolean).join('\n');
}

// --- Утилиты ---

/**
 * Получить текст из FB2-элемента по селектору
 */
export function getFb2Text(parent, selector) {
  if (!parent) return '';
  const el = parent.querySelector(selector);
  return el?.textContent?.trim() || '';
}
