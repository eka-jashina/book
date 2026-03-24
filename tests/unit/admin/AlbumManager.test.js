/**
 * Unit tests for AlbumManager
 * Управление фотоальбомами: страницы, layout, генерация HTML
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupTemplates } from '../../helpers/adminTemplates.js';
import { AlbumManager } from '../../../js/admin/modules/AlbumManager.js';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Реальное экранирование — важно для XSS-тестов
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Мок ChaptersModule — минимальный интерфейс, нужный AlbumManager
 */
function createMockModule() {
  return {
    store: {
      addChapter: vi.fn(),
      updateCover: vi.fn(),
      uploadImage: vi.fn().mockResolvedValue(null),
    },
    app: {
      _showView: vi.fn(),
      _pendingBookId: null,
      openEditor: vi.fn(),
      _cleanupPendingBook: vi.fn(),
    },
    _showToast: vi.fn(),
    _confirm: vi.fn(() => Promise.resolve(true)),
    _escapeHtml: vi.fn((s) => escapeHtml(s)),
    _renderChapters: vi.fn(),
    _renderBookSelector: vi.fn(),
    _renderJsonPreview: vi.fn(),
  };
}

/**
 * DOM-минимум для AlbumManager (inline-режим, albumPagesEl устанавливается вручную)
 */
function setupDOM() {
  document.body.innerHTML = `
    <div id="albumPages"></div>
  `;
  setupTemplates('tmpl-album-image-slot', 'tmpl-admin-album-page-card');
}

/**
 * Создать страницу с указанным layout и N изображениями
 */
function makePage(layout = '1', images = []) {
  return { layout, images };
}

/**
 * Создать объект изображения
 */
function makeImage(dataUrl = 'data:image/png;base64,abc', caption = '', frame = 'none', filter = 'none', filterIntensity = 100) {
  return { dataUrl, caption, frame, filter, filterIntensity };
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('AlbumManager', () => {
  let mockModule;
  let manager;

  beforeEach(() => {
    setupDOM();
    mockModule = createMockModule();
    manager = new AlbumManager(mockModule);
    // albumPagesEl устанавливается inline через ChaptersModule
    manager.albumPagesEl = document.getElementById('albumPages');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // constructor
  // ─────────────────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should store the module reference', () => {
      expect(manager._module).toBe(mockModule);
    });

    it('should initialize _albumPages as an empty array', () => {
      expect(manager._albumPages).toEqual([]);
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
  // CRUD: _addAlbumPage()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_addAlbumPage()', () => {
    beforeEach(() => {
      manager._albumPages = [makePage()];
    });

    it('should increase _albumPages length by 1', () => {
      manager._addAlbumPage();
      expect(manager._albumPages).toHaveLength(2);
    });

    it('should add a page with default layout "1"', () => {
      manager._addAlbumPage();
      expect(manager._albumPages[1].layout).toBe('1');
    });

    it('should add a page with an empty images array', () => {
      manager._addAlbumPage();
      expect(manager._albumPages[1].images).toEqual([]);
    });

    it('should call _renderAlbumPages after adding', () => {
      const spy = vi.spyOn(manager, '_renderAlbumPages');
      manager._addAlbumPage();
      expect(spy).toHaveBeenCalled();
    });

    it('should be additive — multiple calls accumulate pages', () => {
      manager._addAlbumPage();
      manager._addAlbumPage();
      expect(manager._albumPages).toHaveLength(3);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD: _removeAlbumPage()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_removeAlbumPage()', () => {
    it('should remove the page at the given index', () => {
      manager._albumPages = [makePage('1'), makePage('2')];
      manager._removeAlbumPage(0);
      expect(manager._albumPages).toHaveLength(1);
      expect(manager._albumPages[0].layout).toBe('2');
    });

    it('should remove the last (second) page by index', () => {
      manager._albumPages = [makePage('1'), makePage('2')];
      manager._removeAlbumPage(1);
      expect(manager._albumPages).toHaveLength(1);
      expect(manager._albumPages[0].layout).toBe('1');
    });

    it('should NOT remove when only one page remains', () => {
      manager._albumPages = [makePage()];
      manager._removeAlbumPage(0);
      expect(manager._albumPages).toHaveLength(1);
    });

    it('should call _renderAlbumPages after successful removal', () => {
      manager._albumPages = [makePage(), makePage()];
      const spy = vi.spyOn(manager, '_renderAlbumPages');
      manager._removeAlbumPage(0);
      expect(spy).toHaveBeenCalled();
    });

    it('should NOT call _renderAlbumPages when removal is blocked', () => {
      manager._albumPages = [makePage()];
      const spy = vi.spyOn(manager, '_renderAlbumPages');
      manager._removeAlbumPage(0);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD: _selectPageLayout() (updateLayout)
  // ─────────────────────────────────────────────────────────────────────────

  describe('_selectPageLayout()', () => {
    beforeEach(() => {
      manager._albumPages = [makePage('1', [makeImage()])];
    });

    it('should update the page layout', async () => {
      await manager._selectPageLayout(0, '2');
      expect(manager._albumPages[0].layout).toBe('2');
    });

    it('should trim images when switching to a smaller layout', async () => {
      manager._albumPages = [makePage('4', [
        makeImage('a'), makeImage('b'), makeImage('c'), makeImage('d'),
      ])];
      await manager._selectPageLayout(0, '1'); // layout '1' → count=1
      expect(manager._albumPages[0].images).toHaveLength(1);
    });

    it('should keep existing images when switching to a larger layout', async () => {
      manager._albumPages = [makePage('1', [makeImage('img1')])];
      await manager._selectPageLayout(0, '4'); // layout '4' → count=4
      // slice(0, 4) on a 1-item array yields 1 item
      expect(manager._albumPages[0].images).toHaveLength(1);
    });

    it('should preserve remaining images when trimming', async () => {
      manager._albumPages = [makePage('4', [
        makeImage('keep'), makeImage('drop'), makeImage('drop'), makeImage('drop'),
      ])];
      await manager._selectPageLayout(0, '1');
      expect(manager._albumPages[0].images[0].dataUrl).toBe('keep');
    });

    it('should call _renderAlbumPages after layout change', async () => {
      const spy = vi.spyOn(manager, '_renderAlbumPages');
      await manager._selectPageLayout(0, '2');
      expect(spy).toHaveBeenCalled();
    });

    it('should handle unknown layout id by defaulting to count=1', async () => {
      manager._albumPages = [makePage('unknown', [makeImage('a'), makeImage('b')])];
      await manager._selectPageLayout(0, 'unknown');
      expect(manager._albumPages[0].images).toHaveLength(1);
    });

    it('should ask confirmation when images would be lost', async () => {
      manager._module._confirm.mockResolvedValueOnce(false);
      manager._albumPages = [makePage('4', [
        makeImage('a'), makeImage('b'), makeImage('c'), makeImage('d'),
      ])];
      await manager._selectPageLayout(0, '1');
      // Confirm rejected — images should stay
      expect(manager._albumPages[0].images).toHaveLength(4);
      expect(manager._module._confirm).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // рендеринг страниц: _renderAlbumPages()
  // ─────────────────────────────────────────────────────────────────────────

  describe('рендеринг страниц', () => {
    describe('пустой альбом (нет страниц)', () => {
      it('should produce no cards when _albumPages is empty', () => {
        manager._albumPages = [];
        manager._renderAlbumPages();
        expect(manager.albumPagesEl.querySelectorAll('.album-page-card')).toHaveLength(0);
      });
    });

    describe('одна страница', () => {
      beforeEach(() => {
        manager._albumPages = [makePage('1')];
        manager._renderAlbumPages();
      });

      it('should render one card', () => {
        expect(manager.albumPagesEl.querySelectorAll('.album-page-card')).toHaveLength(1);
      });

      it('should show "Страница 1" as page title', () => {
        const title = manager.albumPagesEl.querySelector('.album-page-title');
        expect(title.textContent).toBe('Страница 1');
      });

      it('should NOT show the remove button for a single page', () => {
        const removeBtn = manager.albumPagesEl.querySelector('.album-page-remove');
        expect(removeBtn.hidden).toBe(true);
      });

      it('should render layout buttons', () => {
        expect(manager.albumPagesEl.querySelector('.album-layouts')).not.toBeNull();
      });
    });

    describe('несколько страниц', () => {
      beforeEach(() => {
        manager._albumPages = [makePage('1'), makePage('2')];
        manager._renderAlbumPages();
      });

      it('should render two cards', () => {
        expect(manager.albumPagesEl.querySelectorAll('.album-page-card')).toHaveLength(2);
      });

      it('should show remove button on each card', () => {
        expect(manager.albumPagesEl.querySelectorAll('.album-page-remove')).toHaveLength(2);
      });

      it('should show sequential page numbers', () => {
        const titles = manager.albumPagesEl.querySelectorAll('.album-page-title');
        expect(titles[0].textContent).toBe('Страница 1');
        expect(titles[1].textContent).toBe('Страница 2');
      });
    });

    describe('страница с layout "1" → 1 слот', () => {
      it('should render exactly 1 image slot', () => {
        manager._albumPages = [makePage('1')];
        manager._renderAlbumPages();
        expect(manager.albumPagesEl.querySelectorAll('.album-image-slot')).toHaveLength(1);
      });
    });

    describe('страница с layout "2" → 2 слота', () => {
      it('should render exactly 2 image slots', () => {
        manager._albumPages = [makePage('2')];
        manager._renderAlbumPages();
        expect(manager.albumPagesEl.querySelectorAll('.album-image-slot')).toHaveLength(2);
      });
    });

    describe('страница с layout "3"', () => {
      it('should render exactly 3 image slots', () => {
        manager._albumPages = [makePage('3')];
        manager._renderAlbumPages();
        expect(manager.albumPagesEl.querySelectorAll('.album-image-slot')).toHaveLength(3);
      });
    });

    describe('страница с layout "4"', () => {
      it('should render exactly 4 image slots', () => {
        manager._albumPages = [makePage('4')];
        manager._renderAlbumPages();
        expect(manager.albumPagesEl.querySelectorAll('.album-image-slot')).toHaveLength(4);
      });
    });

    describe('слот с изображением', () => {
      beforeEach(() => {
        manager._albumPages = [makePage('1', [makeImage('data:image/png;base64,abc')])];
        manager._renderAlbumPages();
      });

      it('should add has-image class to the slot', () => {
        const slot = manager.albumPagesEl.querySelector('.album-image-slot');
        expect(slot.classList.contains('has-image')).toBe(true);
      });

      it('should render an img element with the correct src', () => {
        const img = manager.albumPagesEl.querySelector('.album-image-slot-img');
        expect(img).not.toBeNull();
        expect(img.src).toContain('data:image/png');
      });

      it('should pre-fill caption input with image caption', () => {
        manager._albumPages = [makePage('1', [makeImage('data:image/png;base64,abc', 'Закат')])];
        manager._renderAlbumPages();
        const captionInput = manager.albumPagesEl.querySelector('.album-image-slot-caption');
        expect(captionInput.value).toBe('Закат');
      });
    });

    describe('слот без изображения', () => {
      beforeEach(() => {
        manager._albumPages = [makePage('1', [])];
        manager._renderAlbumPages();
      });

      it('should NOT add has-image class to the slot', () => {
        const slot = manager.albumPagesEl.querySelector('.album-image-slot');
        expect(slot.classList.contains('has-image')).toBe(false);
      });

      it('should NOT render an img element', () => {
        expect(manager.albumPagesEl.querySelector('.album-image-slot-img')).toBeNull();
      });

      it('should render a placeholder element', () => {
        expect(manager.albumPagesEl.querySelector('.album-image-slot-placeholder')).not.toBeNull();
      });
    });

    describe('перерендеринг очищает старый DOM', () => {
      it('should replace previous cards on re-render', () => {
        manager._albumPages = [makePage('1'), makePage('2')];
        manager._renderAlbumPages();
        manager._albumPages = [makePage('3')];
        manager._renderAlbumPages();
        expect(manager.albumPagesEl.querySelectorAll('.album-page-card')).toHaveLength(1);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _buildLayoutButtons()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_buildLayoutButtons()', () => {
    it('should generate 8 layout buttons', () => {
      const div = document.createElement('div');
      div.innerHTML = manager._buildLayoutButtons('1');
      expect(div.querySelectorAll('[data-layout]')).toHaveLength(8);
    });

    it('should mark exactly one button as active', () => {
      const div = document.createElement('div');
      div.innerHTML = manager._buildLayoutButtons('2');
      expect(div.querySelectorAll('.active')).toHaveLength(1);
    });

    it('should mark the correct layout as active', () => {
      const div = document.createElement('div');
      div.innerHTML = manager._buildLayoutButtons('3');
      const active = div.querySelector('.active');
      expect(active.dataset.layout).toBe('3');
    });

    it('should generate correct icon count for layout "1" (1 icon)', () => {
      const div = document.createElement('div');
      div.innerHTML = manager._buildLayoutButtons('1');
      const btn = div.querySelector('[data-layout="1"]');
      expect(btn.querySelectorAll('i')).toHaveLength(1);
    });

    it('should generate correct icon count for layout "4" (4 icons)', () => {
      const div = document.createElement('div');
      div.innerHTML = manager._buildLayoutButtons('4');
      const btn = div.querySelector('[data-layout="4"]');
      expect(btn.querySelectorAll('i')).toHaveLength(4);
    });

    it('should set data-layout attribute on each button', () => {
      const div = document.createElement('div');
      div.innerHTML = manager._buildLayoutButtons('1');
      const layouts = Array.from(div.querySelectorAll('[data-layout]')).map(b => b.dataset.layout);
      expect(layouts).toContain('1');
      expect(layouts).toContain('2');
      expect(layouts).toContain('2h');
      expect(layouts).toContain('4');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _getPageSlots() — общий помощник для _renderPageImageSlots и _buildAlbumHtml
  // ─────────────────────────────────────────────────────────────────────────

  describe('_getPageSlots()', () => {
    it('should return an array with length matching layout count', () => {
      expect(manager._getPageSlots(makePage('1', []))).toHaveLength(1);
      expect(manager._getPageSlots(makePage('2', []))).toHaveLength(2);
      expect(manager._getPageSlots(makePage('4', []))).toHaveLength(4);
    });

    it('should pad missing slots with null', () => {
      const slots = manager._getPageSlots(makePage('2', []));
      expect(slots[0]).toBeNull();
      expect(slots[1]).toBeNull();
    });

    it('should preserve existing images at their indices', () => {
      const img = makeImage('data:image/png;base64,abc', 'caption');
      const slots = manager._getPageSlots(makePage('2', [img]));
      expect(slots[0]).toBe(img);
      expect(slots[1]).toBeNull();
    });

    it('should truncate images beyond layout count', () => {
      const images = [makeImage('a'), makeImage('b'), makeImage('c')];
      const slots = manager._getPageSlots(makePage('1', images));
      expect(slots).toHaveLength(1);
      expect(slots[0].dataUrl).toBe('a');
    });

    it('should treat null entries as missing slots', () => {
      const slots = manager._getPageSlots(makePage('2', [null, null]));
      expect(slots[0]).toBeNull();
      expect(slots[1]).toBeNull();
    });

    it('should default to count=1 for unknown layout', () => {
      const slots = manager._getPageSlots(makePage('unknown', []));
      expect(slots).toHaveLength(1);
      expect(slots[0]).toBeNull();
    });

    it('should always return a new array (not page.images reference)', () => {
      const page = makePage('1', []);
      const slots = manager._getPageSlots(page);
      expect(slots).not.toBe(page.images);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // генерация HTML: _buildAlbumHtml()
  // ─────────────────────────────────────────────────────────────────────────

  describe('генерация HTML (_buildAlbumHtml)', () => {
    /** Обёртка: создать albumData из title и pages */
    function buildHtml(title, pages, hideTitle = false) {
      return manager._buildAlbumHtml({ title, hideTitle, pages });
    }

    it('should wrap output in <article>', () => {
      const html = buildHtml('T', [makePage()]);
      expect(html).toMatch(/^<article\b/);
      expect(html).toMatch(/<\/article>$/);
    });

    it('should include <h2> with album title', () => {
      const html = buildHtml('Горный поход', [makePage()]);
      expect(html).toContain('<h2>Горный поход</h2>');
    });

    it('should NOT add class to h2 when hideTitle is false', () => {
      const html = buildHtml('Название', [makePage()], false);
      expect(html).not.toContain('sr-only');
    });

    it('should add class="sr-only" to h2 when hideTitle is checked', () => {
      const html = buildHtml('Название', [makePage()], true);
      expect(html).toContain('class="sr-only"');
    });

    it('should include div.photo-album with correct data-layout', () => {
      const html = buildHtml('T', [makePage('2h')]);
      expect(html).toContain('data-layout="2h"');
    });

    describe('без изображений → пустые слоты фильтруются', () => {
      it('should NOT generate figure when image slot contains null', () => {
        const html = buildHtml('T', [makePage('1', [null])]);
        expect(html).not.toContain('<figure');
        expect(html).not.toContain('<img');
      });

      it('should NOT generate figure when images array is empty', () => {
        const html = buildHtml('T', [makePage('1', [])]);
        expect(html).not.toContain('<figure');
      });

      it('should skip all empty slots', () => {
        const html = buildHtml('T', [makePage('2', [])]);
        expect(html).not.toContain('<figure');
      });
    });

    describe('с изображениями → img с dataUrl', () => {
      it('should embed the dataUrl in the img src', () => {
        const pages = [makePage('1', [makeImage('data:image/png;base64,abc')])];
        const html = buildHtml('T', pages);
        expect(html).toContain('src="data:image/png;base64,abc"');
      });

      it('should NOT generate a placeholder figure when an image is present', () => {
        const pages = [makePage('1', [makeImage('data:image/png;base64,abc')])];
        const html = buildHtml('T', pages);
        expect(html).not.toContain('<img src="" alt="">');
      });

      it('should include figcaption when caption is set', () => {
        const pages = [makePage('1', [makeImage('data:image/png;base64,abc', 'Закат')])];
        const html = buildHtml('T', pages);
        expect(html).toContain('<figcaption>Закат</figcaption>');
      });

      it('should NOT include figcaption when caption is empty', () => {
        const pages = [makePage('1', [makeImage('data:image/png;base64,abc', '')])];
        const html = buildHtml('T', pages);
        expect(html).not.toContain('<figcaption>');
      });

      it('should only include images up to the layout count', () => {
        const pages = [makePage('1', [makeImage('first'), makeImage('second')])];
        const html = buildHtml('T', pages);
        expect(html).toContain('first');
        expect(html).not.toContain('second');
      });
    });

    describe('caption экранируется (XSS)', () => {
      it('should escape < and > in caption', () => {
        const pages = [makePage('1', [makeImage('data:image/png;base64,abc', '<b>bold</b>')])];
        const html = buildHtml('T', pages);
        expect(html).not.toContain('<b>');
        expect(html).toContain('&lt;b&gt;');
      });

      it('should escape <script> injection in caption', () => {
        const xss = '<script>alert("xss")</script>';
        const pages = [makePage('1', [makeImage('data:image/png;base64,abc', xss)])];
        const html = buildHtml('T', pages);
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
      });

      it('should escape quotes in caption (used in alt attribute)', () => {
        const pages = [makePage('1', [makeImage('data:image/png;base64,abc', '"quoted"')])];
        const html = buildHtml('T', pages);
        expect(html).not.toContain('"quoted"');
        expect(html).toContain('&quot;quoted&quot;');
      });

      it('should escape title for XSS protection', () => {
        const html = buildHtml('<script>alert(1)</script>', [makePage()]);
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
      });
    });

    describe('несколько страниц', () => {
      it('should generate one photo-album div per page', () => {
        const pages = [makePage('1'), makePage('2')];
        const html = buildHtml('T', pages);
        const matches = html.match(/class="photo-album"/g);
        expect(matches).toHaveLength(2);
      });

      it('should preserve each page data-layout', () => {
        const pages = [makePage('1'), makePage('4')];
        const html = buildHtml('T', pages);
        expect(html).toContain('data-layout="1"');
        expect(html).toContain('data-layout="4"');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _compressImage()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_compressImage()', () => {
    let mockCtx, mockCanvas, originalCreateElement, imgInstances;

    beforeEach(() => {
      imgInstances = [];

      // Мок canvas
      mockCtx = { drawImage: vi.fn() };
      mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => mockCtx),
        toDataURL: vi.fn(() => 'data:image/jpeg;base64,compressed'),
      };

      originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'canvas') return mockCanvas;
        return originalCreateElement(tag);
      });

      // Мок URL.createObjectURL / revokeObjectURL
      globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      globalThis.URL.revokeObjectURL = vi.fn();

      // Мок Image — класс-конструктор для ручного вызова onload/onerror
      globalThis.Image = class MockImage {
        constructor() {
          this.onload = null;
          this.onerror = null;
          this.src = '';
          this.naturalWidth = 800;
          this.naturalHeight = 600;
          imgInstances.push(this);
        }
      };
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    /** Создать mock-файл с указанным типом */
    function fakeFile(type = 'image/jpeg') {
      return new File(['data'], 'photo.jpg', { type });
    }

    /** Запустить _compressImage и немедленно вызвать onload с заданными размерами */
    function compressAndLoad(file, w = 800, h = 600) {
      const promise = manager._compressImage(file);
      const img = imgInstances[imgInstances.length - 1];
      img.naturalWidth = w;
      img.naturalHeight = h;
      img.onload();
      return promise;
    }

    // --- масштабирование ---

    it('should NOT scale images smaller than max dimension', async () => {
      await compressAndLoad(fakeFile(), 1000, 800);
      expect(mockCanvas.width).toBe(1000);
      expect(mockCanvas.height).toBe(800);
    });

    it('should NOT scale images exactly at max dimension', async () => {
      await compressAndLoad(fakeFile(), 1920, 1080);
      expect(mockCanvas.width).toBe(1920);
      expect(mockCanvas.height).toBe(1080);
    });

    it('should scale down landscape images exceeding max dimension', async () => {
      await compressAndLoad(fakeFile(), 3840, 2160);
      // ratio = 1920/3840 = 0.5
      expect(mockCanvas.width).toBe(1920);
      expect(mockCanvas.height).toBe(1080);
    });

    it('should scale down portrait images exceeding max dimension', async () => {
      await compressAndLoad(fakeFile(), 2160, 3840);
      // ratio = 1920/3840 = 0.5
      expect(mockCanvas.width).toBe(1080);
      expect(mockCanvas.height).toBe(1920);
    });

    it('should scale down square images exceeding max dimension', async () => {
      await compressAndLoad(fakeFile(), 4000, 4000);
      // ratio = 1920/4000 = 0.48
      expect(mockCanvas.width).toBe(1920);
      expect(mockCanvas.height).toBe(1920);
    });

    it('should scale when only width exceeds max dimension', async () => {
      await compressAndLoad(fakeFile(), 3000, 1000);
      // ratio = min(1920/3000, 1920/1000) = 0.64
      expect(mockCanvas.width).toBe(1920);
      expect(mockCanvas.height).toBe(640);
    });

    it('should scale when only height exceeds max dimension', async () => {
      await compressAndLoad(fakeFile(), 1000, 3000);
      // ratio = min(1920/1000, 1920/3000) = 0.64
      expect(mockCanvas.width).toBe(640);
      expect(mockCanvas.height).toBe(1920);
    });

    // --- формат вывода ---

    it('should output JPEG for JPEG input', async () => {
      await compressAndLoad(fakeFile('image/jpeg'));
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85);
    });

    it('should output JPEG for WebP input', async () => {
      await compressAndLoad(fakeFile('image/webp'));
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85);
    });

    it('should output PNG for PNG input (preserves transparency)', async () => {
      mockCanvas.toDataURL.mockReturnValue('data:image/png;base64,pngdata');
      await compressAndLoad(fakeFile('image/png'));
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/png');
    });

    // --- canvas drawImage ---

    it('should call drawImage with correct arguments', async () => {
      await compressAndLoad(fakeFile(), 800, 600);
      const img = imgInstances[0];
      expect(mockCtx.drawImage).toHaveBeenCalledWith(img, 0, 0, 800, 600);
    });

    // --- ресурсы ---

    it('should create an object URL from the file', async () => {
      const file = fakeFile();
      await compressAndLoad(file);
      expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    });

    it('should revoke the object URL on success', async () => {
      await compressAndLoad(fakeFile());
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should revoke the object URL on error', async () => {
      const promise = manager._compressImage(fakeFile());
      const img = imgInstances[0];
      img.onerror();
      await expect(promise).rejects.toThrow();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    // --- результат ---

    it('should resolve with the compressed data URL', async () => {
      mockCanvas.toDataURL.mockReturnValue('data:image/jpeg;base64,result123');
      const result = await compressAndLoad(fakeFile());
      expect(result).toBe('data:image/jpeg;base64,result123');
    });

    // --- ошибки ---

    it('should reject when image fails to load', async () => {
      const promise = manager._compressImage(fakeFile());
      const img = imgInstances[0];
      img.onerror();
      await expect(promise).rejects.toThrow('Не удалось загрузить изображение');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _readPageImageFile() — async с компрессией
  // ─────────────────────────────────────────────────────────────────────────

  describe('_readPageImageFile()', () => {
    beforeEach(() => {
      manager._albumPages = [makePage('1', [])];
    });

    it('should call _compressImage with the file', async () => {
      const spy = vi.spyOn(manager, '_compressImage').mockResolvedValue('data:image/jpeg;base64,ok');
      vi.spyOn(manager, '_renderAlbumPages').mockImplementation(() => {});
      const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
      await manager._readPageImageFile(file, 0, 0);
      expect(spy).toHaveBeenCalledWith(file);
    });

    it('should store the compressed data URL in the correct page/slot', async () => {
      vi.spyOn(manager, '_compressImage').mockResolvedValue('data:image/jpeg;base64,compressed');
      vi.spyOn(manager, '_renderAlbumPages').mockImplementation(() => {});
      await manager._readPageImageFile(new File(['x'], 'p.jpg', { type: 'image/jpeg' }), 0, 0);
      expect(manager._albumPages[0].images[0].dataUrl).toBe('data:image/jpeg;base64,compressed');
    });

    it('should preserve the existing caption', async () => {
      manager._albumPages = [makePage('1', [{ dataUrl: '', caption: 'Закат' }])];
      vi.spyOn(manager, '_compressImage').mockResolvedValue('data:image/jpeg;base64,new');
      vi.spyOn(manager, '_renderAlbumPages').mockImplementation(() => {});
      await manager._readPageImageFile(new File(['x'], 'p.jpg', { type: 'image/jpeg' }), 0, 0);
      expect(manager._albumPages[0].images[0].caption).toBe('Закат');
    });

    it('should default caption to empty string when no prior image', async () => {
      vi.spyOn(manager, '_compressImage').mockResolvedValue('data:image/jpeg;base64,ok');
      vi.spyOn(manager, '_renderAlbumPages').mockImplementation(() => {});
      await manager._readPageImageFile(new File(['x'], 'p.jpg', { type: 'image/jpeg' }), 0, 0);
      expect(manager._albumPages[0].images[0].caption).toBe('');
    });

    it('should call _renderAlbumPages after successful compression', async () => {
      vi.spyOn(manager, '_compressImage').mockResolvedValue('data:image/jpeg;base64,ok');
      const renderSpy = vi.spyOn(manager, '_renderAlbumPages').mockImplementation(() => {});
      await manager._readPageImageFile(new File(['x'], 'p.jpg', { type: 'image/jpeg' }), 0, 0);
      expect(renderSpy).toHaveBeenCalled();
    });

    it('should NOT crash when page was removed during compression', async () => {
      vi.spyOn(manager, '_compressImage').mockResolvedValue('data:image/jpeg;base64,ok');
      vi.spyOn(manager, '_renderAlbumPages').mockImplementation(() => {});
      manager._albumPages = []; // Страница удалена
      await expect(manager._readPageImageFile(new File(['x'], 'p.jpg', { type: 'image/jpeg' }), 0, 0)).resolves.toBeUndefined();
    });

    it('should show a toast when compression fails', async () => {
      vi.spyOn(manager, '_compressImage').mockRejectedValue(new Error('fail'));
      await manager._readPageImageFile(new File(['x'], 'p.jpg', { type: 'image/jpeg' }), 0, 0);
      expect(mockModule._showToast).toHaveBeenCalledWith('Ошибка при обработке изображения');
    });

    it('should NOT call _renderAlbumPages when compression fails', async () => {
      vi.spyOn(manager, '_compressImage').mockRejectedValue(new Error('fail'));
      const renderSpy = vi.spyOn(manager, '_renderAlbumPages').mockImplementation(() => {});
      await manager._readPageImageFile(new File(['x'], 'p.jpg', { type: 'image/jpeg' }), 0, 0);
      expect(renderSpy).not.toHaveBeenCalled();
    });

    it('should preserve existing frame, filter, and filterIntensity when replacing image', async () => {
      manager._albumPages = [makePage('1', [makeImage('old', 'cap', 'shadow', 'sepia', 60)])];
      vi.spyOn(manager, '_compressImage').mockResolvedValue('data:image/jpeg;base64,new');
      vi.spyOn(manager, '_renderAlbumPages').mockImplementation(() => {});
      await manager._readPageImageFile(new File(['x'], 'p.jpg', { type: 'image/jpeg' }), 0, 0);
      expect(manager._albumPages[0].images[0].frame).toBe('shadow');
      expect(manager._albumPages[0].images[0].filter).toBe('sepia');
      expect(manager._albumPages[0].images[0].filterIntensity).toBe(60);
    });

    it('should default frame, filter, and filterIntensity for new image', async () => {
      vi.spyOn(manager, '_compressImage').mockResolvedValue('data:image/jpeg;base64,ok');
      vi.spyOn(manager, '_renderAlbumPages').mockImplementation(() => {});
      await manager._readPageImageFile(new File(['x'], 'p.jpg', { type: 'image/jpeg' }), 0, 0);
      expect(manager._albumPages[0].images[0].frame).toBe('none');
      expect(manager._albumPages[0].images[0].filter).toBe('none');
      expect(manager._albumPages[0].images[0].filterIntensity).toBe(100);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _buildItemModifiers()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_buildItemModifiers()', () => {
    it('should return empty string when frame is "none"', () => {
      expect(manager._buildItemModifiers({ frame: 'none', filter: 'none' })).toBe('');
    });

    it('should return empty string when frame is absent', () => {
      expect(manager._buildItemModifiers({})).toBe('');
    });

    it('should add frame modifier class', () => {
      const result = manager._buildItemModifiers({ frame: 'shadow', filter: 'none' });
      expect(result).toBe(' photo-album__item--frame-shadow');
    });

    it('should add filter class', () => {
      const result = manager._buildItemModifiers({ frame: 'none', filter: 'sepia' });
      expect(result).toBe(' photo-album__item--filter-sepia');
    });

    it('should add both frame and filter classes when both are set', () => {
      const result = manager._buildItemModifiers({ frame: 'polaroid', filter: 'grayscale' });
      expect(result).toBe(' photo-album__item--frame-polaroid photo-album__item--filter-grayscale');
    });

    it('should handle all frame types', () => {
      for (const frame of ['thin', 'shadow', 'polaroid', 'rounded', 'double']) {
        const result = manager._buildItemModifiers({ frame, filter: 'none' });
        expect(result).toContain(`photo-album__item--frame-${frame}`);
      }
    });
  });

  describe('_buildImgInlineStyle()', () => {
    it('should return empty string when no rotation and no filter', () => {
      expect(manager._buildImgInlineStyle({ rotation: 0, filter: 'none' })).toBe('');
    });

    it('should include rotation', () => {
      expect(manager._buildImgInlineStyle({ rotation: 90, filter: 'none' })).toBe('transform:rotate(90deg)');
    });

    it('should include filter with intensity', () => {
      const result = manager._buildImgInlineStyle({ rotation: 0, filter: 'sepia', filterIntensity: 50 });
      expect(result).toContain('filter:sepia(');
    });

    it('should include both rotation and filter', () => {
      const result = manager._buildImgInlineStyle({ rotation: 180, filter: 'grayscale', filterIntensity: 100 });
      expect(result).toContain('transform:rotate(180deg)');
      expect(result).toContain('filter:grayscale(');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _buildOptionSelect()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_buildOptionSelect()', () => {
    const options = [
      { id: 'none', label: 'Нет' },
      { id: 'a', label: 'Опция A' },
      { id: 'b', label: 'Опция B' },
    ];

    it('should create a <select> element', () => {
      const select = manager._buildOptionSelect(options, 'none', () => {});
      expect(select.tagName).toBe('SELECT');
    });

    it('should have the correct CSS class', () => {
      const select = manager._buildOptionSelect(options, 'none', () => {});
      expect(select.classList.contains('album-image-option-select')).toBe(true);
    });

    it('should generate one <option> per item', () => {
      const select = manager._buildOptionSelect(options, 'none', () => {});
      expect(select.querySelectorAll('option')).toHaveLength(3);
    });

    it('should mark the active option as selected', () => {
      const select = manager._buildOptionSelect(options, 'b', () => {});
      expect(select.value).toBe('b');
    });

    it('should call onChange when value changes', () => {
      const cb = vi.fn();
      const select = manager._buildOptionSelect(options, 'none', cb);
      select.value = 'a';
      select.dispatchEvent(new Event('change'));
      expect(cb).toHaveBeenCalledWith('a');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _ensureImageData()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_ensureImageData()', () => {
    it('should create image data when slot is empty', () => {
      const page = makePage('1', []);
      manager._ensureImageData(page, 0);
      expect(page.images[0]).toEqual({ dataUrl: '', caption: '', frame: 'none', filter: 'none', filterIntensity: 100, rotation: 0 });
    });

    it('should not overwrite existing image data', () => {
      const img = makeImage('data:img', 'cap', 'shadow', 'sepia', 50);
      const page = makePage('1', [img]);
      manager._ensureImageData(page, 0);
      expect(page.images[0]).toBe(img);
    });

    it('should create data when slot is null', () => {
      const page = makePage('1', [null]);
      manager._ensureImageData(page, 0);
      expect(page.images[0]).toEqual({ dataUrl: '', caption: '', frame: 'none', filter: 'none', filterIntensity: 100, rotation: 0 });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Рамки и фильтры в рендеринге и HTML-генерации
  // ─────────────────────────────────────────────────────────────────────────

  describe('рамки и фильтры', () => {
    describe('рендеринг слотов', () => {
      it('should render frame and filter select elements per slot', () => {
        manager._albumPages = [makePage('1', [makeImage()])];
        manager._renderAlbumPages();
        const selects = manager.albumPagesEl.querySelectorAll('.album-image-option-select');
        expect(selects).toHaveLength(2); // frame + filter
      });

      it('should render 4 selects for layout "2" (2 slots × 2 selects)', () => {
        manager._albumPages = [makePage('2', [makeImage(), makeImage()])];
        manager._renderAlbumPages();
        const selects = manager.albumPagesEl.querySelectorAll('.album-image-option-select');
        expect(selects).toHaveLength(4);
      });

      it('should set frame select to current value', () => {
        manager._albumPages = [makePage('1', [makeImage('d', 'c', 'shadow', 'none')])];
        manager._renderAlbumPages();
        const selects = manager.albumPagesEl.querySelectorAll('.album-image-option-select');
        expect(selects[0].value).toBe('shadow');
      });

      it('should set filter select to current value', () => {
        manager._albumPages = [makePage('1', [makeImage('d', 'c', 'none', 'sepia')])];
        manager._renderAlbumPages();
        const selects = manager.albumPagesEl.querySelectorAll('.album-image-option-select');
        expect(selects[1].value).toBe('sepia');
      });

      it('should default both selects to "none" for empty image', () => {
        manager._albumPages = [makePage('1', [])];
        manager._renderAlbumPages();
        const selects = manager.albumPagesEl.querySelectorAll('.album-image-option-select');
        expect(selects[0].value).toBe('none');
        expect(selects[1].value).toBe('none');
      });

      it('should wrap selects in .album-image-options container', () => {
        manager._albumPages = [makePage('1', [makeImage()])];
        manager._renderAlbumPages();
        const row = manager.albumPagesEl.querySelector('.album-image-options');
        expect(row).not.toBeNull();
        expect(row.querySelectorAll('.album-image-option-select')).toHaveLength(2);
      });
    });

    describe('HTML-генерация с рамками и фильтрами', () => {
      /** Обёртка для тестов рамок/фильтров */
      function buildHtml(title, pages) {
        return manager._buildAlbumHtml({ title, hideTitle: false, pages });
      }

      it('should NOT add modifier classes or inline style when frame and filter are "none"', () => {
        const pages = [makePage('1', [makeImage('data:img', '', 'none', 'none')])];
        const html = buildHtml('T', pages);
        expect(html).toContain('class="photo-album__item"');
        expect(html).not.toContain('--frame-');
        expect(html).not.toContain('style=');
      });

      it('should add frame modifier class to figure', () => {
        const pages = [makePage('1', [makeImage('data:img', '', 'shadow', 'none')])];
        const html = buildHtml('T', pages);
        expect(html).toContain('photo-album__item photo-album__item--frame-shadow');
      });

      it('should add filter as inline style and class modifier on img', () => {
        const pages = [makePage('1', [makeImage('data:img', '', 'none', 'sepia', 100)])];
        const html = buildHtml('T', pages);
        expect(html).toContain('style="filter:sepia(');
        expect(html).toContain('photo-album__item--filter-sepia');
        expect(html).toContain('data-filter="sepia"');
        expect(html).toContain('data-filter-intensity="100"');
      });

      it('should add frame class and filter inline style together', () => {
        const pages = [makePage('1', [makeImage('data:img', '', 'polaroid', 'grayscale', 100)])];
        const html = buildHtml('T', pages);
        expect(html).toContain('photo-album__item--frame-polaroid');
        expect(html).toContain('style="filter:grayscale(');
      });

      it('should skip empty slots (no placeholder figures)', () => {
        const pages = [makePage('1', [null])];
        const html = buildHtml('T', pages);
        expect(html).not.toContain('<figure');
      });

      it('should handle images without frame/filter properties (backwards compat)', () => {
        const pages = [makePage('1', [{ dataUrl: 'data:img', caption: '' }])];
        const html = buildHtml('T', pages);
        expect(html).toContain('class="photo-album__item"');
        expect(html).not.toContain('--frame-');
        expect(html).not.toContain('style=');
      });

      it('should apply filter intensity via inline style', () => {
        const pages = [makePage('1', [makeImage('data:img', '', 'none', 'grayscale', 50)])];
        const html = buildHtml('T', pages);
        expect(html).toContain('style="filter:grayscale(0.5)"');
      });

      it('should add filter inline style even when intensity is 0', () => {
        const pages = [makePage('1', [makeImage('data:img', '', 'none', 'grayscale', 0)])];
        const html = buildHtml('T', pages);
        expect(html).toContain('style="filter:grayscale(0)"');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _computeFilterStyle()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_computeFilterStyle()', () => {
    it('should return empty string for "none" filter', () => {
      expect(manager._computeFilterStyle('none', 100)).toBe('');
    });

    it('should return empty string for falsy filter', () => {
      expect(manager._computeFilterStyle(null, 100)).toBe('');
      expect(manager._computeFilterStyle(undefined, 100)).toBe('');
      expect(manager._computeFilterStyle('', 100)).toBe('');
    });

    it('should return empty string for unknown filter', () => {
      expect(manager._computeFilterStyle('unknown', 100)).toBe('');
    });

    // --- grayscale ---
    it('should compute grayscale at 100%', () => {
      expect(manager._computeFilterStyle('grayscale', 100)).toBe('grayscale(1)');
    });

    it('should compute grayscale at 50%', () => {
      expect(manager._computeFilterStyle('grayscale', 50)).toBe('grayscale(0.5)');
    });

    it('should compute grayscale at 0%', () => {
      expect(manager._computeFilterStyle('grayscale', 0)).toBe('grayscale(0)');
    });

    // --- sepia ---
    it('should compute sepia at 100% (max 0.75)', () => {
      expect(manager._computeFilterStyle('sepia', 100)).toBe('sepia(0.75)');
    });

    it('should compute sepia at 50%', () => {
      expect(manager._computeFilterStyle('sepia', 50)).toBe('sepia(0.375)');
    });

    it('should compute sepia at 0%', () => {
      expect(manager._computeFilterStyle('sepia', 0)).toBe('sepia(0)');
    });

    // --- contrast ---
    it('should compute contrast at 100% (1.35)', () => {
      expect(manager._computeFilterStyle('contrast', 100)).toBe('contrast(1.35)');
    });

    it('should compute contrast at 0% (1.0)', () => {
      expect(manager._computeFilterStyle('contrast', 0)).toBe('contrast(1)');
    });

    it('should compute contrast at 50%', () => {
      expect(manager._computeFilterStyle('contrast', 50)).toBe('contrast(1.175)');
    });

    // --- warm ---
    it('should compute warm at 100%', () => {
      const result = manager._computeFilterStyle('warm', 100);
      expect(result).toContain('saturate(1.3)');
      expect(result).toContain('hue-rotate(-10deg)');
    });

    it('should compute warm at 0%', () => {
      const result = manager._computeFilterStyle('warm', 0);
      expect(result).toContain('saturate(1)');
      expect(result).toContain('hue-rotate(0deg)');
    });

    // --- cool ---
    it('should compute cool at 100%', () => {
      const result = manager._computeFilterStyle('cool', 100);
      expect(result).toContain('saturate(1.1)');
      expect(result).toContain('hue-rotate(15deg)');
      expect(result).toContain('brightness(1.05)');
    });

    it('should compute cool at 0%', () => {
      const result = manager._computeFilterStyle('cool', 0);
      expect(result).toContain('saturate(1)');
      expect(result).toContain('hue-rotate(0deg)');
      expect(result).toContain('brightness(1)');
    });

    // --- clamp ---
    it('should clamp intensity above 100 to 100', () => {
      expect(manager._computeFilterStyle('grayscale', 200)).toBe('grayscale(1)');
    });

    it('should clamp intensity below 0 to 0', () => {
      expect(manager._computeFilterStyle('grayscale', -50)).toBe('grayscale(0)');
    });

    // --- default intensity ---
    it('should default to 100 when intensity is undefined', () => {
      expect(manager._computeFilterStyle('grayscale', undefined)).toBe('grayscale(1)');
    });

    it('should default to 100 when intensity is null', () => {
      expect(manager._computeFilterStyle('grayscale', null)).toBe('grayscale(1)');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _applyFilterPreview()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_applyFilterPreview()', () => {
    it('should set filter style on the img element', () => {
      const slot = document.createElement('div');
      const imgEl = document.createElement('img');
      imgEl.className = 'album-image-slot-img';
      slot.appendChild(imgEl);

      manager._applyFilterPreview(slot, { filter: 'grayscale', filterIntensity: 100 });
      expect(imgEl.style.filter).toBe('grayscale(1)');
    });

    it('should clear filter style when filter is "none"', () => {
      const slot = document.createElement('div');
      const imgEl = document.createElement('img');
      imgEl.className = 'album-image-slot-img';
      imgEl.style.filter = 'grayscale(1)';
      slot.appendChild(imgEl);

      manager._applyFilterPreview(slot, { filter: 'none', filterIntensity: 100 });
      expect(imgEl.style.filter).toBe('');
    });

    it('should do nothing when no img element exists', () => {
      const slot = document.createElement('div');
      // No throw
      expect(() => manager._applyFilterPreview(slot, { filter: 'sepia', filterIntensity: 50 })).not.toThrow();
    });

    it('should handle null img data', () => {
      const slot = document.createElement('div');
      const imgEl = document.createElement('img');
      imgEl.className = 'album-image-slot-img';
      slot.appendChild(imgEl);

      manager._applyFilterPreview(slot, null);
      expect(imgEl.style.filter).toBe('');
    });

    it('should apply reduced intensity', () => {
      const slot = document.createElement('div');
      const imgEl = document.createElement('img');
      imgEl.className = 'album-image-slot-img';
      slot.appendChild(imgEl);

      manager._applyFilterPreview(slot, { filter: 'sepia', filterIntensity: 40 });
      expect(imgEl.style.filter).toBe('sepia(0.3)');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Слайдер интенсивности фильтра
  // ─────────────────────────────────────────────────────────────────────────

  describe('интенсивность фильтра', () => {
    describe('рендеринг слайдера', () => {
      it('should render intensity slider per slot', () => {
        manager._albumPages = [makePage('1', [makeImage()])];
        manager._renderAlbumPages();
        const sliders = manager.albumPagesEl.querySelectorAll('.album-filter-intensity');
        expect(sliders).toHaveLength(1);
      });

      it('should hide intensity slider when filter is "none"', () => {
        manager._albumPages = [makePage('1', [makeImage('d', 'c', 'none', 'none')])];
        manager._renderAlbumPages();
        const slider = manager.albumPagesEl.querySelector('.album-filter-intensity');
        expect(slider.hidden).toBe(true);
      });

      it('should show intensity slider when filter is set', () => {
        manager._albumPages = [makePage('1', [makeImage('d', 'c', 'none', 'sepia', 75)])];
        manager._renderAlbumPages();
        const slider = manager.albumPagesEl.querySelector('.album-filter-intensity');
        expect(slider.hidden).toBe(false);
      });

      it('should set range input to current intensity value', () => {
        manager._albumPages = [makePage('1', [makeImage('d', 'c', 'none', 'sepia', 60)])];
        manager._renderAlbumPages();
        const range = manager.albumPagesEl.querySelector('.album-filter-intensity-range');
        expect(range.value).toBe('60');
      });

      it('should show intensity label with percentage', () => {
        manager._albumPages = [makePage('1', [makeImage('d', 'c', 'none', 'sepia', 60)])];
        manager._renderAlbumPages();
        const label = manager.albumPagesEl.querySelector('.album-filter-intensity-label');
        expect(label.textContent).toBe('60%');
      });

      it('should default to 100% when filterIntensity is not set', () => {
        manager._albumPages = [makePage('1', [{ dataUrl: 'd', caption: '', frame: 'none', filter: 'sepia' }])];
        manager._renderAlbumPages();
        const range = manager.albumPagesEl.querySelector('.album-filter-intensity-range');
        expect(range.value).toBe('100');
      });

      it('should render 2 intensity sliders for layout "2"', () => {
        manager._albumPages = [makePage('2', [makeImage(), makeImage()])];
        manager._renderAlbumPages();
        const sliders = manager.albumPagesEl.querySelectorAll('.album-filter-intensity');
        expect(sliders).toHaveLength(2);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _movePageUp / _movePageDown
  // ─────────────────────────────────────────────────────────────────────────

  describe('_movePageUp()', () => {
    it('should swap page with previous', () => {
      manager._albumPages = [
        makePage('1', [makeImage('a')]),
        makePage('2', [makeImage('b'), makeImage('c')]),
      ];

      manager._movePageUp(1);

      expect(manager._albumPages[0].layout).toBe('2');
      expect(manager._albumPages[1].layout).toBe('1');
      expect(manager._isDirty).toBe(true);
    });

    it('should do nothing for first page', () => {
      manager._albumPages = [makePage('1'), makePage('2')];

      manager._movePageUp(0);

      expect(manager._albumPages[0].layout).toBe('1');
      expect(manager._albumPages[1].layout).toBe('2');
    });
  });

  describe('_movePageDown()', () => {
    it('should swap page with next', () => {
      manager._albumPages = [
        makePage('1', [makeImage('a')]),
        makePage('2', [makeImage('b')]),
      ];

      manager._movePageDown(0);

      expect(manager._albumPages[0].layout).toBe('2');
      expect(manager._albumPages[1].layout).toBe('1');
      expect(manager._isDirty).toBe(true);
    });

    it('should do nothing for last page', () => {
      manager._albumPages = [makePage('1'), makePage('2')];

      manager._movePageDown(1);

      expect(manager._albumPages[0].layout).toBe('1');
      expect(manager._albumPages[1].layout).toBe('2');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _rotatePageImage()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_rotatePageImage()', () => {
    it('should rotate image by 90 degrees', () => {
      manager._albumPages = [makePage('1', [makeImage()])];
      manager._albumPages[0].images[0].rotation = 0;

      manager._rotatePageImage(0, 0);

      expect(manager._albumPages[0].images[0].rotation).toBe(90);
      expect(manager._isDirty).toBe(true);
    });

    it('should cycle through rotation values', () => {
      manager._albumPages = [makePage('1', [makeImage()])];
      manager._albumPages[0].images[0].rotation = 270;

      manager._rotatePageImage(0, 0);

      expect(manager._albumPages[0].images[0].rotation).toBe(0);
    });

    it('should do nothing for empty image slot', () => {
      manager._albumPages = [makePage('1', [null])];

      manager._rotatePageImage(0, 0);

      expect(manager._albumPages[0].images[0]).toBeNull();
    });

    it('should do nothing for invalid page index', () => {
      manager._albumPages = [makePage('1', [makeImage()])];

      manager._rotatePageImage(5, 0);
    });
  });

});
