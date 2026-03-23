/**
 * Unit tests for LifecycleDelegate
 * Book lifecycle: open, close, repaginate
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mocks
const { mockErrorHandler } = vi.hoisted(() => ({
  mockErrorHandler: {
    handle: vi.fn(),
  },
}));

vi.mock('../../../../js/utils/ErrorHandler.js', () => ({
  ErrorHandler: mockErrorHandler,
}));

const mockConfig = {
  CHAPTERS: [
    { id: 'ch1', file: 'content/part_1.html' },
    { id: 'ch2', file: 'content/part_2.html' },
  ],
  COVER_BG: 'images/cover.webp',
  COVER_BG_MOBILE: 'images/cover_m.webp',
  LAYOUT: {
    MIN_PAGE_WIDTH_RATIO: 0.3,
    SETTLE_DELAY: 50,
  },
  BOOK_ID: null,
};

vi.mock('../../../../js/config.js', () => ({
  getConfig: () => mockConfig,
  BookState: {
    CLOSED: 'CLOSED',
    OPENING: 'OPENING',
    OPENED: 'OPENED',
    FLIPPING: 'FLIPPING',
    CLOSING: 'CLOSING',
  },
  Direction: {
    NEXT: "next",
    PREV: "prev",
  },
}));

const { LifecycleDelegate } = await import('../../../../js/core/delegates/LifecycleDelegate.js');
const { DelegateEvents } = await import('../../../../js/core/delegates/BaseDelegate.js');

describe('LifecycleDelegate', () => {
  let delegate;
  let mockDeps;
  let eventHandlers;

  beforeEach(() => {
    vi.useFakeTimers();

    // Event handlers to capture emitted events
    eventHandlers = {
      onPaginationComplete: vi.fn(),
      onIndexChange: vi.fn(),
      onChapterUpdate: vi.fn(),
    };

    mockDeps = {
      stateMachine: {
        current: 'CLOSED',
        get state() { return this.current; },
        get isClosed() { return this.current === 'CLOSED'; },
        get isOpened() { return this.current === 'OPENED'; },
        get isBusy() { return ['OPENING', 'CLOSING', 'FLIPPING'].includes(this.current); },
        transitionTo: vi.fn((state) => {
          mockDeps.stateMachine.current = state;
          return true;
        }),
        reset: vi.fn((state) => {
          mockDeps.stateMachine.current = state;
        }),
      },
      backgroundManager: {
        preload: vi.fn().mockResolvedValue(undefined),
        setBackground: vi.fn(),
      },
      contentLoader: {
        load: vi.fn().mockResolvedValue('<html><body>Content</body></html>'),
        abort: vi.fn(),
      },
      paginator: {
        paginate: vi.fn().mockResolvedValue({
          pageData: { sourceElement: document.createElement('div'), pageCount: 1, pageWidth: 400, pageHeight: 600 },
          chapterStarts: [0],
        }),
      },
      renderer: {
        renderSpread: vi.fn(),
        clearCache: vi.fn(),
        getMaxIndex: vi.fn(() => 100),
      },
      animator: {
        runOpenAnimation: vi.fn().mockResolvedValue({ aborted: false }),
        finishOpenAnimation: vi.fn().mockResolvedValue(undefined),
        runCloseAnimation: vi.fn().mockResolvedValue(undefined),
        abort: vi.fn(),
      },
      loadingIndicator: {
        show: vi.fn(),
        hide: vi.fn(),
      },
      soundManager: {
        preload: vi.fn().mockResolvedValue(undefined),
        play: vi.fn(),
      },
      ambientManager: {
        setType: vi.fn(),
      },
      settings: {
        get: vi.fn((key) => {
          if (key === 'ambientType') return 'rain';
          return null;
        }),
      },
      mediaQueries: {
        get: vi.fn((key) => key === 'mobile' ? false : null),
        get isMobile() { return this.get("mobile"); }
      },
      dom: {
        get: vi.fn((key) => {
          if (key === 'rightA' || key === 'leftA') {
            const el = document.createElement('div');
            el.classList = { add: vi.fn(), remove: vi.fn() };
            Object.defineProperty(el, 'offsetWidth', { value: 500 });
            return el;
          }
          if (key === 'book') {
            const el = document.createElement('div');
            Object.defineProperty(el, 'offsetWidth', { value: 1000 });
            return el;
          }
          return null;
        }),
      },
      state: {
        index: 0,
        chapterStarts: [0],
      },
    };

    delegate = new LifecycleDelegate(mockDeps);

    // Subscribe to delegate events
    delegate.on(DelegateEvents.PAGINATION_COMPLETE, eventHandlers.onPaginationComplete);
    delegate.on(DelegateEvents.INDEX_CHANGE, eventHandlers.onIndexChange);
    delegate.on(DelegateEvents.CHAPTER_UPDATE, eventHandlers.onChapterUpdate);

    mockErrorHandler.handle.mockClear();
  });

  afterEach(() => {
    delegate.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should store references', () => {
      expect(delegate.contentLoader).toBe(mockDeps.contentLoader);
      expect(delegate.paginator).toBe(mockDeps.paginator);
      expect(delegate.loadingIndicator).toBe(mockDeps.loadingIndicator);
    });

    it('should throw error if required dependencies are missing', () => {
      expect(() => new LifecycleDelegate({})).toThrow('LifecycleDelegate');
    });
  });

  describe('init', () => {
    it('should preload cover background', async () => {
      await delegate.init();

      expect(mockDeps.backgroundManager.preload).toHaveBeenCalledWith('images/cover.webp', true);
    });

    it('should preload mobile cover on mobile', async () => {
      mockDeps.mediaQueries.get.mockImplementation((key) => key === 'mobile' ? true : null);

      await delegate.init();

      expect(mockDeps.backgroundManager.preload).toHaveBeenCalledWith('images/cover_m.webp', true);
    });

    it('should preload sounds', async () => {
      await delegate.init();

      expect(mockDeps.soundManager.preload).toHaveBeenCalled();
    });
  });

  describe('open', () => {
    it('should not open if busy', async () => {
      mockDeps.stateMachine.current = 'OPENING';

      await delegate.open();

      expect(mockDeps.contentLoader.load).not.toHaveBeenCalled();
    });

    it('should not open if already opened', async () => {
      mockDeps.stateMachine.current = 'OPENED';

      await delegate.open();

      expect(mockDeps.contentLoader.load).not.toHaveBeenCalled();
    });

    it('should transition to OPENING', async () => {
      const openPromise = delegate.open();
      await vi.runAllTimersAsync();
      await openPromise;

      expect(mockDeps.stateMachine.transitionTo).toHaveBeenCalledWith('OPENING');
    });

    it('should play book open sound', async () => {
      const openPromise = delegate.open();
      await vi.runAllTimersAsync();
      await openPromise;

      expect(mockDeps.soundManager.play).toHaveBeenCalledWith('bookOpen');
    });

    it('should show loading indicator', async () => {
      const openPromise = delegate.open();
      await vi.runAllTimersAsync();
      await openPromise;

      expect(mockDeps.loadingIndicator.show).toHaveBeenCalled();
    });

    it('should load content', async () => {
      const openPromise = delegate.open();
      await vi.runAllTimersAsync();
      await openPromise;

      expect(mockDeps.contentLoader.load).toHaveBeenCalledWith([
        { file: 'content/part_1.html', id: 'ch1', htmlContent: undefined },
        { file: 'content/part_2.html', id: 'ch2', htmlContent: undefined },
      ]);
    });

    it('should run open animation', async () => {
      const openPromise = delegate.open();
      await vi.runAllTimersAsync();
      await openPromise;

      expect(mockDeps.animator.runOpenAnimation).toHaveBeenCalled();
    });

    it('should paginate content', async () => {
      const openPromise = delegate.open();
      await vi.runAllTimersAsync();
      await openPromise;

      expect(mockDeps.paginator.paginate).toHaveBeenCalled();
    });

    it('should emit paginationComplete event', async () => {
      const openPromise = delegate.open();
      await vi.runAllTimersAsync();
      await openPromise;

      expect(eventHandlers.onPaginationComplete).toHaveBeenCalled();
    });

    it('should render initial spread', async () => {
      const openPromise = delegate.open();
      await vi.runAllTimersAsync();
      await openPromise;

      expect(mockDeps.renderer.renderSpread).toHaveBeenCalledWith(0, false);
    });

    it('should render at specified start index', async () => {
      const openPromise = delegate.open(50);
      await vi.runAllTimersAsync();
      await openPromise;

      expect(mockDeps.renderer.renderSpread).toHaveBeenCalledWith(50, false);
    });

    it('should clamp start index to max', async () => {
      mockDeps.renderer.getMaxIndex.mockReturnValue(30);

      const openPromise = delegate.open(100);
      await vi.runAllTimersAsync();
      await openPromise;

      expect(mockDeps.renderer.renderSpread).toHaveBeenCalledWith(30, false);
    });

    it('should finish open animation', async () => {
      const openPromise = delegate.open();
      await vi.runAllTimersAsync();
      await openPromise;

      expect(mockDeps.animator.finishOpenAnimation).toHaveBeenCalled();
    });

    it('should transition to OPENED', async () => {
      const openPromise = delegate.open();
      await vi.runAllTimersAsync();
      await openPromise;

      expect(mockDeps.stateMachine.transitionTo).toHaveBeenCalledWith('OPENED');
    });

    it('should hide loading indicator', async () => {
      const openPromise = delegate.open();
      await vi.runAllTimersAsync();
      await openPromise;

      expect(mockDeps.loadingIndicator.hide).toHaveBeenCalled();
    });

    it('should handle animation abort gracefully', async () => {
      mockDeps.animator.runOpenAnimation.mockResolvedValue(null);

      const openPromise = delegate.open();
      await vi.runAllTimersAsync();
      await openPromise;

      expect(mockDeps.paginator.paginate).not.toHaveBeenCalled();
    });

    it('should handle content load failure', async () => {
      mockDeps.contentLoader.load.mockResolvedValue(null);

      const openPromise = delegate.open();
      await vi.runAllTimersAsync();
      await openPromise;

      expect(mockDeps.paginator.paginate).not.toHaveBeenCalled();
    });

    it('should handle errors and reset state', async () => {
      mockDeps.paginator.paginate.mockRejectedValue(new Error('Pagination failed'));

      const openPromise = delegate.open();
      await vi.runAllTimersAsync();
      await openPromise;

      expect(mockDeps.stateMachine.reset).toHaveBeenCalledWith('CLOSED');
      expect(mockErrorHandler.handle).toHaveBeenCalled();
    });

    it('should not report AbortError', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockDeps.contentLoader.load.mockRejectedValue(abortError);

      const openPromise = delegate.open();
      await vi.runAllTimersAsync();
      await openPromise;

      expect(mockErrorHandler.handle).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    beforeEach(() => {
      mockDeps.stateMachine.current = 'OPENED';
    });

    it('should not close if busy', async () => {
      mockDeps.stateMachine.current = 'FLIPPING';

      await delegate.close();

      expect(mockDeps.animator.runCloseAnimation).not.toHaveBeenCalled();
    });

    it('should not close if not opened', async () => {
      mockDeps.stateMachine.current = 'CLOSED';

      await delegate.close();

      expect(mockDeps.animator.runCloseAnimation).not.toHaveBeenCalled();
    });

    it('should transition to CLOSING', async () => {
      const closePromise = delegate.close();
      await vi.runAllTimersAsync();
      await closePromise;

      expect(mockDeps.stateMachine.transitionTo).toHaveBeenCalledWith('CLOSING');
    });

    it('should play book close sound', async () => {
      const closePromise = delegate.close();
      await vi.runAllTimersAsync();
      await closePromise;

      expect(mockDeps.soundManager.play).toHaveBeenCalledWith('bookClose');
    });

    it('should run close animation', async () => {
      const closePromise = delegate.close();
      await vi.runAllTimersAsync();
      await closePromise;

      expect(mockDeps.animator.runCloseAnimation).toHaveBeenCalled();
    });

    it('should not emit indexChange on close (runtime reset handled by DelegateMediator)', async () => {
      const closePromise = delegate.close();
      await vi.runAllTimersAsync();
      await closePromise;

      expect(eventHandlers.onIndexChange).not.toHaveBeenCalled();
    });

    it('should clear renderer cache', async () => {
      const closePromise = delegate.close();
      await vi.runAllTimersAsync();
      await closePromise;

      expect(mockDeps.renderer.clearCache).toHaveBeenCalled();
    });

    it('should transition to CLOSED', async () => {
      const closePromise = delegate.close();
      await vi.runAllTimersAsync();
      await closePromise;

      expect(mockDeps.stateMachine.transitionTo).toHaveBeenCalledWith('CLOSED');
    });

    it('should handle errors and reset to OPENED', async () => {
      mockDeps.animator.runCloseAnimation.mockRejectedValue(new Error('Animation failed'));

      const closePromise = delegate.close();
      await vi.runAllTimersAsync();
      await closePromise;

      expect(mockDeps.stateMachine.reset).toHaveBeenCalledWith('OPENED');
    });
  });

  describe('repaginate', () => {
    it('should show loading indicator', async () => {
      const promise = delegate.repaginate();
      await vi.runAllTimersAsync();
      await promise;

      expect(mockDeps.loadingIndicator.show).toHaveBeenCalled();
    });

    it('should clear renderer cache', async () => {
      const promise = delegate.repaginate();
      await vi.runAllTimersAsync();
      await promise;

      expect(mockDeps.renderer.clearCache).toHaveBeenCalled();
    });

    it('should load content', async () => {
      const promise = delegate.repaginate();
      await vi.runAllTimersAsync();
      await promise;

      expect(mockDeps.contentLoader.load).toHaveBeenCalled();
    });

    it('should paginate', async () => {
      const promise = delegate.repaginate();
      await vi.runAllTimersAsync();
      await promise;

      expect(mockDeps.paginator.paginate).toHaveBeenCalled();
    });

    it('should keep current index when keepIndex is true', async () => {
      mockDeps.state.index = 50;
      mockDeps.renderer.getMaxIndex.mockReturnValue(100);

      const promise = delegate.repaginate(true);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockDeps.renderer.renderSpread).toHaveBeenCalledWith(50, false);
    });

    it('should reset to 0 when keepIndex is false', async () => {
      mockDeps.state.index = 50;

      const promise = delegate.repaginate(false);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockDeps.renderer.renderSpread).toHaveBeenCalledWith(0, false);
    });

    it('should clamp index to new max if content is shorter', async () => {
      mockDeps.state.index = 100;
      mockDeps.renderer.getMaxIndex.mockReturnValue(50);

      const promise = delegate.repaginate(true);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockDeps.renderer.renderSpread).toHaveBeenCalledWith(50, false);
    });

    it('should hide loading indicator', async () => {
      const promise = delegate.repaginate();
      await vi.runAllTimersAsync();
      await promise;

      expect(mockDeps.loadingIndicator.hide).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockDeps.contentLoader.load.mockRejectedValue(new Error('Load failed'));

      const promise = delegate.repaginate();
      await vi.runAllTimersAsync();
      await promise;

      expect(mockErrorHandler.handle).toHaveBeenCalled();
      expect(mockDeps.loadingIndicator.hide).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should clear all references', () => {
      delegate.destroy();

      expect(delegate.contentLoader).toBeNull();
      expect(delegate.paginator).toBeNull();
      expect(delegate.loadingIndicator).toBeNull();
    });

    it('should remove all event listeners', () => {
      delegate.destroy();

      // Emitting events after destroy should not call handlers
      delegate.emit(DelegateEvents.PAGINATION_COMPLETE, { pageData: null, chapterStarts: [] });
      delegate.emit(DelegateEvents.INDEX_CHANGE, 5);
      delegate.emit(DelegateEvents.CHAPTER_UPDATE);

      expect(eventHandlers.onPaginationComplete).not.toHaveBeenCalled();
      expect(eventHandlers.onIndexChange).not.toHaveBeenCalled();
      expect(eventHandlers.onChapterUpdate).not.toHaveBeenCalled();
    });
  });
});
