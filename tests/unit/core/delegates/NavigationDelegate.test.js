/**
 * Unit tests for NavigationDelegate
 * Page navigation: flip, flipToPage, handleTOCNavigation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mocks
const { mockCssVars, mockRateLimiters, mockTrackChapterCompleted, mockUpdateReadingPage } = vi.hoisted(() => ({
  mockCssVars: {
    getNumber: vi.fn((name, defaultVal) => defaultVal),
  },
  mockRateLimiters: {
    navigation: {
      tryAction: vi.fn(() => true),
      reset: vi.fn(),
    },
    chapter: {
      tryAction: vi.fn(() => true),
      reset: vi.fn(),
    },
  },
  mockTrackChapterCompleted: vi.fn(),
  mockUpdateReadingPage: vi.fn(),
}));

vi.mock('../../../../js/utils/CSSVariables.js', () => ({
  cssVars: mockCssVars,
}));

vi.mock('../../../../js/utils/index.js', () => ({
  rateLimiters: mockRateLimiters,
}));

vi.mock('../../../../js/utils/Analytics.js', () => ({
  trackChapterCompleted: mockTrackChapterCompleted,
  updateReadingPage: mockUpdateReadingPage,
}));

// Mock config — BOOK_ID нужен для _checkChapterCompleted
const mockConfig = {
  TIMING: {
    FLIP_THROTTLE: 100,
  },
  BOOK_ID: 'test-book-123',
};

vi.mock('../../../../js/config.js', () => ({
  CONFIG: mockConfig,
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

const { NavigationDelegate } = await import('../../../../js/core/delegates/NavigationDelegate.js');
const { DelegateEvents } = await import('../../../../js/core/delegates/BaseDelegate.js');

describe('NavigationDelegate', () => {
  let delegate;
  let mockDeps;
  let eventHandlers;

  beforeEach(() => {
    // Event handlers to capture emitted events
    eventHandlers = {
      onIndexChange: vi.fn(),
      onBookOpen: vi.fn(),
      onBookClose: vi.fn(),
    };

    mockDeps = {
      stateMachine: {
        current: 'OPENED',
        get isOpened() { return this.current === 'OPENED'; },
        get isClosed() { return this.current === 'CLOSED'; },
        get isBusy() { return this.current === 'FLIPPING' || this.current === 'OPENING' || this.current === 'CLOSING'; },
        transitionTo: vi.fn(() => true),
        forceTransitionTo: vi.fn(),
      },
      renderer: {
        getMaxIndex: vi.fn(() => 100),
        prepareBuffer: vi.fn(),
        prepareSheet: vi.fn(),
        swapBuffers: vi.fn(),
      },
      animator: {
        runFlip: vi.fn().mockResolvedValue(undefined),
      },
      settings: {
        get: vi.fn((key) => {
          if (key === 'soundEnabled') return true;
          if (key === 'soundVolume') return 0.5;
          return null;
        }),
      },
      soundManager: {
        play: vi.fn(),
      },
      mediaQueries: {
        get: vi.fn((key) => key === 'mobile' ? false : null),
        get isMobile() { return this.get("mobile"); }
      },
      state: {
        index: 0,
        chapterStarts: [0, 50, 100],
      },
    };

    delegate = new NavigationDelegate(mockDeps);

    // Subscribe to delegate events
    delegate.on(DelegateEvents.INDEX_CHANGE, eventHandlers.onIndexChange);
    delegate.on(DelegateEvents.BOOK_OPEN, eventHandlers.onBookOpen);
    delegate.on(DelegateEvents.BOOK_CLOSE, eventHandlers.onBookClose);
  });

  afterEach(() => {
    delegate.destroy();
    vi.restoreAllMocks();
    mockRateLimiters.navigation.tryAction.mockReturnValue(true);
    mockRateLimiters.chapter.tryAction.mockReturnValue(true);
    mockTrackChapterCompleted.mockClear();
  });

  describe('constructor', () => {
    it('should extend EventEmitter', () => {
      expect(typeof delegate.on).toBe('function');
      expect(typeof delegate.emit).toBe('function');
    });

    it('should throw error if required dependencies are missing', () => {
      expect(() => new NavigationDelegate({})).toThrow('NavigationDelegate');
    });
  });

  describe('flip', () => {
    describe('when book is closed', () => {
      beforeEach(() => {
        mockDeps.stateMachine.current = 'CLOSED';
      });

      it('should open book when flipping next', async () => {
        await delegate.flip('next');

        expect(eventHandlers.onBookOpen).toHaveBeenCalled();
      });

      it('should not flip when direction is prev', async () => {
        await delegate.flip('prev');

        expect(eventHandlers.onBookOpen).not.toHaveBeenCalled();
        expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
      });
    });

    describe('when book is opened', () => {
      beforeEach(() => {
        mockDeps.stateMachine.current = 'OPENED';
      });

      it('should close book when at first page and flipping prev', async () => {
        mockDeps.state.index = 0;

        await delegate.flip('prev');

        expect(eventHandlers.onBookClose).toHaveBeenCalled();
      });

      it('should not close if not at first page', async () => {
        mockDeps.state.index = 10;

        await delegate.flip('prev');

        expect(eventHandlers.onBookClose).not.toHaveBeenCalled();
        expect(mockDeps.stateMachine.transitionTo).toHaveBeenCalledWith('FLIPPING');
      });

      it('should flip to next page', async () => {
        mockDeps.state.index = 10;

        await delegate.flip('next');

        expect(mockDeps.stateMachine.transitionTo).toHaveBeenCalledWith('FLIPPING');
        expect(mockDeps.animator.runFlip).toHaveBeenCalledWith('next', expect.any(Function));
      });

      it('should not flip beyond max index', async () => {
        mockDeps.state.index = 100; // At max
        mockDeps.renderer.getMaxIndex.mockReturnValue(100);

        await delegate.flip('next');

        expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
      });

      it('should not flip below 0', async () => {
        mockDeps.state.index = 0;

        // Create delegate without any listeners to test boundary
        const localDelegate = new NavigationDelegate(mockDeps);

        await localDelegate.flip('prev');

        expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
        localDelegate.destroy();
      });
    });

    describe('when book is busy', () => {
      it('should not flip when already flipping', async () => {
        mockDeps.stateMachine.current = 'FLIPPING';

        await delegate.flip('next');

        expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
      });
    });

    describe('rate limiting', () => {
      it('should check rate limiter before flipping', async () => {
        mockDeps.state.index = 10;

        await delegate.flip('next');

        expect(mockRateLimiters.navigation.tryAction).toHaveBeenCalled();
      });

      it('should block flip when rate limited', async () => {
        mockRateLimiters.navigation.tryAction.mockReturnValue(false);
        mockDeps.state.index = 10;

        await delegate.flip('next');

        expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
      });

      it('should allow flip when rate limiter allows', async () => {
        mockRateLimiters.navigation.tryAction.mockReturnValue(true);
        mockDeps.state.index = 10;

        await delegate.flip('next');

        expect(mockDeps.animator.runFlip).toHaveBeenCalled();
      });
    });

    describe('mobile mode', () => {
      it('should flip one page at a time on mobile', async () => {
        mockDeps.mediaQueries.get.mockImplementation((key) => key === 'mobile' ? true : null);
        mockDeps.state.index = 5;

        await delegate.flip('next');

        // In mobile, pagesPerFlip is 1
        expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(6, true);
      });
    });

    describe('desktop mode', () => {
      it('should flip two pages at a time on desktop', async () => {
        mockDeps.mediaQueries.get.mockImplementation((key) => key === 'mobile' ? false : null);
        mockDeps.state.index = 0;

        await delegate.flip('next');

        // In desktop, pagesPerFlip is 2
        expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(2, false);
      });
    });
  });

  describe('flipToPage', () => {
    beforeEach(() => {
      mockDeps.stateMachine.current = 'OPENED';
    });

    it('should not flip if busy', async () => {
      mockDeps.stateMachine.current = 'FLIPPING';

      await delegate.flipToPage(50, 'next');

      expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
    });

    it('should not flip if book not opened', async () => {
      mockDeps.stateMachine.current = 'CLOSED';

      await delegate.flipToPage(50, 'next');

      expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
    });

    it('should clamp target to valid range', async () => {
      mockDeps.state.index = 50;
      mockDeps.renderer.getMaxIndex.mockReturnValue(100);

      await delegate.flipToPage(150, 'next'); // Beyond max

      expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(100, false);
    });

    it('should clamp target to 0 if negative', async () => {
      mockDeps.state.index = 50;

      await delegate.flipToPage(-10, 'prev');

      expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(0, false);
    });

    it('should not flip if already at target', async () => {
      mockDeps.state.index = 50;

      await delegate.flipToPage(50, 'next');

      expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
    });

    it('should execute flip to target page', async () => {
      mockDeps.state.index = 10;

      await delegate.flipToPage(50, 'next');

      expect(mockDeps.animator.runFlip).toHaveBeenCalledWith('next', expect.any(Function));
    });
  });

  describe('handleTOCNavigation', () => {
    describe('when book is closed', () => {
      it('should open book', async () => {
        mockDeps.stateMachine.current = 'CLOSED';

        await delegate.handleTOCNavigation(0);

        expect(eventHandlers.onBookOpen).toHaveBeenCalled();
      });
    });

    describe('when book is opened', () => {
      beforeEach(() => {
        mockDeps.stateMachine.current = 'OPENED';
        mockDeps.state.index = 50;
      });

      it('should go to beginning when chapter is undefined', async () => {
        await delegate.handleTOCNavigation(undefined);

        expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(0, false);
      });

      it('should go to end when chapter is -1', async () => {
        mockDeps.renderer.getMaxIndex.mockReturnValue(100);

        await delegate.handleTOCNavigation(-1);

        expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(100, false);
      });

      it('should go to specific chapter', async () => {
        // Chapter 1 starts at page 50, but we're at 50, so change index first
        mockDeps.state.index = 10; // Not at chapter start

        await delegate.handleTOCNavigation(1);

        expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(50, false);
      });

      it('should align to spread on desktop', async () => {
        mockDeps.state.chapterStarts = [0, 51, 100]; // Chapter 1 at odd index
        mockDeps.state.index = 10;

        await delegate.handleTOCNavigation(1);

        // Should align to 50 (even) for desktop spread
        expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(50, false);
      });

      it('should not align on mobile', async () => {
        mockDeps.mediaQueries.get.mockImplementation((key) => key === 'mobile' ? true : null);
        mockDeps.state.chapterStarts = [0, 51, 100];
        mockDeps.state.index = 10;

        await delegate.handleTOCNavigation(1);

        // Should go to exact page on mobile
        expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(51, true);
      });

      it('should do nothing for invalid chapter', async () => {
        await delegate.handleTOCNavigation(99);

        expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
      });

      it('should check chapter rate limiter', async () => {
        await delegate.handleTOCNavigation(1);

        expect(mockRateLimiters.chapter.tryAction).toHaveBeenCalled();
      });

      it('should block when chapter rate limited', async () => {
        mockRateLimiters.chapter.tryAction.mockReturnValue(false);

        await delegate.handleTOCNavigation(1);

        expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
      });
    });
  });

  describe('_executeFlip', () => {
    beforeEach(() => {
      mockDeps.stateMachine.current = 'OPENED';
    });

    it('should not execute if transition fails', async () => {
      mockDeps.stateMachine.transitionTo.mockReturnValue(false);

      await delegate.flip('next');

      expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
    });

    it('should play flip sound', async () => {
      await delegate.flip('next');

      // Sound is called with options for playback rate variation
      expect(mockDeps.soundManager.play).toHaveBeenCalledWith('pageFlip', expect.objectContaining({
        playbackRate: expect.any(Number),
      }));
    });

    it('should prepare buffer and sheet', async () => {
      mockDeps.state.index = 10;

      await delegate.flip('next');

      expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalled();
      expect(mockDeps.renderer.prepareSheet).toHaveBeenCalled();
    });

    it('should call swapBuffers during animation', async () => {
      await delegate.flip('next');

      const swapCallback = mockDeps.animator.runFlip.mock.calls[0][1];
      swapCallback();

      expect(mockDeps.renderer.swapBuffers).toHaveBeenCalled();
    });

    it('should transition back to OPENED after flip', async () => {
      await delegate.flip('next');

      expect(mockDeps.stateMachine.transitionTo).toHaveBeenLastCalledWith('OPENED');
    });

    it('should emit indexChange event after flip', async () => {
      mockDeps.state.index = 10;

      await delegate.flip('next');

      expect(eventHandlers.onIndexChange).toHaveBeenCalledWith(12); // 10 + 2 on desktop
    });

    it('should handle errors gracefully', async () => {
      mockDeps.animator.runFlip.mockRejectedValue(new Error('Animation failed'));

      await delegate.flip('next');

      expect(mockDeps.stateMachine.forceTransitionTo).toHaveBeenCalledWith('OPENED');
    });
  });

  describe('destroy', () => {
    it('should remove all event listeners', () => {
      delegate.destroy();

      // Emitting events after destroy should not call handlers
      delegate.emit(DelegateEvents.INDEX_CHANGE, 5);
      delegate.emit(DelegateEvents.BOOK_OPEN);
      delegate.emit(DelegateEvents.BOOK_CLOSE);

      // Handlers should not be called after destroy
      expect(eventHandlers.onIndexChange).not.toHaveBeenCalled();
      expect(eventHandlers.onBookOpen).not.toHaveBeenCalled();
      expect(eventHandlers.onBookClose).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEC-BASED: flip guard — busy states OPENING/CLOSING (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('flip guard — busy states OPENING/CLOSING (spec-based)', () => {
    it('should block flip when busy (OPENING)', () => {
      mockDeps.stateMachine.current = 'OPENING';
      mockDeps.state.index = 10;

      delegate.flip('next');

      expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
    });

    it('should block flip when busy (CLOSING)', () => {
      mockDeps.stateMachine.current = 'CLOSING';
      mockDeps.state.index = 10;

      delegate.flip('next');

      expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEC-BASED: flip boundary — nextIndex validation (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('flip boundary — nextIndex validation (spec-based)', () => {
    beforeEach(() => {
      mockDeps.stateMachine.current = 'OPENED';
    });

    it('should allow flipping forward when exactly at index 0', async () => {
      mockDeps.state.index = 0;
      mockDeps.renderer.getMaxIndex.mockReturnValue(100);

      await delegate.flip('next');

      expect(mockDeps.animator.runFlip).toHaveBeenCalled();
    });

    it('should allow flipping forward when nextIndex equals maxIndex', async () => {
      // Desktop pagesPerFlip=2, index=98, max=100 → next=100=max → OK
      mockDeps.state.index = 98;
      mockDeps.renderer.getMaxIndex.mockReturnValue(100);

      await delegate.flip('next');

      expect(mockDeps.animator.runFlip).toHaveBeenCalled();
    });

    it('should allow flipping backward from index=2 to 0', async () => {
      mockDeps.state.index = 2;

      await delegate.flip('prev');

      expect(mockDeps.animator.runFlip).toHaveBeenCalled();
      expect(eventHandlers.onIndexChange).toHaveBeenCalledWith(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEC-BASED: handleTOCNavigation — rate limit early return (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('handleTOCNavigation — rate limit early return (spec-based)', () => {
    beforeEach(() => {
      mockDeps.stateMachine.current = 'OPENED';
      mockDeps.state.index = 10;
    });

    it('should not call transitionTo when rate limited', async () => {
      mockRateLimiters.chapter.tryAction.mockReturnValue(false);

      await delegate.handleTOCNavigation(1);

      expect(mockDeps.stateMachine.transitionTo).not.toHaveBeenCalled();
    });

    it('should not prepare buffer when rate limited', async () => {
      mockRateLimiters.chapter.tryAction.mockReturnValue(false);

      await delegate.handleTOCNavigation(1);

      expect(mockDeps.renderer.prepareBuffer).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEC-BASED: handleTOCNavigation — direction determination (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('handleTOCNavigation — direction (spec-based)', () => {
    beforeEach(() => {
      mockDeps.stateMachine.current = 'OPENED';
    });

    it('should use NEXT direction when target page > current index', async () => {
      mockDeps.state.index = 10;
      mockDeps.state.chapterStarts = [0, 50, 100];

      await delegate.handleTOCNavigation(1); // chapter 1 starts at page 50

      expect(mockDeps.animator.runFlip).toHaveBeenCalledWith('next', expect.any(Function));
    });

    it('should use PREV direction when target page < current index', async () => {
      mockDeps.state.index = 80;
      mockDeps.state.chapterStarts = [0, 50, 100];

      await delegate.handleTOCNavigation(0); // chapter 0 starts at page 0

      expect(mockDeps.animator.runFlip).toHaveBeenCalledWith('prev', expect.any(Function));
    });

    it('should handle navigation to pageIndex=null gracefully', async () => {
      mockDeps.state.index = 50;

      await delegate.handleTOCNavigation(null);

      // null → pageIndex null → should not flip (null check)
      expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
    });

    it('should handle navigation to pageIndex=undefined gracefully', async () => {
      mockDeps.state.index = 50;

      await delegate.handleTOCNavigation(undefined);

      // undefined → should go to beginning (chapter index treated differently)
      // but if pageIndex is undefined from lookup → prepareBuffer(0, ...)
      expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(0, false);
    });

    it('should not flip when target equals current index', async () => {
      mockDeps.state.index = 50;
      mockDeps.state.chapterStarts = [0, 50, 100];

      await delegate.handleTOCNavigation(1); // chapter 1 = page 50 = current

      expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
    });
  });


  // ═══════════════════════════════════════════════════════════════════════════
  // SPEC-BASED: _checkChapterCompleted — chapter tracking (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_checkChapterCompleted (spec-based)', () => {
    // Спецификация: при листании вперёд, если перешли границу главы — трекаем её завершение.
    // trackChapterCompleted(bookId, chapterIndex) вызывается с BOOK_ID из конфига.

    beforeEach(() => {
      // 3 главы: [0, 50, 100], maxIndex=150
      mockDeps.state.chapterStarts = [0, 50, 100];
      mockDeps.renderer.getMaxIndex.mockReturnValue(150);
    });

    it('should track chapter 0 when flipping forward from chapter 0 into chapter 1', () => {
      // prevIndex=48 (в главе 0), nextIndex=52 (в главе 1) → глава 0 дочитана
      delegate._checkChapterCompleted(48, 52, 'next');

      expect(mockTrackChapterCompleted).toHaveBeenCalledWith('test-book-123', 0);
    });

    it('should track first matching chapter (greedy match from i=0)', () => {
      // prevIndex=98, nextIndex=102: алгоритм находит первое совпадение
      // i=0: 98>=starts[0](0) && 102>=starts[1](50) → трекает главу 0
      delegate._checkChapterCompleted(98, 102, 'next');

      expect(mockTrackChapterCompleted).toHaveBeenCalledWith('test-book-123', 0);
    });

    it('should NOT track when direction is prev', () => {
      delegate._checkChapterCompleted(52, 48, 'prev');

      expect(mockTrackChapterCompleted).not.toHaveBeenCalled();
    });

    it('should NOT track when staying within same chapter', () => {
      // prevIndex=10, nextIndex=12 — оба в главе 0 (0..49)
      delegate._checkChapterCompleted(10, 12, 'next');

      expect(mockTrackChapterCompleted).not.toHaveBeenCalled();
    });

    it('should track last chapter when reaching maxIndex', () => {
      // prevIndex=140 (< maxIndex=150), nextIndex=150 (= maxIndex) → последняя глава дочитана
      delegate._checkChapterCompleted(140, 150, 'next');

      expect(mockTrackChapterCompleted).toHaveBeenCalledWith('test-book-123', 2);
    });

    it('should NOT track last chapter if already at maxIndex', () => {
      // prevIndex=150 (= maxIndex), nextIndex=150 → prevIndex не < maxIndex
      delegate._checkChapterCompleted(150, 150, 'next');

      // Не должен трекать, т.к. prevIndex >= maxIndex
      const lastChapterCalls = mockTrackChapterCompleted.mock.calls.filter(
        (c) => c[1] === 2
      );
      expect(lastChapterCalls.length).toBe(0);
    });

    it('should NOT track when only one chapter (starts.length < 2)', () => {
      mockDeps.state.chapterStarts = [0]; // одна глава

      delegate._checkChapterCompleted(0, 2, 'next');

      expect(mockTrackChapterCompleted).not.toHaveBeenCalled();
    });

    it('should use BOOK_ID from config as first argument', () => {
      delegate._checkChapterCompleted(48, 52, 'next');

      expect(mockTrackChapterCompleted).toHaveBeenCalledWith('test-book-123', expect.any(Number));
    });

    it('should use "default" when BOOK_ID is falsy', () => {
      mockConfig.BOOK_ID = '';

      delegate._checkChapterCompleted(48, 52, 'next');

      expect(mockTrackChapterCompleted).toHaveBeenCalledWith('default', 0);

      // Restore
      mockConfig.BOOK_ID = 'test-book-123';
    });

    it('should track chapter when prevIndex is exactly at chapter start', () => {
      // prevIndex=0 (= starts[0]), nextIndex=52 (>= starts[1]=50) → глава 0 дочитана
      delegate._checkChapterCompleted(0, 52, 'next');

      expect(mockTrackChapterCompleted).toHaveBeenCalledWith('test-book-123', 0);
    });

    it('should track chapter when nextIndex is exactly at next chapter start', () => {
      // prevIndex=48, nextIndex=50 (= starts[1]) → глава 0 дочитана
      delegate._checkChapterCompleted(48, 50, 'next');

      expect(mockTrackChapterCompleted).toHaveBeenCalledWith('test-book-123', 0);
    });

    it('should handle empty chapterStarts gracefully', () => {
      mockDeps.state.chapterStarts = [];

      expect(() => delegate._checkChapterCompleted(0, 2, 'next')).not.toThrow();
      expect(mockTrackChapterCompleted).not.toHaveBeenCalled();
    });

    it('should track exactly one chapter per boundary crossing', () => {
      // Пересекаем только одну границу
      delegate._checkChapterCompleted(48, 52, 'next');

      expect(mockTrackChapterCompleted).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEC-BASED: error recovery — isDestroyed check (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('error recovery (spec-based)', () => {
    it('should log non-empty error message when flip fails', async () => {
      mockDeps.stateMachine.current = 'OPENED';
      mockDeps.state.index = 10;
      mockDeps.animator.runFlip.mockRejectedValue(new Error('test failure'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await delegate.flip('next');

      expect(consoleSpy).toHaveBeenCalled();
      const loggedMessage = consoleSpy.mock.calls[0][0];
      expect(typeof loggedMessage).toBe('string');
      // Сообщение должно содержать контекст (не пустая строка)
      expect(loggedMessage.length).toBeGreaterThan(5);
      expect(loggedMessage).toContain('flip');
    });

    it('should forceTransitionTo OPENED on error', async () => {
      mockDeps.stateMachine.current = 'OPENED';
      mockDeps.state.index = 10;
      mockDeps.animator.runFlip.mockRejectedValue(new Error('failure'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await delegate.flip('next');

      expect(mockDeps.stateMachine.forceTransitionTo).toHaveBeenCalledWith('OPENED');
    });

    it('should not forceTransition if destroyed during flip error', async () => {
      mockDeps.stateMachine.current = 'OPENED';
      mockDeps.state.index = 10;
      mockDeps.animator.runFlip.mockImplementation(async () => {
        delegate.destroy();
        throw new Error('failure after destroy');
      });
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await delegate.flip('next');

      expect(mockDeps.stateMachine.forceTransitionTo).not.toHaveBeenCalled();
    });

    it('should not update index if destroyed during successful flip', async () => {
      mockDeps.stateMachine.current = 'OPENED';
      mockDeps.state.index = 10;
      mockDeps.animator.runFlip.mockImplementation(async (dir, cb) => {
        cb(); // swap buffers
        delegate.destroy();
      });

      await delegate.flip('next');

      expect(eventHandlers.onIndexChange).not.toHaveBeenCalled();
    });

    it('should not transition to OPENED if destroyed during successful flip', async () => {
      mockDeps.stateMachine.current = 'OPENED';
      mockDeps.state.index = 10;
      mockDeps.animator.runFlip.mockImplementation(async (dir, cb) => {
        cb();
        delegate.destroy();
      });

      await delegate.flip('next');

      // transitionTo('FLIPPING') вызван, но transitionTo('OPENED') после — нет
      const transitionCalls = mockDeps.stateMachine.transitionTo.mock.calls;
      const openedCalls = transitionCalls.filter((c) => c[0] === 'OPENED');
      expect(openedCalls.length).toBe(0);
    });
  });
});
