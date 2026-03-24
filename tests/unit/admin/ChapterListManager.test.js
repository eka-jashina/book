import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupTemplates } from '../../helpers/adminTemplates.js';

vi.mock('@i18n', () => ({ t: vi.fn((key, opts) => opts ? `${key}:${JSON.stringify(opts)}` : key) }));

import { ChapterListManager } from '@/admin/modules/ChapterListManager.js';

// ═══════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ═══════════════════════════════════════════

function createMockHost() {
  const chaptersList = document.createElement('div');
  const chaptersEmpty = document.createElement('div');
  document.body.appendChild(chaptersList);
  document.body.appendChild(chaptersEmpty);

  return {
    _showToast: vi.fn(),
    _escapeHtml: vi.fn(s => s),
    _renderJsonPreview: vi.fn(),
    _isAlbumBook: vi.fn(() => false),
    _expandedIndex: -1,
    _confirm: vi.fn(() => Promise.resolve(true)),
    store: {
      getChapters: vi.fn(async () => []),
      addChapter: vi.fn(),
      addSection: vi.fn(),
      removeChapter: vi.fn(),
      moveChapter: vi.fn(),
      updateChapter: vi.fn(),
      save: vi.fn(),
    },
    chaptersList,
    chaptersEmpty,
    _editor: {
      setContent: vi.fn(),
      getContent: vi.fn(() => ''),
      saveExpandedChapter: vi.fn(),
      toggleChapter: vi.fn(),
      destroyInlineEditor: vi.fn(),
    },
  };
}

function createChapter(overrides = {}) {
  return {
    id: 'ch-1',
    title: 'Test Chapter',
    body: '<p>Content</p>',
    file: '',
    htmlContent: '<p>Content</p>',
    type: 'chapter',
    ...overrides,
  };
}

describe('ChapterListManager', () => {
  let manager;
  let host;

  beforeEach(() => {
    document.body.innerHTML = '';
    setupTemplates('tmpl-admin-chapter-card');
    host = createMockHost();
    manager = new ChapterListManager(host);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // КОНСТРУКТОР
  // ═══════════════════════════════════════════

  describe('constructor', () => {
    it('должен сохранить ссылку на host', () => {
      expect(manager._host).toBe(host);
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД renderChapters()
  // ═══════════════════════════════════════════

  describe('renderChapters()', () => {
    it('должен отрисовать пустой список', async () => {
      host.store.getChapters.mockResolvedValue([]);
      await manager.renderChapters();

      expect(host.chaptersList.children.length).toBe(0);
      expect(host.chaptersEmpty.hidden).toBe(false);
    });

    it('должен отрисовать карточки глав', async () => {
      const chapters = [
        createChapter({ id: 'ch-1', title: 'Chapter 1' }),
        createChapter({ id: 'ch-2', title: 'Chapter 2' }),
      ];
      host.store.getChapters.mockResolvedValue(chapters);

      await manager.renderChapters();

      const cards = host.chaptersList.querySelectorAll('.chapter-card');
      expect(cards.length).toBe(2);
    });

    it('должен получить главы из store', async () => {
      await manager.renderChapters();
      expect(host.store.getChapters).toHaveBeenCalled();
    });

    it('должен использовать шаблон', async () => {
      const chapters = [createChapter()];
      host.store.getChapters.mockResolvedValue(chapters);

      await manager.renderChapters();

      const card = host.chaptersList.querySelector('.chapter-card');
      expect(card).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД _createChapterCard()
  // ═══════════════════════════════════════════

  describe('_createChapterCard()', () => {
    it('должен создать карточку из шаблона', () => {
      const tmpl = document.getElementById('tmpl-admin-chapter-card');
      const chapter = createChapter({ title: 'Test Title' });

      const fragment = manager._createChapterCard(tmpl, chapter, 0, 1);

      // _createChapterCard returns a DocumentFragment (clone of template)
      const card = fragment.querySelector('.chapter-card');
      expect(card).not.toBeNull();
      expect(card.querySelector('.chapter-title')).not.toBeNull();
    });

    it('должен отобразить заголовок главы', () => {
      const tmpl = document.getElementById('tmpl-admin-chapter-card');
      const chapter = createChapter({ title: 'My Chapter' });

      const fragment = manager._createChapterCard(tmpl, chapter, 0, 1);

      const titleEl = fragment.querySelector('.chapter-title');
      expect(titleEl.textContent).toContain('My Chapter');
    });

    it('должен скрыть кнопку "вверх" для первого элемента', () => {
      const tmpl = document.getElementById('tmpl-admin-chapter-card');
      const chapter = createChapter();

      const fragment = manager._createChapterCard(tmpl, chapter, 0, 3);

      const upBtn = fragment.querySelector('.chapter-move-up-btn');
      expect(upBtn.hidden).toBe(true);
    });

    it('должен скрыть кнопку "вниз" для последнего элемента', () => {
      const tmpl = document.getElementById('tmpl-admin-chapter-card');
      const chapter = createChapter();

      const fragment = manager._createChapterCard(tmpl, chapter, 2, 3);

      const downBtn = fragment.querySelector('.chapter-move-down-btn');
      expect(downBtn.hidden).toBe(true);
    });

    it('должен показать обе кнопки для среднего элемента', () => {
      const tmpl = document.getElementById('tmpl-admin-chapter-card');
      const chapter = createChapter();

      const fragment = manager._createChapterCard(tmpl, chapter, 1, 3);

      const upBtn = fragment.querySelector('.chapter-move-up-btn');
      const downBtn = fragment.querySelector('.chapter-move-down-btn');
      expect(upBtn.hidden).toBe(false);
      expect(downBtn.hidden).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД addNewChapter()
  // ═══════════════════════════════════════════

  describe('addNewChapter()', () => {
    it('должен добавить главу в store', async () => {
      host.store.getChapters.mockResolvedValue([createChapter()]);
      await manager.addNewChapter();
      expect(host.store.addChapter).toHaveBeenCalled();
    });

    it('должен вызвать renderChapters после добавления', async () => {
      host.store.getChapters.mockResolvedValue([createChapter()]);
      const renderSpy = vi.spyOn(manager, 'renderChapters').mockResolvedValue();

      await manager.addNewChapter();

      expect(renderSpy).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД addNewSection()
  // ═══════════════════════════════════════════

  describe('addNewSection()', () => {
    it('должен добавить секцию альбома в store', async () => {
      host.store.getChapters.mockResolvedValue([createChapter()]);
      await manager.addNewSection();
      // addNewSection calls store.addChapter (not store.addSection)
      expect(host.store.addChapter).toHaveBeenCalled();
    });

    it('должен вызвать renderChapters после добавления', async () => {
      host.store.getChapters.mockResolvedValue([createChapter()]);
      const renderSpy = vi.spyOn(manager, 'renderChapters').mockResolvedValue();

      await manager.addNewSection();

      expect(renderSpy).toHaveBeenCalled();
    });
  });
});
