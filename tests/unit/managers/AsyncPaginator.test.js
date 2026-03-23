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

    it('should return empty result if no articles', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const html = '<div>No articles here</div>';
      const paginatePromise = paginator.paginate(html, mockMeasureElement);
      await advancePagination();
      const result = await paginatePromise;

      expect(result.pageData).toBeNull();
      expect(result.chapterStarts).toEqual([]);
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
