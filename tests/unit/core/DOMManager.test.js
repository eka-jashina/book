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
});
