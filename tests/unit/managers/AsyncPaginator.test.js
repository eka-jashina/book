/**
 * Тесты для AsyncPaginator
 * Асинхронная пагинация HTML-контента
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AsyncPaginator } from '../../../js/managers/AsyncPaginator.js';

// Mock mediaQueries
vi.mock('../../../js/utils/MediaQueryManager.js', () => ({
  mediaQueries: {
    get: vi.fn().mockReturnValue(false), // desktop by default
  },
}));

describe('AsyncPaginator', () => {
  let paginator;
  let mockSanitizer;
  let mockMeasureElement;

  beforeEach(() => {
    vi.useFakeTimers();

    mockSanitizer = {
      sanitize: vi.fn((html) => html),
    };

    mockMeasureElement = {
      clientWidth: 400,
      clientHeight: 600,
    };

    paginator = new AsyncPaginator({
      sanitizer: mockSanitizer,
      chunkSize: 2,
      yieldInterval: 16,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use provided sanitizer', () => {
      expect(paginator.sanitizer).toBe(mockSanitizer);
    });

    it('should use provided chunkSize', () => {
      expect(paginator.chunkSize).toBe(2);
    });

    it('should use provided yieldInterval', () => {
      expect(paginator.yieldInterval).toBe(16);
    });

    it('should use default chunkSize if not provided', () => {
      const p = new AsyncPaginator({ sanitizer: mockSanitizer });
      expect(p.chunkSize).toBe(5);
    });

    it('should use default yieldInterval if not provided', () => {
      const p = new AsyncPaginator({ sanitizer: mockSanitizer });
      expect(p.yieldInterval).toBe(16);
    });

    it('should initialize null abortController', () => {
      expect(paginator.abortController).toBeNull();
    });

    it('should extend EventEmitter', () => {
      expect(typeof paginator.on).toBe('function');
      expect(typeof paginator.emit).toBe('function');
    });
  });

  describe('abort', () => {
    it('should call abort on controller', () => {
      const abortSpy = vi.fn();
      paginator.abortController = { abort: abortSpy };

      paginator.abort();

      expect(abortSpy).toHaveBeenCalled();
    });

    it('should set controller to null', () => {
      paginator.abortController = new AbortController();
      paginator.abort();
      expect(paginator.abortController).toBeNull();
    });

    it('should not fail if no controller', () => {
      expect(() => paginator.abort()).not.toThrow();
    });
  });

  describe('_yieldToUI', () => {
    it('should resolve after yieldInterval', async () => {
      const promise = paginator._yieldToUI(null);
      await vi.advanceTimersByTimeAsync(16);
      await expect(promise).resolves.toBeUndefined();
    });

    it('should reject if signal already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(paginator._yieldToUI(controller.signal))
        .rejects.toThrow('Aborted');
    });

    it('should reject on abort during wait', async () => {
      const controller = new AbortController();
      const promise = paginator._yieldToUI(controller.signal);

      controller.abort();

      await expect(promise).rejects.toThrow('Aborted');
    });

    it('should clear timeout on abort', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const controller = new AbortController();

      const promise = paginator._yieldToUI(controller.signal);
      controller.abort();

      try {
        await promise;
      } catch (e) {
        // expected
      }

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('_createPaginationContainer', () => {
    it('should create container with correct dimensions', () => {
      const result = paginator._createPaginationContainer(mockMeasureElement);

      expect(result.pageWidth).toBe(400);
      expect(result.pageHeight).toBe(600);
    });

    it('should create hidden container', () => {
      const result = paginator._createPaginationContainer(mockMeasureElement);

      expect(result.container.style.left).toBe('-99999px');
      expect(result.container.style.position).toBe('absolute');
    });

    it('should create columnLayout with column-width', () => {
      const result = paginator._createPaginationContainer(mockMeasureElement);

      expect(result.columnLayout.style.columnWidth).toBe('400px');
      expect(result.columnLayout.className).toBe('cols');
    });

    it('should create pageContent container', () => {
      const result = paginator._createPaginationContainer(mockMeasureElement);

      expect(result.pageContent.className).toBe('page-content');
    });

    it('should nest elements correctly', () => {
      const result = paginator._createPaginationContainer(mockMeasureElement);

      expect(result.container.contains(result.columnLayout)).toBe(true);
      expect(result.columnLayout.querySelector('.page-content')).toBe(result.pageContent);
    });
  });

  describe('_addTOC', () => {
    it('should create TOC section', () => {
      const pageContent = document.createElement('div');
      const articles = [
        createMockArticle('Chapter 1'),
        createMockArticle('Chapter 2'),
      ];

      paginator._addTOC(pageContent, articles);

      const toc = pageContent.querySelector('.toc');
      expect(toc).not.toBeNull();
    });

    it('should add TOC title', () => {
      const pageContent = document.createElement('div');
      const articles = [createMockArticle('Test')];

      paginator._addTOC(pageContent, articles);

      const title = pageContent.querySelector('.toc h2');
      expect(title.textContent).toBe('Содержание');
    });

    it('should add list items for each chapter', () => {
      const pageContent = document.createElement('div');
      const articles = [
        createMockArticle('Chapter 1'),
        createMockArticle('Chapter 2'),
        createMockArticle('Chapter 3'),
      ];

      paginator._addTOC(pageContent, articles);

      const items = pageContent.querySelectorAll('.toc ol li');
      expect(items.length).toBe(3);
    });

    it('should set chapter data attribute', () => {
      const pageContent = document.createElement('div');
      const articles = [
        createMockArticle('First'),
        createMockArticle('Second'),
      ];

      paginator._addTOC(pageContent, articles);

      const items = pageContent.querySelectorAll('.toc ol li');
      expect(items[0].dataset.chapter).toBe('0');
      expect(items[1].dataset.chapter).toBe('1');
    });

    it('should set accessibility attributes', () => {
      const pageContent = document.createElement('div');
      const articles = [createMockArticle('Test')];

      paginator._addTOC(pageContent, articles);

      const item = pageContent.querySelector('.toc ol li');
      expect(item.getAttribute('tabindex')).toBe('0');
      expect(item.getAttribute('role')).toBe('button');
    });

    it('should skip articles without h2', () => {
      const pageContent = document.createElement('div');
      const articleWithH2 = createMockArticle('With Title');
      const articleWithoutH2 = document.createElement('article');
      articleWithoutH2.innerHTML = '<p>No title</p>';

      paginator._addTOC(pageContent, [articleWithH2, articleWithoutH2]);

      const items = pageContent.querySelectorAll('.toc ol li');
      expect(items.length).toBe(1);
    });

    it('should set breakAfter on TOC', () => {
      const pageContent = document.createElement('div');
      const articles = [createMockArticle('Test')];

      paginator._addTOC(pageContent, articles);

      const toc = pageContent.querySelector('.toc');
      expect(toc.style.breakAfter).toBe('column');
    });
  });

  describe('_addArticlesChunk', () => {
    it('should add marker before each article', () => {
      const pageContent = document.createElement('div');
      const articles = [
        createMockArticle('Chapter 1'),
        createMockArticle('Chapter 2'),
      ];

      paginator._addArticlesChunk(pageContent, articles, 0);

      const markers = pageContent.querySelectorAll('[data-chapter-start]');
      expect(markers.length).toBe(2);
    });

    it('should set correct chapter index', () => {
      const pageContent = document.createElement('div');
      const articles = [createMockArticle('Test')];

      paginator._addArticlesChunk(pageContent, articles, 5);

      const marker = pageContent.querySelector('[data-chapter-start]');
      expect(marker.dataset.chapterStart).toBe('5');
    });

    it('should clone articles', () => {
      const pageContent = document.createElement('div');
      const original = createMockArticle('Original');
      original.id = 'original-id';

      paginator._addArticlesChunk(pageContent, [original], 0);

      const cloned = pageContent.querySelector('article');
      expect(cloned).not.toBe(original);
      expect(cloned.getAttribute('id')).toBeNull();
    });

    it('should set marker breakBefore', () => {
      const pageContent = document.createElement('div');
      const articles = [createMockArticle('Test')];

      paginator._addArticlesChunk(pageContent, articles, 0);

      const marker = pageContent.querySelector('[data-chapter-start]');
      expect(marker.style.breakBefore).toBe('column');
    });

    it('should set article margin to 0', () => {
      const pageContent = document.createElement('div');
      const articles = [createMockArticle('Test')];

      paginator._addArticlesChunk(pageContent, articles, 0);

      const article = pageContent.querySelector('article');
      expect(article.style.margin).toBe('0px');
    });
  });

  describe('_calculateChapterStarts', () => {
    it('should calculate page indices from markers', () => {
      const container = document.createElement('div');
      const pageWidth = 100;

      const marker1 = document.createElement('div');
      marker1.dataset.chapterStart = '0';
      Object.defineProperty(marker1, 'offsetLeft', { value: 0 });

      const marker2 = document.createElement('div');
      marker2.dataset.chapterStart = '1';
      Object.defineProperty(marker2, 'offsetLeft', { value: 200 });

      container.appendChild(marker1);
      container.appendChild(marker2);

      const result = paginator._calculateChapterStarts(container, pageWidth);

      expect(result).toEqual([0, 2]);
    });
  });

  describe('paginate', () => {
    it('should emit start event', async () => {
      const startHandler = vi.fn();
      paginator.on('start', startHandler);

      const html = '<article><h2>Test</h2><p>Content</p></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);

      // Advance through all yields
      await advancePagination();
      await paginatePromise;

      expect(startHandler).toHaveBeenCalled();
    });

    it('should call sanitizer', async () => {
      const html = '<article><h2>Test</h2></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);
      await advancePagination();
      await paginatePromise;

      expect(mockSanitizer.sanitize).toHaveBeenCalledWith(html);
    });

    it('should emit progress events', async () => {
      const progressHandler = vi.fn();
      paginator.on('progress', progressHandler);

      const html = '<article><h2>Test</h2></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);
      await advancePagination();
      await paginatePromise;

      expect(progressHandler).toHaveBeenCalled();
      const phases = progressHandler.mock.calls.map(c => c[0].phase);
      expect(phases).toContain('sanitize');
      expect(phases).toContain('parse');
    });

    it('should return empty result and warn if no articles', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const html = '<div>No articles here</div>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);
      await advancePagination();
      const result = await paginatePromise;

      expect(result.pageData).toBeNull();
      expect(result.chapterStarts).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith('No articles found');
    });

    it('should abort previous pagination', async () => {
      const abortSpy = vi.fn();
      paginator.abortController = { abort: abortSpy };

      const html = '<article><h2>Test</h2></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);
      await advancePagination();
      await paginatePromise;

      expect(abortSpy).toHaveBeenCalled();
    });

    it('should create new AbortController', async () => {
      const html = '<article><h2>Test</h2></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);

      expect(paginator.abortController).toBeInstanceOf(AbortController);

      await advancePagination();
      await paginatePromise;
    });

    it('should emit complete event', async () => {
      const completeHandler = vi.fn();
      paginator.on('complete', completeHandler);

      const html = '<article><h2>Test</h2></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);
      await advancePagination();
      await paginatePromise;

      expect(completeHandler).toHaveBeenCalled();
    });

    it('should emit abort event on abort', async () => {
      const abortHandler = vi.fn();
      paginator.on('abort', abortHandler);

      const html = '<article><h2>Test</h2></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);

      // Abort immediately
      paginator.abort();
      await advancePagination();

      await paginatePromise;
      expect(abortHandler).toHaveBeenCalled();
    });

    it('should throw error on failure (no duplicate error event)', async () => {
      const errorHandler = vi.fn();
      paginator.on('error', errorHandler);

      mockSanitizer.sanitize.mockImplementation(() => {
        throw new Error('Sanitize error');
      });

      const html = '<article><h2>Test</h2></article>';

      await expect(paginator.paginate(html, mockMeasureElement))
        .rejects.toThrow('Sanitize error');

      // Error is only propagated via thrown promise rejection,
      // not emitted as event (avoids double error handling)
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('should cleanup container from DOM', async () => {
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      const html = '<article><h2>Test</h2></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);
      await advancePagination();
      await paginatePromise;

      expect(removeChildSpy).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should abort current pagination', () => {
      const abortSpy = vi.fn();
      paginator.abortController = { abort: abortSpy };

      paginator.destroy();

      expect(abortSpy).toHaveBeenCalled();
    });

    it('should call parent destroy', () => {
      const listener = vi.fn();
      paginator.on('test', listener);

      paginator.destroy();
      paginator.emit('test');

      // After destroy, listeners should be cleared
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _computePhotoFilter
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_computePhotoFilter', () => {
    it('should compute grayscale filter', () => {
      const result = paginator._computePhotoFilter('grayscale', 100);
      expect(result).toBe('grayscale(1)');
    });

    it('should compute grayscale at half intensity', () => {
      const result = paginator._computePhotoFilter('grayscale', 50);
      expect(result).toBe('grayscale(0.5)');
    });

    it('should compute sepia filter with 0.75 multiplier', () => {
      const result = paginator._computePhotoFilter('sepia', 100);
      expect(result).toBe('sepia(0.75)');
    });

    it('should compute sepia at half intensity', () => {
      const result = paginator._computePhotoFilter('sepia', 50);
      expect(result).toBe('sepia(0.375)');
    });

    it('should compute contrast filter (1 + intensity * 0.35)', () => {
      const result = paginator._computePhotoFilter('contrast', 100);
      expect(result).toBe('contrast(1.35)');
    });

    it('should compute contrast at zero intensity', () => {
      const result = paginator._computePhotoFilter('contrast', 0);
      expect(result).toBe('contrast(1)');
    });

    it('should compute warm filter with saturate and hue-rotate', () => {
      const result = paginator._computePhotoFilter('warm', 100);
      expect(result).toContain('saturate(');
      expect(result).toContain('hue-rotate(');
      // warm: saturate(1 + 0.3) hue-rotate(-10deg)
      expect(result).toBe('saturate(1.3) hue-rotate(-10deg)');
    });

    it('should compute cool filter with saturate, hue-rotate, brightness', () => {
      const result = paginator._computePhotoFilter('cool', 100);
      expect(result).toContain('saturate(');
      expect(result).toContain('hue-rotate(');
      expect(result).toContain('brightness(');
      // cool: saturate(1.1) hue-rotate(15deg) brightness(1.05)
      expect(result).toBe('saturate(1.1) hue-rotate(15deg) brightness(1.05)');
    });

    it('should return empty string for unknown filter', () => {
      expect(paginator._computePhotoFilter('unknown', 100)).toBe('');
    });

    it('should return empty string for default/none filter', () => {
      expect(paginator._computePhotoFilter('none', 100)).toBe('');
    });

    it('should clamp intensity below 0 to 0', () => {
      const result = paginator._computePhotoFilter('grayscale', -50);
      expect(result).toBe('grayscale(0)');
    });

    it('should clamp intensity above 100 to 1', () => {
      const result = paginator._computePhotoFilter('grayscale', 200);
      expect(result).toBe('grayscale(1)');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _restoreAlbumPhotoStyles
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_restoreAlbumPhotoStyles', () => {
    it('should apply CSS filter from data attributes', () => {
      const doc = new DOMParser().parseFromString(`
        <div class="photo-album__item">
          <img data-filter="grayscale" data-filter-intensity="100" />
        </div>
      `, 'text/html');

      paginator._restoreAlbumPhotoStyles(doc);

      const img = doc.querySelector('img');
      expect(img.style.filter).toBe('grayscale(1)');
    });

    it('should apply rotation transform from data-rotation', () => {
      const doc = new DOMParser().parseFromString(`
        <div class="photo-album__item">
          <img data-rotation="15" />
        </div>
      `, 'text/html');

      paginator._restoreAlbumPhotoStyles(doc);

      const img = doc.querySelector('img');
      expect(img.style.transform).toBe('rotate(15deg)');
    });

    it('should skip filter when data-filter is none', () => {
      const doc = new DOMParser().parseFromString(`
        <div class="photo-album__item">
          <img data-filter="none" data-filter-intensity="100" />
        </div>
      `, 'text/html');

      paginator._restoreAlbumPhotoStyles(doc);

      const img = doc.querySelector('img');
      expect(img.style.filter).toBe('');
    });

    it('should skip rotation when data-rotation is 0', () => {
      const doc = new DOMParser().parseFromString(`
        <div class="photo-album__item">
          <img data-rotation="0" />
        </div>
      `, 'text/html');

      paginator._restoreAlbumPhotoStyles(doc);

      const img = doc.querySelector('img');
      expect(img.style.transform).toBe('');
    });

    it('should handle missing data attributes gracefully', () => {
      const doc = new DOMParser().parseFromString(`
        <div class="photo-album__item">
          <img />
        </div>
      `, 'text/html');

      expect(() => paginator._restoreAlbumPhotoStyles(doc)).not.toThrow();
    });

    it('should use default intensity 100 when data-filter-intensity is absent', () => {
      const doc = new DOMParser().parseFromString(`
        <div class="photo-album__item">
          <img data-filter="sepia" />
        </div>
      `, 'text/html');

      paginator._restoreAlbumPhotoStyles(doc);

      const img = doc.querySelector('img');
      // sepia with intensity 100 → sepia(0.75)
      expect(img.style.filter).toBe('sepia(0.75)');
    });

    it('should process multiple images', () => {
      const doc = new DOMParser().parseFromString(`
        <div class="photo-album__item"><img data-filter="grayscale" data-filter-intensity="50" /></div>
        <div class="photo-album__item"><img data-filter="sepia" data-filter-intensity="80" /></div>
      `, 'text/html');

      paginator._restoreAlbumPhotoStyles(doc);

      const imgs = doc.querySelectorAll('img');
      expect(imgs[0].style.filter).toBe('grayscale(0.5)');
      expect(imgs[1].style.filter).toContain('sepia(');
    });

    it('should apply both filter and rotation on same image', () => {
      const doc = new DOMParser().parseFromString(`
        <div class="photo-album__item">
          <img data-filter="contrast" data-filter-intensity="100" data-rotation="5" />
        </div>
      `, 'text/html');

      paginator._restoreAlbumPhotoStyles(doc);

      const img = doc.querySelector('img');
      expect(img.style.filter).toBe('contrast(1.35)');
      expect(img.style.transform).toBe('rotate(5deg)');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _alignChapters
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_alignChapters', () => {
    it('should insert spacer before chapter on odd column index', () => {
      const container = document.createElement('div');
      const marker = document.createElement('div');
      marker.dataset.chapterStart = '1';
      Object.defineProperty(marker, 'offsetLeft', { value: 150, configurable: true });
      container.appendChild(marker);

      const pageWidth = 100;
      // colIndex = Math.round(150/100) = 2 → чётный, не нужен спейсер
      // Тестируем нечётный: offsetLeft = 100 → colIndex = 1
      Object.defineProperty(marker, 'offsetLeft', { value: 100, configurable: true });

      paginator._alignChapters(container, pageWidth);

      const spacer = container.firstChild;
      expect(spacer.style.breakBefore).toBe('column');
      expect(spacer.style.height).toBe('100%');
    });

    it('should not insert spacer for chapter on even column index', () => {
      const container = document.createElement('div');
      const marker = document.createElement('div');
      marker.dataset.chapterStart = '0';
      Object.defineProperty(marker, 'offsetLeft', { value: 0, configurable: true });
      container.appendChild(marker);

      paginator._alignChapters(container, 100);

      // Только маркер, без спейсера
      expect(container.children.length).toBe(1);
    });

    it('should handle multiple chapter markers', () => {
      const container = document.createElement('div');
      const m1 = document.createElement('div');
      m1.dataset.chapterStart = '0';
      Object.defineProperty(m1, 'offsetLeft', { value: 0, configurable: true });

      const m2 = document.createElement('div');
      m2.dataset.chapterStart = '1';
      Object.defineProperty(m2, 'offsetLeft', { value: 300, configurable: true });

      container.appendChild(m1);
      container.appendChild(m2);

      paginator._alignChapters(container, 100);
      // m1: colIndex 0 (even) → no spacer
      // m2: colIndex 3 (odd) → spacer inserted
      const spacers = container.querySelectorAll('div:not([data-chapter-start])');
      expect(spacers.length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _buildPageData
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_buildPageData', () => {
    it('should return pageData with correct dimensions', () => {
      const columnLayout = document.createElement('div');
      Object.defineProperty(columnLayout, 'scrollWidth', { value: 800, configurable: true });

      const pageContent = document.createElement('div');
      columnLayout.appendChild(pageContent);

      const result = paginator._buildPageData(columnLayout, pageContent, 200, 600);

      expect(result.pageWidth).toBe(200);
      expect(result.pageHeight).toBe(600);
    });

    it('should calculate pageCount from scrollWidth / pageWidth minus 1', () => {
      const columnLayout = document.createElement('div');
      Object.defineProperty(columnLayout, 'scrollWidth', { value: 1000, configurable: true });

      const pageContent = document.createElement('div');
      columnLayout.appendChild(pageContent);

      const result = paginator._buildPageData(columnLayout, pageContent, 200, 600);
      // measuredColumnCount = ceil(1000/200) = 5, pageCount = 5 - 1 = 4
      expect(result.pageCount).toBe(4);
    });

    it('should return at least 1 page', () => {
      const columnLayout = document.createElement('div');
      Object.defineProperty(columnLayout, 'scrollWidth', { value: 0, configurable: true });

      const pageContent = document.createElement('div');
      columnLayout.appendChild(pageContent);

      const result = paginator._buildPageData(columnLayout, pageContent, 200, 600);
      expect(result.pageCount).toBeGreaterThanOrEqual(1);
    });

    it('should clone columnLayout as sourceElement', () => {
      const columnLayout = document.createElement('div');
      columnLayout.id = 'test-layout';
      Object.defineProperty(columnLayout, 'scrollWidth', { value: 400, configurable: true });

      const pageContent = document.createElement('div');
      columnLayout.appendChild(pageContent);

      const result = paginator._buildPageData(columnLayout, pageContent, 200, 600);
      expect(result.sourceElement).not.toBe(columnLayout);
      expect(result.sourceElement.tagName).toBe('DIV');
    });

    it('should set hasTOC flag', () => {
      const columnLayout = document.createElement('div');
      Object.defineProperty(columnLayout, 'scrollWidth', { value: 400, configurable: true });

      const pageContent = document.createElement('div');
      columnLayout.appendChild(pageContent);

      const withTOC = paginator._buildPageData(columnLayout, pageContent, 200, 600, true);
      expect(withTOC.hasTOC).toBe(true);

      const withoutTOC = paginator._buildPageData(columnLayout, pageContent, 200, 600, false);
      expect(withoutTOC.hasTOC).toBe(false);
    });

    it('should emit progress with phase slice', () => {
      const progressHandler = vi.fn();
      paginator.on('progress', progressHandler);

      const columnLayout = document.createElement('div');
      Object.defineProperty(columnLayout, 'scrollWidth', { value: 400, configurable: true });

      const pageContent = document.createElement('div');
      columnLayout.appendChild(pageContent);

      paginator._buildPageData(columnLayout, pageContent, 200, 600);

      expect(progressHandler).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'slice', progress: 100 })
      );
    });

    it('should remove measurement column before cloning', () => {
      const columnLayout = document.createElement('div');
      Object.defineProperty(columnLayout, 'scrollWidth', { value: 400, configurable: true });

      const pageContent = document.createElement('div');
      pageContent.innerHTML = '<p>Real content</p>';
      columnLayout.appendChild(pageContent);

      const result = paginator._buildPageData(columnLayout, pageContent, 200, 600);
      // Измерительная колонка не должна попасть в sourceElement
      const measureCols = result.sourceElement.querySelectorAll('div[style*="break-before"]');
      // pageContent should not contain the measurement div anymore
      expect(pageContent.lastChild.tagName).toBe('P');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // paginate progress phases
  // ═══════════════════════════════════════════════════════════════════════════

  describe('paginate progress phases', () => {
    it('should emit all expected progress phases in order', async () => {
      const phases = [];
      paginator.on('progress', ({ phase }) => phases.push(phase));

      const html = '<article><h2>Ch1</h2><p>Text</p></article><article><h2>Ch2</h2><p>More</p></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);
      await advancePagination();
      await paginatePromise;

      expect(phases).toContain('sanitize');
      expect(phases).toContain('parse');
      expect(phases).toContain('layout');
      expect(phases).toContain('content');
      expect(phases).toContain('chapters');
      expect(phases).toContain('slice');
      expect(phases).toContain('complete');
    });

    it('should emit align phase on desktop (non-mobile)', async () => {
      const phases = [];
      paginator.on('progress', ({ phase }) => phases.push(phase));

      // Два article чтобы попасть в ветку с _addTOC
      const html = '<article><h2>Ch1</h2><p>Text</p></article><article><h2>Ch2</h2><p>More</p></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);
      await advancePagination();
      await paginatePromise;

      expect(phases).toContain('align');
    });

    it('should set hasTOC true in pageData when multiple articles', async () => {
      const html = '<article><h2>Ch1</h2></article><article><h2>Ch2</h2></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);
      await advancePagination();
      const result = await paginatePromise;

      expect(result.pageData.hasTOC).toBe(true);
    });

    it('should set hasTOC false in pageData when single article', async () => {
      const html = '<article><h2>Only one</h2></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);
      await advancePagination();
      const result = await paginatePromise;

      expect(result.pageData.hasTOC).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _addTOC with chapterTitles option
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // paginate — TOC presence verification
  // ═══════════════════════════════════════════════════════════════════════════

  describe('paginate — TOC integration', () => {
    it('should include TOC in output when multiple articles', async () => {
      const html = '<article><h2>Ch1</h2><p>A</p></article><article><h2>Ch2</h2><p>B</p></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);
      await advancePagination();
      const result = await paginatePromise;

      // TOC должен быть создан — проверяем через sourceElement
      const toc = result.pageData.sourceElement.querySelector('.toc');
      expect(toc).not.toBeNull();
      expect(toc.querySelector('h2').textContent).toBe('Содержание');
    });

    it('should not include TOC when single article', async () => {
      const html = '<article><h2>Only</h2><p>Content</p></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);
      await advancePagination();
      const result = await paginatePromise;

      const toc = result.pageData.sourceElement.querySelector('.toc');
      expect(toc).toBeNull();
    });

    it('should pass chapterTitles option to _addTOC via paginate', async () => {
      const html = '<article><h2>HTML Title</h2><p>A</p></article><article><h2>B</h2><p>B</p></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement, { chapterTitles: ['Custom 1', 'Custom 2'] });
      await advancePagination();
      const result = await paginatePromise;

      const items = result.pageData.sourceElement.querySelectorAll('.toc ol li');
      expect(items[0].textContent).toBe('Custom 1');
      expect(items[1].textContent).toBe('Custom 2');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // paginate — chunking and progress arithmetic
  // ═══════════════════════════════════════════════════════════════════════════

  describe('paginate — content chunking', () => {
    it('should process articles in chunks of chunkSize', async () => {
      // chunkSize = 2, так что 3 статьи → 2 чанка
      const addChunkSpy = vi.spyOn(paginator, '_addArticlesChunk');

      const html = '<article><h2>A</h2></article><article><h2>B</h2></article><article><h2>C</h2></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);
      await advancePagination();
      await paginatePromise;

      // Должно быть 2 вызова: chunk[0,1] и chunk[2]
      expect(addChunkSpy).toHaveBeenCalledTimes(2);
      // Первый чанк начинается с индекса 0
      expect(addChunkSpy.mock.calls[0][2]).toBe(0);
      // Второй чанк начинается с индекса 2
      expect(addChunkSpy.mock.calls[1][2]).toBe(2);
    });

    it('should emit content progress with correct arithmetic', async () => {
      const progressValues = [];
      paginator.on('progress', ({ phase, progress }) => {
        if (phase === 'content') progressValues.push(progress);
      });

      // 3 articles, chunkSize=2 → 2 iterations: i=0 → progress=20, i=2 → progress=46
      const html = '<article><h2>A</h2></article><article><h2>B</h2></article><article><h2>C</h2></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);
      await advancePagination();
      await paginatePromise;

      // i=0: 20 + round(0/3 * 40) = 20
      expect(progressValues[0]).toBe(20);
      // i=2: 20 + round(2/3 * 40) = 20 + 27 = 47
      expect(progressValues[1]).toBe(47);
    });

    it('should set --album-page-height CSS variable on columnLayout', async () => {
      const html = '<article><h2>Test</h2></article>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);
      await advancePagination();
      const result = await paginatePromise;

      // В jsdom padding = 0, поэтому albumPageHeight = pageHeight = 600
      const varValue = result.pageData.sourceElement.style.getPropertyValue('--album-page-height');
      expect(varValue).toBe('600px');
    });
  });

  describe('_addTOC with chapterTitles', () => {
    it('should prioritize chapterTitles from config over h2', () => {
      const pageContent = document.createElement('div');
      const articles = [createMockArticle('HTML Title')];

      paginator._addTOC(pageContent, articles, ['Config Title']);

      const item = pageContent.querySelector('.toc ol li');
      expect(item.textContent).toBe('Config Title');
    });

    it('should fall back to h2 when chapterTitles entry is undefined', () => {
      const pageContent = document.createElement('div');
      const articles = [createMockArticle('HTML Title')];

      paginator._addTOC(pageContent, articles, [undefined]);

      const item = pageContent.querySelector('.toc ol li');
      expect(item.textContent).toBe('HTML Title');
    });
  });

  // Helper functions
  function createMockArticle(title) {
    const article = document.createElement('article');
    article.innerHTML = `<h2>${title}</h2><p>Content</p>`;
    return article;
  }

  async function advancePagination() {
    // Advance multiple times to cover all yields
    for (let i = 0; i < 20; i++) {
      await vi.advanceTimersByTimeAsync(16);
    }
  }
});
