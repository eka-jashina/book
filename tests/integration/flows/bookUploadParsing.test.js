/**
 * INTEGRATION TEST: Book Upload & Parsing
 * Загрузка файлов (txt/doc/docx/epub/fb2), диспатч парсера,
 * валидация magic bytes, санитизация HTML.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock DOMPurify — prevent dynamic import issues in test env
vi.mock('dompurify', () => ({
  default: { sanitize: (html) => html },
}));

/**
 * Helper: create File-like object that works in jsdom.
 * jsdom's File sometimes lacks .text() / .arrayBuffer(), so we use Blob + name.
 */
function createFile(content, name, opts = {}) {
  const blob = new Blob([content], { type: opts.type || '' });
  blob.name = name;
  // Polyfill .text() if missing (some jsdom versions)
  if (!blob.text) {
    blob.text = () => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
  }
  if (!blob.arrayBuffer) {
    blob.arrayBuffer = () => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }
  return blob;
}

describe('Book Upload & Parsing Integration', () => {

  // ── BookParser dispatch ───────────────────────────────────────────────────

  describe('BookParser', () => {
    let BookParser;

    beforeEach(async () => {
      const mod = await import('../../../js/admin/BookParser.js');
      BookParser = mod.BookParser;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should parse a simple .txt file', async () => {
      const content = 'First paragraph\n\nSecond paragraph\n\nThird paragraph';
      const file = createFile(content, 'test-book.txt', { type: 'text/plain' });

      const result = await BookParser.parse(file);

      expect(result.title).toBe('test-book');
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0].html).toContain('First paragraph');
      expect(result.chapters[0].html).toContain('Second paragraph');
      expect(result.chapters[0].html).toContain('Third paragraph');
    });

    it('should preserve paragraphs in txt parsing', async () => {
      const content = 'Para one\n\nPara two\n\nPara three';
      const file = createFile(content, 'multi.txt', { type: 'text/plain' });

      const result = await BookParser.parse(file);

      const html = result.chapters[0].html;
      expect(html.match(/<p>/g).length).toBe(3);
    });

    it('should escape HTML entities in txt content', async () => {
      const content = '<script>alert("xss")</script>\n\nNormal text & "quotes"';
      const file = createFile(content, 'xss.txt', { type: 'text/plain' });

      const result = await BookParser.parse(file);

      const html = result.chapters[0].html;
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&amp;');
    });

    it('should reject empty txt file', async () => {
      const file = createFile('', 'empty.txt', { type: 'text/plain' });

      await expect(BookParser.parse(file)).rejects.toThrow();
    });

    it('should reject unsupported file extension', async () => {
      const file = createFile('data', 'image.png', { type: 'image/png' });

      await expect(BookParser.parse(file)).rejects.toThrow();
    });

    it('should extract title from filename without extension', async () => {
      const file = createFile('Hello world', 'My Great Novel.txt', { type: 'text/plain' });

      const result = await BookParser.parse(file);

      expect(result.title).toBe('My Great Novel');
    });

    it('should validate magic bytes for .docx (must be ZIP)', async () => {
      const file = createFile('not a zip file content', 'fake.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      await expect(BookParser.parse(file)).rejects.toThrow();
    });

    it('should validate magic bytes for .epub (must be ZIP)', async () => {
      const file = createFile('not zip', 'fake.epub', { type: 'application/epub+zip' });

      await expect(BookParser.parse(file)).rejects.toThrow();
    });

    it('should validate magic bytes for .doc (must be OLE2)', async () => {
      const file = createFile('not ole2', 'fake.doc', { type: 'application/msword' });

      await expect(BookParser.parse(file)).rejects.toThrow();
    });

    it('should validate .fb2 starts with XML tag', async () => {
      const file = createFile('not xml content', 'fake.fb2', { type: 'text/xml' });

      await expect(BookParser.parse(file)).rejects.toThrow();
    });

    it('should handle .txt with only whitespace', async () => {
      const file = createFile('   \n\n   \n   ', 'spaces.txt', { type: 'text/plain' });

      await expect(BookParser.parse(file)).rejects.toThrow();
    });

    it('should preserve internal line breaks as <br> in txt', async () => {
      const content = 'Line one\nLine two within same paragraph';
      const file = createFile(content, 'breaks.txt', { type: 'text/plain' });

      const result = await BookParser.parse(file);

      expect(result.chapters[0].html).toContain('<br>');
    });

    it('should return ParsedBook shape with correct fields', async () => {
      const file = createFile('Some content', 'shape.txt', { type: 'text/plain' });

      const result = await BookParser.parse(file);

      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('chapters');
      expect(Array.isArray(result.chapters)).toBe(true);
      expect(result.chapters[0]).toHaveProperty('id');
      expect(result.chapters[0]).toHaveProperty('title');
      expect(result.chapters[0]).toHaveProperty('html');
    });
  });

  // ── TxtParser (direct) ─────────────────────────────────────────────────────

  describe('TxtParser direct', () => {
    let parseTxt;

    beforeEach(async () => {
      const mod = await import('../../../js/admin/parsers/TxtParser.js');
      parseTxt = mod.parseTxt;
    });

    it('should split paragraphs by blank lines', async () => {
      const file = createFile('A\n\nB\n\nC', 'abc.txt');

      const result = await parseTxt(file);

      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0].html.match(/<p>/g).length).toBe(3);
    });

    it('should produce article wrapper', async () => {
      const file = createFile('Hello', 'test.txt');

      const result = await parseTxt(file);

      expect(result.chapters[0].html).toContain('<article');
    });

    it('should handle single paragraph', async () => {
      const file = createFile('Just one paragraph', 'single.txt');

      const result = await parseTxt(file);

      expect(result.chapters[0].html).toContain('Just one paragraph');
      expect(result.chapters).toHaveLength(1);
    });
  });

  // ── parserUtils ─────────────────────────────────────────────────────────────

  describe('parserUtils', () => {
    let escapeHtml;

    beforeEach(async () => {
      const mod = await import('../../../js/admin/parsers/parserUtils.js');
      escapeHtml = mod.escapeHtml;
    });

    it('should escape < and >', () => {
      expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('should escape &', () => {
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('should escape quotes', () => {
      expect(escapeHtml('"hello"')).toContain('&quot;');
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle string without special chars', () => {
      expect(escapeHtml('normal text')).toBe('normal text');
    });
  });
});
