/**
 * Unit tests for BookRenderer
 * Page rendering with double buffering and viewport reuse
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookRenderer } from '../../../js/core/BookRenderer.js';

/**
 * Создать mock pageData для тестирования.
 * Имитирует результат AsyncPaginator._buildPageData().
 */
function createMockPageData(pageCount, pageWidth = 400, pageHeight = 600, hasTOC = false) {
  const cols = document.createElement('div');
  cols.className = 'cols';

  const flow = document.createElement('div');
  const pageContent = document.createElement('div');
  pageContent.className = 'page-content';

  for (let i = 0; i < pageCount; i++) {
    const p = document.createElement('p');
    p.textContent = `Page ${i}`;
    pageContent.appendChild(p);
  }

  flow.appendChild(pageContent);
  cols.appendChild(flow);

  return { sourceElement: cols, pageCount, pageWidth, pageHeight, hasTOC };
}

describe('BookRenderer', () => {
  let renderer;
  let mockElements;

  beforeEach(() => {
    // Create mock DOM elements
    mockElements = {
      leftActive: document.createElement('div'),
      rightActive: document.createElement('div'),
      leftBuffer: document.createElement('div'),
      rightBuffer: document.createElement('div'),
      sheetFront: document.createElement('div'),
      sheetBack: document.createElement('div'),
    };

    // Wrap elements in pages for classList.toggle test
    Object.values(mockElements).forEach(el => {
      const page = document.createElement('div');
      page.classList.add('page');
      page.appendChild(el);
    });

    renderer = new BookRenderer({
      ...mockElements,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with zero total pages', () => {
      expect(renderer.totalPages).toBe(0);
    });

    it('should initialize empty loadedImageUrls set', () => {
      expect(renderer.loadedImageUrls).toBeInstanceOf(Set);
      expect(renderer.loadedImageUrls.size).toBe(0);
    });

    it('should store element references', () => {
      expect(renderer.elements.leftActive).toBe(mockElements.leftActive);
      expect(renderer.elements.rightActive).toBe(mockElements.rightActive);
    });
  });

  describe('setPaginationData', () => {
    it('should update totalPages from pagination data', () => {
      const pageData = createMockPageData(10);
      renderer.setPaginationData(pageData);
      expect(renderer.totalPages).toBe(10);
    });

    it('should clear all viewports when setting new data', () => {
      const pageData = createMockPageData(3);
      renderer.setPaginationData(pageData);
      renderer.fill(mockElements.leftActive, 0);
      expect(mockElements.leftActive.children.length).toBe(1);

      renderer.setPaginationData(createMockPageData(5));
      expect(mockElements.leftActive.children.length).toBe(0);
    });

    it('should clear loadedImageUrls to prevent memory leaks', () => {
      renderer.loadedImageUrls.add('http://example.com/image.jpg');
      renderer.setPaginationData(null);
      expect(renderer.loadedImageUrls.size).toBe(0);
    });

    it('should handle null pageData', () => {
      renderer.setPaginationData(null);
      expect(renderer.totalPages).toBe(0);
    });

    it('should store hasTOC flag', () => {
      renderer.setPaginationData(createMockPageData(3, 400, 600, true));
      expect(renderer._hasTOC).toBe(true);
    });
  });

  describe('fill', () => {
    let container;

    beforeEach(() => {
      renderer.setPaginationData(createMockPageData(3));

      container = document.createElement('div');
      const page = document.createElement('div');
      page.classList.add('page');
      page.appendChild(container);
    });

    it('should do nothing if container is null', () => {
      expect(() => renderer.fill(null, 0)).not.toThrow();
    });

    it('should fill container with viewport on first call', () => {
      renderer.fill(container, 0);
      expect(container.children.length).toBe(1);
      expect(container.firstElementChild._isBookViewport).toBe(true);
    });

    it('should clear container if page does not exist', () => {
      container.innerHTML = '<p>Old content</p>';
      renderer.fill(container, 100);
      expect(container.children.length).toBe(0);
    });

    it('should reuse existing viewport on subsequent calls (translateX only)', () => {
      renderer.fill(container, 0);
      const viewport = container.firstElementChild;

      renderer.fill(container, 2);
      // Same viewport element reused
      expect(container.firstElementChild).toBe(viewport);
      // translateX updated
      expect(viewport.firstChild.style.transform).toBe('translate3d(-800px, 0px, 0px)');
    });

    it('should set correct translateX based on page index', () => {
      renderer.fill(container, 1);
      const inner = container.firstElementChild.firstChild;
      expect(inner.style.transform).toBe('translate3d(-400px, 0px, 0px)');
    });

    it('should add page--toc class when hasTOC and pageIndex is 0', () => {
      renderer.setPaginationData(createMockPageData(3, 400, 600, true));

      renderer.fill(container, 0);
      const page = container.closest('.page');
      expect(page.classList.contains('page--toc')).toBe(true);
    });

    it('should not add page--toc class when hasTOC but pageIndex is not 0', () => {
      renderer.setPaginationData(createMockPageData(3, 400, 600, true));

      renderer.fill(container, 1);
      const page = container.closest('.page');
      expect(page.classList.contains('page--toc')).toBe(false);
    });

    it('should remove page--toc class when page has no TOC', () => {
      const page = container.closest('.page');
      page.classList.add('page--toc');

      renderer.fill(container, 0);
      expect(page.classList.contains('page--toc')).toBe(false);
    });

    it('should remove page--toc on invalid index', () => {
      const page = container.closest('.page');
      page.classList.add('page--toc');

      renderer.fill(container, -1);
      expect(page.classList.contains('page--toc')).toBe(false);
    });

    it('should clear container for negative index', () => {
      renderer.fill(container, 0);
      expect(container.children.length).toBe(1);

      renderer.fill(container, -1);
      expect(container.children.length).toBe(0);
    });
  });

  describe('_createViewport', () => {
    it('should create viewport with correct dimensions', () => {
      renderer.setPaginationData(createMockPageData(5, 300, 500));
      const viewport = renderer._createViewport(0);
      expect(viewport.style.width).toBe('300px');
      expect(viewport.style.height).toBe('500px');
      expect(viewport.style.overflow).toBe('hidden');
    });

    it('should mark viewport with _isBookViewport flag', () => {
      renderer.setPaginationData(createMockPageData(5));
      const viewport = renderer._createViewport(0);
      expect(viewport._isBookViewport).toBe(true);
    });

    it('should set translateX based on page index', () => {
      renderer.setPaginationData(createMockPageData(5, 300, 500));
      const viewport = renderer._createViewport(2);
      const inner = viewport.firstChild;
      expect(inner.style.transform).toBe('translate3d(-600px, 0px, 0px)');
    });

    it('should set inner width based on total pages', () => {
      renderer.setPaginationData(createMockPageData(5, 300, 500));
      const viewport = renderer._createViewport(0);
      const inner = viewport.firstChild;
      expect(inner.style.width).toBe('1500px'); // 5 * 300
    });
  });

  describe('_clearAllViewports', () => {
    it('should clear all containers', () => {
      renderer.setPaginationData(createMockPageData(4));
      renderer.fill(mockElements.leftActive, 0);
      renderer.fill(mockElements.rightActive, 1);

      renderer._clearAllViewports();

      expect(mockElements.leftActive.children.length).toBe(0);
      expect(mockElements.rightActive.children.length).toBe(0);
    });
  });

  describe('_setupImageBlurPlaceholders', () => {
    it('should set data-loading="false" for already loaded images', () => {
      const container = document.createElement('div');
      const img = document.createElement('img');
      img.src = 'http://example.com/loaded.jpg';
      renderer.loadedImageUrls.add('http://example.com/loaded.jpg');
      container.appendChild(img);

      renderer._setupImageBlurPlaceholders(container);
      expect(img.dataset.loading).toBe('false');
    });

    it('should set data-loading="true" for images being loaded', () => {
      const container = document.createElement('div');
      const img = document.createElement('img');
      Object.defineProperty(img, 'complete', { value: false });
      img.src = 'http://example.com/loading.jpg';
      container.appendChild(img);

      renderer._setupImageBlurPlaceholders(container);
      expect(img.dataset.loading).toBe('true');
    });

    it('should add image URL to loadedImageUrls on load', () => {
      const container = document.createElement('div');
      const img = document.createElement('img');
      Object.defineProperty(img, 'complete', { value: false });
      img.src = 'http://example.com/new.jpg';
      container.appendChild(img);

      renderer._setupImageBlurPlaceholders(container);

      img.dispatchEvent(new Event('load'));

      expect(renderer.loadedImageUrls.has('http://example.com/new.jpg')).toBe(true);
      expect(img.dataset.loading).toBe('false');
    });

    it('should handle error by setting data-loading="false"', () => {
      const container = document.createElement('div');
      const img = document.createElement('img');
      Object.defineProperty(img, 'complete', { value: false });
      img.src = 'http://example.com/error.jpg';
      container.appendChild(img);

      renderer._setupImageBlurPlaceholders(container);

      img.dispatchEvent(new Event('error'));

      expect(img.dataset.loading).toBe('false');
    });
  });

  describe('renderSpread', () => {
    beforeEach(() => {
      renderer.setPaginationData(createMockPageData(4));
    });

    it('should clear pages when no content', () => {
      renderer.setPaginationData(null);
      renderer.renderSpread(0, false);
      expect(mockElements.leftActive.children.length).toBe(0);
      expect(mockElements.rightActive.children.length).toBe(0);
    });

    describe('desktop mode (isMobile=false)', () => {
      it('should render left and right pages', () => {
        renderer.renderSpread(0, false);
        expect(mockElements.leftActive.children.length).toBe(1);
        expect(mockElements.rightActive.children.length).toBe(1);
      });

      it('should render spread at index 2', () => {
        renderer.renderSpread(2, false);
        expect(mockElements.leftActive.children.length).toBe(1);
        expect(mockElements.rightActive.children.length).toBe(1);
      });
    });

    describe('mobile mode (isMobile=true)', () => {
      it('should clear left and show current page on right', () => {
        renderer.renderSpread(0, true);
        expect(mockElements.leftActive.children.length).toBe(0);
        expect(mockElements.rightActive.children.length).toBe(1);
      });

      it('should show page at current index', () => {
        renderer.renderSpread(2, true);
        expect(mockElements.rightActive.children.length).toBe(1);
      });
    });
  });

  describe('prepareBuffer', () => {
    beforeEach(() => {
      renderer.setPaginationData(createMockPageData(4));
    });

    describe('desktop mode', () => {
      it('should prepare buffer with next spread', () => {
        renderer.prepareBuffer(2, false);
        expect(mockElements.leftBuffer.children.length).toBe(1);
        expect(mockElements.rightBuffer.children.length).toBe(1);
      });
    });

    describe('mobile mode', () => {
      it('should clear left buffer and fill right with page', () => {
        renderer.prepareBuffer(1, true);
        expect(mockElements.leftBuffer.children.length).toBe(0);
        expect(mockElements.rightBuffer.children.length).toBe(1);
      });
    });
  });

  describe('prepareSheet', () => {
    beforeEach(() => {
      renderer.setPaginationData(createMockPageData(4));
    });

    describe('mobile mode', () => {
      it('should fill sheet with current and next pages', () => {
        renderer.prepareSheet(0, 1, 'next', true);
        expect(mockElements.sheetFront.children.length).toBe(1);
        expect(mockElements.sheetBack.children.length).toBe(1);
      });
    });

    describe('desktop mode - next direction', () => {
      it('should fill sheet with right page of current spread and left of next', () => {
        renderer.prepareSheet(0, 2, 'next', false);
        expect(mockElements.sheetFront.children.length).toBe(1);
        expect(mockElements.sheetBack.children.length).toBe(1);
      });
    });

    describe('desktop mode - prev direction', () => {
      it('should fill sheet for prev direction', () => {
        renderer.prepareSheet(2, 0, 'prev', false);
        expect(mockElements.sheetFront.children.length).toBe(1);
        expect(mockElements.sheetBack.children.length).toBe(1);
      });
    });
  });

  describe('swapBuffers', () => {
    it('should swap active and buffer references', () => {
      const originalLeftActive = renderer.elements.leftActive;
      const originalRightActive = renderer.elements.rightActive;
      const originalLeftBuffer = renderer.elements.leftBuffer;
      const originalRightBuffer = renderer.elements.rightBuffer;

      renderer.swapBuffers();

      expect(renderer.elements.leftActive).toBe(originalLeftBuffer);
      expect(renderer.elements.rightActive).toBe(originalRightBuffer);
      expect(renderer.elements.leftBuffer).toBe(originalLeftActive);
      expect(renderer.elements.rightBuffer).toBe(originalRightActive);
    });

    it('should update data-buffer attributes', () => {
      renderer.swapBuffers();

      expect(mockElements.leftActive.dataset.buffer).toBe('true');
      expect(mockElements.rightActive.dataset.buffer).toBe('true');
      expect(mockElements.leftBuffer.dataset.buffer).toBe('false');
      expect(mockElements.rightBuffer.dataset.buffer).toBe('false');
    });

    it('should update data-active attributes', () => {
      renderer.swapBuffers();

      expect(mockElements.leftActive.dataset.active).toBe('false');
      expect(mockElements.rightActive.dataset.active).toBe('false');
      expect(mockElements.leftBuffer.dataset.active).toBe('true');
      expect(mockElements.rightBuffer.dataset.active).toBe('true');
    });
  });

  describe('clearCache', () => {
    it('should clear all viewports', () => {
      renderer.setPaginationData(createMockPageData(3));
      renderer.fill(mockElements.leftActive, 0);
      expect(mockElements.leftActive.children.length).toBe(1);

      renderer.clearCache();
      expect(mockElements.leftActive.children.length).toBe(0);
    });
  });

  describe('getMaxIndex', () => {
    beforeEach(() => {
      renderer.setPaginationData(createMockPageData(10));
    });

    it('should return last index for mobile', () => {
      expect(renderer.getMaxIndex(true)).toBe(9);
    });

    it('should return last even index for desktop', () => {
      expect(renderer.getMaxIndex(false)).toBe(8);
    });

    it('should return 0 for desktop with 1 page', () => {
      renderer.setPaginationData(createMockPageData(1));
      expect(renderer.getMaxIndex(false)).toBe(0);
    });

    it('should return 0 for desktop with 2 pages', () => {
      renderer.setPaginationData(createMockPageData(2));
      expect(renderer.getMaxIndex(false)).toBe(0);
    });

    it('should return 0 for mobile with 1 page', () => {
      renderer.setPaginationData(createMockPageData(1));
      expect(renderer.getMaxIndex(true)).toBe(0);
    });
  });

  describe('totalPages', () => {
    it('should return 0 when no pagination data set', () => {
      expect(renderer.totalPages).toBe(0);
    });

    it('should return page count from pagination data', () => {
      renderer.setPaginationData(createMockPageData(42));
      expect(renderer.totalPages).toBe(42);
    });

    it('should return 0 after setting null pagination data', () => {
      renderer.setPaginationData(createMockPageData(10));
      renderer.setPaginationData(null);
      expect(renderer.totalPages).toBe(0);
    });
  });

  describe('viewport reuse performance', () => {
    it('should not call cloneNode on subsequent fills to same container', () => {
      renderer.setPaginationData(createMockPageData(10));

      // First fill creates viewport
      renderer.fill(mockElements.leftActive, 0);
      const viewport = mockElements.leftActive.firstElementChild;
      const inner = viewport.firstChild;
      const cloneSpy = vi.spyOn(renderer._sourceElement, 'cloneNode');

      // Subsequent fills reuse viewport — no cloneNode
      renderer.fill(mockElements.leftActive, 5);
      expect(cloneSpy).not.toHaveBeenCalled();
      expect(inner.style.transform).toBe('translate3d(-2000px, 0px, 0px)');
    });
  });
});
