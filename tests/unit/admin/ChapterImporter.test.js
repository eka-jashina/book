import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@i18n', () => ({ t: vi.fn((key, opts) => opts ? `${key}:${JSON.stringify(opts)}` : key) }));

vi.mock('@/admin/BookParser.js', () => ({
  BookParser: {
    parse: vi.fn(),
  },
}));

import { ChapterImporter } from '@/admin/modules/ChapterImporter.js';
import { BookParser } from '@/admin/BookParser.js';

// ═══════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ═══════════════════════════════════════════

function createMockHost() {
  return {
    _showToast: vi.fn(),
    _escapeHtml: vi.fn(s => s),
    _renderJsonPreview: vi.fn(),
    _validator: {
      validateImportFile: vi.fn(() => true),
      validateChapterFile: vi.fn(() => true),
      isHtmlFile: vi.fn(() => false),
      validateHtmlContent: vi.fn(() => true),
    },
    store: {
      getChapters: vi.fn(() => []),
      addChapter: vi.fn(),
      save: vi.fn(),
    },
    _editor: {
      _pendingHtmlContent: null,
      setContent: vi.fn(),
    },
    _listManager: {
      renderChapters: vi.fn(),
    },
    importDropzone: document.createElement('div'),
    importFileInput: document.createElement('input'),
  };
}

function createMockFile(name, content = 'content', type = 'text/plain') {
  return new File([content], name, { type });
}

describe('ChapterImporter', () => {
  let importer;
  let host;

  beforeEach(() => {
    host = createMockHost();
    importer = new ChapterImporter(host);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // КОНСТРУКТОР
  // ═══════════════════════════════════════════

  describe('constructor', () => {
    it('должен сохранить ссылку на host', () => {
      expect(importer._host).toBe(host);
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД importBookFile()
  // ═══════════════════════════════════════════

  describe('importBookFile()', () => {
    it('должен валидировать файл через _validator', async () => {
      const file = createMockFile('book.epub');
      BookParser.parse.mockResolvedValue({ chapters: [] });

      await importer.importBookFile(file);

      expect(host._validator.validateImportFile).toHaveBeenCalledWith(file);
    });

    it('должен прервать выполнение при невалидном файле', async () => {
      const file = createMockFile('image.png');
      host._validator.validateImportFile.mockReturnValue(false);

      await importer.importBookFile(file);

      expect(BookParser.parse).not.toHaveBeenCalled();
    });

    it('должен парсить файл через BookParser', async () => {
      const file = createMockFile('book.epub');
      const chapters = [
        { title: 'Chapter 1', html: '<p>Content 1</p>' },
        { title: 'Chapter 2', html: '<p>Content 2</p>' },
      ];
      BookParser.parse.mockResolvedValue({ chapters });

      await importer.importBookFile(file);

      expect(BookParser.parse).toHaveBeenCalledWith(file);
    });

    it('должен добавить спарсенные главы в store', async () => {
      const file = createMockFile('book.fb2');
      const chapters = [
        { title: 'Ch 1', html: '<p>Text 1</p>' },
        { title: 'Ch 2', html: '<p>Text 2</p>' },
      ];
      BookParser.parse.mockResolvedValue({ chapters });

      await importer.importBookFile(file);

      expect(host.store.addChapter).toHaveBeenCalledTimes(2);
    });

    it('должен обновить список глав после импорта', async () => {
      const file = createMockFile('book.txt');
      BookParser.parse.mockResolvedValue({
        chapters: [{ title: 'Ch 1', html: '<p>Text</p>' }],
      });

      await importer.importBookFile(file);

      expect(host._listManager.renderChapters).toHaveBeenCalled();
    });

    it('должен показать toast при успешном импорте', async () => {
      const file = createMockFile('book.epub');
      BookParser.parse.mockResolvedValue({
        chapters: [{ title: 'Ch 1', html: '<p>Text</p>' }],
      });

      await importer.importBookFile(file);

      expect(host._showToast).toHaveBeenCalled();
    });

    it('должен обработать ошибку парсинга', async () => {
      const file = createMockFile('broken.epub');
      BookParser.parse.mockRejectedValue(new Error('parse error'));

      await importer.importBookFile(file);

      expect(host._showToast).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД processInlineFile()
  // ═══════════════════════════════════════════

  describe('processInlineFile()', () => {
    let bodyEl;

    beforeEach(() => {
      bodyEl = document.createElement('div');
      bodyEl.innerHTML = `
        <div class="chapter-inline-file-dropzone"></div>
        <div class="chapter-inline-file-info" hidden></div>
        <span class="chapter-inline-file-name"></span>
      `;
    });

    it('должен валидировать файл', async () => {
      const file = createMockFile('chapter.docx');
      BookParser.parse.mockResolvedValue({
        chapters: [{ title: 'Ch', html: '<p>Body</p>' }],
      });

      await importer.processInlineFile(file, bodyEl);

      expect(host._validator.validateChapterFile).toHaveBeenCalledWith(file);
    });

    it('должен прервать при невалидном файле', async () => {
      const file = createMockFile('bad.xyz');
      host._validator.validateChapterFile.mockReturnValue(false);

      await importer.processInlineFile(file, bodyEl);

      expect(BookParser.parse).not.toHaveBeenCalled();
    });

    it('должен парсить файл и сохранить контент в editor', async () => {
      const file = createMockFile('chapter.doc');
      const parsed = { chapters: [{ title: 'Ch', html: '<p>Parsed content</p>' }] };
      BookParser.parse.mockResolvedValue(parsed);

      await importer.processInlineFile(file, bodyEl);

      expect(BookParser.parse).toHaveBeenCalledWith(file);
    });

    it('должен обработать ошибку парсинга inline файла', async () => {
      const file = createMockFile('broken.docx');
      BookParser.parse.mockRejectedValue(new Error('parse failed'));

      await importer.processInlineFile(file, bodyEl);

      expect(host._showToast).toHaveBeenCalled();
    });
  });
});
