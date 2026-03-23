/**
 * INTEGRATION TEST: Book Lifecycle
 * Тестирование открытия и закрытия книги с реальными компонентами
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createFullBookDOM,
  cleanupIntegrationDOM,
  createChapterContent,
  setupFetchMock,
} from '../../helpers/integrationUtils.js';

import { BookStateMachine } from '../../../js/managers/BookStateMachine.js';
import { ContentLoader } from '../../../js/managers/ContentLoader.js';
import { LifecycleDelegate } from '../../../js/core/delegates/LifecycleDelegate.js';
import { BookState } from '../../../js/config.js';
import { EventEmitter } from '../../../js/utils/EventEmitter.js';

describe('Book Lifecycle Integration', () => {
  let dom;
  let stateMachine;
  let contentLoader;
  let lifecycleDelegate;
  let eventEmitter;
  let resolveAnimation;
  let resolveFinishAnimation;
  let resolveCloseAnimation;

  // Mock dependencies
  let mockAnimator;
  let mockRenderer;
  let mockLoadingIndicator;
  let mockDom;
  let mockMediaQueries;
  let mockSoundManager;
  let mockPaginator;
  let mockBackgroundManager;
  let mockState;

  const createControllablePromise = () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  beforeEach(() => {
    dom = createFullBookDOM();

    // Setup fetch mock with test content
    const testContent = createChapterContent({ chapters: 3, paragraphsPerChapter: 5 });
    setupFetchMock(testContent);

    // Real components
    stateMachine = new BookStateMachine();
    contentLoader = new ContentLoader();
    eventEmitter = new EventEmitter();

    // Create controllable promises for animations
    const openAnimPromise = createControllablePromise();
    const finishAnimPromise = createControllablePromise();
    const closeAnimPromise = createControllablePromise();

    resolveAnimation = openAnimPromise.resolve;
    resolveFinishAnimation = finishAnimPromise.resolve;
    resolveCloseAnimation = closeAnimPromise.resolve;

    // Mock animator with controllable promises
    mockAnimator = {
      runOpenAnimation: vi.fn().mockReturnValue(openAnimPromise.promise),
      finishOpenAnimation: vi.fn().mockReturnValue(finishAnimPromise.promise),
      runCloseAnimation: vi.fn().mockReturnValue(closeAnimPromise.promise),
      abort: vi.fn(),
    };

    // Mock paginator
    mockPaginator = {
      paginate: vi.fn().mockResolvedValue({
        pageData: { sourceElement: document.createElement('div'), pageCount: 4, pageWidth: 400, pageHeight: 600 },
        chapterStarts: [0, 2],
      }),
    };

    // Mock backgroundManager
    mockBackgroundManager = {
      preload: vi.fn().mockResolvedValue(),
      setBackground: vi.fn(),
    };

    // Mock renderer
    mockRenderer = {
      renderSpread: vi.fn(),
      getMaxIndex: vi.fn().mockReturnValue(3),
      clearCache: vi.fn(),
    };

    // Mock loading indicator
    mockLoadingIndicator = {
      show: vi.fn(),
      hide: vi.fn(),
    };

    // Mock DOM manager - return elements with proper dimensions
    mockDom = {
      get: vi.fn((id) => {
        const mapping = {
          book: dom.book,
          leftA: dom.leftA,
          leftB: dom.leftB,
          rightA: dom.rightA,
          rightB: dom.rightB,
          sheet: dom.sheet,
          cover: dom.cover,
        };
        return mapping[id] || null;
      }),
    };

    // Mock media queries
    mockMediaQueries = {
      matches: vi.fn().mockReturnValue(false),
    };

    // Mock sound manager
    mockSoundManager = {
      play: vi.fn(),
      preload: vi.fn().mockResolvedValue(),
    };

    mockState = { index: 0, chapterStarts: [] };

    lifecycleDelegate = new LifecycleDelegate({
      stateMachine,
      backgroundManager: mockBackgroundManager,
      contentLoader,
      paginator: mockPaginator,
      renderer: mockRenderer,
      animator: mockAnimator,
      loadingIndicator: mockLoadingIndicator,
      soundManager: mockSoundManager,
      mediaQueries: mockMediaQueries,
      dom: mockDom,
      state: mockState,
    });

    // Connect delegate events
    lifecycleDelegate.on('paginationComplete', (data) => {
      eventEmitter.emit('paginationComplete', data);
    });
    lifecycleDelegate.on('indexChange', (index) => {
      eventEmitter.emit('indexChange', index);
    });
  });

  afterEach(() => {
    lifecycleDelegate?.destroy();
    contentLoader?.destroy();
    stateMachine?.destroy();
    eventEmitter?.destroy();
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  // Helper to complete open animation sequence
  const completeOpenAnimation = async () => {
    resolveAnimation('completed');
    await Promise.resolve();
    resolveFinishAnimation();
    await Promise.resolve();
  };

  // Helper to complete close animation
  const completeCloseAnimation = async () => {
    resolveCloseAnimation();
    await Promise.resolve();
  };

  describe('Book Opening', () => {
    it('should transition to OPENING state immediately', async () => {
      expect(stateMachine.state).toBe(BookState.CLOSED);

      const openPromise = lifecycleDelegate.open(0);

      // Should immediately transition to OPENING
      expect(stateMachine.state).toBe(BookState.OPENING);

      // Complete the animation to prevent hanging
      await completeOpenAnimation();
      await openPromise;
    });

    it('should transition to OPENED state after animations complete', async () => {
      const openPromise = lifecycleDelegate.open(0);

      await completeOpenAnimation();
      await openPromise;

      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should load content via ContentLoader', async () => {
      const openPromise = lifecycleDelegate.open(0);

      await completeOpenAnimation();
      await openPromise;

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should call paginator with loaded HTML', async () => {
      const openPromise = lifecycleDelegate.open(0);

      await completeOpenAnimation();
      await openPromise;

      expect(mockPaginator.paginate).toHaveBeenCalled();
      const [html] = mockPaginator.paginate.mock.calls[0];
      expect(html).toContain('Глава 1');
    });

    it('should show loading indicator on start', async () => {
      const openPromise = lifecycleDelegate.open(0);

      expect(mockLoadingIndicator.show).toHaveBeenCalled();

      await completeOpenAnimation();
      await openPromise;
    });

    it('should hide loading indicator after completion', async () => {
      const openPromise = lifecycleDelegate.open(0);

      await completeOpenAnimation();
      await openPromise;

      expect(mockLoadingIndicator.hide).toHaveBeenCalled();
    });

    it('should play book open sound', async () => {
      const openPromise = lifecycleDelegate.open(0);

      expect(mockSoundManager.play).toHaveBeenCalledWith('bookOpen');

      await completeOpenAnimation();
      await openPromise;
    });

    it('should render first spread', async () => {
      const openPromise = lifecycleDelegate.open(0);

      await completeOpenAnimation();
      await openPromise;

      expect(mockRenderer.renderSpread).toHaveBeenCalledWith(0, false);
    });

    it('should render at specified start index', async () => {
      const openPromise = lifecycleDelegate.open(2);

      await completeOpenAnimation();
      await openPromise;

      expect(mockRenderer.renderSpread).toHaveBeenCalledWith(2, false);
    });

    it('should clamp start index to max', async () => {
      mockRenderer.getMaxIndex.mockReturnValue(3);

      const openPromise = lifecycleDelegate.open(100);

      await completeOpenAnimation();
      await openPromise;

      expect(mockRenderer.renderSpread).toHaveBeenCalledWith(3, false);
    });

    it('should not open if already opening', async () => {
      const firstOpen = lifecycleDelegate.open(0);

      // Book is now in OPENING state
      expect(stateMachine.state).toBe(BookState.OPENING);

      // Second open should be ignored
      lifecycleDelegate.open(0);

      expect(mockAnimator.runOpenAnimation).toHaveBeenCalledTimes(1);

      await completeOpenAnimation();
      await firstOpen;
    });

    it('should emit paginationComplete event', async () => {
      const handler = vi.fn();
      eventEmitter.on('paginationComplete', handler);

      const openPromise = lifecycleDelegate.open(0);

      await completeOpenAnimation();
      await openPromise;

      expect(handler).toHaveBeenCalledWith({
        pageData: expect.any(Object),
        chapterStarts: expect.any(Array),
      });
    });

    it('should emit indexChange event', async () => {
      const handler = vi.fn();
      eventEmitter.on('indexChange', handler);

      const openPromise = lifecycleDelegate.open(0);

      await completeOpenAnimation();
      await openPromise;

      expect(handler).toHaveBeenCalledWith(0);
    });
  });

  describe('Book Closing', () => {
    beforeEach(async () => {
      // Open the book first
      const openPromise = lifecycleDelegate.open(0);
      await completeOpenAnimation();
      await openPromise;

      // Reset mocks for close tests
      mockAnimator.runCloseAnimation.mockClear();
      mockSoundManager.play.mockClear();
    });

    it('should transition to CLOSING state immediately', async () => {
      expect(stateMachine.state).toBe(BookState.OPENED);

      const closePromise = lifecycleDelegate.close();

      expect(stateMachine.state).toBe(BookState.CLOSING);

      await completeCloseAnimation();
      await closePromise;
    });

    it('should transition to CLOSED state after animation', async () => {
      const closePromise = lifecycleDelegate.close();

      await completeCloseAnimation();
      await closePromise;

      expect(stateMachine.state).toBe(BookState.CLOSED);
    });

    it('should play book close sound', async () => {
      const closePromise = lifecycleDelegate.close();

      expect(mockSoundManager.play).toHaveBeenCalledWith('bookClose');

      await completeCloseAnimation();
      await closePromise;
    });

    it('should clear renderer cache', async () => {
      mockRenderer.clearCache.mockClear();

      const closePromise = lifecycleDelegate.close();

      await completeCloseAnimation();
      await closePromise;

      expect(mockRenderer.clearCache).toHaveBeenCalled();
    });

    it('should not emit indexChange on close (runtime reset handled by DelegateMediator)', async () => {
      const handler = vi.fn();
      eventEmitter.on('indexChange', handler);
      handler.mockClear();

      const closePromise = lifecycleDelegate.close();

      await completeCloseAnimation();
      await closePromise;

      // LifecycleDelegate не эмитит indexChange при закрытии,
      // чтобы не затереть сохранённую позицию (page) в SettingsManager.
      // Runtime-сброс index → 0 выполняет DelegateMediator.handleBookClose().
      expect(handler).not.toHaveBeenCalled();
    });

    it('should not close if already closed', async () => {
      // Close the book
      const closePromise = lifecycleDelegate.close();
      await completeCloseAnimation();
      await closePromise;

      expect(stateMachine.state).toBe(BookState.CLOSED);

      mockAnimator.runCloseAnimation.mockClear();

      // Try to close again
      lifecycleDelegate.close();

      expect(mockAnimator.runCloseAnimation).not.toHaveBeenCalled();
    });

    it('should not close if currently closing', async () => {
      const firstClose = lifecycleDelegate.close();

      expect(stateMachine.state).toBe(BookState.CLOSING);

      // Second close should be ignored
      lifecycleDelegate.close();

      expect(mockAnimator.runCloseAnimation).toHaveBeenCalledTimes(1);

      await completeCloseAnimation();
      await firstClose;
    });
  });

  describe('Error Recovery', () => {
    it('should recover to CLOSED if open animation fails', async () => {
      mockAnimator.runOpenAnimation.mockRejectedValue(new Error('Animation failed'));

      await lifecycleDelegate.open(0);

      expect(stateMachine.state).toBe(BookState.CLOSED);
    });

    it('should recover to OPENED if close animation fails', async () => {
      // First open successfully
      const openPromise = lifecycleDelegate.open(0);
      await completeOpenAnimation();
      await openPromise;

      // Make close fail
      mockAnimator.runCloseAnimation.mockRejectedValue(new Error('Close failed'));

      await lifecycleDelegate.close();

      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should hide loading indicator even on error', async () => {
      mockAnimator.runOpenAnimation.mockRejectedValue(new Error('Failed'));

      await lifecycleDelegate.open(0);

      expect(mockLoadingIndicator.hide).toHaveBeenCalled();
    });

    it('should handle AbortError gracefully', async () => {
      const abortError = new DOMException('Aborted', 'AbortError');
      mockAnimator.runOpenAnimation.mockRejectedValue(abortError);

      // Should not throw
      await expect(lifecycleDelegate.open(0)).resolves.not.toThrow();
    });
  });

  describe('Full Open-Close Cycle', () => {
    it('should complete a full open-close cycle', async () => {
      // Open
      let promise = lifecycleDelegate.open(0);
      await completeOpenAnimation();
      await promise;
      expect(stateMachine.state).toBe(BookState.OPENED);

      // Create new promises for close and second open
      const closePromise1 = createControllablePromise();
      mockAnimator.runCloseAnimation.mockReturnValue(closePromise1.promise);

      // Close
      promise = lifecycleDelegate.close();
      closePromise1.resolve();
      await promise;
      expect(stateMachine.state).toBe(BookState.CLOSED);
    });

    it('should allow reopening after close', async () => {
      // Open
      let promise = lifecycleDelegate.open(0);
      await completeOpenAnimation();
      await promise;

      // Close
      const closePromise = createControllablePromise();
      mockAnimator.runCloseAnimation.mockReturnValue(closePromise.promise);
      promise = lifecycleDelegate.close();
      closePromise.resolve();
      await promise;

      expect(stateMachine.state).toBe(BookState.CLOSED);

      // Setup new animation promises for second open
      const openPromise2 = createControllablePromise();
      const finishPromise2 = createControllablePromise();
      mockAnimator.runOpenAnimation.mockReturnValue(openPromise2.promise);
      mockAnimator.finishOpenAnimation.mockReturnValue(finishPromise2.promise);

      // Open again
      promise = lifecycleDelegate.open(0);
      openPromise2.resolve('completed');
      await Promise.resolve();
      finishPromise2.resolve();
      await promise;

      expect(stateMachine.state).toBe(BookState.OPENED);
    });
  });

  describe('State Tracking', () => {
    it('should track all state transitions during open', async () => {
      const states = [];
      stateMachine.subscribe((state) => states.push(state));

      const openPromise = lifecycleDelegate.open(0);
      await completeOpenAnimation();
      await openPromise;

      expect(states).toEqual([BookState.OPENING, BookState.OPENED]);
    });

    it('should track all state transitions during close', async () => {
      // Open first
      const openPromise = lifecycleDelegate.open(0);
      await completeOpenAnimation();
      await openPromise;

      const states = [];
      stateMachine.subscribe((state) => states.push(state));

      const closePromise = createControllablePromise();
      mockAnimator.runCloseAnimation.mockReturnValue(closePromise.promise);

      const promise = lifecycleDelegate.close();
      closePromise.resolve();
      await promise;

      expect(states).toEqual([BookState.CLOSING, BookState.CLOSED]);
    });
  });
});
