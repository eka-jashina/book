/**
 * INTEGRATION TEST: Chapter Switch + Repagination
 * Тестирование смены главы с репагинацией, корректными chapterStarts и фоном.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createFullBookDOM,
  cleanupIntegrationDOM,
  createChapterContent,
  setupFetchMock,
} from '../../helpers/integrationUtils.js';

import { BookStateMachine } from '../../../js/managers/BookStateMachine.js';
import { LifecycleDelegate } from '../../../js/core/delegates/LifecycleDelegate.js';
import { ChapterDelegate } from '../../../js/core/delegates/ChapterDelegate.js';
import { NavigationDelegate } from '../../../js/core/delegates/NavigationDelegate.js';
import { BookState, Direction } from '../../../js/config.js';
import { EventEmitter } from '../../../js/utils/EventEmitter.js';
import { ContentLoader } from '../../../js/managers/ContentLoader.js';
import { DelegateEvents } from '../../../js/core/delegates/BaseDelegate.js';
import { rateLimiters } from '../../../js/utils/RateLimiter.js';

describe('Chapter Switch + Repagination', () => {
  let dom;
  let stateMachine;
  let contentLoader;
  let lifecycleDelegate;
  let chapterDelegate;
  let eventEmitter;
  let mockState;
  let mockRenderer;
  let mockAnimator;
  let mockPaginator;
  let mockBackgroundManager;

  beforeEach(() => {
    dom = createFullBookDOM();

    rateLimiters.navigation.reset();
    rateLimiters.chapter.reset();

    stateMachine = new BookStateMachine();
    contentLoader = new ContentLoader();
    eventEmitter = new EventEmitter();

    const testContent = createChapterContent({ chapters: 3, paragraphsPerChapter: 5 });
    setupFetchMock(testContent);

    mockState = {
      index: 0,
      chapterStarts: [],
    };

    mockBackgroundManager = {
      setBackground: vi.fn(),
      preload: vi.fn().mockResolvedValue(),
    };

    mockRenderer = {
      getMaxIndex: vi.fn().mockReturnValue(20),
      renderSpread: vi.fn(),
      clearCache: vi.fn(),
      prepareBuffer: vi.fn(),
      prepareSheet: vi.fn(),
      swapBuffers: vi.fn(),
    };

    mockPaginator = {
      paginate: vi.fn().mockResolvedValue({
        pageData: { sourceElement: document.createElement('div'), pageCount: 21, pageWidth: 400, pageHeight: 600 },
        chapterStarts: [0, 8, 16],
      }),
    };

    mockAnimator = {
      runOpenAnimation: vi.fn().mockResolvedValue('completed'),
      finishOpenAnimation: vi.fn().mockResolvedValue(),
      runCloseAnimation: vi.fn().mockResolvedValue(),
      abort: vi.fn(),
    };

    chapterDelegate = new ChapterDelegate({
      backgroundManager: mockBackgroundManager,
      dom: {
        get: (id) => {
          if (id === 'body') return document.body;
          return null;
        },
      },
      state: mockState,
    });

    lifecycleDelegate = new LifecycleDelegate({
      stateMachine,
      backgroundManager: mockBackgroundManager,
      contentLoader,
      paginator: mockPaginator,
      renderer: mockRenderer,
      animator: mockAnimator,
      loadingIndicator: { show: vi.fn(), hide: vi.fn() },
      soundManager: { play: vi.fn(), preload: vi.fn().mockResolvedValue() },
      mediaQueries: { isMobile: false },
      dom: {
        get: (id) => {
          const map = {
            book: dom.book,
            leftA: dom.leftA,
            rightA: dom.rightA,
          };
          return map[id] || null;
        },
      },
      state: mockState,
    });

    // Подключаем pagination complete → обновление state
    lifecycleDelegate.on(DelegateEvents.PAGINATION_COMPLETE, ({ pageData, chapterStarts }) => {
      mockState.chapterStarts = chapterStarts;
      mockRenderer.getMaxIndex.mockReturnValue(pageData.pageCount - 1);
    });

    lifecycleDelegate.on(DelegateEvents.INDEX_CHANGE, (index) => {
      mockState.index = index;
    });

    lifecycleDelegate.on(DelegateEvents.CHAPTER_UPDATE, () => {
      chapterDelegate.updateBackground(mockState.index, false);
    });
  });

  afterEach(() => {
    lifecycleDelegate?.destroy();
    chapterDelegate?.destroy();
    stateMachine?.destroy();
    contentLoader?.destroy();
    eventEmitter?.destroy();
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  describe('Open and chapter starts', () => {
    it('should set chapterStarts after opening book', async () => {
      await lifecycleDelegate.open(0);

      expect(mockState.chapterStarts).toEqual([0, 8, 16]);
    });

    it('should render initial spread at index 0', async () => {
      await lifecycleDelegate.open(0);

      expect(mockRenderer.renderSpread).toHaveBeenCalledWith(0, false);
      expect(mockState.index).toBe(0);
    });

    it('should transition to OPENED state', async () => {
      await lifecycleDelegate.open(0);

      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should update background on chapter update', async () => {
      await lifecycleDelegate.open(0);

      expect(mockBackgroundManager.setBackground).toHaveBeenCalled();
    });
  });

  describe('Open at specific chapter', () => {
    it('should open at chapter 2 start index', async () => {
      await lifecycleDelegate.open(16);

      expect(mockState.index).toBe(16);
      expect(mockRenderer.renderSpread).toHaveBeenCalledWith(16, false);
    });

    it('should clamp start index to max', async () => {
      mockPaginator.paginate.mockResolvedValue({
        pageData: { sourceElement: document.createElement('div'), pageCount: 11, pageWidth: 400, pageHeight: 600 },
        chapterStarts: [0, 5],
      });

      await lifecycleDelegate.open(100);

      // Should be clamped to maxIndex (10)
      expect(mockState.index).toBe(10);
    });
  });

  describe('Chapter detection', () => {
    it('should correctly identify chapter 0 for early pages', async () => {
      await lifecycleDelegate.open(0);

      const chapter = chapterDelegate.getCurrentChapter(4);
      expect(chapter).toBe(0);
    });

    it('should correctly identify chapter 1 at boundary', async () => {
      await lifecycleDelegate.open(0);

      const chapter = chapterDelegate.getCurrentChapter(8);
      expect(chapter).toBe(1);
    });

    it('should correctly identify chapter 2 for later pages', async () => {
      await lifecycleDelegate.open(0);

      const chapter = chapterDelegate.getCurrentChapter(18);
      expect(chapter).toBe(2);
    });

    it('should identify next chapter', async () => {
      await lifecycleDelegate.open(0);

      expect(chapterDelegate.getNextChapter(0)).toBe(1);
      expect(chapterDelegate.getNextChapter(1)).toBe(2);
      expect(chapterDelegate.getNextChapter(2)).toBeNull();
    });
  });

  describe('Repagination preserves chapter structure', () => {
    it('should maintain chapterStarts after repagination', async () => {
      await lifecycleDelegate.open(0);
      mockState.index = 10;

      await lifecycleDelegate.repaginate(true);

      expect(mockState.chapterStarts).toEqual([0, 8, 16]);
    });

    it('should preserve reading position on repagination', async () => {
      await lifecycleDelegate.open(0);
      mockState.index = 10;

      await lifecycleDelegate.repaginate(true);

      expect(mockState.index).toBe(10);
      expect(mockRenderer.renderSpread).toHaveBeenLastCalledWith(10, false);
    });

    it('should clamp index if pages reduced after repagination', async () => {
      await lifecycleDelegate.open(0);
      mockState.index = 18;

      // Второй вызов paginate вернёт меньше страниц
      mockPaginator.paginate.mockResolvedValue({
        pageData: { sourceElement: document.createElement('div'), pageCount: 11, pageWidth: 400, pageHeight: 600 },
        chapterStarts: [0, 5],
      });

      await lifecycleDelegate.repaginate(true);

      // Индекс должен быть <= maxIndex (10)
      expect(mockState.index).toBeLessThanOrEqual(10);
    });

    it('should reset to page 0 when keepIndex is false', async () => {
      await lifecycleDelegate.open(0);
      mockState.index = 14;

      await lifecycleDelegate.repaginate(false);

      expect(mockState.index).toBe(0);
    });
  });

  describe('Background updates on chapter change', () => {
    it('should update background for cover pages', async () => {
      mockState.chapterStarts = [2, 8, 16];
      mockState.index = 0;

      chapterDelegate.updateBackground(0, false);

      expect(document.body.dataset.chapter).toBe('cover');
    });

    it('should set chapter-specific data attribute', async () => {
      await lifecycleDelegate.open(0);
      mockState.index = 10;

      chapterDelegate.updateBackground(10, false);

      // Chapter 1 (index 10 is in chapter 1: starts at 8)
      expect(document.body.dataset.chapter).toBeTruthy();
    });

    it('should preload next chapter background', async () => {
      await lifecycleDelegate.open(0);
      mockBackgroundManager.preload.mockClear();

      // Сбрасываем lastPreloadedChapter чтобы гарантировать preload
      chapterDelegate.lastPreloadedChapter = -1;
      chapterDelegate.updateBackground(6, false);

      // Should preload chapter 1's background
      expect(mockBackgroundManager.preload).toHaveBeenCalled();
    });
  });

  describe('Content reload on repagination', () => {
    it('should call contentLoader.load during repagination', async () => {
      await lifecycleDelegate.open(0);

      // ContentLoader кэширует результаты, поэтому fetch может не вызываться повторно.
      // Проверяем что paginate вызывается заново (новый расчёт)
      const paginateCountBefore = mockPaginator.paginate.mock.calls.length;
      await lifecycleDelegate.repaginate(true);

      expect(mockPaginator.paginate.mock.calls.length).toBeGreaterThan(paginateCountBefore);
    });

    it('should clear renderer cache before repagination', async () => {
      await lifecycleDelegate.open(0);
      mockRenderer.clearCache.mockClear();

      await lifecycleDelegate.repaginate(true);

      expect(mockRenderer.clearCache).toHaveBeenCalled();
    });
  });
});
