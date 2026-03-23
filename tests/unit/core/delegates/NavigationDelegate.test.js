/**
 * Unit tests for NavigationDelegate
 * Page navigation: flip, flipToPage, handleTOCNavigation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mocks
const { mockCssVars, mockRateLimiters } = vi.hoisted(() => ({
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
}));

vi.mock('../../../../js/utils/CSSVariables.js', () => ({
  cssVars: mockCssVars,
}));

vi.mock('../../../../js/utils/index.js', () => ({
  rateLimiters: mockRateLimiters,
}));

// Mock config
vi.mock('../../../../js/config.js', () => {
  const CONFIG = {
    TIMING: {
      FLIP_THROTTLE: 100,
    },
  };
  return {
    CONFIG,
    getConfig: () => CONFIG,
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
  };
});

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
});
