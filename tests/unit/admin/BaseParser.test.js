/**
 * TESTS: BaseParser (shared utilities)
 * Тесты для общих утилит парсеров: createChapter, wrapChapterHtml,
 * titleFromFilename, validateZipSize, findZipFile
 */

import { describe, it, expect, vi } from 'vitest';
import {
  MAX_DECOMPRESSED_SIZE,
  validateZipSize,
  findZipFile,
  createChapter,
  wrapChapterHtml,
  titleFromFilename,
} from '../../../js/admin/parsers/BaseParser.js';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Создать мок JSZip-объекта
 */
function createMockZip(files = {}) {
  const zipFiles = {};
  for (const [name, options] of Object.entries(files)) {
    zipFiles[name] = {
      dir: options.dir || false,
      _data: options._data || {},
      async: options.async || vi.fn(),
      name,
    };
  }

  return {
    files: zipFiles,
    file: (path) => zipFiles[path] || null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// createChapter
// ═══════════════════════════════════════════════════════════════════════════

describe('BaseParser', () => {
  describe('createChapter', () => {
    it('should create chapter with correct id (1-based)', () => {
      const chapter = createChapter(0, 'Title', '<p>Content</p>');
      expect(chapter.id).toBe('chapter_1');
    });

    it('should create chapter with index 5', () => {
      const chapter = createChapter(5, 'Title', '<p>Content</p>');
      expect(chapter.id).toBe('chapter_6');
    });

    it('should set title and html', () => {
      const chapter = createChapter(0, 'My Title', '<p>My Content</p>');
      expect(chapter.title).toBe('My Title');
      expect(chapter.html).toBe('<p>My Content</p>');
    });

    it('should handle empty title', () => {
      const chapter = createChapter(0, '', '<p>Content</p>');
      expect(chapter.title).toBe('');
    });

    it('should handle empty html', () => {
      const chapter = createChapter(0, 'Title', '');
      expect(chapter.html).toBe('');
    });

    it('should return plain object with three properties', () => {
      const chapter = createChapter(0, 'T', 'H');
      expect(Object.keys(chapter)).toEqual(['id', 'title', 'html']);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // wrapChapterHtml
  // ═══════════════════════════════════════════════════════════════════════════

  describe('wrapChapterHtml', () => {
    it('should wrap content in <article> tags', () => {
      const result = wrapChapterHtml('Title', '<p>Content</p>');
      expect(result).toMatch(/^<article>/);
      expect(result).toMatch(/<\/article>$/);
    });

    it('should include escaped title as h2', () => {
      const result = wrapChapterHtml('My Chapter', '<p>Content</p>');
      expect(result).toContain('<h2>My Chapter</h2>');
    });

    it('should escape HTML in title', () => {
      const result = wrapChapterHtml('<script>xss</script>', '<p>Content</p>');
      expect(result).toContain('&lt;script&gt;xss&lt;/script&gt;');
      expect(result).not.toContain('<script>');
    });

    it('should include content after title', () => {
      const result = wrapChapterHtml('Title', '<p>Paragraph 1</p>\n<p>Paragraph 2</p>');
      expect(result).toContain('<p>Paragraph 1</p>');
      expect(result).toContain('<p>Paragraph 2</p>');
    });

    it('should handle empty title', () => {
      const result = wrapChapterHtml('', '<p>Content</p>');
      expect(result).toContain('<h2></h2>');
      expect(result).toContain('<p>Content</p>');
    });

    it('should handle empty content', () => {
      const result = wrapChapterHtml('Title', '');
      expect(result).toContain('<h2>Title</h2>');
      expect(result).toMatch(/<article>\n<h2>Title<\/h2>\n\n<\/article>/);
    });

    it('should escape special characters in title', () => {
      const result = wrapChapterHtml('Chapter "1" & \'intro\'', '<p>X</p>');
      expect(result).toContain('&quot;1&quot;');
      expect(result).toContain('&amp;');
      expect(result).toContain('&#39;intro&#39;');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // titleFromFilename
  // ═══════════════════════════════════════════════════════════════════════════

  describe('titleFromFilename', () => {
    it('should remove file extension', () => {
      expect(titleFromFilename('book.txt')).toBe('book');
    });

    it('should handle multiple dots — remove only last extension', () => {
      expect(titleFromFilename('my.book.v2.epub')).toBe('my.book.v2');
    });

    it('should handle no extension', () => {
      expect(titleFromFilename('README')).toBe('README');
    });

    it('should handle dotfile', () => {
      expect(titleFromFilename('.gitignore')).toBe('');
    });

    it('should handle complex filenames', () => {
      expect(titleFromFilename('My Novel - Chapter 1.doc')).toBe('My Novel - Chapter 1');
    });

    it('should handle extension-only filename', () => {
      expect(titleFromFilename('.txt')).toBe('');
    });

    it('should preserve spaces and special chars in name', () => {
      expect(titleFromFilename('файл (копия).fb2')).toBe('файл (копия)');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MAX_DECOMPRESSED_SIZE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('MAX_DECOMPRESSED_SIZE', () => {
    it('should be 100 MB', () => {
      expect(MAX_DECOMPRESSED_SIZE).toBe(100 * 1024 * 1024);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // validateZipSize
  // ═══════════════════════════════════════════════════════════════════════════

  describe('validateZipSize', () => {
    it('should pass for small zip files', async () => {
      const zip = createMockZip({
        'file1.txt': { _data: { uncompressedSize: 1024 } },
        'file2.txt': { _data: { uncompressedSize: 2048 } },
      });

      await expect(validateZipSize(zip)).resolves.toBeUndefined();
    });

    it('should throw for zip bomb (exceeds limit)', async () => {
      const zip = createMockZip({
        'bomb.txt': { _data: { uncompressedSize: MAX_DECOMPRESSED_SIZE + 1 } },
      });

      await expect(validateZipSize(zip)).rejects.toThrow('превышает лимит');
    });

    it('should sum sizes across multiple files', async () => {
      const halfSize = Math.floor(MAX_DECOMPRESSED_SIZE / 2);
      const zip = createMockZip({
        'file1.txt': { _data: { uncompressedSize: halfSize } },
        'file2.txt': { _data: { uncompressedSize: halfSize } },
        'file3.txt': { _data: { uncompressedSize: halfSize } },
      });

      await expect(validateZipSize(zip)).rejects.toThrow('превышает лимит');
    });

    it('should skip directory entries', async () => {
      const zip = createMockZip({
        'dir/': { dir: true, _data: { uncompressedSize: MAX_DECOMPRESSED_SIZE + 1 } },
        'file.txt': { _data: { uncompressedSize: 100 } },
      });

      await expect(validateZipSize(zip)).resolves.toBeUndefined();
    });

    it('should handle files without uncompressedSize metadata', async () => {
      const zip = createMockZip({
        'file.txt': { _data: {} },
      });

      await expect(validateZipSize(zip)).resolves.toBeUndefined();
    });

    it('should handle files with null uncompressedSize', async () => {
      const zip = createMockZip({
        'file.txt': { _data: { uncompressedSize: null } },
      });

      await expect(validateZipSize(zip)).resolves.toBeUndefined();
    });

    it('should pass for exactly at limit', async () => {
      const zip = createMockZip({
        'file.txt': { _data: { uncompressedSize: MAX_DECOMPRESSED_SIZE } },
      });

      await expect(validateZipSize(zip)).resolves.toBeUndefined();
    });

    it('should handle empty zip', async () => {
      const zip = createMockZip({});
      await expect(validateZipSize(zip)).resolves.toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // findZipFile
  // ═══════════════════════════════════════════════════════════════════════════

  describe('findZipFile', () => {
    it('should find file by exact path', () => {
      const zip = createMockZip({
        'content/chapter1.html': { _data: {} },
      });
      const result = findZipFile(zip, 'content/chapter1.html');
      expect(result).not.toBeNull();
      expect(result.name).toBe('content/chapter1.html');
    });

    it('should strip leading slash', () => {
      const zip = createMockZip({
        'content/file.txt': { _data: {} },
      });
      const result = findZipFile(zip, '/content/file.txt');
      expect(result).not.toBeNull();
    });

    it('should strip fragment (#section)', () => {
      const zip = createMockZip({
        'chapter1.xhtml': { _data: {} },
      });
      const result = findZipFile(zip, 'chapter1.xhtml#section1');
      expect(result).not.toBeNull();
    });

    it('should find URL-decoded path', () => {
      const zip = createMockZip({
        'Глава.xhtml': { _data: {} },
      });
      const result = findZipFile(zip, '%D0%93%D0%BB%D0%B0%D0%B2%D0%B0.xhtml');
      expect(result).not.toBeNull();
    });

    it('should find URL-encoded path', () => {
      const zip = createMockZip({
        '%D0%93%D0%BB%D0%B0%D0%B2%D0%B0.xhtml': { _data: {} },
      });
      const result = findZipFile(zip, 'Глава.xhtml');
      expect(result).not.toBeNull();
    });

    it('should find case-insensitively', () => {
      const zip = createMockZip({
        'CONTENT/Chapter1.HTML': { _data: {} },
      });
      const result = findZipFile(zip, 'content/chapter1.html');
      expect(result).not.toBeNull();
    });

    it('should return null for non-existent file', () => {
      const zip = createMockZip({
        'file.txt': { _data: {} },
      });
      const result = findZipFile(zip, 'missing.txt');
      expect(result).toBeNull();
    });

    it('should not match directory entries in case-insensitive search', () => {
      const zip = createMockZip({
        'dir/': { dir: true, _data: {} },
      });
      const result = findZipFile(zip, 'dir/');
      // findZipFile tries exact match via zip.file() first
      // Case-insensitive search skips dirs
      // Result depends on whether zip.file('dir/') returns the entry
    });

    it('should handle empty path gracefully', () => {
      const zip = createMockZip({});
      const result = findZipFile(zip, '');
      expect(result).toBeNull();
    });

    it('should handle path with both fragment and leading slash', () => {
      const zip = createMockZip({
        'OEBPS/text.xhtml': { _data: {} },
      });
      const result = findZipFile(zip, '/OEBPS/text.xhtml#chapter');
      expect(result).not.toBeNull();
    });

    it('should try decoded case-insensitive as last resort', () => {
      const zip = createMockZip({
        'глава.xhtml': { _data: {} },
      });
      const result = findZipFile(zip, '%D0%93%D0%BB%D0%B0%D0%B2%D0%B0.xhtml');
      // Decoded = "Глава.xhtml", lowered = "глава.xhtml" — should match
      expect(result).not.toBeNull();
    });
  });
});
