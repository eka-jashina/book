/**
 * INTEGRATION TEST: Error Recovery Chain
 * Тестирование цепочки восстановления после ошибок:
 * загрузка главы → retry → fallback → UI recovery.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createFullBookDOM,
  cleanupIntegrationDOM,
  createChapterContent,
  setupFetchMock,
  setupFetchError,
  setupNetworkError,
} from '../../helpers/integrationUtils.js';

import { BookStateMachine } from '../../../js/managers/BookStateMachine.js';
import { LifecycleDelegate } from '../../../js/core/delegates/LifecycleDelegate.js';
import { NavigationDelegate } from '../../../js/core/delegates/NavigationDelegate.js';
import { BookState, Direction } from '../../../js/config.js';
import { ContentLoader } from '../../../js/managers/ContentLoader.js';
import { DelegateEvents } from '../../../js/core/delegates/BaseDelegate.js';
import { rateLimiters } from '../../../js/utils/RateLimiter.js';

// Mock ErrorHandler
vi.mock('../../../js/utils/ErrorHandler.js', () => ({
  ErrorHandler: {
    handle: vi.fn(),
  },
}));

import { ErrorHandler } from '../../../js/utils/ErrorHandler.js';

describe('Error Recovery Chain', () => {
  let dom;
  let stateMachine;
  let contentLoader;
  let lifecycleDelegate;
  let mockState;
  let mockRenderer;
  let mockAnimator;
  let mockPaginator;
  let mockLoadingIndicator;

  beforeEach(() => {
    dom = createFullBookDOM();
    stateMachine = new BookStateMachine();
    contentLoader = new ContentLoader();

    rateLimiters.navigation.reset();
    rateLimiters.chapter.reset();

    mockState = { index: 0, chapterStarts: [] };

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
        chapterStarts: [0, 8],
      }),
    };

    mockAnimator = {
      runOpenAnimation: vi.fn().mockResolvedValue('completed'),
      finishOpenAnimation: vi.fn().mockResolvedValue(),
      runCloseAnimation: vi.fn().mockResolvedValue(),
      abort: vi.fn(),
    };

    mockLoadingIndicator = {
      show: vi.fn(),
      hide: vi.fn(),
    };

    lifecycleDelegate = new LifecycleDelegate({
      stateMachine,
      backgroundManager: { preload: vi.fn().mockResolvedValue(), setBackground: vi.fn() },
      contentLoader,
      paginator: mockPaginator,
      renderer: mockRenderer,
      animator: mockAnimator,
      loadingIndicator: mockLoadingIndicator,
      soundManager: { play: vi.fn(), preload: vi.fn().mockResolvedValue() },
      mediaQueries: { isMobile: false },
      dom: {
        get: (id) => {
          const map = { book: dom.book, leftA: dom.leftA, rightA: dom.rightA };
          return map[id] || null;
        },
      },
      state: mockState,
    });

    lifecycleDelegate.on(DelegateEvents.PAGINATION_COMPLETE, ({ pageData, chapterStarts }) => {
      mockState.chapterStarts = chapterStarts;
    });

    lifecycleDelegate.on(DelegateEvents.INDEX_CHANGE, (index) => {
      mockState.index = index;
    });
  });

  afterEach(() => {
    lifecycleDelegate?.destroy();
    stateMachine?.destroy();
    contentLoader?.destroy();
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  describe('Content load error during open', () => {
    it('should recover to CLOSED state on network error', async () => {
      setupNetworkError();

      await lifecycleDelegate.open(0);

      expect(stateMachine.state).toBe(BookState.CLOSED);
    });

    it('should call ErrorHandler on content load failure', async () => {
      setupNetworkError();

      await lifecycleDelegate.open(0);

      expect(ErrorHandler.handle).toHaveBeenCalled();
    });

    it('should hide loading indicator after error', async () => {
      setupNetworkError();

      await lifecycleDelegate.open(0);

      expect(mockLoadingIndicator.hide).toHaveBeenCalled();
    });

    it('should recover to CLOSED on HTTP error', async () => {
      setupFetchError(500, 'Server Error');

      await lifecycleDelegate.open(0);

      expect(stateMachine.state).toBe(BookState.CLOSED);
    });
  });

  describe('Animation error during open', () => {
    it('should recover to CLOSED when open animation fails', async () => {
      const testContent = createChapterContent({ chapters: 1, paragraphsPerChapter: 2 });
      setupFetchMock(testContent);

      mockAnimator.runOpenAnimation.mockRejectedValue(new Error('Animation failed'));

      await lifecycleDelegate.open(0);

      expect(stateMachine.state).toBe(BookState.CLOSED);
    });

    it('should abort content loader when animation fails', async () => {
      const abortSpy = vi.spyOn(contentLoader, 'abort');
      const testContent = createChapterContent({ chapters: 1, paragraphsPerChapter: 2 });
      setupFetchMock(testContent);

      mockAnimator.runOpenAnimation.mockRejectedValue(new Error('Animation failed'));

      await lifecycleDelegate.open(0);

      expect(abortSpy).toHaveBeenCalled();
    });
  });

  describe('Paginator error', () => {
    it('should recover when paginator throws', async () => {
      const testContent = createChapterContent({ chapters: 1, paragraphsPerChapter: 2 });
      setupFetchMock(testContent);

      mockPaginator.paginate.mockRejectedValue(new Error('Paginator failed'));

      await lifecycleDelegate.open(0);

      expect(stateMachine.state).toBe(BookState.CLOSED);
      expect(ErrorHandler.handle).toHaveBeenCalled();
    });
  });

  describe('Error during close', () => {
    it('should recover to OPENED when close animation fails', async () => {
      const testContent = createChapterContent({ chapters: 1, paragraphsPerChapter: 2 });
      setupFetchMock(testContent);

      await lifecycleDelegate.open(0);
      expect(stateMachine.state).toBe(BookState.OPENED);

      mockAnimator.runCloseAnimation.mockRejectedValue(new Error('Close failed'));

      await lifecycleDelegate.close();

      // Should recover to OPENED (not stuck in CLOSING)
      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should restore DOM elements after close failure', async () => {
      const testContent = createChapterContent({ chapters: 1, paragraphsPerChapter: 2 });
      setupFetchMock(testContent);

      await lifecycleDelegate.open(0);

      mockAnimator.runCloseAnimation.mockRejectedValue(new Error('Close failed'));

      await lifecycleDelegate.close();

      // closing-hidden classes should be removed
      expect(dom.leftA.classList.contains('closing-hidden')).toBe(false);
      expect(dom.rightA.classList.contains('closing-hidden')).toBe(false);
    });
  });

  describe('Error during repagination', () => {
    it('should recover state after repagination error', async () => {
      const testContent = createChapterContent({ chapters: 1, paragraphsPerChapter: 2 });
      setupFetchMock(testContent);

      await lifecycleDelegate.open(0);
      expect(stateMachine.state).toBe(BookState.OPENED);

      // Второй вызов content loader падает
      setupNetworkError();

      await lifecycleDelegate.repaginate(true);

      // Должен остаться в OPENED (не сломать state machine)
      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should hide loading indicator after repagination error', async () => {
      const testContent = createChapterContent({ chapters: 1, paragraphsPerChapter: 2 });
      setupFetchMock(testContent);

      await lifecycleDelegate.open(0);
      mockLoadingIndicator.hide.mockClear();

      setupNetworkError();
      await lifecycleDelegate.repaginate(true);

      expect(mockLoadingIndicator.hide).toHaveBeenCalled();
    });
  });

  describe('Abort handling', () => {
    it('should not call ErrorHandler on AbortError', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      mockAnimator.runOpenAnimation.mockRejectedValue(abortError);

      const testContent = createChapterContent({ chapters: 1, paragraphsPerChapter: 2 });
      setupFetchMock(testContent);

      ErrorHandler.handle.mockClear();
      await lifecycleDelegate.open(0);

      expect(ErrorHandler.handle).not.toHaveBeenCalled();
    });
  });

  describe('Recovery allows retry', () => {
    it('should allow reopening after error recovery', async () => {
      // Первая попытка — ошибка
      setupNetworkError();
      await lifecycleDelegate.open(0);
      expect(stateMachine.state).toBe(BookState.CLOSED);

      // Вторая попытка — успех
      const testContent = createChapterContent({ chapters: 1, paragraphsPerChapter: 2 });
      setupFetchMock(testContent);

      await lifecycleDelegate.open(0);
      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should allow close after failed close recovery', async () => {
      const testContent = createChapterContent({ chapters: 1, paragraphsPerChapter: 2 });
      setupFetchMock(testContent);

      await lifecycleDelegate.open(0);

      // Первая попытка закрытия — ошибка
      mockAnimator.runCloseAnimation.mockRejectedValueOnce(new Error('Close fail'));
      await lifecycleDelegate.close();
      expect(stateMachine.state).toBe(BookState.OPENED);

      // Вторая попытка — успех
      mockAnimator.runCloseAnimation.mockResolvedValue();
      await lifecycleDelegate.close();
      expect(stateMachine.state).toBe(BookState.CLOSED);
    });
  });

  describe('Navigation error recovery', () => {
    let navigationDelegate;
    let resolveFlip;

    const createControllablePromise = () => {
      let resolve, reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };

    beforeEach(async () => {
      const testContent = createChapterContent({ chapters: 1, paragraphsPerChapter: 2 });
      setupFetchMock(testContent);
      await lifecycleDelegate.open(0);

      const flipPromise = createControllablePromise();
      resolveFlip = flipPromise.resolve;

      const navAnimator = {
        runFlip: vi.fn().mockImplementation((dir, cb) => {
          navAnimator._swapCallback = cb;
          return flipPromise.promise;
        }),
      };

      navigationDelegate = new NavigationDelegate({
        stateMachine,
        renderer: mockRenderer,
        animator: navAnimator,
        settings: { get: vi.fn().mockReturnValue(true) },
        soundManager: { play: vi.fn() },
        mediaQueries: { isMobile: false },
        state: mockState,
      });
    });

    afterEach(() => {
      navigationDelegate?.destroy();
    });

    it('should recover to OPENED after flip animation error', async () => {
      const errorPromise = createControllablePromise();
      errorPromise.promise.catch(() => {});

      navigationDelegate._deps.animator.runFlip.mockReturnValue(errorPromise.promise);

      const flipPromise = navigationDelegate.flip(Direction.NEXT);
      expect(stateMachine.state).toBe(BookState.FLIPPING);

      errorPromise.reject(new Error('Flip animation failed'));
      await flipPromise;

      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should allow new flip after error recovery', async () => {
      const errorPromise = createControllablePromise();
      errorPromise.promise.catch(() => {});

      navigationDelegate._deps.animator.runFlip.mockReturnValueOnce(errorPromise.promise);

      const flipPromise = navigationDelegate.flip(Direction.NEXT);
      errorPromise.reject(new Error('Flip failed'));
      await flipPromise;

      expect(stateMachine.state).toBe(BookState.OPENED);

      // Сброс rate limiter и throttle для следующего flip
      rateLimiters.navigation.reset();
      navigationDelegate._lastFlipTime = 0;

      // Новый flip должен работать
      const newFlipPromise = createControllablePromise();
      navigationDelegate._deps.animator.runFlip.mockReturnValue(newFlipPromise.promise);

      const flip2 = navigationDelegate.flip(Direction.NEXT);
      expect(stateMachine.state).toBe(BookState.FLIPPING);

      if (navigationDelegate._deps.animator._swapCallback) {
        navigationDelegate._deps.animator._swapCallback();
      }
      newFlipPromise.resolve();
      await flip2;
    });
  });
});
