/**
 * TESTS: ChaptersModule
 * Тесты для модуля управления главами, книгами и фотоальбомами
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTemplates } from '../../helpers/adminTemplates.js';

// Мок QuillEditorWrapper до импорта ChaptersModule
vi.mock('../../../js/admin/modules/QuillEditorWrapper.js', () => ({
  QuillEditorWrapper: class {
    constructor() {
      this.init = vi.fn().mockResolvedValue(undefined);
      this.setHTML = vi.fn();
      this.getHTML = vi.fn(() => '');
      this.isEmpty = vi.fn(() => true);
      this.clear = vi.fn();
      this.destroy = vi.fn();
      this.isInitialized = false;
    }
  },
}));

const { ChaptersModule } = await import('../../../js/admin/modules/ChaptersModule.js');

function createMockApp() {
  return {
    store: {
      getChapters: vi.fn().mockResolvedValue([
        { id: 'part_1', file: 'content/part_1.html', bg: 'bg1.webp', bgMobile: 'bg1-m.webp' },
        { id: 'part_2', file: 'content/part_2.html', bg: 'bg2.webp', bgMobile: 'bg2-m.webp' },
      ]),
      addChapter: vi.fn(),
      updateChapter: vi.fn(),
      removeChapter: vi.fn(),
      moveChapter: vi.fn(),
      getCover: vi.fn().mockResolvedValue({ title: 'Sample Book', author: 'Flipbook Demo', bgMode: 'default', bgCustomData: null }),
      updateCover: vi.fn(),
      getBooks: vi.fn(() => [
        { id: 'default', title: 'Sample Book', author: 'Flipbook Demo', chaptersCount: 3 },
      ]),
      getActiveBookId: vi.fn(() => 'default'),
      setActiveBook: vi.fn(),
      addBook: vi.fn(),
      removeBook: vi.fn(),
      waitForSave: vi.fn().mockResolvedValue(undefined),
    },
    settings: { render: vi.fn() },
    editorTitle: { textContent: '' },
    _showToast: vi.fn(),
    _escapeHtml: vi.fn((s) => s),
    _renderJsonPreview: vi.fn(),
    _render: vi.fn(),
    _showView: vi.fn(),
    openEditor: vi.fn(),
    _confirm: vi.fn(() => Promise.resolve(true)),
  };
}

function setupChapterTemplates() {
  setupTemplates(
    'tmpl-album-image-slot',
    'tmpl-admin-chapter-card',
    'tmpl-admin-book-card',
    'tmpl-admin-album-page-card',
  );
}

function setupDOM() {
  document.body.innerHTML = `
    <div id="chaptersList"></div>
    <div id="chaptersEmpty" hidden></div>
    <button id="addChapter"></button>
    <button id="addAlbum"></button>
    <div id="chaptersImportDropzone">
      <input type="file" id="chaptersImportFileInput" accept=".epub,.fb2,.docx,.doc,.txt" hidden>
    </div>
    <div id="bookSelector"></div>
    <button id="deleteBook" hidden></button>
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
    <input id="coverTitle" type="text">
    <input id="coverAuthor" type="text">
    <input type="hidden" id="bgCoverMode" value="default">
    <button class="texture-option active" type="button" data-bg-mode="default"></button>
    <button class="texture-option" type="button" data-bg-mode="none"></button>
    <label class="texture-option texture-option--upload">
      <span id="bgCoverThumb" class="texture-thumb texture-thumb--upload"></span>
      <input id="bgCoverFileInput" type="file" hidden>
    </label>
    <div id="bgCoverCustomInfo" hidden></div>
    <span id="bgCoverCustomName"></span>
    <button id="bgCoverRemove"></button>
    <button id="saveCover"></button>
    <dialog class="admin-modal admin-modal--chapter" id="chapterModal">
      <h2 id="modalTitle"></h2>
      <form id="chapterForm">
        <input id="chapterId" type="text">
        <input id="chapterTitle" type="text">
        <div id="chapterInputToggle">
          <button type="button" class="chapter-input-toggle-btn active" data-input-mode="upload">Загрузить файл</button>
          <button type="button" class="chapter-input-toggle-btn" data-input-mode="editor">Редактор</button>
        </div>
        <div id="chapterUploadPanel">
          <input id="chapterFileInput" type="file" hidden>
          <div id="chapterFileDropzone"></div>
          <div id="chapterFileInfo" hidden>
            <span id="chapterFileName"></span>
            <button id="chapterFileRemove" type="button"></button>
          </div>
        </div>
        <div id="chapterEditorPanel" hidden>
          <div id="chapterEditorContainer"></div>
        </div>
        <input id="chapterBg" type="text">
        <input id="chapterBgMobile" type="text">
        <button id="cancelModal" type="button"></button>
      </form>
    </dialog>
  `;
}

describe('ChaptersModule', () => {
  let app;
  let mod;

  beforeEach(() => {
    setupDOM();
    setupChapterTemplates();
    document.querySelectorAll('dialog').forEach(d => {
      d.showModal = d.showModal || vi.fn();
      d.close = d.close || vi.fn();
    });
    app = createMockApp();
    mod = new ChaptersModule(app);
    mod.cacheDOM();
    mod.bindEvents();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should initialize state', () => {
      expect(mod._expandedIndex).toBe(-1);
      expect(mod._album).toBeDefined();
      expect(mod._bookUpload).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _renderCover
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderCover()', () => {
    it('should populate cover fields from store', async () => {
      await mod._renderCover();

      expect(mod.coverTitle.value).toBe('Sample Book');
      expect(mod.coverAuthor.value).toBe('Flipbook Demo');
      expect(mod.bgCoverMode.value).toBe('default');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _renderChapters
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderChapters()', () => {
    it('should render chapter cards', async () => {
      await mod._renderChapters();

      const cards = mod.chaptersList.querySelectorAll('.chapter-card');
      expect(cards.length).toBe(2);
    });

    it('should show empty state when no chapters', async () => {
      app.store.getChapters.mockResolvedValue([]);

      await mod._renderChapters();

      expect(mod.chaptersEmpty.hidden).toBe(false);
      expect(mod.chaptersList.innerHTML).toBe('');
    });

    it('should show chapter ID and file path', async () => {
      await mod._renderChapters();

      const titles = mod.chaptersList.querySelectorAll('.chapter-title');
      const metas = mod.chaptersList.querySelectorAll('.chapter-meta');
      expect(titles[0].textContent).toBe('part_1');
      expect(metas[0].textContent).toBe('content/part_1.html');
    });

    it('should show "Встроенный контент" for chapters with htmlContent', async () => {
      app.store.getChapters.mockResolvedValue([
        { id: 'album', file: '', htmlContent: '<article>...</article>', bg: '', bgMobile: '' },
      ]);

      await mod._renderChapters();

      const meta = mod.chaptersList.querySelector('.chapter-meta');
      expect(meta.textContent).toBe('Встроенный контент');
    });

    it('should not show up button for first chapter', async () => {
      await mod._renderChapters();

      const upBtns = mod.chaptersList.querySelectorAll('[data-action="up"]:not([hidden])');
      // First chapter has no visible up button, second has one
      expect(upBtns.length).toBe(1);
      expect(upBtns[0].dataset.index).toBe('1');
    });

    it('should not show down button for last chapter', async () => {
      await mod._renderChapters();

      const downBtns = mod.chaptersList.querySelectorAll('[data-action="down"]:not([hidden])');
      expect(downBtns.length).toBe(1);
      expect(downBtns[0].dataset.index).toBe('0');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _renderBookSelector
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderBookSelector()', () => {
    it('should render book cards', () => {
      mod._renderBookSelector();

      const cards = mod.bookSelector.querySelectorAll('.book-card');
      expect(cards.length).toBe(1);
    });

    it('should mark active book', () => {
      mod._renderBookSelector();

      const activeCard = mod.bookSelector.querySelector('.book-card.active');
      expect(activeCard).not.toBeNull();
      expect(activeCard.dataset.bookId).toBe('default');
    });

    it('should hide delete button when only one book', () => {
      mod._renderBookSelector();
      expect(mod.deleteBookBtn.hidden).toBe(true);
    });

    it('should show delete button when multiple books', () => {
      app.store.getBooks.mockReturnValue([
        { id: 'book1', title: 'Book 1', author: '', chaptersCount: 1 },
        { id: 'book2', title: 'Book 2', author: '', chaptersCount: 2 },
      ]);

      mod._renderBookSelector();

      expect(mod.deleteBookBtn.hidden).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _toggleChapter (inline editing — replaces _openModal)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_toggleChapter()', () => {
    it('should expand chapter inline for editing', async () => {
      await mod._renderChapters();
      await mod._toggleChapter(0);

      expect(mod._expandedIndex).toBe(0);
      const card = mod.chaptersList.querySelector('.chapter-card[data-index="0"]');
      expect(card.classList.contains('chapter-card--expanded')).toBe(true);
    });

    it('should collapse expanded chapter on second toggle', async () => {
      await mod._renderChapters();
      await mod._toggleChapter(0);
      await mod._toggleChapter(0);

      expect(mod._expandedIndex).toBe(-1);
      const card = mod.chaptersList.querySelector('.chapter-card[data-index="0"]');
      expect(card.classList.contains('chapter-card--expanded')).toBe(false);
    });

    it('should switch to new chapter when different one is toggled', async () => {
      await mod._renderChapters();
      await mod._toggleChapter(0);
      await mod._toggleChapter(1);

      expect(mod._expandedIndex).toBe(1);
      const card0 = mod.chaptersList.querySelector('.chapter-card[data-index="0"]');
      const card1 = mod.chaptersList.querySelector('.chapter-card[data-index="1"]');
      expect(card0.classList.contains('chapter-card--expanded')).toBe(false);
      expect(card1.classList.contains('chapter-card--expanded')).toBe(true);
    });

    it('should populate inline fields with chapter data', async () => {
      await mod._renderChapters();
      await mod._toggleChapter(0);

      const card = mod.chaptersList.querySelector('.chapter-card[data-index="0"]');
      const body = card.querySelector('.chapter-card-body');
      const idInput = body.querySelector('.chapter-inline-id');
      expect(idInput.value).toBe('part_1');
    });

    it('should set editor mode for chapter with htmlContent', async () => {
      app.store.getChapters.mockResolvedValue([
        { id: 'inline', title: 'Inline', file: '', htmlContent: '<p>HTML</p>', bg: '', bgMobile: '' },
      ]);
      await mod._renderChapters();
      await mod._toggleChapter(0);

      expect(mod._inputMode).toBe('editor');
      expect(mod._pendingHtmlContent).toBe('<p>HTML</p>');
    });

    it('should set upload mode for chapter with file path', async () => {
      await mod._renderChapters();
      await mod._toggleChapter(0);

      expect(mod._inputMode).toBe('upload');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _addNewChapter
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_addNewChapter()', () => {
    it('should add empty chapter to store and expand it', async () => {
      await mod._addNewChapter();

      expect(app.store.addChapter).toHaveBeenCalledWith(expect.objectContaining({
        title: '',
        file: '',
        htmlContent: '',
      }));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _saveExpandedChapter
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_saveExpandedChapter()', () => {
    it('should save inline fields to store on collapse', async () => {
      await mod._renderChapters();
      await mod._toggleChapter(0);

      // Modify inline fields
      const card = mod.chaptersList.querySelector('.chapter-card[data-index="0"]');
      const body = card.querySelector('.chapter-card-body');
      const titleInput = body.querySelector('.chapter-inline-title');
      titleInput.value = 'New Title';

      await mod._saveExpandedChapter();

      expect(app.store.updateChapter).toHaveBeenCalledWith(0, expect.objectContaining({
        title: 'New Title',
      }));
    });

    it('should not save if no chapter is expanded', async () => {
      await mod._saveExpandedChapter();
      expect(app.store.updateChapter).not.toHaveBeenCalled();
    });

    it('should collect HTML from editor when in editor mode', async () => {
      app.store.getChapters.mockResolvedValue([
        { id: 'inline', title: '', file: '', htmlContent: '<p>old</p>', bg: '', bgMobile: '' },
      ]);
      await mod._renderChapters();
      await mod._toggleChapter(0);

      mod._inputMode = 'editor';
      mod._editor._quill.isInitialized = true;
      mod._editor._quill.isEmpty = vi.fn(() => false);
      mod._editor._quill.getHTML = vi.fn(() => '<p>Editor content</p>');

      await mod._saveExpandedChapter();

      expect(app.store.updateChapter).toHaveBeenCalledWith(0, expect.objectContaining({
        htmlContent: '<p>Editor content</p>',
      }));
    });

    it('should not destroy editor after save (keeps content for re-expand)', async () => {
      await mod._renderChapters();
      await mod._toggleChapter(0);

      mod._editor._quill.isInitialized = true;
      await mod._saveExpandedChapter();

      expect(mod._editor._quill.destroy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _openModal (legacy — delegates to inline editing)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_openModal() legacy', () => {
    it('should add new chapter when called without index', async () => {
      await mod._openModal();
      expect(app.store.addChapter).toHaveBeenCalled();
    });

    it('should expand chapter inline when called with index', async () => {
      await mod._renderChapters();
      await mod._openModal(0);

      expect(mod._expandedIndex).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _switchInputMode (legacy)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_switchInputMode()', () => {
    it('should switch to editor mode', async () => {
      await mod._switchInputMode('editor');
      expect(mod._inputMode).toBe('editor');
    });

    it('should switch to upload mode', async () => {
      await mod._switchInputMode('editor');
      await mod._switchInputMode('upload');
      expect(mod._inputMode).toBe('upload');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _handleChapterSubmit (legacy — delegates to _saveExpandedChapter)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_handleChapterSubmit()', () => {
    it('should reject if id is empty', async () => {
      mod.inputId.value = '';
      mod._pendingHtmlContent = '<article>content</article>';

      await mod._handleChapterSubmit({ preventDefault: vi.fn() });

      // Legacy submit delegates to _saveExpandedChapter which needs expanded chapter
      // No expanded chapter means nothing saved
      expect(app.store.addChapter).not.toHaveBeenCalled();
    });

    it('should reject if both file and htmlContent are empty', async () => {
      mod.inputId.value = 'test';
      mod._pendingHtmlContent = null;

      await mod._handleChapterSubmit({ preventDefault: vi.fn() });

      expect(app.store.addChapter).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _removeChapterFile with editor
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_removeChapterFile() with editor', () => {
    it('should clear editor if initialized', () => {
      mod._editor._quill.isInitialized = true;

      mod._removeChapterFile();

      expect(mod._editor._quill.clear).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _saveCover
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_saveCover()', () => {
    it('should save cover data to store', () => {
      mod.coverTitle.value = 'New Title';
      mod.coverAuthor.value = 'New Author';

      mod._saveCover();

      expect(app.store.updateCover).toHaveBeenCalledWith({
        title: 'New Title',
        author: 'New Author',
        bgMode: 'default',
      });
      expect(app._showToast).toHaveBeenCalledWith('Обложка сохранена');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _handleSelectBook / _handleDeleteBook
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_handleSelectBook()', () => {
    it('should switch active book, re-render and open editor', () => {
      mod._handleSelectBook('book2');

      expect(app.store.setActiveBook).toHaveBeenCalledWith('book2');
      expect(app._render).toHaveBeenCalled();
      expect(app.openEditor).toHaveBeenCalled();
    });

    it('should open editor even if already active (without switching)', () => {
      mod._handleSelectBook('default');

      expect(app.store.setActiveBook).not.toHaveBeenCalled();
      expect(app.openEditor).toHaveBeenCalled();
    });
  });

  describe('_handleDeleteBook()', () => {
    it('should not delete last book', () => {
      mod._handleDeleteBook('default');

      expect(app._showToast).toHaveBeenCalledWith('Нельзя удалить единственную книгу');
      expect(app.store.removeBook).not.toHaveBeenCalled();
    });

    it('should delete book after confirmation', async () => {
      app.store.getBooks.mockReturnValue([
        { id: 'book1', title: 'Book 1' },
        { id: 'book2', title: 'Book 2' },
      ]);
      app._confirm.mockResolvedValue(true);

      await mod._handleDeleteBook('book2');

      expect(app.store.removeBook).toHaveBeenCalledWith('book2');
      expect(app._render).toHaveBeenCalled();
      expect(app._showView).toHaveBeenCalledWith('bookshelf');
    });

    it('should not delete on cancel', async () => {
      app.store.getBooks.mockReturnValue([
        { id: 'book1', title: 'Book 1' },
        { id: 'book2', title: 'Book 2' },
      ]);
      app._confirm.mockResolvedValue(false);

      await mod._handleDeleteBook('book2');

      expect(app.store.removeBook).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHOTO ALBUM (delegated to AlbumManager)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('photo album', () => {
    beforeEach(() => {
      // albumPagesEl устанавливается inline через ChaptersModule; в тестах — вручную
      const pagesEl = document.createElement('div');
      pagesEl.id = 'albumPagesInline';
      document.body.appendChild(pagesEl);
      mod._album.albumPagesEl = pagesEl;
    });

    describe('_addAlbumPage()', () => {
      it('should add new page', () => {
        mod._album._albumPages = [{ layout: '1', images: [] }];
        mod._album._addAlbumPage();
        expect(mod._album._albumPages.length).toBe(2);
      });
    });

    describe('_removeAlbumPage()', () => {
      it('should remove page if more than one', () => {
        mod._album._albumPages = [{ layout: '1', images: [] }, { layout: '2', images: [] }];
        mod._album._removeAlbumPage(0);
        expect(mod._album._albumPages.length).toBe(1);
      });

      it('should not remove last page', () => {
        mod._album._albumPages = [{ layout: '1', images: [] }];
        mod._album._removeAlbumPage(0);
        expect(mod._album._albumPages.length).toBe(1);
      });
    });

    describe('_selectPageLayout()', () => {
      it('should update layout for page', async () => {
        mod._album._albumPages = [{ layout: '1', images: [{ dataUrl: 'a', caption: '' }, { dataUrl: 'b', caption: '' }] }];
        await mod._album._selectPageLayout(0, '1');
        // Layout '1' supports only 1 image, so images array is truncated
        expect(mod._album._albumPages[0].layout).toBe('1');
        expect(mod._album._albumPages[0].images.length).toBe(1);
      });

      it('should keep images that fit the layout', async () => {
        mod._album._albumPages = [{ layout: '1', images: [{ dataUrl: 'a', caption: '' }] }];
        await mod._album._selectPageLayout(0, '4');
        // Layout '4' supports 4 images, existing 1 should stay
        expect(mod._album._albumPages[0].images.length).toBe(1);
      });
    });

    describe('_buildAlbumHtml()', () => {
      it('should generate article HTML with title', () => {
        const pages = [{ layout: '1', images: [{ dataUrl: 'data:img', caption: 'My photo' }] }];

        const html = mod._album._buildAlbumHtml({ title: 'Test Album', hideTitle: false, pages });

        expect(html).toContain('<article class="photo-album-chapter">');
        expect(html).toContain('<h2>Test Album</h2>');
        expect(html).toContain('data-layout="1"');
        expect(html).toContain('src="data:img"');
        expect(html).toContain('<figcaption>My photo</figcaption>');
      });

      it('should add sr-only class when title hidden', () => {
        const pages = [{ layout: '1', images: [{ dataUrl: 'data:img', caption: '' }] }];

        const html = mod._album._buildAlbumHtml({ title: 'Hidden Title', hideTitle: true, pages });

        expect(html).toContain('class="sr-only"');
      });

      it('should skip empty image slots in generated HTML', () => {
        const pages = [{ layout: '2', images: [null, { dataUrl: 'data:img', caption: '' }] }];

        const html = mod._album._buildAlbumHtml({ title: 'Test', hideTitle: false, pages });

        // Null slots are filtered out, only the valid image remains
        expect(html).not.toContain('src=""');
        expect(html).toContain('src="data:img"');
      });
    });

  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOK UPLOAD (delegated to BookUploadManager)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('book upload', () => {
    describe('_processBookFile()', () => {
      it('should reject unsupported formats', async () => {
        await mod._bookUpload._processBookFile({ name: 'book.pdf' });

        expect(app._showToast).toHaveBeenCalledWith('Неподдерживаемый формат. Поддерживаются: epub, fb2, docx, doc, txt');
      });
    });

    describe('_applyParsedBook()', () => {
      it('should do nothing without pending book', async () => {
        mod._bookUpload._pendingParsedBook = null;

        await mod._bookUpload._applyParsedBook();

        expect(app.store.addBook).not.toHaveBeenCalled();
      });

      it('should add parsed book to store', async () => {
        mod._bookUpload._pendingParsedBook = {
          title: 'Test Book',
          author: 'Test Author',
          chapters: [
            { id: 'ch1', title: 'Chapter 1', html: '<article>Content</article>' },
          ],
        };

        await mod._bookUpload._applyParsedBook();

        expect(app.store.addBook).toHaveBeenCalledWith(expect.objectContaining({
          cover: expect.objectContaining({
            title: 'Test Book',
            author: 'Test Author',
          }),
          chapters: expect.arrayContaining([
            expect.objectContaining({
              id: 'ch1',
              htmlContent: '<article>Content</article>',
            }),
          ]),
        }));
        expect(app.store.setActiveBook).toHaveBeenCalled();
        expect(app._render).toHaveBeenCalled();
        expect(app.openEditor).toHaveBeenCalled();
      });

      it('should rollback on save failure', async () => {
        app.store.waitForSave.mockRejectedValue(new Error('quota'));
        mod._bookUpload._pendingParsedBook = {
          title: 'Big Book',
          author: '',
          chapters: [{ id: 'ch1', title: '', html: '<article>x</article>' }],
        };

        await mod._bookUpload._applyParsedBook();

        expect(app.store.removeBook).toHaveBeenCalled();
        expect(app._showToast).toHaveBeenCalledWith('Ошибка сохранения: недостаточно места в хранилище');
        expect(app.store.setActiveBook).not.toHaveBeenCalled();
      });
    });

    describe('_resetBookUpload()', () => {
      it('should reset upload state', () => {
        mod._bookUpload._pendingParsedBook = { some: 'data' };
        mod._bookUpload.bookDropzone.hidden = true;
        mod._bookUpload.bookUploadProgress.hidden = false;
        mod._bookUpload.bookUploadResult.hidden = false;

        mod._bookUpload._resetBookUpload();

        expect(mod._bookUpload._pendingParsedBook).toBeNull();
        expect(mod._bookUpload.bookDropzone.hidden).toBe(false);
        expect(mod._bookUpload.bookUploadProgress.hidden).toBe(true);
        expect(mod._bookUpload.bookUploadResult.hidden).toBe(true);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE UI HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_showChapterFileInfo()', () => {
    it('should show file info and hide dropzone', () => {
      mod._showChapterFileInfo('my-chapter.html');

      expect(mod.chapterFileDropzone.hidden).toBe(true);
      expect(mod.chapterFileInfo.hidden).toBe(false);
      expect(mod.chapterFileName.textContent).toBe('my-chapter.html');
    });
  });

  describe('_resetChapterFileUI()', () => {
    it('should hide file info and show dropzone', () => {
      // Set initial state — file info visible
      mod.chapterFileDropzone.hidden = true;
      mod.chapterFileInfo.hidden = false;
      mod.chapterFileName.textContent = 'some-file.html';

      mod._resetChapterFileUI();

      expect(mod.chapterFileDropzone.hidden).toBe(false);
      expect(mod.chapterFileInfo.hidden).toBe(true);
      expect(mod.chapterFileName.textContent).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _processChapterFile
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_processChapterFile()', () => {
    it('should reject unsupported file extension', async () => {
      const file = new File(['data'], 'book.pdf', { type: 'application/pdf' });

      await mod._processChapterFile(file);

      expect(app._showToast).toHaveBeenCalledWith(expect.stringContaining('Допустимые форматы'));
    });

    it('should reject file exceeding max size', async () => {
      // Create a file mock with a large size
      const file = { name: 'big.html', size: 20 * 1024 * 1024, text: vi.fn() };

      await mod._processChapterFile(file);

      expect(app._showToast).toHaveBeenCalledWith(expect.stringContaining('слишком большой'));
    });

    it('should process HTML file directly', async () => {
      const file = new File(['<article><p>Hello</p></article>'], 'chapter.html', { type: 'text/html' });
      if (!file.text) file.text = () => Promise.resolve('<article><p>Hello</p></article>');

      await mod._processChapterFile(file);

      expect(mod._pendingHtmlContent).toBe('<article><p>Hello</p></article>');
      expect(app._showToast).toHaveBeenCalledWith('Файл загружен');
    });

    it('should show file info after successful processing', async () => {
      const file = new File(['<p>Content</p>'], 'my-file.htm', { type: 'text/html' });
      if (!file.text) file.text = () => Promise.resolve('<p>Content</p>');

      await mod._processChapterFile(file);

      expect(mod.chapterFileDropzone.hidden).toBe(true);
      expect(mod.chapterFileName.textContent).toBe('my-file.htm');
    });

    it('should reject empty HTML file', async () => {
      const file = new File(['   '], 'empty.html', { type: 'text/html' });
      if (!file.text) file.text = () => Promise.resolve('   ');

      await mod._processChapterFile(file);

      expect(app._showToast).toHaveBeenCalledWith('Файл пуст или не удалось извлечь контент');
    });

    it('should remove loading class after processing', async () => {
      const file = new File(['<p>text</p>'], 'f.html', { type: 'text/html' });
      if (!file.text) file.text = () => Promise.resolve('<p>text</p>');

      await mod._processChapterFile(file);

      expect(mod.chapterFileDropzone.classList.contains('loading')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKGROUND MODE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderBgModeSelector()', () => {
    it('should set active class on matching button', () => {
      mod._renderBgModeSelector('none', null);

      const defaultBtn = document.querySelector('[data-bg-mode="default"]');
      const noneBtn = document.querySelector('[data-bg-mode="none"]');
      expect(defaultBtn.classList.contains('active')).toBe(false);
      expect(noneBtn.classList.contains('active')).toBe(true);
    });

    it('should set hidden input value', () => {
      mod._renderBgModeSelector('none', null);
      expect(mod.bgCoverMode.value).toBe('none');
    });

    it('should show thumbnail when custom data provided', () => {
      mod._renderBgModeSelector('custom', 'data:image/png;base64,abc');

      expect(mod.bgCoverThumb.classList.contains('has-image')).toBe(true);
      expect(mod.bgCoverCustomInfo.hidden).toBe(false);
      expect(mod.bgCoverCustomName.textContent).toBe('Своё изображение');
    });

    it('should clear thumbnail when no custom data', () => {
      // First set custom
      mod._renderBgModeSelector('custom', 'data:image/png;base64,abc');
      // Then clear
      mod._renderBgModeSelector('default', null);

      expect(mod.bgCoverThumb.classList.contains('has-image')).toBe(false);
      expect(mod.bgCoverCustomInfo.hidden).toBe(true);
    });
  });

  describe('_selectBgMode()', () => {
    it('should update bg mode selector from store', async () => {
      app.store.getCover.mockResolvedValue({
        title: 'T', author: 'A', bgMode: 'custom', bgCustomData: 'data:img',
      });

      await mod._selectBgMode('custom');

      expect(mod.bgCoverMode.value).toBe('custom');
    });
  });

  describe('_removeBgCustom()', () => {
    it('should reset background to default', () => {
      mod._removeBgCustom();

      expect(app.store.updateCover).toHaveBeenCalledWith({
        bgMode: 'default',
        bgCustomData: null,
      });
      expect(mod.bgCoverMode.value).toBe('default');
      expect(app._showToast).toHaveBeenCalledWith('Своё изображение удалено');
    });
  });

  describe('_handleBgUpload()', () => {
    it('should reject file without file', () => {
      mod._handleBgUpload({ target: { files: [] } });
      expect(app.store.updateCover).not.toHaveBeenCalled();
    });
  });
});
