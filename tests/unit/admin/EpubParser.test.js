/**
 * TESTS: EpubParser
 * Тесты для парсера EPUB-файлов
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('jszip', () => {
  return {
    default: {
      loadAsync: vi.fn(),
    },
  };
});

import JSZip from 'jszip';
import {
  parseEpub,
  convertElement,
  convertInlineContent,
  convertImage,
  resolveImage,
  resolveRelativePath,
  splitByHeadings,
} from '../../../js/admin/parsers/EpubParser.js';

/**
 * Создать мок ZIP-архива для EPUB
 */
function createMockEpubZip(files = {}) {
  const zipFiles = {};

  for (const [path, content] of Object.entries(files)) {
    zipFiles[path] = {
      dir: false,
      name: path,
      async: vi.fn().mockResolvedValue(content),
      _data: { uncompressedSize: content.length || 100 },
    };
  }

  return {
    files: zipFiles,
    file: vi.fn((path) => zipFiles[path] || null),
  };
}

/**
 * Минимальный container.xml
 */
function makeContainerXml(opfPath = 'OEBPS/content.opf') {
  return `<?xml version="1.0"?>
    <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
      <rootfiles>
        <rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/>
      </rootfiles>
    </container>`;
}

/**
 * Минимальный content.opf
 */
function makeOpfXml({ title = 'Test Book', author = 'Test Author', spineItems = [] } = {}) {
  const manifestItems = spineItems
    .map((item, i) => `<item id="ch${i}" href="${item.href}" media-type="${item.mediaType || 'application/xhtml+xml'}"/>`)
    .join('\n');
  const spineRefs = spineItems
    .map((_, i) => `<itemref idref="ch${i}"/>`)
    .join('\n');

  return `<?xml version="1.0"?>
    <package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <metadata>
        <dc:title>${title}</dc:title>
        <dc:creator>${author}</dc:creator>
      </metadata>
      <manifest>${manifestItems}</manifest>
      <spine>${spineRefs}</spine>
    </package>`;
}

describe('EpubParser', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // resolveRelativePath
  // ═══════════════════════════════════════════════════════════════════════════

  describe('resolveRelativePath', () => {
    it('should resolve simple relative path', () => {
      expect(resolveRelativePath('OEBPS/', 'chapter1.xhtml')).toBe('OEBPS/chapter1.xhtml');
    });

    it('should resolve parent directory reference', () => {
      expect(resolveRelativePath('OEBPS/text/', '../images/photo.jpg')).toBe('OEBPS/images/photo.jpg');
    });

    it('should handle multiple parent references', () => {
      expect(resolveRelativePath('a/b/c/', '../../d/e.html')).toBe('a/d/e.html');
    });

    it('should handle current directory reference (.)', () => {
      expect(resolveRelativePath('OEBPS/', './ch.xhtml')).toBe('OEBPS/ch.xhtml');
    });

    it('should handle absolute paths', () => {
      expect(resolveRelativePath('OEBPS/', '/content.xhtml')).toBe('content.xhtml');
    });

    it('should handle empty base', () => {
      expect(resolveRelativePath('', 'file.xhtml')).toBe('file.xhtml');
    });

    it('should handle path with no trailing slash', () => {
      expect(resolveRelativePath('OEBPS', 'chapter.xhtml')).toBe('OEBPS/chapter.xhtml');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // resolveImage
  // ═══════════════════════════════════════════════════════════════════════════

  describe('resolveImage', () => {
    let imageMap;

    beforeEach(() => {
      imageMap = new Map();
      imageMap.set('images/photo.jpg', 'data:image/jpeg;base64,abc');
      imageMap.set('photo.jpg', 'data:image/jpeg;base64,abc');
      imageMap.set('OEBPS/images/photo.jpg', 'data:image/jpeg;base64,abc');
    });

    it('should resolve direct match', () => {
      const result = resolveImage('images/photo.jpg', imageMap, '');
      expect(result).toBe('data:image/jpeg;base64,abc');
    });

    it('should resolve by basename', () => {
      const result = resolveImage('some/path/photo.jpg', imageMap, '');
      expect(result).toBe('data:image/jpeg;base64,abc');
    });

    it('should resolve relative path', () => {
      const result = resolveImage('../images/photo.jpg', imageMap, 'OEBPS/text/');
      expect(result).toBe('data:image/jpeg;base64,abc');
    });

    it('should return null for unknown image', () => {
      const result = resolveImage('unknown.png', imageMap, '');
      expect(result).toBeNull();
    });

    it('should handle URL-encoded paths', () => {
      imageMap.set('фото.jpg', 'data:image/jpeg;base64,xyz');
      const result = resolveImage('%D1%84%D0%BE%D1%82%D0%BE.jpg', imageMap, '');
      expect(result).toBe('data:image/jpeg;base64,xyz');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // convertImage
  // ═══════════════════════════════════════════════════════════════════════════

  describe('convertImage', () => {
    it('should convert image with known src', () => {
      const imageMap = new Map([['img.jpg', 'data:image;base64,abc']]);
      const imgEl = document.createElement('img');
      imgEl.setAttribute('src', 'img.jpg');

      const result = convertImage(imgEl, imageMap, '');
      expect(result).toContain('<img src="data:image;base64,abc"');
    });

    it('should return empty string for unknown src', () => {
      const imageMap = new Map();
      const imgEl = document.createElement('img');
      imgEl.setAttribute('src', 'unknown.jpg');

      expect(convertImage(imgEl, imageMap, '')).toBe('');
    });

    it('should return empty string for img without src', () => {
      const imgEl = document.createElement('img');
      expect(convertImage(imgEl, new Map(), '')).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // convertInlineContent
  // ═══════════════════════════════════════════════════════════════════════════

  describe('convertInlineContent', () => {
    const imageMap = new Map();

    it('should preserve text content', () => {
      const p = document.createElement('p');
      p.textContent = 'Hello world';

      const result = convertInlineContent(p, imageMap, '');
      expect(result).toBe('Hello world');
    });

    it('should preserve em/i tags', () => {
      const p = document.createElement('p');
      p.innerHTML = 'Hello <em>world</em>';

      const result = convertInlineContent(p, imageMap, '');
      expect(result).toContain('<em>world</em>');
    });

    it('should preserve strong/b tags', () => {
      const p = document.createElement('p');
      p.innerHTML = '<strong>Bold</strong> text';

      const result = convertInlineContent(p, imageMap, '');
      expect(result).toContain('<strong>Bold</strong>');
    });

    it('should handle nested inline elements', () => {
      const p = document.createElement('p');
      p.innerHTML = '<strong><em>Bold italic</em></strong>';

      const result = convertInlineContent(p, imageMap, '');
      expect(result).toContain('<strong><em>Bold italic</em></strong>');
    });

    it('should handle br tags', () => {
      const p = document.createElement('p');
      p.innerHTML = 'Line 1<br>Line 2';

      const result = convertInlineContent(p, imageMap, '');
      expect(result).toContain('<br>');
    });

    it('should extract text from span elements', () => {
      const p = document.createElement('p');
      p.innerHTML = '<span>Span text</span>';

      const result = convertInlineContent(p, imageMap, '');
      expect(result).toContain('Span text');
    });

    it('should handle anchor tags by extracting content', () => {
      const p = document.createElement('p');
      p.innerHTML = '<a href="#">Link text</a>';

      const result = convertInlineContent(p, imageMap, '');
      expect(result).toContain('Link text');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // convertElement
  // ═══════════════════════════════════════════════════════════════════════════

  describe('convertElement', () => {
    const imageMap = new Map();

    it('should convert headings to h2', () => {
      const h1 = document.createElement('h1');
      h1.textContent = 'Title';

      expect(convertElement(h1, imageMap, '')).toContain('<h2>');
    });

    it('should convert h3 to h2', () => {
      const h3 = document.createElement('h3');
      h3.textContent = 'Subtitle';

      expect(convertElement(h3, imageMap, '')).toContain('<h2>');
    });

    it('should convert paragraphs', () => {
      const p = document.createElement('p');
      p.textContent = 'Content';

      const result = convertElement(p, imageMap, '');
      expect(result).toBe('<p>Content</p>');
    });

    it('should skip empty paragraphs', () => {
      const p = document.createElement('p');
      p.textContent = '';

      expect(convertElement(p, imageMap, '')).toBe('');
    });

    it('should handle lists', () => {
      const ul = document.createElement('ul');
      ul.innerHTML = '<li>Item 1</li><li>Item 2</li>';

      const result = convertElement(ul, imageMap, '');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<li>Item 2</li>');
    });

    it('should handle ordered lists', () => {
      const ol = document.createElement('ol');
      ol.innerHTML = '<li>First</li>';

      const result = convertElement(ol, imageMap, '');
      expect(result).toContain('<ol>');
    });

    it('should recurse into div/section elements', () => {
      const div = document.createElement('div');
      div.innerHTML = '<p>Inner content</p>';

      const result = convertElement(div, imageMap, '');
      expect(result).toContain('<p>Inner content</p>');
    });

    it('should wrap blockquote content', () => {
      const bq = document.createElement('blockquote');
      bq.innerHTML = '<p>Quote</p>';

      const result = convertElement(bq, imageMap, '');
      expect(result).toContain('<blockquote>');
    });

    it('should extract text from unknown elements', () => {
      const pre = document.createElement('pre');
      pre.textContent = 'Code content';

      const result = convertElement(pre, imageMap, '');
      expect(result).toContain('Code content');
    });

    it('should return empty for elements with no text', () => {
      const span = document.createElement('span');
      span.textContent = '';

      // span is treated as unknown inline — returns empty for empty text
      expect(convertElement(span, imageMap, '')).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // splitByHeadings
  // ═══════════════════════════════════════════════════════════════════════════

  describe('splitByHeadings', () => {
    it('should split by h1 headings', () => {
      const body = document.createElement('div');
      body.innerHTML = '<h1>Chapter 1</h1><p>Text 1</p><h1>Chapter 2</h1><p>Text 2</p>';

      const sections = splitByHeadings(body, new Map(), '');

      expect(sections).toHaveLength(2);
      expect(sections[0].title).toBe('Chapter 1');
      expect(sections[1].title).toBe('Chapter 2');
    });

    it('should split by h2 headings', () => {
      const body = document.createElement('div');
      body.innerHTML = '<h2>Section A</h2><p>Content A</p><h2>Section B</h2><p>Content B</p>';

      const sections = splitByHeadings(body, new Map(), '');

      expect(sections).toHaveLength(2);
    });

    it('should handle content before first heading', () => {
      const body = document.createElement('div');
      body.innerHTML = '<p>Intro</p><h1>Chapter 1</h1><p>Text</p>';

      const sections = splitByHeadings(body, new Map(), '');

      expect(sections).toHaveLength(2);
      expect(sections[0].title).toBe(''); // no heading title for intro
    });

    it('should return single section if no headings', () => {
      const body = document.createElement('div');
      body.innerHTML = '<p>Just text</p><p>More text</p>';

      const sections = splitByHeadings(body, new Map(), '');

      expect(sections).toHaveLength(1);
    });

    it('should handle empty body', () => {
      const body = document.createElement('div');

      const sections = splitByHeadings(body, new Map(), '');

      expect(sections).toHaveLength(0);
    });

    it('should preserve content in each section', () => {
      const body = document.createElement('div');
      body.innerHTML = '<h1>Title</h1><p>Paragraph 1</p><p>Paragraph 2</p>';

      const sections = splitByHeadings(body, new Map(), '');

      expect(sections[0].content).toContain('Paragraph 1');
      expect(sections[0].content).toContain('Paragraph 2');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // parseEpub
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parseEpub', () => {
    it('should parse basic EPUB with one chapter', async () => {
      const chapterHtml = `<?xml version="1.0"?>
        <html xmlns="http://www.w3.org/1999/xhtml">
          <body><h1>Chapter 1</h1><p>Content here</p></body>
        </html>`;

      const mockZip = createMockEpubZip({
        'META-INF/container.xml': makeContainerXml(),
        'OEBPS/content.opf': makeOpfXml({
          title: 'My EPUB',
          author: 'Author Name',
          spineItems: [{ href: 'chapter1.xhtml' }],
        }),
        'OEBPS/chapter1.xhtml': chapterHtml,
      });
      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'book.epub');
      const result = await parseEpub(file);

      expect(result.title).toBe('My EPUB');
      expect(result.author).toBe('Author Name');
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0].html).toContain('Content here');
    });

    it('should parse EPUB with multiple spine items', async () => {
      const ch1 = `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml">
        <body><h1>Глава 1</h1><p>Текст первой главы</p></body></html>`;
      const ch2 = `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml">
        <body><h2>Глава 2</h2><p>Текст второй главы</p></body></html>`;

      const mockZip = createMockEpubZip({
        'META-INF/container.xml': makeContainerXml(),
        'OEBPS/content.opf': makeOpfXml({
          spineItems: [
            { href: 'ch1.xhtml' },
            { href: 'ch2.xhtml' },
          ],
        }),
        'OEBPS/ch1.xhtml': ch1,
        'OEBPS/ch2.xhtml': ch2,
      });
      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'book.epub');
      const result = await parseEpub(file);

      expect(result.chapters.length).toBeGreaterThanOrEqual(2);
      expect(result.chapters[0].html).toContain('Текст первой главы');
      expect(result.chapters[1].html).toContain('Текст второй главы');
    });

    it('should throw if container.xml is missing', async () => {
      const mockZip = createMockEpubZip({});
      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'bad.epub');

      await expect(parseEpub(file)).rejects.toThrow();
    });

    it('should throw if no text extracted from EPUB', async () => {
      const emptyHtml = `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml">
        <body></body></html>`;

      const mockZip = createMockEpubZip({
        'META-INF/container.xml': makeContainerXml(),
        'OEBPS/content.opf': makeOpfXml({
          spineItems: [{ href: 'empty.xhtml' }],
        }),
        'OEBPS/empty.xhtml': emptyHtml,
      });
      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'empty.epub');

      await expect(parseEpub(file)).rejects.toThrow('Не удалось извлечь текст из EPUB');
    });

    it('should use filename as title fallback', async () => {
      const chapterHtml = `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml">
        <body><p>Some content</p></body></html>`;

      const mockZip = createMockEpubZip({
        'META-INF/container.xml': makeContainerXml(),
        'OEBPS/content.opf': makeOpfXml({
          title: '',
          author: '',
          spineItems: [{ href: 'ch.xhtml' }],
        }),
        'OEBPS/ch.xhtml': chapterHtml,
      });
      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'My Novel.epub');
      const result = await parseEpub(file);

      expect(result.title).toBe('My Novel');
    });

    it('should skip non-html spine items', async () => {
      const chapterHtml = `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml">
        <body><p>Real content</p></body></html>`;

      const mockZip = createMockEpubZip({
        'META-INF/container.xml': makeContainerXml(),
        'OEBPS/content.opf': makeOpfXml({
          spineItems: [
            { href: 'style.css', mediaType: 'text/css' },
            { href: 'ch.xhtml' },
          ],
        }),
        'OEBPS/ch.xhtml': chapterHtml,
      });
      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'book.epub');
      const result = await parseEpub(file);

      expect(result.chapters.length).toBeGreaterThanOrEqual(1);
      expect(result.chapters[0].html).toContain('Real content');
    });

    it('should reject ZIP bombs', async () => {
      const mockZip = {
        files: {
          'META-INF/container.xml': {
            dir: false,
            _data: { uncompressedSize: 200 * 1024 * 1024 },
          },
        },
        file: vi.fn(),
      };
      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'bomb.epub');

      await expect(parseEpub(file)).rejects.toThrow('лимит');
    });
  });
});
