/**
 * EpubParser
 *
 * Парсер EPUB-файлов.
 * Извлекает главы, метаданные и изображения из EPUB-архива.
 */

import JSZip from 'jszip';
import { JSDOM } from 'jsdom';
import { escapeHtml, parseXml, parseHtml, getTextContent, type ParsedBook, type ParsedChapter } from './parserUtils.js';
import { validateZipSize, findZipFile } from './BaseParser.js';

const { Node: NodeType } = new JSDOM('').window;
const TEXT_NODE = NodeType.TEXT_NODE;
const ELEMENT_NODE = NodeType.ELEMENT_NODE;

export async function parseEpub(buffer: Buffer, filename: string): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(buffer);

  // Защита от ZIP-бомб
  await validateZipSize(zip);

  // 1. Найти путь к content.opf через META-INF/container.xml
  const containerXml = await readZipFile(zip, 'META-INF/container.xml');
  const containerDoc = parseXml(containerXml);
  const rootfileEl = containerDoc.querySelector('rootfile');
  if (!rootfileEl) {
    throw new Error('Не найден rootfile в container.xml');
  }
  const opfPath = rootfileEl.getAttribute('full-path')!;
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  // 2. Парсинг content.opf
  const opfXml = await readZipFile(zip, opfPath);
  const opfDoc = parseXml(opfXml);

  const title = getTextContent(opfDoc, 'dc\\:title, title') || filename.replace(/\.epub$/i, '');
  const author = getTextContent(opfDoc, 'dc\\:creator, creator') || '';

  // Manifest
  const manifest = new Map<string, { href: string; mediaType: string }>();
  for (const item of opfDoc.querySelectorAll('manifest > item')) {
    manifest.set(item.getAttribute('id')!, {
      href: item.getAttribute('href')!,
      mediaType: item.getAttribute('media-type')!,
    });
  }

  // Spine
  const spineItems: { href: string; mediaType: string }[] = [];
  for (const itemref of opfDoc.querySelectorAll('spine > itemref')) {
    const idref = itemref.getAttribute('idref');
    const entry = manifest.get(idref!);
    if (entry) spineItems.push(entry);
  }

  // 3. Загрузить изображения
  const imageMap = await loadEpubImages(zip, opfDir, manifest);

  // 4. Загрузить контент глав
  const rawChapters: { html: string; dir: string }[] = [];
  const loadedPaths = new Set<string>();
  for (const item of spineItems) {
    if (!item.mediaType?.includes('html') && !item.mediaType?.includes('xml')) continue;
    const href = item.href.split('#')[0];
    const filePath = resolveEpubHref(opfDir, href);
    if (loadedPaths.has(filePath)) continue;
    loadedPaths.add(filePath);
    try {
      const html = await readZipFile(zip, filePath);
      const chapterDir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/') + 1) : '';
      rawChapters.push({ html, dir: chapterDir });
    } catch {
      continue;
    }
  }

  // 5. Разделить на главы
  const chapters = splitEpubChapters(rawChapters, imageMap);

  if (chapters.length === 0) {
    const allContent = rawChapters
      .map(({ html, dir }) => {
        const doc = parseHtml(html);
        const body = doc.body || doc.documentElement;
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

async function readZipFile(zip: JSZip, path: string): Promise<string> {
  const file = findZipFile(zip, path);
  if (!file) {
    throw new Error(`Файл не найден в архиве: ${path}`);
  }
  return file.async('string');
}

// --- Изображения ---

async function loadEpubImages(
  zip: JSZip,
  opfDir: string,
  manifest: Map<string, { href: string; mediaType: string }>,
): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();

  for (const [, entry] of manifest) {
    if (!entry.mediaType?.startsWith('image/')) continue;
    const imgPath = resolveEpubHref(opfDir, entry.href);
    const imgFile = findZipFile(zip, imgPath);
    if (!imgFile) continue;

    const imgData = await imgFile.async('base64');
    const dataUrl = `data:${entry.mediaType};base64,${imgData}`;

    imageMap.set(imgFile.name, dataUrl);
    imageMap.set(imgPath, dataUrl);
    imageMap.set(entry.href, dataUrl);
    try {
      const decoded = decodeURIComponent(entry.href);
      if (decoded !== entry.href) imageMap.set(decoded, dataUrl);
    } catch { /* */ }
    const basename = entry.href.split('/').pop();
    if (basename) {
      imageMap.set(basename, dataUrl);
      try {
        const decodedBasename = decodeURIComponent(basename);
        if (decodedBasename !== basename) imageMap.set(decodedBasename, dataUrl);
      } catch { /* */ }
    }
  }

  return imageMap;
}

// --- Разделение на главы ---

function splitEpubChapters(rawChapters: { html: string; dir: string }[], imageMap: Map<string, string>): ParsedChapter[] {
  const result: ParsedChapter[] = [];
  let chapterIndex = 0;

  for (const { html, dir } of rawChapters) {
    const doc = parseHtml(html);
    const body = doc.body || doc.documentElement;

    const elements = extractElements(body, imageMap, dir);
    if (elements.trim().length === 0) continue;

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

function splitByHeadings(body: Element, imageMap: Map<string, string>, dir: string): { title: string; content: string }[] {
  const headingTags = new Set(['H1', 'H2', 'H3']);
  const children = Array.from(body.children);
  const sections: { title: string; content: string }[] = [];
  let currentTitle = '';
  let currentContent = '';

  for (const el of children) {
    if (headingTags.has(el.tagName)) {
      if (currentContent.trim()) {
        sections.push({ title: currentTitle, content: currentContent });
      }
      currentTitle = el.textContent!.trim();
      currentContent = `<h2>${escapeHtml(currentTitle)}</h2>\n`;
    } else {
      currentContent += `${convertElement(el, imageMap, dir)}\n`;
    }
  }

  if (currentContent.trim()) {
    sections.push({ title: currentTitle, content: currentContent });
  }

  return sections;
}

// --- Конвертация элементов ---

function extractElements(body: Element, imageMap: Map<string, string>, dir: string): string {
  const parts: string[] = [];
  for (const child of body.children) {
    parts.push(convertElement(child, imageMap, dir));
  }
  return parts.join('\n');
}

function convertElement(el: Element, imageMap: Map<string, string>, dir: string): string {
  const tag = el.tagName.toLowerCase();

  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    return `<h2>${escapeHtml(el.textContent!.trim())}</h2>`;
  }

  if (tag === 'p') {
    const inner = convertInlineContent(el, imageMap, dir);
    if (!inner.trim()) return '';
    return `<p>${inner}</p>`;
  }

  if (tag === 'img') {
    return convertImage(el, imageMap, dir);
  }

  if (tag === 'svg' || tag === 'image') return '';

  if (['div', 'section', 'article', 'main', 'aside', 'blockquote'].includes(tag)) {
    const parts: string[] = [];
    for (const child of el.children) {
      const converted = convertElement(child, imageMap, dir);
      if (converted) parts.push(converted);
    }
    if (tag === 'blockquote') {
      return `<blockquote>${parts.join('\n')}</blockquote>`;
    }
    return parts.join('\n');
  }

  if (tag === 'ul' || tag === 'ol') {
    const items = Array.from(el.querySelectorAll('li'))
      .map(li => `<li>${escapeHtml(li.textContent!.trim())}</li>`)
      .join('\n');
    return `<${tag}>\n${items}\n</${tag}>`;
  }

  const text = el.textContent!.trim();
  if (text) return `<p>${escapeHtml(text)}</p>`;

  return '';
}

function convertInlineContent(el: Element, imageMap: Map<string, string>, dir: string): string {
  let result = '';

  for (const node of el.childNodes) {
    if (node.nodeType === TEXT_NODE) {
      result += escapeHtml(node.textContent || '');
      continue;
    }

    if (node.nodeType !== ELEMENT_NODE) continue;

    const child = node as Element;
    const tag = child.tagName.toLowerCase();

    if (tag === 'img') {
      result += convertImage(child, imageMap, dir);
      continue;
    }

    if (['em', 'i'].includes(tag)) {
      result += `<em>${convertInlineContent(child, imageMap, dir)}</em>`;
      continue;
    }

    if (['strong', 'b'].includes(tag)) {
      result += `<strong>${convertInlineContent(child, imageMap, dir)}</strong>`;
      continue;
    }

    if (tag === 'a') {
      result += convertInlineContent(child, imageMap, dir);
      continue;
    }

    if (tag === 'br') {
      result += '<br>';
      continue;
    }

    if (tag === 'span' || tag === 'sub' || tag === 'sup') {
      result += convertInlineContent(child, imageMap, dir);
      continue;
    }

    result += escapeHtml(node.textContent || '');
  }

  return result;
}

function convertImage(imgEl: Element, imageMap: Map<string, string>, dir: string): string {
  const src = imgEl.getAttribute('src') || imgEl.getAttribute('xlink:href') || '';
  if (!src) return '';

  const dataUrl = resolveImage(src, imageMap, dir);
  if (dataUrl) {
    return `<img src="${dataUrl}" alt="">`;
  }

  return '';
}

// --- Резолвинг путей ---

function resolveImage(src: string, imageMap: Map<string, string>, dir: string): string | null {
  if (imageMap.has(src)) return imageMap.get(src)!;

  try {
    const decoded = decodeURIComponent(src);
    if (decoded !== src && imageMap.has(decoded)) return imageMap.get(decoded)!;
  } catch { /* */ }

  const resolved = resolveRelativePath(dir, src);
  if (imageMap.has(resolved)) return imageMap.get(resolved)!;

  const basename = src.split('/').pop();
  if (basename && imageMap.has(basename)) return imageMap.get(basename)!;
  try {
    const decodedBasename = decodeURIComponent(basename!);
    if (decodedBasename !== basename && imageMap.has(decodedBasename)) return imageMap.get(decodedBasename)!;
  } catch { /* */ }

  return null;
}

function resolveRelativePath(base: string, relative: string): string {
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

function resolveEpubHref(opfDir: string, href: string): string {
  if (!href) return href;
  if (href.startsWith('/')) return href.substring(1);
  return resolveRelativePath(opfDir, href);
}
