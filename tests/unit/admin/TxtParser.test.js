/**
 * TESTS: TxtParser
 * Тесты для парсера TXT-файлов
 */

import { describe, it, expect } from 'vitest';
import { parseTxt } from '../../../js/admin/parsers/TxtParser.js';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function createTextFile(name, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const file = new File([blob], name, { type: 'text/plain' });
  file.text = () => Promise.resolve(content);
  return file;
}

// ═══════════════════════════════════════════════════════════════════════════
// parseTxt
// ═══════════════════════════════════════════════════════════════════════════

describe('TxtParser', () => {
  describe('parseTxt', () => {
    it('should parse simple text into a single chapter', async () => {
      const file = createTextFile('book.txt', 'Hello world');
      const result = await parseTxt(file);

      expect(result.title).toBe('book');
      expect(result.author).toBe('');
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0].id).toBe('chapter_1');
      expect(result.chapters[0].title).toBe('book');
    });

    it('should split text by double newlines into paragraphs', async () => {
      const file = createTextFile('test.txt', 'Para 1\n\nPara 2\n\nPara 3');
      const result = await parseTxt(file);
      const html = result.chapters[0].html;

      expect(html).toContain('<p>Para 1</p>');
      expect(html).toContain('<p>Para 2</p>');
      expect(html).toContain('<p>Para 3</p>');
    });

    it('should handle triple+ newlines as paragraph separator', async () => {
      const file = createTextFile('test.txt', 'A\n\n\n\nB');
      const result = await parseTxt(file);
      const html = result.chapters[0].html;

      expect(html).toContain('<p>A</p>');
      expect(html).toContain('<p>B</p>');
    });

    it('should convert single newlines within paragraph to <br>', async () => {
      const file = createTextFile('test.txt', 'Line 1\nLine 2\nLine 3');
      const result = await parseTxt(file);

      expect(result.chapters[0].html).toContain('Line 1<br>Line 2<br>Line 3');
    });

    it('should escape HTML entities in text', async () => {
      const file = createTextFile('test.txt', '<script>alert("xss")</script> & "quotes"');
      const result = await parseTxt(file);
      const html = result.chapters[0].html;

      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&amp;');
      expect(html).toContain('&quot;quotes&quot;');
      expect(html).not.toContain('<script>');
    });

    it('should wrap content in <article> with title', async () => {
      const file = createTextFile('my-book.txt', 'Content');
      const result = await parseTxt(file);
      const html = result.chapters[0].html;

      expect(html).toMatch(/^<article>/);
      expect(html).toMatch(/<\/article>$/);
      expect(html).toContain('<h2>my-book</h2>');
    });

    it('should throw on empty file', async () => {
      const file = createTextFile('empty.txt', '');
      await expect(parseTxt(file)).rejects.toThrow('Файл пуст');
    });

    it('should throw on whitespace-only file', async () => {
      const file = createTextFile('blank.txt', '   \n\n\t  ');
      await expect(parseTxt(file)).rejects.toThrow('Файл пуст');
    });

    it('should extract title from filename without extension', async () => {
      const file = createTextFile('My Novel - Chapter 1.txt', 'Text');
      const result = await parseTxt(file);
      expect(result.title).toBe('My Novel - Chapter 1');
    });

    it('should handle filename with multiple dots', async () => {
      const file = createTextFile('book.v2.final.txt', 'Text');
      const result = await parseTxt(file);
      expect(result.title).toBe('book.v2.final');
    });

    it('should filter out empty paragraphs from splitting', async () => {
      const file = createTextFile('test.txt', 'A\n\n\n\n\n\nB');
      const result = await parseTxt(file);
      const html = result.chapters[0].html;

      // Should only have 2 paragraphs, not empty ones
      const pCount = (html.match(/<p>/g) || []).length;
      // h2 + 2 content paragraphs
      expect(pCount).toBe(2);
    });

    it('should trim paragraph whitespace', async () => {
      const file = createTextFile('test.txt', '  Para with spaces  \n\n  Another  ');
      const result = await parseTxt(file);
      const html = result.chapters[0].html;

      expect(html).toContain('<p>Para with spaces</p>');
      expect(html).toContain('<p>Another</p>');
    });

    it('should handle Windows-style line endings (CRLF)', async () => {
      const file = createTextFile('test.txt', 'Para 1\r\n\r\nPara 2');
      const result = await parseTxt(file);
      const html = result.chapters[0].html;

      expect(html).toContain('<p>Para 1</p>');
      expect(html).toContain('<p>Para 2</p>');
    });

    it('should handle text with special characters', async () => {
      const file = createTextFile('test.txt', 'Привет мир!\n\nТекст на русском.');
      const result = await parseTxt(file);
      const html = result.chapters[0].html;

      expect(html).toContain('Привет мир!');
      expect(html).toContain('Текст на русском.');
    });

    it('should handle single paragraph (no double newlines)', async () => {
      const file = createTextFile('test.txt', 'One long paragraph with no breaks at all');
      const result = await parseTxt(file);
      const html = result.chapters[0].html;

      expect(html).toContain('<p>One long paragraph with no breaks at all</p>');
    });

    it('should escape single quotes', async () => {
      const file = createTextFile('test.txt', "it's a test");
      const result = await parseTxt(file);

      expect(result.chapters[0].html).toContain('it&#39;s a test');
    });
  });
});
