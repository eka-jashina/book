/**
 * Тесты для DOMManager
 * Централизованное кэширование DOM элементов
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DOMManager } from '../../../js/core/DOMManager.js';

describe('DOMManager', () => {
  let mockElements;
  let getElementByIdSpy;
  let querySelectorSpy;

  beforeEach(() => {
    // Create mock elements for all required IDs
    mockElements = {};
    const elementIds = [
      'book', 'book-wrap', 'cover',
      'leftA', 'rightA', 'leftB', 'rightB',
      'sheet', 'sheetFront', 'sheetBack',
      'flipShadow', 'loadingOverlay', 'loadingProgress',
      'next', 'prev', 'tocBtn', 'continueBtn',
      'current-page', 'total-pages', 'reading-progress',
      'increase', 'decrease', 'font-size-value', 'font-select',
      'debugToggle', 'sound-toggle', 'volume-slider', 'page-volume-control',
      'ambient-volume', 'ambient-volume-wrapper', 'settings-checkbox',
      'fullscreen-btn', 'debugInfo', 'debugState', 'debugTotal',
      'debugCurrent', 'debugCache', 'debugMemory', 'debugListeners',
    ];

    elementIds.forEach(id => {
      mockElements[id] = document.createElement('div');
      mockElements[id].id = id;
    });

    // Mock getElementById
    getElementByIdSpy = vi.spyOn(document, 'getElementById').mockImplementation(
      (id) => mockElements[id] || null
    );

    // Mock querySelector
    querySelectorSpy = vi.spyOn(document, 'querySelector').mockImplementation(
      (selector) => {
        if (selector === '.theme-segmented') return document.createElement('div');
        if (selector === '.ambient-pills') return document.createElement('div');
        return null;
      }
    );
  });

  afterEach(() => {
    getElementByIdSpy.mockRestore();
    querySelectorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should cache DOM elements', () => {
      const dom = new DOMManager();
      expect(dom.elements).toBeDefined();
      expect(dom.elements.book).toBe(mockElements['book']);
    });

    it('should throw if critical elements are missing', () => {
      mockElements['book'] = null;
      expect(() => new DOMManager()).toThrow('Critical DOM elements missing: book');
    });

    it('should list all missing critical elements', () => {
      mockElements['book'] = null;
      mockElements['leftA'] = null;
      mockElements['sheet'] = null;
      expect(() => new DOMManager()).toThrow(/book.*leftA.*sheet/);
    });
  });

  describe('get', () => {
    it('should return element by key', () => {
      const dom = new DOMManager();
      expect(dom.get('book')).toBe(mockElements['book']);
    });

    it('should return null for unknown key', () => {
      const dom = new DOMManager();
      expect(dom.get('nonexistent')).toBeNull();
    });

    it('should return null for undefined key', () => {
      const dom = new DOMManager();
      expect(dom.get(undefined)).toBeNull();
    });
  });

  describe('getMultiple', () => {
    it('should return multiple elements', () => {
      const dom = new DOMManager();
      const result = dom.getMultiple('book', 'cover', 'sheet');

      expect(result.book).toBe(mockElements['book']);
      expect(result.cover).toBe(mockElements['cover']);
      expect(result.sheet).toBe(mockElements['sheet']);
    });

    it('should include undefined for missing elements', () => {
      const dom = new DOMManager();
      const result = dom.getMultiple('book', 'nonexistent');

      expect(result.book).toBe(mockElements['book']);
      expect(result.nonexistent).toBeUndefined();
    });

    it('should return empty object for no keys', () => {
      const dom = new DOMManager();
      const result = dom.getMultiple();
      expect(result).toEqual({});
    });
  });

  describe('clearPages', () => {
    it('should clear innerHTML of all page elements', () => {
      const dom = new DOMManager();

      // Set some content
      dom.elements.leftA.innerHTML = '<p>Content</p>';
      dom.elements.rightA.innerHTML = '<p>Content</p>';
      dom.elements.leftB.innerHTML = '<p>Content</p>';
      dom.elements.rightB.innerHTML = '<p>Content</p>';
      dom.elements.sheetFront.innerHTML = '<p>Content</p>';
      dom.elements.sheetBack.innerHTML = '<p>Content</p>';

      dom.clearPages();

      expect(dom.elements.leftA.innerHTML).toBe('');
      expect(dom.elements.rightA.innerHTML).toBe('');
      expect(dom.elements.leftB.innerHTML).toBe('');
      expect(dom.elements.rightB.innerHTML).toBe('');
      expect(dom.elements.sheetFront.innerHTML).toBe('');
      expect(dom.elements.sheetBack.innerHTML).toBe('');
    });

    it('should not fail if some elements are null', () => {
      const dom = new DOMManager();
      dom.elements.leftB = null;

      expect(() => dom.clearPages()).not.toThrow();
    });
  });

  describe('_cacheElements', () => {
    it('should include html and body', () => {
      const dom = new DOMManager();
      expect(dom.elements.html).toBe(document.documentElement);
      expect(dom.elements.body).toBe(document.body);
    });
  });

  describe('_cacheElements - element ID mapping', () => {
    it.each([
      ['book', 'book'],
      ['bookWrap', 'book-wrap'],
      ['cover', 'cover'],
      ['leftA', 'leftA'],
      ['rightA', 'rightA'],
      ['leftB', 'leftB'],
      ['rightB', 'rightB'],
      ['sheet', 'sheet'],
      ['sheetFront', 'sheetFront'],
      ['sheetBack', 'sheetBack'],
      ['flipShadow', 'flipShadow'],
      ['loadingOverlay', 'loadingOverlay'],
      ['loadingProgress', 'loadingProgress'],
      ['nextBtn', 'next'],
      ['prevBtn', 'prev'],
      ['tocBtn', 'tocBtn'],
      ['continueBtn', 'continueBtn'],
      ['currentPage', 'current-page'],
      ['totalPages', 'total-pages'],
      ['readingProgress', 'reading-progress'],
      ['increaseBtn', 'increase'],
      ['decreaseBtn', 'decrease'],
      ['fontSizeValue', 'font-size-value'],
      ['fontSelect', 'font-select'],
      ['debugToggle', 'debugToggle'],
      ['soundToggle', 'sound-toggle'],
      ['volumeSlider', 'volume-slider'],
      ['pageVolumeControl', 'page-volume-control'],
      ['ambientVolume', 'ambient-volume'],
      ['ambientVolumeWrapper', 'ambient-volume-wrapper'],
      ['settingsCheckbox', 'settings-checkbox'],
      ['fullscreenBtn', 'fullscreen-btn'],
      ['debugInfo', 'debugInfo'],
      ['debugState', 'debugState'],
      ['debugTotal', 'debugTotal'],
      ['debugCurrent', 'debugCurrent'],
      ['debugCache', 'debugCache'],
      ['debugMemory', 'debugMemory'],
      ['debugListeners', 'debugListeners'],
    ])('should map "%s" to element with id "%s"', (key, id) => {
      const dom = new DOMManager();
      expect(dom.elements[key]).toBe(mockElements[id]);
    });

    it('should query ".theme-segmented" for themeSegmented', () => {
      const dom = new DOMManager();
      expect(querySelectorSpy).toHaveBeenCalledWith('.theme-segmented');
      expect(dom.elements.themeSegmented).toBeTruthy();
    });

    it('should query ".ambient-pills" for ambientPills', () => {
      const dom = new DOMManager();
      expect(querySelectorSpy).toHaveBeenCalledWith('.ambient-pills');
      expect(dom.elements.ambientPills).toBeTruthy();
    });
  });

  describe('resetBookDOM', () => {
    let dom;

    beforeEach(() => {
      dom = new DOMManager();
    });

    it('should set bookWrap.dataset.state to "closed"', () => {
      dom.elements.bookWrap.dataset.state = 'opened';
      dom.resetBookDOM();
      expect(dom.elements.bookWrap.dataset.state).toBe('closed');
    });

    it('should set book.dataset.state to "closed"', () => {
      dom.elements.book.dataset.state = 'opening';
      dom.resetBookDOM();
      expect(dom.elements.book.dataset.state).toBe('closed');
    });

    it('should delete cover.dataset.animation', () => {
      dom.elements.cover.dataset.animation = 'opening';
      dom.resetBookDOM();
      expect(dom.elements.cover.dataset.animation).toBeUndefined();
    });

    it('should delete sheet.dataset.phase and direction', () => {
      dom.elements.sheet.dataset.phase = 'rotate';
      dom.elements.sheet.dataset.direction = 'next';
      dom.resetBookDOM();
      expect(dom.elements.sheet.dataset.phase).toBeUndefined();
      expect(dom.elements.sheet.dataset.direction).toBeUndefined();
    });

    it('should restore leftA as active (data-active=true, no data-buffer)', () => {
      dom.elements.leftA.dataset.buffer = 'true';
      dom.elements.leftA.dataset.active = 'false';
      dom.resetBookDOM();
      expect(dom.elements.leftA.dataset.active).toBe('true');
      expect(dom.elements.leftA.dataset.buffer).toBeUndefined();
    });

    it('should restore rightA as active (data-active=true, no data-buffer)', () => {
      dom.elements.rightA.dataset.buffer = 'true';
      dom.elements.rightA.dataset.active = 'false';
      dom.resetBookDOM();
      expect(dom.elements.rightA.dataset.active).toBe('true');
      expect(dom.elements.rightA.dataset.buffer).toBeUndefined();
    });

    it('should restore leftB as buffer (data-buffer=true, no data-active)', () => {
      dom.elements.leftB.dataset.active = 'true';
      dom.elements.leftB.dataset.buffer = 'false';
      dom.resetBookDOM();
      expect(dom.elements.leftB.dataset.buffer).toBe('true');
      expect(dom.elements.leftB.dataset.active).toBeUndefined();
    });

    it('should restore rightB as buffer (data-buffer=true, no data-active)', () => {
      dom.elements.rightB.dataset.active = 'true';
      dom.elements.rightB.dataset.buffer = 'false';
      dom.resetBookDOM();
      expect(dom.elements.rightB.dataset.buffer).toBe('true');
      expect(dom.elements.rightB.dataset.active).toBeUndefined();
    });

    it('should clear content of all page and sheet elements', () => {
      dom.elements.leftA.innerHTML = '<p>Content</p>';
      dom.elements.rightA.innerHTML = '<p>Content</p>';
      dom.elements.leftB.innerHTML = '<p>Content</p>';
      dom.elements.rightB.innerHTML = '<p>Content</p>';
      dom.elements.sheetFront.innerHTML = '<p>Content</p>';
      dom.elements.sheetBack.innerHTML = '<p>Content</p>';

      dom.resetBookDOM();

      expect(dom.elements.leftA.children.length).toBe(0);
      expect(dom.elements.rightA.children.length).toBe(0);
      expect(dom.elements.leftB.children.length).toBe(0);
      expect(dom.elements.rightB.children.length).toBe(0);
      expect(dom.elements.sheetFront.children.length).toBe(0);
      expect(dom.elements.sheetBack.children.length).toBe(0);
    });

    it('should handle null elements gracefully (no throw)', () => {
      dom.elements.cover = null;
      dom.elements.sheet = null;
      dom.elements.leftB = null;
      expect(() => dom.resetBookDOM()).not.toThrow();
    });
  });

  describe('_validateElements', () => {
    it('should require bookWrap as critical element', () => {
      mockElements['book-wrap'] = null;
      expect(() => new DOMManager()).toThrow(/bookWrap/);
    });

    it('should require sheetFront as critical element', () => {
      mockElements['sheetFront'] = null;
      expect(() => new DOMManager()).toThrow(/sheetFront/);
    });

    it('should require sheetBack as critical element', () => {
      mockElements['sheetBack'] = null;
      expect(() => new DOMManager()).toThrow(/sheetBack/);
    });

    it('should require rightA as critical element', () => {
      mockElements['rightA'] = null;
      expect(() => new DOMManager()).toThrow(/rightA/);
    });

    it('should not throw when all critical elements exist', () => {
      expect(() => new DOMManager()).not.toThrow();
    });
  });
});
