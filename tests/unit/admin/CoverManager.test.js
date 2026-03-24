import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@i18n', () => ({ t: vi.fn((key, opts) => opts ? `${key}:${JSON.stringify(opts)}` : key) }));

vi.mock('@/admin/modules/adminHelpers.js', () => ({
  uploadWithFallback: vi.fn().mockResolvedValue('data:image/png;base64,abc'),
}));

import { CoverManager } from '@/admin/modules/CoverManager.js';

// ═══════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ═══════════════════════════════════════════

function createMockDOM() {
  document.body.innerHTML = `
    <input id="coverTitle" value="">
    <input id="coverAuthor" value="">
    <input id="bgCoverMode" type="hidden" value="default">
    <div class="texture-option" data-bg-mode="default"></div>
    <div class="texture-option" data-bg-mode="custom"></div>
    <input id="bgCoverFileInput" type="file" accept="image/*">
    <div id="bgCoverThumb"></div>
    <div id="bgCoverCustomInfo" hidden>
      <span id="bgCoverCustomName"></span>
    </div>
    <button id="bgCoverRemove" hidden></button>
    <button id="saveCover"></button>
  `;
}

function createMockHost() {
  return {
    _showToast: vi.fn(),
    _escapeHtml: vi.fn(s => s),
    _renderJsonPreview: vi.fn(),
    _validateFile: vi.fn(() => true),
    _bookSelector: {
      render: vi.fn(),
    },
    app: {
      editorTitle: document.createElement('span'),
    },
    store: {
      getCover: vi.fn(async () => ({
        title: 'Test Book',
        author: 'Author',
        bgMode: 'default',
        bgCustomData: null,
      })),
      updateCover: vi.fn(),
      save: vi.fn(),
    },
  };
}

describe('CoverManager', () => {
  let manager;
  let host;

  beforeEach(() => {
    createMockDOM();
    host = createMockHost();
    manager = new CoverManager(host);
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
  // МЕТОД cacheDOM()
  // ═══════════════════════════════════════════

  describe('cacheDOM()', () => {
    it('должен найти все необходимые элементы', () => {
      manager.cacheDOM();

      expect(manager.coverTitle).toBe(document.getElementById('coverTitle'));
      expect(manager.coverAuthor).toBe(document.getElementById('coverAuthor'));
      expect(manager.bgCoverFileInput).toBe(document.getElementById('bgCoverFileInput'));
    });

    it('не должен бросить ошибку', () => {
      expect(() => manager.cacheDOM()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД bindEvents()
  // ═══════════════════════════════════════════

  describe('bindEvents()', () => {
    it('должен привязать обработчики без ошибок', () => {
      manager.cacheDOM();
      expect(() => manager.bindEvents()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД render()
  // ═══════════════════════════════════════════

  describe('render()', () => {
    beforeEach(() => {
      manager.cacheDOM();
    });

    it('должен получить данные обложки из store', async () => {
      await manager.render();
      expect(host.store.getCover).toHaveBeenCalled();
    });

    it('должен заполнить поле заголовка', async () => {
      await manager.render();

      const titleInput = document.getElementById('coverTitle');
      expect(titleInput.value).toBe('Test Book');
    });

    it('должен заполнить поле автора', async () => {
      await manager.render();

      const authorInput = document.getElementById('coverAuthor');
      expect(authorInput.value).toBe('Author');
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД _removeBgCustom()
  // ═══════════════════════════════════════════

  describe('_removeBgCustom()', () => {
    it('должен вызвать store.updateCover с default режимом', () => {
      manager.cacheDOM();
      manager._removeBgCustom();

      expect(host.store.updateCover).toHaveBeenCalledWith(
        expect.objectContaining({ bgMode: 'default', bgCustomData: null }),
      );
    });

    it('должен показать toast', () => {
      manager.cacheDOM();
      manager._removeBgCustom();

      expect(host._showToast).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД _saveCover()
  // ═══════════════════════════════════════════

  describe('_saveCover()', () => {
    it('должен сохранить данные обложки в store', async () => {
      manager.cacheDOM();
      await manager.render();

      document.getElementById('coverTitle').value = 'New Title';
      manager._saveCover();

      expect(host.store.updateCover).toHaveBeenCalled();
    });

    it('должен показать toast после сохранения', async () => {
      manager.cacheDOM();
      await manager.render();
      manager._saveCover();

      expect(host._showToast).toHaveBeenCalled();
    });

    it('должен обновить bookSelector', async () => {
      manager.cacheDOM();
      await manager.render();
      manager._saveCover();

      expect(host._bookSelector.render).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД _handleBgUpload()
  // ═══════════════════════════════════════════

  describe('_handleBgUpload()', () => {
    it('должен обработать пустой выбор файла', () => {
      manager.cacheDOM();

      const event = { target: { files: [] } };
      expect(() => manager._handleBgUpload(event)).not.toThrow();
    });
  });
});
