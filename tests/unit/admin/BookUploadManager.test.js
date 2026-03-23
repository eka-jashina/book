/**
 * Unit tests for BookUploadManager
 * Загрузка файлов книг: drag-and-drop, парсинг, сохранение в store
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookParser } from '../../../js/admin/BookParser.js';
import { BookUploadManager } from '../../../js/admin/modules/BookUploadManager.js';

// Мокируем BookParser целиком — не хотим реального парсинга файлов
vi.mock('../../../js/admin/BookParser.js', () => ({
  BookParser: {
    parse: vi.fn(),
  },
}));

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function createMockModule() {
  return {
    store: {
      addBook: vi.fn(),
      removeBook: vi.fn(),
      setActiveBook: vi.fn(),
      waitForSave: vi.fn().mockResolvedValue(undefined),
    },
    app: {
      _render: vi.fn(),
      openEditor: vi.fn(),
      _router: { navigate: vi.fn() },
    },
    _showToast: vi.fn(),
  };
}

function setupDOM() {
  document.body.innerHTML = `
    <div id="bookUploadArea">
      <div id="bookDropzone"></div>
      <input id="bookFileInput" type="file">
      <div id="bookUploadProgress" hidden></div>
      <span id="bookUploadStatus"></span>
      <div id="bookUploadResult" hidden></div>
      <span id="bookUploadTitle"></span>
      <span id="bookUploadAuthor"></span>
      <span id="bookUploadChaptersCount"></span>
      <button id="bookUploadConfirm"></button>
      <button id="bookUploadCancel"></button>
    </div>
  `;
}

/** Создать фиктивный File с заданным именем */
function makeFile(name = 'book.txt') {
  return new File(['content'], name, { type: 'text/plain' });
}

/** Создать стандартный объект результата парсинга */
function makeParsedBook(overrides = {}) {
  return {
    title: 'Тестовая книга',
    author: 'Тест Авторов',
    chapters: [
      { id: 'ch1', title: 'Глава 1', html: '<article><h2>Глава 1</h2><p>Текст</p></article>' },
      { id: 'ch2', title: 'Глава 2', html: '<article><h2>Глава 2</h2><p>Текст</p></article>' },
    ],
    ...overrides,
  };
}

/** Создать drop-событие с файлом в dataTransfer */
function makeDropEvent(file) {
  return Object.assign(new Event('drop', { bubbles: true, cancelable: true }), {
    dataTransfer: { files: file ? [file] : [] },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('BookUploadManager', () => {
  let mockModule;
  let manager;

  beforeEach(() => {
    setupDOM();
    mockModule = createMockModule();
    manager = new BookUploadManager(mockModule);
    manager.cacheDOM();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // constructor
  // ─────────────────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should store the module reference', () => {
      expect(manager._module).toBe(mockModule);
    });

    it('should initialize _pendingParsedBook as null', () => {
      expect(manager._pendingParsedBook).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // get store()
  // ─────────────────────────────────────────────────────────────────────────

  describe('get store()', () => {
    it('should return the module store', () => {
      expect(manager.store).toBe(mockModule.store);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // cacheDOM()
  // ─────────────────────────────────────────────────────────────────────────

  describe('cacheDOM()', () => {
    it('should cache bookDropzone', () => {
      expect(manager.bookDropzone).toBe(document.getElementById('bookDropzone'));
    });

    it('should cache bookFileInput', () => {
      expect(manager.bookFileInput).toBe(document.getElementById('bookFileInput'));
    });

    it('should cache bookUploadProgress', () => {
      expect(manager.bookUploadProgress).toBe(document.getElementById('bookUploadProgress'));
    });

    it('should cache bookUploadStatus', () => {
      expect(manager.bookUploadStatus).toBe(document.getElementById('bookUploadStatus'));
    });

    it('should cache bookUploadResult', () => {
      expect(manager.bookUploadResult).toBe(document.getElementById('bookUploadResult'));
    });

    it('should cache bookUploadTitle', () => {
      expect(manager.bookUploadTitle).toBe(document.getElementById('bookUploadTitle'));
    });

    it('should cache bookUploadAuthor', () => {
      expect(manager.bookUploadAuthor).toBe(document.getElementById('bookUploadAuthor'));
    });

    it('should cache bookUploadChaptersCount', () => {
      expect(manager.bookUploadChaptersCount).toBe(document.getElementById('bookUploadChaptersCount'));
    });

    it('should cache bookUploadConfirm', () => {
      expect(manager.bookUploadConfirm).toBe(document.getElementById('bookUploadConfirm'));
    });

    it('should cache bookUploadCancel', () => {
      expect(manager.bookUploadCancel).toBe(document.getElementById('bookUploadCancel'));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // dragover / dragleave — CSS-классы bookDropzone
  // ─────────────────────────────────────────────────────────────────────────

  describe('dragover/dragleave → CSS-класс bookDropzone', () => {
    beforeEach(() => {
      manager.bindEvents();
    });

    it('dragover should add "dragover" CSS class to bookDropzone', () => {
      manager.bookDropzone.dispatchEvent(
        new Event('dragover', { bubbles: true, cancelable: true })
      );
      expect(manager.bookDropzone.classList.contains('dragover')).toBe(true);
    });

    it('dragleave should remove "dragover" CSS class from bookDropzone', () => {
      manager.bookDropzone.classList.add('dragover');
      manager.bookDropzone.dispatchEvent(new Event('dragleave', { bubbles: true }));
      expect(manager.bookDropzone.classList.contains('dragover')).toBe(false);
    });

    it('dragleave should be a no-op when class is not present', () => {
      manager.bookDropzone.dispatchEvent(new Event('dragleave', { bubbles: true }));
      expect(manager.bookDropzone.classList.contains('dragover')).toBe(false);
    });

    it('drop should remove "dragover" class', () => {
      manager.bookDropzone.classList.add('dragover');
      vi.spyOn(manager, '_processBookFile').mockResolvedValue(undefined);
      manager.bookDropzone.dispatchEvent(makeDropEvent(makeFile()));
      expect(manager.bookDropzone.classList.contains('dragover')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // drop с file → вызывает _processBookFile
  // ─────────────────────────────────────────────────────────────────────────

  describe('drop с file → вызывает _processBookFile', () => {
    beforeEach(() => {
      manager.bindEvents();
      vi.spyOn(manager, '_processBookFile').mockResolvedValue(undefined);
    });

    it('should call _processBookFile with the dropped file', () => {
      const file = makeFile('book.txt');
      manager.bookDropzone.dispatchEvent(makeDropEvent(file));
      expect(manager._processBookFile).toHaveBeenCalledWith(file);
    });

    it('should NOT call _processBookFile when dataTransfer has no files', () => {
      manager.bookDropzone.dispatchEvent(makeDropEvent(null));
      expect(manager._processBookFile).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _handleBookUpload()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_handleBookUpload()', () => {
    beforeEach(() => {
      vi.spyOn(manager, '_processBookFile').mockResolvedValue(undefined);
    });

    it('should call _processBookFile with file from input', () => {
      const file = makeFile('book.txt');
      manager._handleBookUpload({ target: { files: [file], value: '' } });
      expect(manager._processBookFile).toHaveBeenCalledWith(file);
    });

    it('should do nothing when input has no file', () => {
      manager._handleBookUpload({ target: { files: [], value: '' } });
      expect(manager._processBookFile).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _processBookFile() — неподдерживаемый формат → ошибка
  // ─────────────────────────────────────────────────────────────────────────

  describe('_processBookFile() — неподдерживаемый формат', () => {
    it('should show toast listing allowed formats for .pdf', async () => {
      await manager._processBookFile(makeFile('book.pdf'));
      expect(mockModule._showToast).toHaveBeenCalledWith(
        expect.stringContaining('epub')
      );
    });

    it('should show toast for .rtf format', async () => {
      await manager._processBookFile(makeFile('book.rtf'));
      expect(mockModule._showToast).toHaveBeenCalled();
    });

    it('should NOT call BookParser.parse for unsupported format', async () => {
      await manager._processBookFile(makeFile('book.pdf'));
      expect(BookParser.parse).not.toHaveBeenCalled();
    });

    it('should NOT modify UI for unsupported format', async () => {
      const wasHidden = manager.bookDropzone.hidden;
      await manager._processBookFile(makeFile('book.pdf'));
      expect(manager.bookDropzone.hidden).toBe(wasHidden);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _processBookFile() — поддерживаемые форматы → BookParser.parse
  // ─────────────────────────────────────────────────────────────────────────

  describe('_processBookFile() — .txt → вызывает BookParser.parse', () => {
    it('should call BookParser.parse with the file', async () => {
      BookParser.parse.mockResolvedValue(makeParsedBook());
      const file = makeFile('book.txt');
      await manager._processBookFile(file);
      expect(BookParser.parse).toHaveBeenCalledWith(file);
    });

    it('should call BookParser.parse for .epub', async () => {
      BookParser.parse.mockResolvedValue(makeParsedBook());
      await manager._processBookFile(makeFile('book.epub'));
      expect(BookParser.parse).toHaveBeenCalledOnce();
    });

    it('should call BookParser.parse for .fb2', async () => {
      BookParser.parse.mockResolvedValue(makeParsedBook());
      await manager._processBookFile(makeFile('book.fb2'));
      expect(BookParser.parse).toHaveBeenCalledOnce();
    });

    it('should call BookParser.parse for .docx', async () => {
      BookParser.parse.mockResolvedValue(makeParsedBook());
      await manager._processBookFile(makeFile('book.docx'));
      expect(BookParser.parse).toHaveBeenCalledOnce();
    });

    it('should call BookParser.parse for .doc', async () => {
      BookParser.parse.mockResolvedValue(makeParsedBook());
      await manager._processBookFile(makeFile('book.doc'));
      expect(BookParser.parse).toHaveBeenCalledOnce();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _processBookFile() — UI во время обработки
  // ─────────────────────────────────────────────────────────────────────────

  describe('_processBookFile() — UI при парсинге', () => {
    it('should hide bookDropzone while processing', async () => {
      let hiddenDuringParse = false;
      BookParser.parse.mockImplementation(async () => {
        hiddenDuringParse = manager.bookDropzone.hidden;
        return makeParsedBook();
      });
      await manager._processBookFile(makeFile('book.txt'));
      expect(hiddenDuringParse).toBe(true);
    });

    it('should show bookUploadProgress while processing', async () => {
      let visibleDuringParse = false;
      BookParser.parse.mockImplementation(async () => {
        visibleDuringParse = !manager.bookUploadProgress.hidden;
        return makeParsedBook();
      });
      await manager._processBookFile(makeFile('book.txt'));
      expect(visibleDuringParse).toBe(true);
    });

    it('should set status text before parsing', async () => {
      let statusDuringParse = '';
      BookParser.parse.mockImplementation(async () => {
        statusDuringParse = manager.bookUploadStatus.textContent;
        return makeParsedBook();
      });
      await manager._processBookFile(makeFile('book.txt'));
      expect(statusDuringParse).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _processBookFile() — успешный результат
  // ─────────────────────────────────────────────────────────────────────────

  describe('_processBookFile() — успешный парсинг', () => {
    let parsed;

    beforeEach(async () => {
      parsed = makeParsedBook();
      BookParser.parse.mockResolvedValue(parsed);
      await manager._processBookFile(makeFile('book.txt'));
    });

    it('should store parsed result in _pendingParsedBook', () => {
      expect(manager._pendingParsedBook).toBe(parsed);
    });

    it('should hide bookUploadProgress after parse', () => {
      expect(manager.bookUploadProgress.hidden).toBe(true);
    });

    it('should show bookUploadResult after parse', () => {
      expect(manager.bookUploadResult.hidden).toBe(false);
    });

    it('should display parsed title in bookUploadTitle', () => {
      expect(manager.bookUploadTitle.textContent).toBe('Тестовая книга');
    });

    it('should display author in bookUploadAuthor', () => {
      expect(manager.bookUploadAuthor.textContent).toContain('Тест Авторов');
    });

    it('should display chapter count in bookUploadChaptersCount', () => {
      expect(manager.bookUploadChaptersCount.textContent).toContain('2');
    });
  });

  describe('_processBookFile() — книга без названия и автора', () => {
    it('should show "Без названия" when title is empty string', async () => {
      BookParser.parse.mockResolvedValue(makeParsedBook({ title: '' }));
      await manager._processBookFile(makeFile('book.txt'));
      expect(manager.bookUploadTitle.textContent).toBe('Без названия');
    });

    it('should show empty author string when author is absent', async () => {
      BookParser.parse.mockResolvedValue(makeParsedBook({ author: '' }));
      await manager._processBookFile(makeFile('book.txt'));
      expect(manager.bookUploadAuthor.textContent).toBe('');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _processBookFile() — ошибка парсинга
  // ─────────────────────────────────────────────────────────────────────────

  describe('_processBookFile() — ошибка парсинга', () => {
    beforeEach(async () => {
      BookParser.parse.mockRejectedValue(new Error('Corrupt file'));
      await manager._processBookFile(makeFile('book.txt'));
    });

    it('should show toast with the error message', () => {
      expect(mockModule._showToast).toHaveBeenCalledWith(
        expect.stringContaining('Corrupt file')
      );
    });

    it('should NOT store result in _pendingParsedBook', () => {
      expect(manager._pendingParsedBook).toBeNull();
    });

    it('should restore bookDropzone visibility (calls _resetBookUpload)', () => {
      expect(manager.bookDropzone.hidden).toBe(false);
    });

    it('should hide bookUploadProgress after error', () => {
      expect(manager.bookUploadProgress.hidden).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _applyParsedBook() — записывает главы в AdminConfigStore
  // ─────────────────────────────────────────────────────────────────────────

  describe('_applyParsedBook() — нет pending книги', () => {
    it('should return early without calling store.addBook', async () => {
      manager._pendingParsedBook = null;
      await manager._applyParsedBook();
      expect(mockModule.store.addBook).not.toHaveBeenCalled();
    });
  });

  describe('_applyParsedBook() — успешное сохранение', () => {
    let parsed;

    beforeEach(async () => {
      parsed = makeParsedBook();
      manager._pendingParsedBook = parsed;
      await manager._applyParsedBook();
    });

    it('should call store.addBook once', () => {
      expect(mockModule.store.addBook).toHaveBeenCalledOnce();
    });

    it('should pass title from parsed book to cover', () => {
      const arg = mockModule.store.addBook.mock.calls[0][0];
      expect(arg.cover.title).toBe('Тестовая книга');
    });

    it('should pass author from parsed book to cover', () => {
      const arg = mockModule.store.addBook.mock.calls[0][0];
      expect(arg.cover.author).toBe('Тест Авторов');
    });

    it('should generate a book id starting with "book_"', () => {
      const arg = mockModule.store.addBook.mock.calls[0][0];
      expect(arg.id).toMatch(/^book_/);
    });

    it('should map all parsed chapters to store format', () => {
      const arg = mockModule.store.addBook.mock.calls[0][0];
      expect(arg.chapters).toHaveLength(2);
    });

    it('should store chapter html as htmlContent', () => {
      const arg = mockModule.store.addBook.mock.calls[0][0];
      expect(arg.chapters[0].id).toBe('ch1');
      expect(arg.chapters[0].htmlContent).toBe(parsed.chapters[0].html);
    });

    it('should set empty file field for each chapter', () => {
      const arg = mockModule.store.addBook.mock.calls[0][0];
      expect(arg.chapters[0].file).toBe('');
    });

    it('should call store.waitForSave', () => {
      expect(mockModule.store.waitForSave).toHaveBeenCalledOnce();
    });

    it('should call store.setActiveBook with the new book id', () => {
      const arg = mockModule.store.addBook.mock.calls[0][0];
      expect(mockModule.store.setActiveBook).toHaveBeenCalledWith(arg.id);
    });

    it('should call app._render()', () => {
      expect(mockModule.app._render).toHaveBeenCalled();
    });

    it('should navigate to reader via router', () => {
      expect(mockModule.app._router.navigate).toHaveBeenCalled();
      const url = mockModule.app._router.navigate.mock.calls[0][0];
      expect(url).toMatch(/^\/book\/book_\d+$/);
    });

    it('should show success toast', () => {
      expect(mockModule._showToast).toHaveBeenCalled();
    });

    it('should reset _pendingParsedBook to null after save', () => {
      expect(manager._pendingParsedBook).toBeNull();
    });
  });

  describe('_applyParsedBook() — книга без названия', () => {
    it('should use "Без названия" as cover title when title is empty', async () => {
      manager._pendingParsedBook = makeParsedBook({ title: '' });
      await manager._applyParsedBook();
      const arg = mockModule.store.addBook.mock.calls[0][0];
      expect(arg.cover.title).toBe('Без названия');
    });
  });

  describe('_applyParsedBook() — ошибка waitForSave', () => {
    let capturedBookId;

    beforeEach(async () => {
      manager._pendingParsedBook = makeParsedBook();
      mockModule.store.addBook.mockImplementation((book) => {
        capturedBookId = book.id;
      });
      mockModule.store.waitForSave.mockRejectedValue(new Error('QuotaExceededError'));
      await manager._applyParsedBook();
    });

    it('should call store.removeBook to rollback the added book', () => {
      expect(mockModule.store.removeBook).toHaveBeenCalledWith(capturedBookId);
    });

    it('should show storage error toast', () => {
      expect(mockModule._showToast).toHaveBeenCalledWith(
        expect.stringContaining('Ошибка сохранения')
      );
    });

    it('should NOT call store.setActiveBook', () => {
      expect(mockModule.store.setActiveBook).not.toHaveBeenCalled();
    });

    it('should NOT navigate to reader', () => {
      expect(mockModule.app._router.navigate).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _resetBookUpload()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_resetBookUpload()', () => {
    beforeEach(() => {
      manager._pendingParsedBook = makeParsedBook();
      manager.bookDropzone.hidden = true;
      manager.bookUploadProgress.hidden = false;
      manager.bookUploadResult.hidden = false;
    });

    it('should clear _pendingParsedBook to null', () => {
      manager._resetBookUpload();
      expect(manager._pendingParsedBook).toBeNull();
    });

    it('should show bookDropzone', () => {
      manager._resetBookUpload();
      expect(manager.bookDropzone.hidden).toBe(false);
    });

    it('should hide bookUploadProgress', () => {
      manager._resetBookUpload();
      expect(manager.bookUploadProgress.hidden).toBe(true);
    });

    it('should hide bookUploadResult', () => {
      manager._resetBookUpload();
      expect(manager.bookUploadResult.hidden).toBe(true);
    });
  });
});
