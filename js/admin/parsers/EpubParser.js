/**
 * EpubParser
 *
 * Парсер EPUB-файлов.
 * Извлекает главы, метаданные и изображения из EPUB-архива.
 */

import JSZip from 'jszip';
import { escapeHtml, parseXml, parseHtml, getTextContent } from './parserUtils.js';
import { validateZipSize, findZipFile } from './BaseParser.js';

/**
 * Парсинг EPUB-контента (XHTML/HTML).
 * EPUB использует XHTML с самозакрывающимися тегами (<title/>, <br/>),
 * которые ломают парсинг через text/html. Поэтому сначала пробуем XML.
 */
function parseEpubContent(htmlString) {
  const xmlDoc = parseXml(htmlString);
  // parseXml при ошибке парсинга уже делает fallback на text/html
  // Проверяем, что body не пустой — если пуст, пробуем text/html напрямую
  const body = xmlDoc.body || xmlDoc.querySelector('body');
  if (body && body.children.length > 0) {
    return xmlDoc;
  }
  return parseHtml(htmlString);
}

/**
 * Парсинг EPUB файла
 * @param {File} file
 * @returns {Promise<import('../BookParser.js').ParsedBook>}
 */
export async function parseEpub(file) {
  const zip = await JSZip.loadAsync(file);

  // Защита от ZIP-бомб
  await validateZipSize(zip);

  // 1. Найти путь к content.opf через META-INF/container.xml
  const containerXml = await readZipFile(zip, 'META-INF/container.xml');
  const containerDoc = parseXml(containerXml);
  const rootfileEl = containerDoc.querySelector('rootfile');
  if (!rootfileEl) {
    throw new Error('Не найден rootfile в container.xml');
  }
  const opfPath = rootfileEl.getAttribute('full-path');
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  // 2. Парсинг content.opf — метаданные и spine
  const opfXml = await readZipFile(zip, opfPath);
  const opfDoc = parseXml(opfXml);

  // Метаданные
  const title = getTextContent(opfDoc, 'dc\\:title, title') || file.name.replace(/\.epub$/i, '');
  const author = getTextContent(opfDoc, 'dc\\:creator, creator') || '';

  // Manifest — карта id → href
  const manifest = new Map();
  for (const item of opfDoc.querySelectorAll('manifest > item')) {
    manifest.set(item.getAttribute('id'), {
      href: item.getAttribute('href'),
      mediaType: item.getAttribute('media-type'),
    });
  }

  // Spine — порядок чтения
  const spineItems = [];
  for (const itemref of opfDoc.querySelectorAll('spine > itemref')) {
    const idref = itemref.getAttribute('idref');
    const entry = manifest.get(idref);
    if (entry) {
      spineItems.push(entry);
    }
  }

  // 3. Загрузить и обработать изображения (base64 data URLs)
  const imageMap = await loadEpubImages(zip, opfDir, manifest);

  // 4. Загрузить и парсить контент глав
  const rawChapters = [];
  const loadedPaths = new Set();
  for (const item of spineItems) {
    if (!item.mediaType?.includes('html') && !item.mediaType?.includes('xml')) {
      continue;
    }
    // href может содержать фрагмент (#section) и относительные сегменты (../text/ch.xhtml)
    const href = item.href.split('#')[0];
    const filePath = resolveEpubHref(opfDir, href);
    // Пропускаем дубликаты (один файл может быть в spine несколько раз с разными фрагментами)
    if (loadedPaths.has(filePath)) continue;
    loadedPaths.add(filePath);
    try {
      const html = await readZipFile(zip, filePath);
      const chapterDir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/') + 1) : '';
      rawChapters.push({ html, dir: chapterDir });
    } catch {
      // Пропускаем файлы, которые не удалось загрузить (обложки, nav и т.д.)
      continue;
    }
  }

  // 5. Разделить на главы по заголовкам
  const chapters = splitEpubChapters(rawChapters, imageMap);

  // Fallback: если не удалось разбить на главы — весь контент как одна глава
  if (chapters.length === 0) {
    const allContent = rawChapters
      .map(({ html, dir }) => {
        const doc = parseEpubContent(html);
        const body = doc.body || doc.querySelector('body') || doc.documentElement;
        return extractElements(body, imageMap, dir);
      })
      .filter(c => c.trim())
      .join('\n');

    if (!allContent.trim()) {
      throw new Error('Не удалось извлечь текст из EPUB');
    }

    chapters.push({
      id: 'chapter_1',
      title: title || 'Глава 1',
      html: `<article>\n<h2>${escapeHtml(title || 'Глава 1')}</h2>\n${allContent}\n</article>`,
    });
  }

  return { title, author, chapters };
}

// --- ZIP-утилиты ---

/**
 * Прочитать файл из ZIP-архива
 */
async function readZipFile(zip, path) {
  const file = findZipFile(zip, path);
  if (!file) {
    throw new Error(`Файл не найден в архиве: ${path}`);
  }
  return file.async('string');
}

// --- Изображения ---

/**
 * Загрузить изображения из EPUB как base64 data URLs
 */
async function loadEpubImages(zip, opfDir, manifest) {
  const imageMap = new Map();

  for (const [, entry] of manifest) {
    if (!entry.mediaType?.startsWith('image/')) continue;
    const imgPath = resolveEpubHref(opfDir, entry.href);
    const imgFile = findZipFile(zip, imgPath);
    if (!imgFile) continue;

    const imgData = await imgFile.async('base64');
    const dataUrl = `data:${entry.mediaType};base64,${imgData}`;

    // Сохраняем по нескольким ключам для сопоставления
    imageMap.set(imgFile.name, dataUrl);
    imageMap.set(imgPath, dataUrl);
    imageMap.set(entry.href, dataUrl);
    // Декодированный вариант пути (для сопоставления из HTML-атрибутов)
    try {
      const decoded = decodeURIComponent(entry.href);
      if (decoded !== entry.href) imageMap.set(decoded, dataUrl);
    } catch (err) { console.debug('EpubParser: ошибка декодирования href изображения', err); }
    // Часто в EPUB src="../images/foo.jpg" — нужен только basename
    const basename = entry.href.split('/').pop();
    if (basename) {
      imageMap.set(basename, dataUrl);
      try {
        const decodedBasename = decodeURIComponent(basename);
        if (decodedBasename !== basename) imageMap.set(decodedBasename, dataUrl);
      } catch (err) { console.debug('EpubParser: ошибка декодирования basename изображения', err); }
    }
  }

  return imageMap;
}

// --- Разделение на главы ---

/**
 * Разделить EPUB-контент на главы
 */
function splitEpubChapters(rawChapters, imageMap) {
  const result = [];
  let chapterIndex = 0;

  for (const { html, dir } of rawChapters) {
    const doc = parseEpubContent(html);
    const body = doc.body || doc.querySelector('body') || doc.documentElement;

    // Извлечь текстовое содержимое
    const elements = extractElements(body, imageMap, dir);
    if (elements.trim().length === 0) continue;

    // Попробовать разделить по заголовкам h1/h2/h3 внутри одного spine-файла
    const subChapters = splitByHeadings(body, imageMap, dir);

    if (subChapters.length > 1) {
      for (const sub of subChapters) {
        chapterIndex++;
        result.push({
          id: `chapter_${chapterIndex}`,
          title: sub.title || `Глава ${chapterIndex}`,
          html: `<article>\n<h2>${escapeHtml(sub.title || `Глава ${chapterIndex}`)}</h2>\n${sub.content}\n</article>`,
        });
      }
    } else {
      // Один файл = одна глава
      chapterIndex++;
      const heading = body.querySelector('h1, h2, h3');
      const chTitle = heading?.textContent?.trim() || `Глава ${chapterIndex}`;

      result.push({
        id: `chapter_${chapterIndex}`,
        title: chTitle,
        html: `<article>\n${elements}\n</article>`,
      });
    }
  }

  return result;
}

/**
 * Разделить содержимое body по заголовкам
 */
export function splitByHeadings(body, imageMap, dir) {
  const headingTags = new Set(['H1', 'H2', 'H3']);
  const children = Array.from(body.children);
  const sections = [];
  let currentTitle = '';
  let currentContent = '';

  for (const el of children) {
    // tagName в XML-режиме возвращается в нижнем регистре
    if (headingTags.has(el.tagName.toUpperCase())) {
      // Если накоплен контент — сохранить секцию
      if (currentContent.trim()) {
        sections.push({ title: currentTitle, content: currentContent });
      }
      currentTitle = el.textContent.trim();
      currentContent = `<h2>${escapeHtml(currentTitle)}</h2>\n`;
    } else {
      currentContent += `${convertElement(el, imageMap, dir)}\n`;
    }
  }

  // Последняя секция
  if (currentContent.trim()) {
    sections.push({ title: currentTitle, content: currentContent });
  }

  return sections;
}

// --- Конвертация элементов ---

/**
 * Извлечь элементы из тела документа
 */
function extractElements(body, imageMap, dir) {
  const parts = [];
  for (const child of body.children) {
    parts.push(convertElement(child, imageMap, dir));
  }
  return parts.join('\n');
}

/**
 * Конвертировать DOM-элемент в чистый HTML для ридера
 */
export function convertElement(el, imageMap, dir) {
  const tag = el.tagName.toLowerCase();

  // Заголовки → h2
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    return `<h2>${escapeHtml(el.textContent.trim())}</h2>`;
  }

  // Параграфы
  if (tag === 'p') {
    const inner = convertInlineContent(el, imageMap, dir);
    if (!inner.trim()) return '';
    return `<p>${inner}</p>`;
  }

  // Изображения
  if (tag === 'img') {
    return convertImage(el, imageMap, dir);
  }

  // SVG-обёртки изображений
  if (tag === 'svg' || tag === 'image') {
    return '';
  }

  // Span-контейнер: в EPUB span иногда оборачивает блочные элементы (<p>, <div>)
  if (tag === 'span' && el.children.length > 0 && el.querySelector('p, div, h1, h2, h3, h4, h5, h6')) {
    const parts = [];
    for (const child of el.children) {
      const converted = convertElement(child, imageMap, dir);
      if (converted) parts.push(converted);
    }
    return parts.join('\n');
  }

  // Div / section — рекурсивно
  if (['div', 'section', 'article', 'main', 'aside', 'blockquote'].includes(tag)) {
    const parts = [];
    for (const child of el.children) {
      const converted = convertElement(child, imageMap, dir);
      if (converted) parts.push(converted);
    }
    if (tag === 'blockquote') {
      return `<blockquote>${parts.join('\n')}</blockquote>`;
    }
    return parts.join('\n');
  }

  // Списки
  if (tag === 'ul' || tag === 'ol') {
    const items = Array.from(el.querySelectorAll('li'))
      .map(li => `<li>${escapeHtml(li.textContent.trim())}</li>`)
      .join('\n');
    return `<${tag}>\n${items}\n</${tag}>`;
  }

  // Прочее — извлечь текст как параграф
  const text = el.textContent.trim();
  if (text) {
    return `<p>${escapeHtml(text)}</p>`;
  }

  return '';
}

/**
 * Конвертировать inline-содержимое элемента (сохраняя em, strong, a)
 */
export function convertInlineContent(el, imageMap, dir) {
  let result = '';

  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += escapeHtml(node.textContent);
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const tag = node.tagName.toLowerCase();

    if (tag === 'img') {
      result += convertImage(node, imageMap, dir);
      continue;
    }

    if (['em', 'i'].includes(tag)) {
      result += `<em>${convertInlineContent(node, imageMap, dir)}</em>`;
      continue;
    }

    if (['strong', 'b'].includes(tag)) {
      result += `<strong>${convertInlineContent(node, imageMap, dir)}</strong>`;
      continue;
    }

    if (tag === 'a') {
      result += convertInlineContent(node, imageMap, dir);
      continue;
    }

    if (tag === 'br') {
      result += '<br>';
      continue;
    }

    if (tag === 'span' || tag === 'sub' || tag === 'sup') {
      result += convertInlineContent(node, imageMap, dir);
      continue;
    }

    // Прочие inline-элементы — только текст
    result += escapeHtml(node.textContent);
  }

  return result;
}

/**
 * Конвертировать изображение с заменой src на data URL
 */
export function convertImage(imgEl, imageMap, dir) {
  const src = imgEl.getAttribute('src') || imgEl.getAttribute('xlink:href') || '';
  if (!src) return '';

  // Попытка найти data URL
  const dataUrl = resolveImage(src, imageMap, dir);
  if (dataUrl) {
    return `<img src="${dataUrl}" alt="">`;
  }

  return '';
}

// --- Резолвинг путей ---

/**
 * Резолвить путь к изображению в data URL
 */
export function resolveImage(src, imageMap, dir) {
  // Прямое совпадение
  if (imageMap.has(src)) return imageMap.get(src);

  // Попробовать URL-декодированный вариант
  try {
    const decoded = decodeURIComponent(src);
    if (decoded !== src && imageMap.has(decoded)) return imageMap.get(decoded);
  } catch (err) { console.debug('EpubParser: ошибка декодирования src изображения', err); }

  // Относительный путь от директории главы
  const resolved = resolveRelativePath(dir, src);
  if (imageMap.has(resolved)) return imageMap.get(resolved);

  // Только имя файла
  const basename = src.split('/').pop();
  if (basename && imageMap.has(basename)) return imageMap.get(basename);
  // Декодированный basename
  try {
    const decodedBasename = decodeURIComponent(basename);
    if (decodedBasename !== basename && imageMap.has(decodedBasename)) return imageMap.get(decodedBasename);
  } catch (err) { console.debug('EpubParser: ошибка декодирования basename', err); }

  return null;
}

/**
 * Резолвить относительный путь (поддерживает ../ и ./ в любой позиции)
 */
export function resolveRelativePath(base, relative) {
  // Абсолютные пути не резолвим
  if (relative.startsWith('/')) return relative.substring(1);

  const baseParts = base.split('/').filter(Boolean);
  const relParts = relative.split('/');

  for (const part of relParts) {
    if (part === '..') {
      baseParts.pop();
    } else if (part !== '.' && part !== '') {
      baseParts.push(part);
    }
  }

  return baseParts.join('/');
}

/**
 * Резолвить href из OPF-манифеста относительно директории OPF.
 * Обрабатывает относительные пути и URL-кодирование.
 */
function resolveEpubHref(opfDir, href) {
  if (!href) return href;
  // Если href начинается с / — абсолютный путь внутри архива
  if (href.startsWith('/')) return href.substring(1);
  // Резолвим относительно директории OPF
  return resolveRelativePath(opfDir, href);
}
