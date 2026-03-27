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

    it('should set _sourceElement to null so preWarm skips', () => {
      renderer.setPaginationData(createMockPageData(5));
      renderer.clearCache();
      expect(renderer._sourceElement).toBeNull();
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

  describe('_resetBufferAttributes', () => {
    it('should set data-active="true" on leftActive and rightActive', () => {
      // Constructor calls _resetBufferAttributes, check the result
      expect(mockElements.leftActive.dataset.active).toBe('true');
      expect(mockElements.rightActive.dataset.active).toBe('true');
    });

    it('should remove data-buffer from leftActive and rightActive', () => {
      mockElements.leftActive.dataset.buffer = 'true';
      mockElements.rightActive.dataset.buffer = 'true';

      // Re-create to trigger _resetBufferAttributes
      const r = new BookRenderer({ ...mockElements });
      expect(mockElements.leftActive.dataset.buffer).toBeUndefined();
      expect(mockElements.rightActive.dataset.buffer).toBeUndefined();
    });

    it('should set data-buffer="true" on leftBuffer and rightBuffer', () => {
      expect(mockElements.leftBuffer.dataset.buffer).toBe('true');
      expect(mockElements.rightBuffer.dataset.buffer).toBe('true');
    });

    it('should remove data-active from leftBuffer and rightBuffer', () => {
      mockElements.leftBuffer.dataset.active = 'true';
      mockElements.rightBuffer.dataset.active = 'true';

      const r = new BookRenderer({ ...mockElements });
      expect(mockElements.leftBuffer.dataset.active).toBeUndefined();
      expect(mockElements.rightBuffer.dataset.active).toBeUndefined();
    });

    it('should handle null elements gracefully', () => {
      expect(() => new BookRenderer({
        leftActive: null,
        rightActive: mockElements.rightActive,
        leftBuffer: mockElements.leftBuffer,
        rightBuffer: mockElements.rightBuffer,
        sheetFront: mockElements.sheetFront,
        sheetBack: mockElements.sheetBack,
      })).not.toThrow();
    });
  });

  describe('_trackLoadedImage', () => {
    it('should not add duplicate URLs', () => {
      renderer.loadedImageUrls.add('http://example.com/a.jpg');
      renderer._trackLoadedImage('http://example.com/a.jpg');
      expect(renderer.loadedImageUrls.size).toBe(1);
    });

    it('should add new URL to set', () => {
      renderer._trackLoadedImage('http://example.com/new.jpg');
      expect(renderer.loadedImageUrls.has('http://example.com/new.jpg')).toBe(true);
    });

    it('should evict oldest URL when cache limit exceeded', () => {
      // Fill up to limit (100)
      for (let i = 0; i < 100; i++) {
        renderer._trackLoadedImage(`http://example.com/${i}.jpg`);
      }
      expect(renderer.loadedImageUrls.size).toBe(100);

      // Adding one more should evict the first
      renderer._trackLoadedImage('http://example.com/new.jpg');
      expect(renderer.loadedImageUrls.size).toBe(100);
      expect(renderer.loadedImageUrls.has('http://example.com/0.jpg')).toBe(false);
      expect(renderer.loadedImageUrls.has('http://example.com/new.jpg')).toBe(true);
    });

  });

  describe('_setupImageBlurPlaceholders - complete image with naturalWidth', () => {
    it('should skip placeholder for complete images with naturalWidth > 0 and track URL', () => {
      const container = document.createElement('div');
      const img = document.createElement('img');
      Object.defineProperty(img, 'complete', { value: true });
      Object.defineProperty(img, 'naturalWidth', { value: 200 });
      img.src = 'http://example.com/cached.jpg';
      container.appendChild(img);

      renderer._setupImageBlurPlaceholders(container);

      expect(img.dataset.loading).toBe('false');
      expect(renderer.loadedImageUrls.has('http://example.com/cached.jpg')).toBe(true);
    });

    it('should not skip if complete but naturalWidth is 0 (broken image)', () => {
      const container = document.createElement('div');
      const img = document.createElement('img');
      Object.defineProperty(img, 'complete', { value: true });
      Object.defineProperty(img, 'naturalWidth', { value: 0 });
      img.src = 'http://example.com/broken.jpg';
      container.appendChild(img);

      renderer._setupImageBlurPlaceholders(container);

      // Should set loading=true because naturalWidth is 0
      expect(img.dataset.loading).toBe('true');
    });
  });

  describe('fill - boundary condition', () => {
    it('should clear container when pageIndex equals totalPages', () => {
      renderer.setPaginationData(createMockPageData(5));

      const container = document.createElement('div');
      const page = document.createElement('div');
      page.classList.add('page');
      page.appendChild(container);

      renderer.fill(container, 5); // index === totalPages, should be invalid
      expect(container.children.length).toBe(0);
    });

    it('should render last valid page at totalPages - 1', () => {
      renderer.setPaginationData(createMockPageData(5));

      const container = document.createElement('div');
      const page = document.createElement('div');
      page.classList.add('page');
      page.appendChild(container);

      renderer.fill(container, 4); // last valid index
      expect(container.children.length).toBe(1);
    });
  });

  describe('prepareBuffer - index arithmetic', () => {
    beforeEach(() => {
      renderer.setPaginationData(createMockPageData(10));
    });

    it('should fill leftBuffer with index and rightBuffer with index+1 on desktop', () => {
      const fillSpy = vi.spyOn(renderer, 'fill');
      renderer.prepareBuffer(4, false);

      expect(fillSpy).toHaveBeenCalledWith(mockElements.leftBuffer, 4);
      expect(fillSpy).toHaveBeenCalledWith(mockElements.rightBuffer, 5);
    });

    it('should clear leftBuffer and fill rightBuffer with index on mobile', () => {
      const fillSpy = vi.spyOn(renderer, 'fill');
      renderer.prepareBuffer(3, true);

      expect(fillSpy).toHaveBeenCalledWith(mockElements.rightBuffer, 3);
      // leftBuffer cleared (replaceChildren)
      expect(mockElements.leftBuffer.children.length).toBe(0);
    });
  });

  describe('prepareSheet - index arithmetic', () => {
    beforeEach(() => {
      renderer.setPaginationData(createMockPageData(10));
    });

    it('should fill sheetFront=currentIndex, sheetBack=nextIndex on mobile', () => {
      const fillSpy = vi.spyOn(renderer, 'fill');
      renderer.prepareSheet(3, 4, 'next', true);

      expect(fillSpy).toHaveBeenCalledWith(mockElements.sheetFront, 3);
      expect(fillSpy).toHaveBeenCalledWith(mockElements.sheetBack, 4);
    });

    it('should fill sheetFront=current+1, sheetBack=current+2 for desktop next', () => {
      const fillSpy = vi.spyOn(renderer, 'fill');
      renderer.prepareSheet(2, 4, 'next', false);

      expect(fillSpy).toHaveBeenCalledWith(mockElements.sheetFront, 3); // current+1
      expect(fillSpy).toHaveBeenCalledWith(mockElements.sheetBack, 4);  // current+2
    });

    it('should fill sheetFront=current, sheetBack=current-1 for desktop prev', () => {
      const fillSpy = vi.spyOn(renderer, 'fill');
      renderer.prepareSheet(4, 2, 'prev', false);

      expect(fillSpy).toHaveBeenCalledWith(mockElements.sheetFront, 4); // current
      expect(fillSpy).toHaveBeenCalledWith(mockElements.sheetBack, 3);  // current-1
    });
  });

  describe('renderSpread - currentPageIndex tracking', () => {
    it('should update _currentPageIndex for pre-warm', () => {
      renderer.setPaginationData(createMockPageData(10));
      renderer.renderSpread(6, false);
      expect(renderer._currentPageIndex).toBe(6);
    });
  });

  describe('_schedulePreWarm', () => {
    it('should not schedule twice (dedup via _preWarmScheduled flag)', () => {
      renderer.setPaginationData(createMockPageData(5));

      const rafSpy = vi.spyOn(global, 'requestAnimationFrame').mockImplementation(() => 1);

      renderer._schedulePreWarm();
      renderer._schedulePreWarm();
      renderer._schedulePreWarm();

      // Should only be called once due to _preWarmScheduled guard
      expect(rafSpy).toHaveBeenCalledTimes(1);
      rafSpy.mockRestore();
    });

    it('should reset _preWarmScheduled flag in doWarm callback before calling _preWarmViewports', () => {
      renderer.setPaginationData(createMockPageData(5));

      let capturedFn;
      const rafSpy = vi.spyOn(global, 'requestAnimationFrame').mockImplementation(fn => {
        capturedFn = fn;
        return 1;
      });

      // Stub _preWarmViewports to prevent re-scheduling
      const preWarmSpy = vi.spyOn(renderer, '_preWarmViewports').mockImplementation(() => {});

      renderer._schedulePreWarm();
      expect(renderer._preWarmScheduled).toBe(true);

      // Execute the callback — it resets flag, then calls _preWarmViewports
      capturedFn();
      expect(renderer._preWarmScheduled).toBe(false);
      expect(preWarmSpy).toHaveBeenCalled();

      rafSpy.mockRestore();
      preWarmSpy.mockRestore();
    });
  });

  describe('_preWarmViewports', () => {
    it('should skip if no _sourceElement', () => {
      renderer._sourceElement = null;
      // Should not throw
      expect(() => renderer._preWarmViewports()).not.toThrow();
    });

    it('should skip if elements is null', () => {
      renderer.elements = null;
      renderer._sourceElement = document.createElement('div');
      expect(() => renderer._preWarmViewports()).not.toThrow();
    });

    it('should create viewport for first empty container', () => {
      renderer.setPaginationData(createMockPageData(5));
      // Clear all viewports
      renderer._clearAllViewports();

      // Mock _schedulePreWarm to prevent recursive scheduling
      const scheduleSpy = vi.spyOn(renderer, '_schedulePreWarm').mockImplementation(() => {});

      renderer._preWarmViewports();

      // sheetFront is first in priority order, should get a viewport
      expect(mockElements.sheetFront.firstElementChild?._isBookViewport).toBe(true);
      expect(scheduleSpy).toHaveBeenCalled();

      scheduleSpy.mockRestore();
    });

    it('should skip containers that already have viewports', () => {
      renderer.setPaginationData(createMockPageData(5));
      // Fill all — they all get viewports
      renderer.fill(mockElements.leftActive, 0);
      renderer.fill(mockElements.rightActive, 1);
      renderer.fill(mockElements.leftBuffer, 0);
      renderer.fill(mockElements.rightBuffer, 1);
      renderer.fill(mockElements.sheetFront, 0);
      renderer.fill(mockElements.sheetBack, 1);

      const scheduleSpy = vi.spyOn(renderer, '_schedulePreWarm');

      renderer._preWarmViewports();

      // All containers already warmed — no more scheduling needed
      expect(scheduleSpy).not.toHaveBeenCalled();
      scheduleSpy.mockRestore();
    });
  });

  describe('destroy', () => {
    it('should reset _preWarmScheduled to false', () => {
      renderer._preWarmScheduled = true;
      renderer.destroy();
      expect(renderer._preWarmScheduled).toBe(false);
    });

    it('should reset _currentPageIndex to 0', () => {
      renderer._currentPageIndex = 42;
      renderer.destroy();
      expect(renderer._currentPageIndex).toBe(0);
    });

    it('should clear loadedImageUrls', () => {
      renderer.loadedImageUrls.add('http://example.com/a.jpg');
      renderer.destroy();
      expect(renderer.loadedImageUrls.size).toBe(0);
    });

    it('should set _sourceElement to null', () => {
      renderer.setPaginationData(createMockPageData(5));
      renderer.destroy();
      expect(renderer._sourceElement).toBeNull();
    });

    it('should reset _totalPages to 0', () => {
      renderer.setPaginationData(createMockPageData(10));
      renderer.destroy();
      expect(renderer._totalPages).toBe(0);
    });

    it('should reset _pageWidth and _pageHeight to 0', () => {
      renderer.setPaginationData(createMockPageData(5, 300, 500));
      renderer.destroy();
      expect(renderer._pageWidth).toBe(0);
      expect(renderer._pageHeight).toBe(0);
    });

    it('should reset _hasTOC to false', () => {
      renderer.setPaginationData(createMockPageData(5, 400, 600, true));
      renderer.destroy();
      expect(renderer._hasTOC).toBe(false);
    });

    it('should set elements to null', () => {
      renderer.destroy();
      expect(renderer.elements).toBeNull();
    });

    it('should clear all viewports before nullifying elements', () => {
      renderer.setPaginationData(createMockPageData(5));
      renderer.fill(mockElements.leftActive, 0);
      expect(mockElements.leftActive.children.length).toBe(1);

      renderer.destroy();
      expect(mockElements.leftActive.children.length).toBe(0);
    });
  });

});
