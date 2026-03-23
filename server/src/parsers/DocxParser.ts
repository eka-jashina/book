/**
 * DocxParser
 *
 * Парсер DOCX-файлов (Office Open XML).
 * Извлекает текст, изображения и базовое форматирование.
 */

import JSZip from 'jszip';
import { escapeHtml, parseXml, getTextContent, type ParsedBook } from './parserUtils.js';
import { validateZipSize, createChapter, wrapChapterHtml, titleFromFilename } from './BaseParser.js';

export async function parseDocx(buffer: Buffer, filename: string): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(buffer);

  // Защита от ZIP-бомб
  await validateZipSize(zip);
  const title = titleFromFilename(filename);

  // Метаданные из docProps/core.xml
  let author = '';
  let docTitle = '';
  const coreXml = zip.file('docProps/core.xml');
  if (coreXml) {
    const coreText = await coreXml.async('string');
    const coreDoc = parseXml(coreText);
    docTitle = getTextContent(coreDoc, 'dc\\:title, title') || '';
    author = getTextContent(coreDoc, 'dc\\:creator, creator') || '';
  }

  const finalTitle = docTitle || title;

  // Загрузить изображения из word/media/
  const imageMap = await loadDocxImages(zip);

  // Загрузить связи для изображений
  const relsMap = await loadDocxRels(zip);

  // Парсить word/document.xml
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('Не найден word/document.xml в архиве');
  }
  const docXml = await docXmlFile.async('string');
  const doc = parseXml(docXml);

  const body = doc.querySelector('body') || doc.documentElement;
  const html = convertDocxBody(body, imageMap, relsMap);

  if (!html.trim()) {
    throw new Error('Не удалось извлечь текст из DOCX');
  }

  return {
    title: finalTitle,
    author,
    chapters: [createChapter(0, finalTitle, wrapChapterHtml(finalTitle, html))],
  };
}

async function loadDocxImages(zip: JSZip): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();

  for (const [path, file] of Object.entries(zip.files)) {
    if (!path.startsWith('word/media/')) continue;
    if (file.dir) continue;

    const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml', '.webp': 'image/webp',
    };
    const mime = mimeTypes[ext];
    if (!mime) continue;

    const base64 = await file.async('base64');
    const dataUrl = `data:${mime};base64,${base64}`;
    const relPath = path.substring('word/'.length);
    imageMap.set(relPath, dataUrl);
  }

  return imageMap;
}

async function loadDocxRels(zip: JSZip): Promise<Map<string, string>> {
  const relsMap = new Map<string, string>();
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (!relsFile) return relsMap;

  const relsXml = await relsFile.async('string');
  const relsDoc = parseXml(relsXml);

  for (const rel of relsDoc.querySelectorAll('Relationship')) {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) {
      relsMap.set(id, target);
    }
  }

  return relsMap;
}

function convertDocxBody(body: Element, imageMap: Map<string, string>, relsMap: Map<string, string>): string {
  const parts: string[] = [];
  const children = body.children;

  for (const el of children) {
    const tag = el.tagName?.toLowerCase() || el.localName;

    if (tag === 'w:p' || tag === 'p') {
      const result = convertDocxParagraph(el, imageMap, relsMap);
      if (result) parts.push(result);
    } else if (tag === 'w:tbl' || tag === 'tbl') {
      const rows = el.querySelectorAll('w\\:tr, tr');
      for (const row of rows) {
        const cells = row.querySelectorAll('w\\:tc, tc');
        for (const cell of cells) {
          const paras = cell.querySelectorAll('w\\:p, p');
          for (const p of paras) {
            const result = convertDocxParagraph(p, imageMap, relsMap);
            if (result) parts.push(result);
          }
        }
      }
    }
  }

  return parts.join('\n');
}

function convertDocxParagraph(pEl: Element, imageMap: Map<string, string>, relsMap: Map<string, string>): string {
  const pStyle = pEl.querySelector('w\\:pPr > w\\:pStyle, pPr > pStyle');
  const styleVal = pStyle?.getAttribute('w:val') || pStyle?.getAttribute('val') || '';

  const runs = pEl.querySelectorAll('w\\:r, r');
  let text = '';
  let hasImage = false;
  let imageHtml = '';

  for (const run of runs) {
    const drawing = run.querySelector('w\\:drawing, drawing');
    if (drawing) {
      const blip = drawing.querySelector('a\\:blip, blip');
      const embed = blip?.getAttribute('r:embed') || blip?.getAttribute('embed') || '';
      if (embed) {
        const target = relsMap.get(embed);
        if (target) {
          const dataUrl = imageMap.get(target);
          if (dataUrl) {
            hasImage = true;
            imageHtml += `<img src="${dataUrl}" alt="">`;
          }
        }
      }
      continue;
    }

    const tEls = run.querySelectorAll('w\\:t, t');
    const rPr = run.querySelector('w\\:rPr, rPr');
    const isBold = rPr?.querySelector('w\\:b, b');
    const isItalic = rPr?.querySelector('w\\:i, i');

    for (const t of tEls) {
      let chunk = escapeHtml(t.textContent || '');
      if (isBold) chunk = `<strong>${chunk}</strong>`;
      if (isItalic) chunk = `<em>${chunk}</em>`;
      text += chunk;
    }

    if (run.querySelector('w\\:br, br')) {
      text += '<br>';
    }
  }

  if (hasImage) return imageHtml;
  if (!text.trim()) return '';

  if (/^heading\s*1$/i.test(styleVal) || /^1$/i.test(styleVal)) {
    return `<h2>${text}</h2>`;
  }
  if (/^heading\s*[2-6]$/i.test(styleVal)) {
    return `<h2>${text}</h2>`;
  }

  return `<p>${text}</p>`;
}
