import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@i18n', () => ({ t: vi.fn((key, opts) => opts ? `${key}:${JSON.stringify(opts)}` : key) }));

import {
  IMPORT_EXTENSIONS,
  CHAPTER_FILE_EXTENSIONS,
  ChapterValidator,
} from '@/admin/modules/ChapterValidator.js';

// ═══════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ═══════════════════════════════════════════

function createMockHost() {
  return {
    _showToast: vi.fn(),
    _escapeHtml: vi.fn(s => s),
  };
}

function createMockFile(name, type = 'text/plain', size = 1024) {
  return new File(['content'], name, { type });
}

describe('ChapterValidator', () => {
  let validator;
  let host;

  beforeEach(() => {
    host = createMockHost();
    validator = new ChapterValidator(host);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // КОНСТАНТЫ
  // ═══════════════════════════════════════════

  describe('константы', () => {
    it('IMPORT_EXTENSIONS должен содержать правильные расширения', () => {
      expect(IMPORT_EXTENSIONS).toContain('.epub');
      expect(IMPORT_EXTENSIONS).toContain('.fb2');
      expect(IMPORT_EXTENSIONS).toContain('.docx');
      expect(IMPORT_EXTENSIONS).toContain('.doc');
      expect(IMPORT_EXTENSIONS).toContain('.txt');
      expect(IMPORT_EXTENSIONS).toHaveLength(5);
    });

    it('CHAPTER_FILE_EXTENSIONS должен содержать правильные расширения', () => {
      expect(CHAPTER_FILE_EXTENSIONS).toContain('.doc');
      expect(CHAPTER_FILE_EXTENSIONS).toContain('.docx');
      expect(CHAPTER_FILE_EXTENSIONS).toContain('.html');
      expect(CHAPTER_FILE_EXTENSIONS).toContain('.htm');
      expect(CHAPTER_FILE_EXTENSIONS).toContain('.txt');
      expect(CHAPTER_FILE_EXTENSIONS).toHaveLength(5);
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД validateImportFile()
  // ═══════════════════════════════════════════

  describe('validateImportFile()', () => {
    it('должен вернуть true для .epub файла', () => {
      const file = createMockFile('book.epub');
      expect(validator.validateImportFile(file)).toBe(true);
    });

    it('должен вернуть true для .fb2 файла', () => {
      const file = createMockFile('book.fb2');
      expect(validator.validateImportFile(file)).toBe(true);
    });

    it('должен вернуть true для .docx файла', () => {
      const file = createMockFile('document.docx');
      expect(validator.validateImportFile(file)).toBe(true);
    });

    it('должен вернуть true для .doc файла', () => {
      const file = createMockFile('document.doc');
      expect(validator.validateImportFile(file)).toBe(true);
    });

    it('должен вернуть true для .txt файла', () => {
      const file = createMockFile('text.txt');
      expect(validator.validateImportFile(file)).toBe(true);
    });

    it('должен вернуть false для неподдерживаемого формата', () => {
      const file = createMockFile('image.png');
      const result = validator.validateImportFile(file);

      expect(result).toBe(false);
      expect(host._showToast).toHaveBeenCalled();
    });

    it('должен вернуть false для .pdf файла', () => {
      const file = createMockFile('document.pdf');
      expect(validator.validateImportFile(file)).toBe(false);
    });

    it('должен быть нечувствителен к регистру расширения', () => {
      const file = createMockFile('book.EPUB');
      expect(validator.validateImportFile(file)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД validateChapterFile()
  // ═══════════════════════════════════════════

  describe('validateChapterFile()', () => {
    it('должен вернуть true для .html файла', () => {
      const file = createMockFile('chapter.html');
      expect(validator.validateChapterFile(file)).toBe(true);
    });

    it('должен вернуть true для .htm файла', () => {
      const file = createMockFile('chapter.htm');
      expect(validator.validateChapterFile(file)).toBe(true);
    });

    it('должен вернуть true для .txt файла', () => {
      const file = createMockFile('chapter.txt');
      expect(validator.validateChapterFile(file)).toBe(true);
    });

    it('должен вернуть true для .doc файла', () => {
      const file = createMockFile('chapter.doc');
      expect(validator.validateChapterFile(file)).toBe(true);
    });

    it('должен вернуть true для .docx файла', () => {
      const file = createMockFile('chapter.docx');
      expect(validator.validateChapterFile(file)).toBe(true);
    });

    it('должен вернуть false для .epub файла', () => {
      const file = createMockFile('book.epub');
      expect(validator.validateChapterFile(file)).toBe(false);
    });

    it('должен вернуть false для неподдерживаемого формата', () => {
      const file = createMockFile('file.json');
      expect(validator.validateChapterFile(file)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД isHtmlFile()
  // ═══════════════════════════════════════════

  describe('isHtmlFile()', () => {
    it('должен вернуть true для .html файла', () => {
      const file = createMockFile('page.html');
      expect(validator.isHtmlFile(file)).toBe(true);
    });

    it('должен вернуть true для .htm файла', () => {
      const file = createMockFile('page.htm');
      expect(validator.isHtmlFile(file)).toBe(true);
    });

    it('должен вернуть false для .txt файла', () => {
      const file = createMockFile('page.txt');
      expect(validator.isHtmlFile(file)).toBe(false);
    });

    it('должен вернуть false для .docx файла', () => {
      const file = createMockFile('page.docx');
      expect(validator.isHtmlFile(file)).toBe(false);
    });

    it('должен быть нечувствителен к регистру', () => {
      const file = createMockFile('page.HTML');
      expect(validator.isHtmlFile(file)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД validateHtmlContent()
  // ═══════════════════════════════════════════

  describe('validateHtmlContent()', () => {
    it('должен вернуть true для непустого HTML', () => {
      expect(validator.validateHtmlContent('<p>Hello</p>')).toBe(true);
    });

    it('должен вернуть true для текстового контента', () => {
      expect(validator.validateHtmlContent('Some text')).toBe(true);
    });

    it('должен вернуть false для пустой строки', () => {
      expect(validator.validateHtmlContent('')).toBe(false);
    });

    it('должен вернуть false для null', () => {
      expect(validator.validateHtmlContent(null)).toBe(false);
    });

    it('должен вернуть false для undefined', () => {
      expect(validator.validateHtmlContent(undefined)).toBe(false);
    });

    it('должен вернуть false для строки из пробелов', () => {
      expect(validator.validateHtmlContent('   ')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД _getExtension()
  // ═══════════════════════════════════════════

  describe('_getExtension()', () => {
    it('должен извлечь расширение из имени файла', () => {
      expect(validator._getExtension('book.epub')).toBe('.epub');
    });

    it('должен привести расширение к нижнему регистру', () => {
      expect(validator._getExtension('book.EPUB')).toBe('.epub');
    });

    it('должен извлечь последнее расширение', () => {
      expect(validator._getExtension('archive.tar.gz')).toBe('.gz');
    });

    it('должен вернуть строку для файла без расширения', () => {
      // substring(lastIndexOf('.')) when no dot: lastIndexOf returns -1, substring(-1) = substring(0) = full string
      const ext = validator._getExtension('README');
      expect(typeof ext).toBe('string');
    });

    it('должен обработать файл с точкой в начале', () => {
      const ext = validator._getExtension('.gitignore');
      expect(typeof ext).toBe('string');
    });
  });
});
