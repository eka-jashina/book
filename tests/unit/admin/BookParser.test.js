/**
 * TESTS: BookParser
 * Тесты для парсера электронных книг
 */

import { describe, it, expect } from 'vitest';
import { BookParser } from '../../../js/admin/BookParser.js';
import { escapeHtml, parseXml, parseHtml, getTextContent } from '../../../js/admin/parsers/parserUtils.js';
import { convertElement, convertInlineContent, convertImage, resolveImage, resolveRelativePath, splitByHeadings } from '../../../js/admin/parsers/EpubParser.js';
import { getFb2Text, loadFb2Images, extractFb2Title, convertFb2Element, convertFb2Inline } from '../../../js/admin/parsers/Fb2Parser.js';
import { parseTxt } from '../../../js/admin/parsers/TxtParser.js';
import { parseDoc, extractDocText, extractDocTextAscii, parseOLE2 } from '../../../js/admin/parsers/DocParser.js';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Создать мок File с текстовым содержимым
 * jsdom не поддерживает File.text(), поэтому добавляем его вручную
 */
function createTextFile(name, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const file = new File([blob], name, { type: 'text/plain' });
  file.text = () => Promise.resolve(content);
  return file;
}

/**
 * Создать мок File с бинарным содержимым (ArrayBuffer)
 */
function createBinaryFile(name, buffer) {
  const file = new File([buffer], name);
  file.arrayBuffer = () => Promise.resolve(buffer);
  return file;
}

/**
 * Построить минимальный валидный OLE2 DOC-файл для тестов.
 * Создаёт OLE2 контейнер с:
 * - Root Entry (storage)
 * - WordDocument stream (FIB + текст)
 * - 1Table stream (CLX с piece table)
 *
 * @param {string} text — текст документа
 * @param {{ compressed?: boolean }} options
 * @returns {ArrayBuffer}
 */
function buildMinimalOLE2Doc(text, options = {}) {
  const sectorSize = 512;
  const { compressed = false } = options;

  // ═══════════ Подготовка текстовых данных ═══════════

  let textBytes;
  if (compressed) {
    // CP1252: 1 байт на символ
    textBytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      textBytes[i] = text.charCodeAt(i) & 0xFF;
    }
  } else {
    // UTF-16LE: 2 байта на символ
    textBytes = new Uint8Array(text.length * 2);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      textBytes[i * 2] = code & 0xFF;
      textBytes[i * 2 + 1] = (code >> 8) & 0xFF;
    }
  }

  // ═══════════ FIB (File Information Block) ═══════════

  // FibBase (32 байта)
  const fibBase = new Uint8Array(32);
  const fibBaseView = new DataView(fibBase.buffer);
  fibBaseView.setUint16(0, 0xA5EC, true);  // wIdent
  fibBaseView.setUint16(2, 0x00C1, true);  // nFib (Word 97)
  // flags: bit 9 = fWhichTblStm = 1 (1Table)
  fibBaseView.setUint16(10, 0x0200, true);

  // FibRgW97: csw=14 (стандарт для Word 97)
  const csw = 14;
  const fibRgW = new Uint8Array(2 + csw * 2);
  new DataView(fibRgW.buffer).setUint16(0, csw, true);

  // FibRgLw97: cslw=22 (стандарт для Word 97)
  const cslw = 22;
  const fibRgLw = new Uint8Array(2 + cslw * 4);
  const fibRgLwView = new DataView(fibRgLw.buffer);
  fibRgLwView.setUint16(0, cslw, true);
  // ccpText (индекс 3): количество символов основного текста
  fibRgLwView.setUint32(2 + 3 * 4, text.length, true);

  // FibRgFcLcb97: cbRgFcLcb=93 (Word 97 стандарт)
  const cbRgFcLcb = 93;
  const fibRgFcLcb = new Uint8Array(2 + cbRgFcLcb * 8);
  const fibRgFcLcbView = new DataView(fibRgFcLcb.buffer);
  fibRgFcLcbView.setUint16(0, cbRgFcLcb, true);
  // fcClx/lcbClx — индекс 33 в массиве пар
  // Значения установим после создания CLX (ниже)

  // Текст расположен сразу после FIB в WordDocument stream
  const fibTotalSize = fibBase.length + fibRgW.length + fibRgLw.length + fibRgFcLcb.length;
  const textOffset = fibTotalSize;

  // WordDocument stream = FIB + текст
  const wordDocSize = fibTotalSize + textBytes.length;
  const wordDocData = new Uint8Array(wordDocSize);
  let wdPos = 0;
  wordDocData.set(fibBase, wdPos); wdPos += fibBase.length;
  wordDocData.set(fibRgW, wdPos); wdPos += fibRgW.length;
  wordDocData.set(fibRgLw, wdPos); wdPos += fibRgLw.length;
  wordDocData.set(fibRgFcLcb, wdPos); wdPos += fibRgFcLcb.length;
  wordDocData.set(textBytes, wdPos);

  // ═══════════ Piece Table (CLX → 1Table stream) ═══════════

  // PlcPcd: 2 CPs (uint32) + 1 PCD (8 байт) = 16 байт
  const plcPcdSize = 2 * 4 + 1 * 8; // 16
  // CLX = Pcdt marker(1) + lcb(4) + PlcPcd
  const clxSize = 1 + 4 + plcPcdSize;
  const tableData = new Uint8Array(clxSize);
  const tableView = new DataView(tableData.buffer);

  let tPos = 0;
  tableData[tPos++] = 0x02;  // Pcdt marker
  tableView.setUint32(tPos, plcPcdSize, true); tPos += 4;

  // CP[0] = 0, CP[1] = text.length
  tableView.setUint32(tPos, 0, true); tPos += 4;
  tableView.setUint32(tPos, text.length, true); tPos += 4;

  // PCD: 2 байта unused + 4 байта fc + 2 байта prm
  tPos += 2; // unused
  if (compressed) {
    // fc с установленным битом 30, byte_offset = textOffset → fc = (textOffset * 2) | 0x40000000
    tableView.setUint32(tPos, (textOffset * 2) | 0x40000000, true);
  } else {
    // Unicode: fc = byte offset в WordDocument stream
    tableView.setUint32(tPos, textOffset, true);
  }

  // Записать fcClx/lcbClx в FIB (в wordDocData)
  const fcLcbOffset = fibBase.length + fibRgW.length + fibRgLw.length + 2; // +2 для cbRgFcLcb
  const clxPairByteOffset = fcLcbOffset + 33 * 8;
  const wdView = new DataView(wordDocData.buffer);
  wdView.setUint32(clxPairByteOffset, 0, true);          // fcClx = 0 (начало table stream)
  wdView.setUint32(clxPairByteOffset + 4, clxSize, true); // lcbClx

  // ═══════════ OLE2 контейнер ═══════════

  // Раскладка секторов:
  // Sector 0: FAT sector
  // Sector 1: Directory sector
  // Sector 2..N: WordDocument data
  // Sector N+1..M: 1Table data

  const wordDocSectors = Math.ceil(wordDocSize / sectorSize);
  const tableSectors = Math.ceil(tableData.length / sectorSize);

  const wordDocStart = 2;  // первый сектор данных WordDocument
  const tableStart = wordDocStart + wordDocSectors;
  const totalSectors = 1 + 1 + wordDocSectors + tableSectors; // FAT + Dir + WD + Table
  const fileSize = (1 + totalSectors) * sectorSize; // +1 для заголовка (512 байт)

  const buf = new ArrayBuffer(fileSize);
  const fileBytes = new Uint8Array(buf);
  const fileView = new DataView(buf);

  // ─── OLE2 Header (512 байт) ───

  // Сигнатура
  const sig = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
  for (let i = 0; i < 8; i++) fileBytes[i] = sig[i];

  fileView.setUint16(24, 0x003E, true);  // minor version
  fileView.setUint16(26, 0x0003, true);  // major version (v3)
  fileView.setUint16(28, 0xFFFE, true);  // byte order (little-endian)
  fileView.setUint16(30, 9, true);       // sector size power (512)
  fileView.setUint16(32, 6, true);       // mini sector size power (64)
  fileView.setUint32(44, 1, true);       // total FAT sectors
  fileView.setUint32(48, 1, true);       // first directory sector = 1
  fileView.setUint32(56, 0x1000, true);  // mini stream cutoff (4096)
  fileView.setInt32(60, -2, true);       // first miniFAT sector (none)
  fileView.setUint32(64, 0, true);       // total miniFAT sectors
  fileView.setInt32(68, -2, true);       // first DIFAT sector (none)
  fileView.setUint32(72, 0, true);       // total DIFAT sectors

  // DIFAT[0] = sector 0 (FAT)
  fileView.setInt32(76, 0, true);
  // DIFAT[1..108] = FREESECT (-1)
  for (let i = 1; i < 109; i++) {
    fileView.setInt32(76 + i * 4, -1, true);
  }

  // ─── Sector 0: FAT ───

  const fatOffset = sectorSize; // sector 0
  // Sector 0 = FAT sector itself (0xFFFFFFFD = -3)
  fileView.setInt32(fatOffset + 0 * 4, -3, true);
  // Sector 1 = Directory (ENDOFCHAIN)
  fileView.setInt32(fatOffset + 1 * 4, -2, true);

  // WordDocument chain: sector 2 → 3 → ... → (2+N-1) = ENDOFCHAIN
  for (let i = 0; i < wordDocSectors; i++) {
    const sector = wordDocStart + i;
    const nextSector = (i < wordDocSectors - 1) ? sector + 1 : -2;
    fileView.setInt32(fatOffset + sector * 4, nextSector, true);
  }

  // 1Table chain: sector tableStart → ... → ENDOFCHAIN
  for (let i = 0; i < tableSectors; i++) {
    const sector = tableStart + i;
    const nextSector = (i < tableSectors - 1) ? sector + 1 : -2;
    fileView.setInt32(fatOffset + sector * 4, nextSector, true);
  }

  // Остальные — FREESECT
  for (let i = tableStart + tableSectors; i < sectorSize / 4; i++) {
    fileView.setInt32(fatOffset + i * 4, -1, true);
  }

  // ─── Sector 1: Directory ───

  const dirOffset = sectorSize * 2; // sector 1

  // Entry 0: Root Entry (type=5, storage)
  writeDirEntry(fileView, fileBytes, dirOffset + 0 * 128, 'Root Entry', 5, -2, 0);

  // Entry 1: WordDocument (type=2, stream)
  writeDirEntry(fileView, fileBytes, dirOffset + 1 * 128, 'WordDocument', 2, wordDocStart, wordDocSize);

  // Entry 2: 1Table (type=2, stream)
  writeDirEntry(fileView, fileBytes, dirOffset + 2 * 128, '1Table', 2, tableStart, tableData.length);

  // ─── Data sectors: WordDocument ───

  const wdDataOffset = sectorSize * (1 + wordDocStart); // +1 for header
  fileBytes.set(wordDocData, wdDataOffset);

  // ─── Data sectors: 1Table ───

  const tableDataOffset = sectorSize * (1 + tableStart);
  fileBytes.set(tableData, tableDataOffset);

  return buf;
}

/**
 * Записать directory entry в OLE2 структуру
 */
function writeDirEntry(view, bytes, offset, name, type, startSector, size) {
  // Имя в UTF-16LE
  for (let i = 0; i < name.length; i++) {
    view.setUint16(offset + i * 2, name.charCodeAt(i), true);
  }
  // Null terminator
  view.setUint16(offset + name.length * 2, 0, true);
  // Name length in bytes (including null terminator)
  view.setUint16(offset + 64, (name.length + 1) * 2, true);
  // Type
  bytes[offset + 66] = type;
  // Color (black=1 for red-black tree)
  bytes[offset + 67] = 1;
  // Left/Right/Child sibling IDs = 0xFFFFFFFF (none)
  view.setInt32(offset + 68, -1, true);  // left
  view.setInt32(offset + 72, -1, true);  // right
  view.setInt32(offset + 76, -1, true);  // child
  // Start sector
  view.setInt32(offset + 116, startSector, true);
  // Size
  view.setUint32(offset + 120, size, true);
}

describe('BookParser', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // escapeHtml
  // ═══════════════════════════════════════════════════════════════════════════

  describe('escapeHtml', () => {
    it('should escape ampersands', () => {
      expect(escapeHtml('A & B')).toBe('A &amp; B');
    });

    it('should escape angle brackets', () => {
      expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('should escape double quotes', () => {
      expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    it('should escape all special characters together', () => {
      expect(escapeHtml('<a href="x">&</a>')).toBe(
        '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;'
      );
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should not escape regular text', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // parseXml
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parseXml', () => {
    it('should parse valid XML', () => {
      const doc = parseXml('<root><child>text</child></root>');
      expect(doc.querySelector('child').textContent).toBe('text');
    });

    it('should fallback to HTML parsing on invalid XML', () => {
      // Невалидный XML, но валидный HTML
      const doc = parseXml('<div><p>text</div>');
      expect(doc).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // parseHtml
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parseHtml', () => {
    it('should parse HTML string into document', () => {
      const doc = parseHtml('<html><body><p>Hello</p></body></html>');
      expect(doc.querySelector('p').textContent).toBe('Hello');
    });

    it('should handle fragment HTML', () => {
      const doc = parseHtml('<p>fragment</p>');
      expect(doc.querySelector('p').textContent).toBe('fragment');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getTextContent
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getTextContent', () => {
    it('should get text content by selector', () => {
      const doc = parseXml('<root><title>My Title</title></root>');
      expect(getTextContent(doc, 'title')).toBe('My Title');
    });

    it('should return empty string if selector not found', () => {
      const doc = parseXml('<root></root>');
      expect(getTextContent(doc, 'title')).toBe('');
    });

    it('should trim whitespace', () => {
      const doc = parseXml('<root><title>  spaced  </title></root>');
      expect(getTextContent(doc, 'title')).toBe('spaced');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getFb2Text
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getFb2Text', () => {
    it('should get text from FB2 element', () => {
      const doc = parseXml(
        '<title-info><book-title>FB2 Book</book-title></title-info>'
      );
      const parent = doc.querySelector('title-info');
      expect(getFb2Text(parent, 'book-title')).toBe('FB2 Book');
    });

    it('should return empty string for null parent', () => {
      expect(getFb2Text(null, 'book-title')).toBe('');
    });

    it('should return empty string if not found', () => {
      const doc = parseXml('<title-info></title-info>');
      const parent = doc.querySelector('title-info');
      expect(getFb2Text(parent, 'book-title')).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // resolveRelativePath
  // ═══════════════════════════════════════════════════════════════════════════

  describe('resolveRelativePath', () => {
    it('should resolve ../ paths', () => {
      expect(resolveRelativePath('OEBPS/Text/', '../Images/img.png'))
        .toBe('OEBPS/Images/img.png');
    });

    it('should resolve ./ paths', () => {
      expect(resolveRelativePath('dir/', './file.txt'))
        .toBe('dir/file.txt');
    });

    it('should resolve non-dot-relative path against base directory', () => {
      expect(resolveRelativePath('dir/', 'images/img.png'))
        .toBe('dir/images/img.png');
    });

    it('should handle multiple ../ levels', () => {
      expect(resolveRelativePath('a/b/c/', '../../img.png'))
        .toBe('a/img.png');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // convertElement
  // ═══════════════════════════════════════════════════════════════════════════

  describe('convertElement', () => {
    const imageMap = new Map();

    it('should convert headings to h2', () => {
      const doc = parseHtml('<h1>Title</h1>');
      const result = convertElement(doc.querySelector('h1'), imageMap, '');
      expect(result).toBe('<h2>Title</h2>');
    });

    it('should convert h3 to h2', () => {
      const doc = parseHtml('<h3>Subtitle</h3>');
      const result = convertElement(doc.querySelector('h3'), imageMap, '');
      expect(result).toBe('<h2>Subtitle</h2>');
    });

    it('should convert paragraphs', () => {
      const doc = parseHtml('<p>Some text</p>');
      const result = convertElement(doc.querySelector('p'), imageMap, '');
      expect(result).toBe('<p>Some text</p>');
    });

    it('should skip empty paragraphs', () => {
      const doc = parseHtml('<p>  </p>');
      const result = convertElement(doc.querySelector('p'), imageMap, '');
      expect(result).toBe('');
    });

    it('should convert lists', () => {
      const doc = parseHtml('<ul><li>Item 1</li><li>Item 2</li></ul>');
      const result = convertElement(doc.querySelector('ul'), imageMap, '');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<li>Item 2</li>');
    });

    it('should convert ordered lists', () => {
      const doc = parseHtml('<ol><li>First</li></ol>');
      const result = convertElement(doc.querySelector('ol'), imageMap, '');
      expect(result).toContain('<ol>');
      expect(result).toContain('<li>First</li>');
    });

    it('should convert blockquote', () => {
      const doc = parseHtml('<blockquote><p>Quote</p></blockquote>');
      const result = convertElement(doc.querySelector('blockquote'), imageMap, '');
      expect(result).toContain('<blockquote>');
      expect(result).toContain('<p>Quote</p>');
    });

    it('should recursively handle div', () => {
      const doc = parseHtml('<div><p>Inside div</p></div>');
      const result = convertElement(doc.querySelector('div'), imageMap, '');
      expect(result).toBe('<p>Inside div</p>');
    });

    it('should handle unknown elements as text paragraphs', () => {
      const doc = parseHtml('<span>Some text</span>');
      const span = doc.querySelector('span');
      // Span внутри body, а не inline внутри p
      const result = convertElement(span, imageMap, '');
      expect(result).toBe('<p>Some text</p>');
    });

    it('should return empty string for elements with no text', () => {
      const doc = parseHtml('<div></div>');
      const result = convertElement(doc.querySelector('div'), imageMap, '');
      expect(result).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // convertInlineContent
  // ═══════════════════════════════════════════════════════════════════════════

  describe('convertInlineContent', () => {
    const imageMap = new Map();

    it('should preserve em/i as <em>', () => {
      const doc = parseHtml('<p><em>italic</em></p>');
      const result = convertInlineContent(doc.querySelector('p'), imageMap, '');
      expect(result).toBe('<em>italic</em>');
    });

    it('should preserve strong/b as <strong>', () => {
      const doc = parseHtml('<p><strong>bold</strong></p>');
      const result = convertInlineContent(doc.querySelector('p'), imageMap, '');
      expect(result).toBe('<strong>bold</strong>');
    });

    it('should handle <br> tags', () => {
      const doc = parseHtml('<p>line1<br>line2</p>');
      const result = convertInlineContent(doc.querySelector('p'), imageMap, '');
      expect(result).toContain('<br>');
    });

    it('should strip links but preserve text', () => {
      const doc = parseHtml('<p><a href="http://example.com">Link text</a></p>');
      const result = convertInlineContent(doc.querySelector('p'), imageMap, '');
      expect(result).toBe('Link text');
      expect(result).not.toContain('<a');
    });

    it('should handle mixed inline content', () => {
      const doc = parseHtml('<p>Normal <em>italic</em> and <strong>bold</strong></p>');
      const result = convertInlineContent(doc.querySelector('p'), imageMap, '');
      expect(result).toBe('Normal <em>italic</em> and <strong>bold</strong>');
    });

    it('should escape HTML in text nodes', () => {
      const doc = parseHtml('<p>A &amp; B</p>');
      const result = convertInlineContent(doc.querySelector('p'), imageMap, '');
      expect(result).toContain('&amp;');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // convertImage
  // ═══════════════════════════════════════════════════════════════════════════

  describe('convertImage', () => {
    it('should convert image with mapped src', () => {
      const imageMap = new Map([['img.png', 'data:image/png;base64,abc']]);
      const doc = parseHtml('<img src="img.png">');
      const result = convertImage(doc.querySelector('img'), imageMap, '');
      expect(result).toBe('<img src="data:image/png;base64,abc" alt="">');
    });

    it('should return empty string for unmapped image', () => {
      const imageMap = new Map();
      const doc = parseHtml('<img src="missing.png">');
      const result = convertImage(doc.querySelector('img'), imageMap, '');
      expect(result).toBe('');
    });

    it('should return empty string for image without src', () => {
      const imageMap = new Map();
      const doc = parseHtml('<img>');
      const result = convertImage(doc.querySelector('img'), imageMap, '');
      expect(result).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // resolveImage
  // ═══════════════════════════════════════════════════════════════════════════

  describe('resolveImage', () => {
    it('should resolve direct match', () => {
      const imageMap = new Map([['images/pic.png', 'data:abc']]);
      expect(resolveImage('images/pic.png', imageMap, '')).toBe('data:abc');
    });

    it('should resolve by basename', () => {
      const imageMap = new Map([['pic.png', 'data:abc']]);
      expect(resolveImage('path/to/pic.png', imageMap, '')).toBe('data:abc');
    });

    it('should resolve relative path', () => {
      const imageMap = new Map([['OEBPS/Images/pic.png', 'data:abc']]);
      expect(resolveImage('../Images/pic.png', imageMap, 'OEBPS/Text/')).toBe('data:abc');
    });

    it('should return null for unresolvable image', () => {
      const imageMap = new Map();
      expect(resolveImage('missing.png', imageMap, '')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // parseTxt
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parseTxt', () => {
    it('should parse simple text file', async () => {
      const file = createTextFile('book.txt', 'First paragraph.\n\nSecond paragraph.');
      const result = await parseTxt(file);

      expect(result.title).toBe('book');
      expect(result.author).toBe('');
      expect(result.chapters.length).toBe(1);
      expect(result.chapters[0].id).toBe('chapter_1');
      expect(result.chapters[0].html).toContain('<p>First paragraph.</p>');
      expect(result.chapters[0].html).toContain('<p>Second paragraph.</p>');
    });

    it('should use filename as title (without extension)', async () => {
      const file = createTextFile('my-novel.txt', 'Some text');
      const result = await parseTxt(file);
      expect(result.title).toBe('my-novel');
    });

    it('should wrap content in <article>', async () => {
      const file = createTextFile('book.txt', 'Content here');
      const result = await parseTxt(file);
      expect(result.chapters[0].html).toMatch(/^<article>/);
      expect(result.chapters[0].html).toMatch(/<\/article>$/);
    });

    it('should escape HTML in text', async () => {
      const file = createTextFile('book.txt', 'Text with <script>alert("xss")</script>');
      const result = await parseTxt(file);
      expect(result.chapters[0].html).not.toContain('<script>');
      expect(result.chapters[0].html).toContain('&lt;script&gt;');
    });

    it('should convert newlines within paragraph to <br>', async () => {
      const file = createTextFile('book.txt', 'Line 1\nLine 2\nLine 3');
      const result = await parseTxt(file);
      expect(result.chapters[0].html).toContain('Line 1<br>Line 2<br>Line 3');
    });

    it('should throw on empty file', async () => {
      const file = createTextFile('empty.txt', '   ');
      await expect(parseTxt(file)).rejects.toThrow('Файл пуст');
    });

    it('should handle multiple paragraphs separated by blank lines', async () => {
      const text = 'Para 1\n\nPara 2\n\n\nPara 3';
      const file = createTextFile('multi.txt', text);
      const result = await parseTxt(file);

      const html = result.chapters[0].html;
      expect(html).toContain('<p>Para 1</p>');
      expect(html).toContain('<p>Para 2</p>');
      expect(html).toContain('<p>Para 3</p>');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // parse (format dispatch)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parse (format dispatch)', () => {
    it('should dispatch .txt files to parseTxt', async () => {
      const file = createTextFile('book.txt', 'text content');
      const result = await BookParser.parse(file);
      expect(result.title).toBe('book');
      expect(result.chapters.length).toBe(1);
    });

    it('should dispatch .epub files to parseEpub', async () => {
      const file = new File(['data'], 'book.epub');
      // EPUB parser должен упасть с ошибкой парсера, а не «Неподдерживаемый формат»
      try {
        await BookParser.parse(file);
      } catch (e) {
        expect(e.message).not.toContain('Неподдерживаемый формат');
      }
    });

    it('should dispatch .fb2 files to parseFb2', async () => {
      const file = createTextFile('book.fb2', '<FictionBook><body><section><p>Text</p></section></body></FictionBook>');
      file.arrayBuffer = () => file.text().then(t => new TextEncoder().encode(t).buffer);
      const result = await BookParser.parse(file);
      expect(result.chapters.length).toBeGreaterThan(0);
    });

    it('should dispatch .docx files to parseDocx', async () => {
      const file = new File(['data'], 'doc.docx');
      // DOCX parser должен упасть с ошибкой парсера, а не «Неподдерживаемый формат»
      try {
        await BookParser.parse(file);
      } catch (e) {
        expect(e.message).not.toContain('Неподдерживаемый формат');
      }
    });

    it('should dispatch .doc files to parseDoc', async () => {
      // OLE2 magic bytes чтобы пройти валидацию сигнатуры
      const ole2Sig = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
      const file = new File([ole2Sig], 'doc.doc');
      file.arrayBuffer = () => Promise.resolve(new ArrayBuffer(10));
      // DOC parser должен упасть с ошибкой «Не удалось извлечь текст из DOC»
      await expect(BookParser.parse(file)).rejects.toThrow('Не удалось извлечь текст из DOC');
    });

    it('should throw on unsupported format', async () => {
      const file = new File(['data'], 'book.pdf');
      await expect(BookParser.parse(file)).rejects.toThrow('Неподдерживаемый формат');
    });

    it('should handle uppercase extensions', async () => {
      const file = createTextFile('BOOK.TXT', 'text content');
      const result = await BookParser.parse(file);
      expect(result.title).toBe('BOOK');
      expect(result.chapters.length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OLE2 парсер
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parseOLE2', () => {
    it('should return null for non-OLE2 buffer', () => {
      const buffer = new ArrayBuffer(1024);
      expect(parseOLE2(buffer)).toBeNull();
    });

    it('should return null for buffer smaller than 512 bytes', () => {
      const buffer = new ArrayBuffer(100);
      expect(parseOLE2(buffer)).toBeNull();
    });

    it('should return null for buffer with wrong signature', () => {
      const buffer = new ArrayBuffer(512);
      const view = new Uint8Array(buffer);
      view[0] = 0xFF;
      expect(parseOLE2(buffer)).toBeNull();
    });

    it('should parse valid OLE2 header and find directory entries', () => {
      const ole2 = buildMinimalOLE2Doc('Hello World test document text for extraction');
      const parsed = parseOLE2(ole2);

      expect(parsed).not.toBeNull();
      expect(parsed.directories.length).toBeGreaterThan(0);
      expect(parsed.findEntry('WordDocument')).not.toBeNull();
    });

    it('should read stream data from directory entry', () => {
      const text = 'Test content for stream reading verification';
      const ole2 = buildMinimalOLE2Doc(text);
      const parsed = parseOLE2(ole2);

      const wordDoc = parsed.findEntry('WordDocument');
      expect(wordDoc).not.toBeNull();

      const data = parsed.readStream(wordDoc);
      expect(data).not.toBeNull();
      expect(data.length).toBeGreaterThan(0);
    });

    it('should find both WordDocument and Table streams', () => {
      const ole2 = buildMinimalOLE2Doc('Test document');
      const parsed = parseOLE2(ole2);

      expect(parsed.findEntry('WordDocument')).not.toBeNull();
      // Наш билдер создаёт 1Table
      expect(parsed.findEntry('1Table')).not.toBeNull();
    });

    it('should return null for entry not found', () => {
      const ole2 = buildMinimalOLE2Doc('Test');
      const parsed = parseOLE2(ole2);
      expect(parsed.findEntry('NonExistent')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Структурный парсинг DOC (OLE2 → FIB → Piece Table)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('extractDocText (structured parsing)', () => {
    it('should extract text from valid OLE2 DOC via piece table', () => {
      const text = 'Привет мир! Это тестовый документ Word.';
      const ole2Buffer = buildMinimalOLE2Doc(text);

      const result = extractDocText(ole2Buffer);
      expect(result).toContain('Привет мир');
      expect(result).toContain('тестовый документ');
    });

    it('should extract ASCII text from OLE2 DOC', () => {
      const text = 'Hello World! This is a test Word document with enough content.';
      const ole2Buffer = buildMinimalOLE2Doc(text);

      const result = extractDocText(ole2Buffer);
      expect(result).toContain('Hello World');
      expect(result).toContain('test Word document');
    });

    it('should handle paragraph marks in DOC text', () => {
      // 0x0D = paragraph mark in Word
      const text = 'First paragraph\rSecond paragraph\rThird paragraph';
      const ole2Buffer = buildMinimalOLE2Doc(text);

      const result = extractDocText(ole2Buffer);
      expect(result).toContain('First paragraph');
      expect(result).toContain('Second paragraph');
      expect(result).toContain('Third paragraph');
    });

    it('should handle compressed (CP1252) pieces', () => {
      const text = 'Simple ASCII text for compressed piece test';
      const ole2Buffer = buildMinimalOLE2Doc(text, { compressed: true });

      const result = extractDocText(ole2Buffer);
      expect(result).toContain('Simple ASCII text');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // extractDocText (fallback)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('extractDocText (fallback)', () => {
    it('should extract UTF-16LE text from non-OLE2 buffer via fallback', () => {
      // Создаём UTF-16LE буфер с длинным текстом (без OLE2 структуры)
      const text = 'This is a test document with enough characters to be extracted from DOC';
      const buffer = new ArrayBuffer(text.length * 2);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        view[i * 2] = code & 0xFF;
        view[i * 2 + 1] = (code >> 8) & 0xFF;
      }

      const result = extractDocText(buffer);
      expect(result).toContain('This is a test document');
    });

    it('should handle empty buffer', () => {
      const buffer = new ArrayBuffer(0);
      const result = extractDocText(buffer);
      expect(result).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // extractDocTextAscii
  // ═══════════════════════════════════════════════════════════════════════════

  describe('extractDocTextAscii', () => {
    it('should extract ASCII text from bytes', () => {
      const text = 'This is a long enough ASCII text to be extracted from a document buffer here';
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        bytes[i] = text.charCodeAt(i);
      }

      const result = extractDocTextAscii(bytes);
      expect(result).toContain('This is a long enough ASCII text');
    });

    it('should skip short chunks', () => {
      // Текст короче 30 символов — не должен быть извлечён
      const text = 'Short text';
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        bytes[i] = text.charCodeAt(i);
      }

      const result = extractDocTextAscii(bytes);
      expect(result).toBe('');
    });

    it('should normalize line endings', () => {
      const text = 'Line 1\r\nLine 2\rLine 3\nLine 4 and some more text to reach the minimum';
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        bytes[i] = text.charCodeAt(i);
      }

      const result = extractDocTextAscii(bytes);
      expect(result).not.toContain('\r');
      expect(result).toContain('\n');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // loadFb2Images
  // ═══════════════════════════════════════════════════════════════════════════

  describe('loadFb2Images', () => {
    it('should extract binary images from FB2 document', () => {
      const xml = `
        <FictionBook>
          <binary id="cover.jpg" content-type="image/jpeg">AAAA</binary>
          <binary id="img1.png" content-type="image/png">BBBB</binary>
        </FictionBook>
      `;
      const doc = parseXml(xml);
      const imageMap = loadFb2Images(doc);

      expect(imageMap.get('cover.jpg')).toBe('data:image/jpeg;base64,AAAA');
      expect(imageMap.get('#cover.jpg')).toBe('data:image/jpeg;base64,AAAA');
      expect(imageMap.get('img1.png')).toBe('data:image/png;base64,BBBB');
    });

    it('should handle document without binary elements', () => {
      const doc = parseXml('<FictionBook></FictionBook>');
      const imageMap = loadFb2Images(doc);
      expect(imageMap.size).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // extractFb2Title
  // ═══════════════════════════════════════════════════════════════════════════

  describe('extractFb2Title', () => {
    it('should extract title from <p> elements', () => {
      const xml = '<title><p>Part 1</p><p>Introduction</p></title>';
      const doc = parseXml(xml);
      const result = extractFb2Title(doc.querySelector('title'));
      expect(result).toBe('Part 1. Introduction');
    });

    it('should fallback to textContent', () => {
      const xml = '<title>Simple Title</title>';
      const doc = parseXml(xml);
      const result = extractFb2Title(doc.querySelector('title'));
      expect(result).toBe('Simple Title');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // convertFb2Element
  // ═══════════════════════════════════════════════════════════════════════════

  describe('convertFb2Element', () => {
    const imageMap = new Map();

    it('should convert <p> to HTML paragraph', () => {
      const doc = parseXml('<root><p>Text</p></root>');
      const result = convertFb2Element(doc.querySelector('p'), imageMap);
      expect(result).toBe('<p>Text</p>');
    });

    it('should convert <empty-line> to spacer', () => {
      const doc = parseXml('<root><empty-line/></root>');
      const result = convertFb2Element(doc.querySelector('empty-line'), imageMap);
      expect(result).toBe('<p>&nbsp;</p>');
    });

    it('should convert <subtitle> to h2', () => {
      const doc = parseXml('<root><subtitle>Sub</subtitle></root>');
      const result = convertFb2Element(doc.querySelector('subtitle'), imageMap);
      expect(result).toBe('<h2>Sub</h2>');
    });

    it('should convert <epigraph> to blockquote', () => {
      const doc = parseXml('<root><epigraph><p>Quote</p></epigraph></root>');
      const result = convertFb2Element(doc.querySelector('epigraph'), imageMap);
      expect(result).toContain('<blockquote>');
      expect(result).toContain('<p>Quote</p>');
    });

    it('should convert <cite> to blockquote', () => {
      const doc = parseXml('<root><cite><p>Citation</p></cite></root>');
      const result = convertFb2Element(doc.querySelector('cite'), imageMap);
      expect(result).toContain('<blockquote>');
    });

    it('should convert <text-author> to italic paragraph', () => {
      const doc = parseXml('<root><text-author>Author Name</text-author></root>');
      const result = convertFb2Element(doc.querySelector('text-author'), imageMap);
      expect(result).toBe('<p><em>Author Name</em></p>');
    });

    it('should convert <image> with mapped href', () => {
      const map = new Map([['#cover', 'data:image/jpeg;base64,abc'], ['cover', 'data:image/jpeg;base64,abc']]);
      // Создаём элемент напрямую — XML/HTML парсеры плохо обрабатывают <image>
      const el = document.createElement('image');
      el.setAttribute('href', '#cover');
      const result = convertFb2Element(el, map);
      expect(result).toBe('<img src="data:image/jpeg;base64,abc" alt="">');
    });

    it('should return empty for unknown empty elements', () => {
      const doc = parseXml('<root><custom></custom></root>');
      const result = convertFb2Element(doc.querySelector('custom'), imageMap);
      expect(result).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // convertFb2Inline
  // ═══════════════════════════════════════════════════════════════════════════

  describe('convertFb2Inline', () => {
    const imageMap = new Map();

    it('should convert <emphasis> to <em>', () => {
      const doc = parseXml('<p><emphasis>italic</emphasis></p>');
      const result = convertFb2Inline(doc.querySelector('p'), imageMap);
      expect(result).toBe('<em>italic</em>');
    });

    it('should convert <strong> to <strong>', () => {
      const doc = parseXml('<p><strong>bold</strong></p>');
      const result = convertFb2Inline(doc.querySelector('p'), imageMap);
      expect(result).toBe('<strong>bold</strong>');
    });

    it('should convert <strikethrough> to <s>', () => {
      const doc = parseXml('<p><strikethrough>deleted</strikethrough></p>');
      const result = convertFb2Inline(doc.querySelector('p'), imageMap);
      expect(result).toBe('<s>deleted</s>');
    });

    it('should convert <sup> and <sub>', () => {
      const doc = parseXml('<p>H<sub>2</sub>O and x<sup>2</sup></p>');
      const result = convertFb2Inline(doc.querySelector('p'), imageMap);
      expect(result).toContain('<sub>2</sub>');
      expect(result).toContain('<sup>2</sup>');
    });

    it('should strip <a> tags but preserve text', () => {
      const doc = parseXml('<p><a href="link">linked</a></p>');
      const result = convertFb2Inline(doc.querySelector('p'), imageMap);
      expect(result).toBe('linked');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // splitByHeadings
  // ═══════════════════════════════════════════════════════════════════════════

  describe('splitByHeadings', () => {
    const imageMap = new Map();

    it('should split content by h1/h2/h3 headings', () => {
      const doc = parseHtml(`
        <body>
          <h1>Chapter 1</h1>
          <p>Content 1</p>
          <h2>Chapter 2</h2>
          <p>Content 2</p>
        </body>
      `);

      const sections = splitByHeadings(doc.body, imageMap, '');
      expect(sections.length).toBe(2);
      expect(sections[0].title).toBe('Chapter 1');
      expect(sections[1].title).toBe('Chapter 2');
    });

    it('should handle content before first heading', () => {
      const doc = parseHtml(`
        <body>
          <p>Preamble</p>
          <h1>Chapter</h1>
          <p>Content</p>
        </body>
      `);

      const sections = splitByHeadings(doc.body, imageMap, '');
      expect(sections.length).toBe(2);
      expect(sections[0].title).toBe('');
      expect(sections[1].title).toBe('Chapter');
    });

    it('should return single section when no headings', () => {
      const doc = parseHtml(`
        <body>
          <p>Just text</p>
          <p>More text</p>
        </body>
      `);

      const sections = splitByHeadings(doc.body, imageMap, '');
      expect(sections.length).toBe(1);
      expect(sections[0].title).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // parseDoc
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parseDoc', () => {
    it('should parse DOC file with enough text', async () => {
      const text = 'This is a really long test document paragraph with enough content to be detected by the parser function for document extraction';
      // Создать UTF-16LE буфер
      const buffer = new ArrayBuffer(text.length * 2);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        view[i * 2] = code & 0xFF;
        view[i * 2 + 1] = (code >> 8) & 0xFF;
      }

      const file = createBinaryFile('test.doc', buffer);
      const result = await parseDoc(file);

      expect(result.title).toBe('test');
      expect(result.author).toBe('');
      expect(result.chapters.length).toBe(1);
      expect(result.chapters[0].html).toContain('<article>');
    });

    it('should throw on empty DOC', async () => {
      const buffer = new ArrayBuffer(10);
      const file = createBinaryFile('empty.doc', buffer);
      await expect(parseDoc(file)).rejects.toThrow('Не удалось извлечь текст из DOC');
    });
  });
});
