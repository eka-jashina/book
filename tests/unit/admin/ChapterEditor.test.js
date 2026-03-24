/**
 * TESTS: ChapterEditor
 * Тесты для редактора контента глав
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderChapterBody, renderSectionBody, renderBgSelector } from '../../../js/admin/modules/ChapterEditorRenderer.js';
import { ChapterEditor } from '../../../js/admin/modules/ChapterEditor.js';

// Мок QuillEditorWrapper
vi.mock('../../../js/admin/modules/QuillEditorWrapper.js', () => {
  const QuillEditorWrapper = vi.fn(function () {
    this.isInitialized = false;
    this.init = vi.fn().mockResolvedValue();
    this.destroy = vi.fn();
    this.setHTML = vi.fn();
    this.getHTML = vi.fn(() => '<p>Quill content</p>');
    this.isEmpty = vi.fn(() => false);
    this.clear = vi.fn();
  });
  return { QuillEditorWrapper };
});

// Мок adminHelpers
vi.mock('../../../js/admin/modules/adminHelpers.js', () => ({
  uploadWithFallback: vi.fn().mockResolvedValue('data:image/png;base64,abc'),
  setupDropzone: vi.fn(),
}));

// Мок ChapterEditorRenderer
vi.mock('../../../js/admin/modules/ChapterEditorRenderer.js', () => ({
  renderChapterBody: vi.fn(() => '<div class="chapter-body-mock"></div>'),
  renderSectionBody: vi.fn(() => '<div class="section-body-mock"></div>'),
  renderBgSelector: vi.fn(() => '<div class="bg-selector-mock"></div>'),
}));

// Мок i18n
vi.mock('@i18n', () => ({
  t: vi.fn((key) => key),
}));

/**
 * Создать мок хост-объекта (ChaptersModule)
 */
function createMockHost() {
  return {
    store: {
      getChapters: vi.fn(() => [
        { id: 'ch1', title: 'Chapter 1', htmlContent: '<p>Content 1</p>' },
        { id: 'ch2', title: 'Chapter 2', file: 'ch2.txt' },
        { id: 'sec1', title: 'Section', albumData: { title: 'Album', hideTitle: true, pages: [] } },
      ]),
      updateChapter: vi.fn().mockResolvedValue(),
      getChapterContent: vi.fn().mockResolvedValue('<p>Loaded content</p>'),
    },
    _expandedIndex: -1,
    chaptersList: document.createElement('div'),
    _escapeHtml: vi.fn((s) => s),
    _showToast: vi.fn(),
    _renderJsonPreview: vi.fn(),
    _importer: { processInlineFile: vi.fn() },
    _album: {
      _albumPages: [],
      _editingChapterIndex: -1,
      _isDirty: false,
      albumPagesEl: document.createElement('div'),
      _renderAlbumPages: vi.fn(),
      _addAlbumPage: vi.fn(),
      _bulkUpload: vi.fn(),
      _buildAlbumHtml: vi.fn(() => '<div class="album-html"></div>'),
    },
    _validateFile: vi.fn(() => true),
    _restoreAlbumPagesEl: null,
    _inlineAlbumPages: null,
  };
}

/**
 * Создать DOM-карточку главы
 */
function createChapterCard(index, options = {}) {
  const card = document.createElement('div');
  card.className = 'chapter-card';
  card.dataset.index = index;
  card.innerHTML = `<div class="chapter-card-body"></div>`;
  if (options.expanded) {
    card.classList.add('chapter-card--expanded');
    card.querySelector('.chapter-card-body').innerHTML = `
      <input class="chapter-inline-id" value="${options.id || ''}" />
      <input class="chapter-inline-title" value="${options.title || ''}" />
      <input class="chapter-inline-bg-value" value="${options.bg || ''}" />
    `;
  }
  return card;
}

describe('ChapterEditor', () => {
  let host;
  let editor;

  beforeEach(() => {
    host = createMockHost();
    editor = new ChapterEditor(host);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('должен сохранить ссылку на host', () => {
      expect(editor._host).toBe(host);
    });

    it('должен инициализировать pendingHtmlContent как null', () => {
      expect(editor._pendingHtmlContent).toBeNull();
    });

    it('должен инициализировать inputMode как upload', () => {
      expect(editor._inputMode).toBe('upload');
    });

    it('должен создать QuillEditorWrapper', () => {
      expect(editor._quill).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // collapseAll
  // ═══════════════════════════════════════════════════════════════════════════

  describe('collapseAll()', () => {
    it('должен сбросить expandedIndex на -1', () => {
      host._expandedIndex = 2;

      editor.collapseAll();

      expect(host._expandedIndex).toBe(-1);
    });

    it('должен сбросить pendingHtmlContent', () => {
      editor._pendingHtmlContent = '<p>Pending</p>';

      editor.collapseAll();

      expect(editor._pendingHtmlContent).toBeNull();
    });

    it('должен сбросить inputMode на upload', () => {
      editor._inputMode = 'editor';

      editor.collapseAll();

      expect(editor._inputMode).toBe('upload');
    });

    it('должен удалить класс expanded у карточек', () => {
      const card = createChapterCard(0, { expanded: true });
      host.chaptersList.appendChild(card);

      editor.collapseAll();

      expect(card.classList.contains('chapter-card--expanded')).toBe(false);
    });

    it('должен очистить содержимое body карточек', () => {
      const card = createChapterCard(0, { expanded: true });
      host.chaptersList.appendChild(card);

      editor.collapseAll();

      expect(card.querySelector('.chapter-card-body').innerHTML).toBe('');
    });

    it('должен вызвать _restoreAlbumPagesEl, если он установлен', () => {
      const restore = vi.fn();
      host._restoreAlbumPagesEl = restore;

      editor.collapseAll();

      expect(restore).toHaveBeenCalled();
      expect(host._restoreAlbumPagesEl).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // toggleChapter
  // ═══════════════════════════════════════════════════════════════════════════

  describe('toggleChapter()', () => {
    it('должен свернуть главу, если она уже раскрыта', async () => {
      host._expandedIndex = 0;
      const saveSpy = vi.spyOn(editor, 'saveExpandedChapter').mockResolvedValue();
      const collapseSpy = vi.spyOn(editor, 'collapseAll');

      await editor.toggleChapter(0);

      expect(saveSpy).toHaveBeenCalled();
      expect(collapseSpy).toHaveBeenCalled();
    });

    it('должен сохранить предыдущую раскрытую главу перед открытием новой', async () => {
      host._expandedIndex = 0;
      const card = createChapterCard(1);
      host.chaptersList.appendChild(card);
      const saveSpy = vi.spyOn(editor, 'saveExpandedChapter').mockResolvedValue();
      vi.spyOn(editor, '_initInlineControls').mockImplementation(() => {});

      await editor.toggleChapter(1);

      expect(saveSpy).toHaveBeenCalled();
    });

    it('должен установить expandedIndex на новый индекс', async () => {
      const card = createChapterCard(1);
      host.chaptersList.appendChild(card);
      vi.spyOn(editor, 'saveExpandedChapter').mockResolvedValue();
      vi.spyOn(editor, '_initInlineControls').mockImplementation(() => {});

      await editor.toggleChapter(1);

      expect(host._expandedIndex).toBe(1);
    });

    it('должен добавить класс expanded к карточке', async () => {
      const card = createChapterCard(0);
      host.chaptersList.appendChild(card);
      vi.spyOn(editor, 'saveExpandedChapter').mockResolvedValue();
      vi.spyOn(editor, '_initInlineControls').mockImplementation(() => {});

      await editor.toggleChapter(0);

      expect(card.classList.contains('chapter-card--expanded')).toBe(true);
    });

    it('должен загрузить контент, если _hasHtmlContent но нет htmlContent', async () => {
      host.store.getChapters.mockReturnValue([
        { id: 'ch1', title: 'Chapter 1', _hasHtmlContent: true },
      ]);
      const card = createChapterCard(0);
      host.chaptersList.appendChild(card);
      vi.spyOn(editor, 'saveExpandedChapter').mockResolvedValue();
      vi.spyOn(editor, '_initInlineControls').mockImplementation(() => {});

      await editor.toggleChapter(0);

      expect(host.store.getChapterContent).toHaveBeenCalledWith(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // saveExpandedChapter
  // ═══════════════════════════════════════════════════════════════════════════

  describe('saveExpandedChapter()', () => {
    it('не должен ничего делать при expandedIndex < 0', async () => {
      host._expandedIndex = -1;

      await editor.saveExpandedChapter();

      expect(host.store.updateChapter).not.toHaveBeenCalled();
    });

    it('не должен ничего делать, если карточка не найдена', async () => {
      host._expandedIndex = 0;
      // chaptersList пустой

      await editor.saveExpandedChapter();

      expect(host.store.updateChapter).not.toHaveBeenCalled();
    });

    it('должен сохранить данные обычной главы', async () => {
      host._expandedIndex = 0;
      const card = createChapterCard(0, { expanded: true, id: 'ch1', title: 'Updated Title' });
      host.chaptersList.appendChild(card);

      await editor.saveExpandedChapter();

      expect(host.store.updateChapter).toHaveBeenCalledWith(
        0,
        expect.objectContaining({
          id: 'ch1',
          title: 'Updated Title',
        })
      );
    });

    it('должен сохранить pendingHtmlContent, если установлен', async () => {
      host._expandedIndex = 0;
      editor._pendingHtmlContent = '<p>Pending content</p>';
      const card = createChapterCard(0, { expanded: true, id: 'ch1', title: 'Title' });
      host.chaptersList.appendChild(card);

      await editor.saveExpandedChapter();

      expect(host.store.updateChapter).toHaveBeenCalledWith(
        0,
        expect.objectContaining({
          htmlContent: '<p>Pending content</p>',
        })
      );
    });

    it('должен сохранить htmlContent из existing, если нет pending', async () => {
      host._expandedIndex = 0;
      editor._pendingHtmlContent = null;
      const card = createChapterCard(0, { expanded: true, id: 'ch1', title: 'Title' });
      host.chaptersList.appendChild(card);

      await editor.saveExpandedChapter();

      expect(host.store.updateChapter).toHaveBeenCalledWith(
        0,
        expect.objectContaining({
          htmlContent: '<p>Content 1</p>',
        })
      );
    });

    it('должен вызвать _renderJsonPreview после сохранения', async () => {
      host._expandedIndex = 0;
      const card = createChapterCard(0, { expanded: true, id: 'ch1', title: 'T' });
      host.chaptersList.appendChild(card);

      await editor.saveExpandedChapter();

      expect(host._renderJsonPreview).toHaveBeenCalled();
    });

    it('должен сохранить inline-альбом, если _inlineAlbumPages установлен', async () => {
      host._expandedIndex = 2;
      host._inlineAlbumPages = [{ layout: '1', images: [] }];
      host._album._albumPages = [{ layout: '2', images: ['img.jpg'] }];
      const card = createChapterCard(2, { expanded: true });
      // Добавить поля для альбома
      const body = card.querySelector('.chapter-card-body');
      body.innerHTML = `
        <input class="section-inline-title" value="Album Title" />
        <input class="section-inline-hide-title" type="checkbox" checked />
        <input class="chapter-inline-bg-value" value="" />
      `;
      host.chaptersList.appendChild(card);

      await editor.saveExpandedChapter();

      expect(host.store.updateChapter).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          title: 'Album Title',
          albumData: expect.objectContaining({
            title: 'Album Title',
            hideTitle: true,
          }),
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // handleSaveChapterClick
  // ═══════════════════════════════════════════════════════════════════════════

  describe('handleSaveChapterClick()', () => {
    it('должен показать toast после сохранения', async () => {
      vi.spyOn(editor, 'saveExpandedChapter').mockResolvedValue();

      await editor.handleSaveChapterClick();

      expect(host._showToast).toHaveBeenCalledWith('admin.chapters.chapterSaved');
    });

    it('должен заблокировать и разблокировать кнопку сохранения', async () => {
      const saveBtn = document.createElement('button');
      saveBtn.dataset.actionInline = 'save-chapter';
      host.chaptersList.appendChild(saveBtn);
      vi.spyOn(editor, 'saveExpandedChapter').mockResolvedValue();

      await editor.handleSaveChapterClick();

      expect(saveBtn.disabled).toBe(false);
    });

    it('должен разблокировать кнопку даже при ошибке', async () => {
      const saveBtn = document.createElement('button');
      saveBtn.dataset.actionInline = 'save-chapter';
      host.chaptersList.appendChild(saveBtn);
      vi.spyOn(editor, 'saveExpandedChapter').mockRejectedValue(new Error('fail'));

      await expect(editor.handleSaveChapterClick()).rejects.toThrow('fail');
      expect(saveBtn.disabled).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // destroyInlineEditor
  // ═══════════════════════════════════════════════════════════════════════════

  describe('destroyInlineEditor()', () => {
    it('должен уничтожить Quill, если инициализирован', () => {
      editor._quill.isInitialized = true;

      editor.destroyInlineEditor();

      expect(editor._quill.destroy).toHaveBeenCalled();
    });

    it('не должен вызывать destroy, если Quill не инициализирован', () => {
      editor._quill.isInitialized = false;

      editor.destroyInlineEditor();

      expect(editor._quill.destroy).not.toHaveBeenCalled();
    });

    it('должен сбросить pendingHtmlContent', () => {
      editor._pendingHtmlContent = '<p>Content</p>';

      editor.destroyInlineEditor();

      expect(editor._pendingHtmlContent).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _renderChapterBody / _renderSectionBody / _renderBgSelector
  // ═══════════════════════════════════════════════════════════════════════════

  describe('render delegates', () => {
    it('_renderChapterBody должен делегировать в renderChapterBody', () => {
      editor._renderChapterBody({ id: 'ch1', title: 'T' }, 0);

      expect(renderChapterBody).toHaveBeenCalled();
    });

    it('_renderSectionBody должен делегировать в renderSectionBody', () => {
      editor._renderSectionBody({ id: 'sec1', albumData: {} }, 0);

      expect(renderSectionBody).toHaveBeenCalled();
    });

    it('_renderBgSelector должен делегировать в renderBgSelector', () => {
      editor._renderBgSelector({ id: 'ch1' });

      expect(renderBgSelector).toHaveBeenCalled();
    });
  });
});
