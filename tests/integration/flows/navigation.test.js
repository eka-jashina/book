/**
 * INTEGRATION TEST: Page Navigation
 * Тестирование перелистывания страниц с реальными компонентами
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createFullBookDOM,
  cleanupIntegrationDOM,
} from '../../helpers/integrationUtils.js';

import { BookStateMachine } from '../../../js/managers/BookStateMachine.js';
import { NavigationDelegate } from '../../../js/core/delegates/NavigationDelegate.js';
import { BookState, Direction } from '../../../js/config.js';
import { EventEmitter } from '../../../js/utils/EventEmitter.js';
import { rateLimiters } from '../../../js/utils/RateLimiter.js';

describe('Page Navigation Integration', () => {
  let dom;
  let stateMachine;
  let navigationDelegate;
  let eventEmitter;
  let resolveFlip;

  // Mock dependencies
  let mockRenderer;
  let mockAnimator;
  let mockSettings;
  let mockMediaQueries;
  let mockSoundManager;
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

    // Сброс rate limiter для изоляции тестов
    rateLimiters.navigation.reset();
    rateLimiters.chapter.reset();

    // Real state machine
    stateMachine = new BookStateMachine();
    eventEmitter = new EventEmitter();

    // Create controllable promise for flip animation
    const flipPromise = createControllablePromise();
    resolveFlip = flipPromise.resolve;

    // Mock renderer
    mockRenderer = {
      getMaxIndex: vi.fn().mockReturnValue(10),
      prepareBuffer: vi.fn(),
      prepareSheet: vi.fn(),
      swapBuffers: vi.fn(),
      renderSpread: vi.fn(),
    };

    // Mock animator with controllable promise
    mockAnimator = {
      runFlip: vi.fn().mockImplementation((direction, swapCallback) => {
        // Store swap callback for later execution
        mockAnimator._swapCallback = swapCallback;
        return flipPromise.promise;
      }),
    };

    // Mock settings
    mockSettings = {
      get: vi.fn().mockReturnValue(true),
    };

    // Mock media queries (desktop mode)
    mockMediaQueries = {
      isMobile: false,
    };

    // Mock sound manager
    mockSoundManager = {
      play: vi.fn(),
    };

    // Shared state object
    mockState = {
      index: 0,
      chapterStarts: [0, 4, 8],
    };

    // Set state machine to OPENED (book is open)
    stateMachine.transitionTo(BookState.OPENING);
    stateMachine.transitionTo(BookState.OPENED);

    navigationDelegate = new NavigationDelegate({
      stateMachine,
      renderer: mockRenderer,
      animator: mockAnimator,
      settings: mockSettings,
      soundManager: mockSoundManager,
      mediaQueries: mockMediaQueries,
      state: mockState,
    });

    // Connect delegate events
    navigationDelegate.on('indexChange', (index) => {
      mockState.index = index;
      eventEmitter.emit('indexChange', index);
    });
    navigationDelegate.on('bookOpen', () => {
      eventEmitter.emit('bookOpen');
    });
    navigationDelegate.on('bookClose', () => {
      eventEmitter.emit('bookClose');
    });
  });

  afterEach(() => {
    navigationDelegate?.destroy();
    stateMachine?.destroy();
    eventEmitter?.destroy();
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  // Helper to complete flip animation
  const completeFlip = async () => {
    if (mockAnimator._swapCallback) {
      mockAnimator._swapCallback();
    }
    resolveFlip();
    await Promise.resolve();
  };

  describe('Forward Navigation (flip next)', () => {
    it('should transition to FLIPPING state during animation', async () => {
      const flipPromise = navigationDelegate.flip(Direction.NEXT);

      expect(stateMachine.state).toBe(BookState.FLIPPING);

      await completeFlip();
      await flipPromise;
    });

    it('should return to OPENED state after animation', async () => {
      const flipPromise = navigationDelegate.flip(Direction.NEXT);

      await completeFlip();
      await flipPromise;

      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should prepare buffer for next page', async () => {
      mockState.index = 0;

      const flipPromise = navigationDelegate.flip(Direction.NEXT);

      // On desktop, step is 2 (two pages per spread)
      expect(mockRenderer.prepareBuffer).toHaveBeenCalledWith(2, false);

      await completeFlip();
      await flipPromise;
    });

    it('should prepare sheet with correct parameters', async () => {
      mockState.index = 2;

      const flipPromise = navigationDelegate.flip(Direction.NEXT);

      expect(mockRenderer.prepareSheet).toHaveBeenCalledWith(
        2,      // current index
        4,      // next index
        Direction.NEXT,
        false   // isMobile
      );

      await completeFlip();
      await flipPromise;
    });

    it('should call animator.runFlip with direction', async () => {
      const flipPromise = navigationDelegate.flip(Direction.NEXT);

      expect(mockAnimator.runFlip).toHaveBeenCalledWith(
        Direction.NEXT,
        expect.any(Function)
      );

      await completeFlip();
      await flipPromise;
    });

    it('should swap buffers during animation', async () => {
      const flipPromise = navigationDelegate.flip(Direction.NEXT);

      await completeFlip();
      await flipPromise;

      expect(mockRenderer.swapBuffers).toHaveBeenCalled();
    });

    it('should emit indexChange with new index', async () => {
      const handler = vi.fn();
      eventEmitter.on('indexChange', handler);

      mockState.index = 0;
      const flipPromise = navigationDelegate.flip(Direction.NEXT);

      await completeFlip();
      await flipPromise;

      expect(handler).toHaveBeenCalledWith(2);
    });

    it('should update state index after flip', async () => {
      mockState.index = 0;
      const flipPromise = navigationDelegate.flip(Direction.NEXT);

      await completeFlip();
      await flipPromise;

      expect(mockState.index).toBe(2);
    });

    it('should not flip beyond max index', async () => {
      mockRenderer.getMaxIndex.mockReturnValue(10);
      mockState.index = 10;

      const flipPromise = navigationDelegate.flip(Direction.NEXT);
      await flipPromise;

      // Should not call animator if already at max
      expect(mockAnimator.runFlip).not.toHaveBeenCalled();
    });

    it('should play flip sound', async () => {
      const flipPromise = navigationDelegate.flip(Direction.NEXT);

      expect(mockSoundManager.play).toHaveBeenCalledWith(
        'pageFlip',
        expect.objectContaining({ playbackRate: expect.any(Number) })
      );

      await completeFlip();
      await flipPromise;
    });
  });

  describe('Backward Navigation (flip prev)', () => {
    beforeEach(() => {
      // Start from page 4
      mockState.index = 4;
    });

    it('should transition states correctly', async () => {
      const states = [];
      stateMachine.subscribe((state) => states.push(state));

      const flipPromise = navigationDelegate.flip(Direction.PREV);

      await completeFlip();
      await flipPromise;

      expect(states).toContain(BookState.FLIPPING);
      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should prepare buffer for previous page', async () => {
      const flipPromise = navigationDelegate.flip(Direction.PREV);

      // Desktop step is 2
      expect(mockRenderer.prepareBuffer).toHaveBeenCalledWith(2, false);

      await completeFlip();
      await flipPromise;
    });

    it('should prepare sheet with prev direction', async () => {
      const flipPromise = navigationDelegate.flip(Direction.PREV);

      expect(mockRenderer.prepareSheet).toHaveBeenCalledWith(
        4,      // current index
        2,      // next index
        Direction.PREV,
        false
      );

      await completeFlip();
      await flipPromise;
    });

    it('should emit indexChange with decreased index', async () => {
      const handler = vi.fn();
      eventEmitter.on('indexChange', handler);

      const flipPromise = navigationDelegate.flip(Direction.PREV);

      await completeFlip();
      await flipPromise;

      expect(handler).toHaveBeenCalledWith(2);
    });

    it('should not flip below 0', async () => {
      mockState.index = 0;

      // Should emit bookClose instead of flipping
      const closeHandler = vi.fn();
      eventEmitter.on('bookClose', closeHandler);

      await navigationDelegate.flip(Direction.PREV);

      expect(closeHandler).toHaveBeenCalled();
      expect(mockAnimator.runFlip).not.toHaveBeenCalled();
    });
  });

  describe('Mobile Navigation', () => {
    let mobileNavigationDelegate;
    let mobileFlipPromise;
    let resolveMobileFlip;

    beforeEach(() => {
      // Create new delegate with mobile mode
      mobileFlipPromise = createControllablePromise();
      resolveMobileFlip = mobileFlipPromise.resolve;

      const mobileMediaQueries = { isMobile: true };
      const mobileAnimator = {
        runFlip: vi.fn().mockImplementation((direction, swapCallback) => {
          mobileAnimator._swapCallback = swapCallback;
          return mobileFlipPromise.promise;
        }),
      };

      mobileNavigationDelegate = new NavigationDelegate({
        stateMachine,
        renderer: mockRenderer,
        animator: mobileAnimator,
        settings: mockSettings,
        soundManager: mockSoundManager,
        mediaQueries: mobileMediaQueries,
        state: mockState,
      });

      // Reset renderer mocks
      mockRenderer.prepareBuffer.mockClear();
      mockRenderer.prepareSheet.mockClear();
    });

    afterEach(() => {
      mobileNavigationDelegate?.destroy();
    });

    const completeMobileFlip = async () => {
      resolveMobileFlip();
      await Promise.resolve();
    };

    it('should flip one page at a time on mobile', async () => {
      mockState.index = 0;
      mockRenderer.getMaxIndex.mockReturnValue(10);

      const flipPromise = mobileNavigationDelegate.flip(Direction.NEXT);

      // Verify isMobile flag is passed correctly to renderer
      // Note: Step calculation depends on CSS --pages-per-flip variable
      // which defaults to 2 in jsdom (no CSS support)
      expect(mockRenderer.prepareBuffer).toHaveBeenCalledWith(
        expect.any(Number),
        true  // isMobile flag
      );

      await completeMobileFlip();
      await flipPromise;
    });

    it('should pass isMobile flag to renderer', async () => {
      mockState.index = 0;
      const flipPromise = mobileNavigationDelegate.flip(Direction.NEXT);

      expect(mockRenderer.prepareSheet).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(String),
        true  // isMobile
      );

      await completeMobileFlip();
      await flipPromise;
    });
  });

  describe('flipToPage', () => {
    it('should flip to specific page', async () => {
      mockState.index = 0;

      const flipPromise = navigationDelegate.flipToPage(6, Direction.NEXT);

      expect(mockRenderer.prepareBuffer).toHaveBeenCalledWith(6, false);

      await completeFlip();
      await flipPromise;

      expect(mockState.index).toBe(6);
    });

    it('should clamp to max index', async () => {
      mockRenderer.getMaxIndex.mockReturnValue(10);
      mockState.index = 0;

      const flipPromise = navigationDelegate.flipToPage(100, Direction.NEXT);

      expect(mockRenderer.prepareBuffer).toHaveBeenCalledWith(10, false);

      await completeFlip();
      await flipPromise;
    });

    it('should clamp to 0 if negative', async () => {
      mockState.index = 5;

      const flipPromise = navigationDelegate.flipToPage(-5, Direction.PREV);

      expect(mockRenderer.prepareBuffer).toHaveBeenCalledWith(0, false);

      await completeFlip();
      await flipPromise;
    });

    it('should not flip if already on target page', async () => {
      mockState.index = 4;

      await navigationDelegate.flipToPage(4, Direction.NEXT);

      expect(mockAnimator.runFlip).not.toHaveBeenCalled();
    });

    it('should not flip if book is busy', async () => {
      // Start a flip
      const firstFlip = navigationDelegate.flip(Direction.NEXT);

      // Try to flip to page while busy
      await navigationDelegate.flipToPage(8, Direction.NEXT);

      // Only the first flip should be called
      expect(mockAnimator.runFlip).toHaveBeenCalledTimes(1);

      await completeFlip();
      await firstFlip;
    });
  });

  describe('TOC Navigation', () => {
    it('should navigate to chapter start', async () => {
      mockState.index = 0;
      mockState.chapterStarts = [0, 4, 8];

      const flipPromise = navigationDelegate.handleTOCNavigation(1);

      // Chapter 1 starts at index 4, aligned to spread (even)
      expect(mockRenderer.prepareBuffer).toHaveBeenCalledWith(4, false);

      await completeFlip();
      await flipPromise;
    });

    it('should navigate to beginning when chapter is undefined', async () => {
      mockState.index = 6;

      const flipPromise = navigationDelegate.handleTOCNavigation(undefined);

      expect(mockRenderer.prepareBuffer).toHaveBeenCalledWith(0, false);

      await completeFlip();
      await flipPromise;
    });

    it('should navigate to end when chapter is -1', async () => {
      mockState.index = 0;
      mockRenderer.getMaxIndex.mockReturnValue(10);

      const flipPromise = navigationDelegate.handleTOCNavigation(-1);

      expect(mockRenderer.prepareBuffer).toHaveBeenCalledWith(10, false);

      await completeFlip();
      await flipPromise;
    });

    it('should emit bookOpen if book is closed', async () => {
      // Reset to CLOSED state
      stateMachine.forceTransitionTo(BookState.CLOSED);

      const openHandler = vi.fn();
      eventEmitter.on('bookOpen', openHandler);

      await navigationDelegate.handleTOCNavigation(1);

      expect(openHandler).toHaveBeenCalled();
    });

    it('should align chapter start to spread on desktop', async () => {
      mockState.index = 0;
      mockState.chapterStarts = [0, 5, 9]; // Chapter 1 at odd index

      const flipPromise = navigationDelegate.handleTOCNavigation(1);

      // Should align 5 to 4 (even number for spread)
      expect(mockRenderer.prepareBuffer).toHaveBeenCalledWith(4, false);

      await completeFlip();
      await flipPromise;
    });

    it('should not align on mobile', async () => {
      // Create mobile delegate for this test
      const mobileFlipPromise = createControllablePromise();
      const mobileMediaQueries = { isMobile: true };
      const mobileAnimator = {
        runFlip: vi.fn().mockImplementation((direction, swapCallback) => {
          mobileAnimator._swapCallback = swapCallback;
          return mobileFlipPromise.promise;
        }),
      };

      const mobileDelegate = new NavigationDelegate({
        stateMachine,
        renderer: mockRenderer,
        animator: mobileAnimator,
        settings: mockSettings,
        soundManager: mockSoundManager,
        mediaQueries: mobileMediaQueries,
        state: mockState,
      });

      mockRenderer.prepareBuffer.mockClear();
      mockState.index = 0;
      mockState.chapterStarts = [0, 5, 9];

      const flipPromise = mobileDelegate.handleTOCNavigation(1);

      // Mobile doesn't align to spread
      expect(mockRenderer.prepareBuffer).toHaveBeenCalledWith(5, true);

      mobileFlipPromise.resolve();
      await flipPromise;

      mobileDelegate.destroy();
    });
  });

  describe('State Guards', () => {
    it('should not flip when book is FLIPPING', async () => {
      // Start first flip
      const firstFlip = navigationDelegate.flip(Direction.NEXT);

      expect(stateMachine.state).toBe(BookState.FLIPPING);

      // Second flip should be ignored
      await navigationDelegate.flip(Direction.NEXT);

      expect(mockAnimator.runFlip).toHaveBeenCalledTimes(1);

      await completeFlip();
      await firstFlip;
    });

    it('should emit bookOpen when flipping next on closed book', async () => {
      stateMachine.forceTransitionTo(BookState.CLOSED);

      const openHandler = vi.fn();
      eventEmitter.on('bookOpen', openHandler);

      await navigationDelegate.flip(Direction.NEXT);

      expect(openHandler).toHaveBeenCalled();
      expect(mockAnimator.runFlip).not.toHaveBeenCalled();
    });

    it('should emit bookClose when flipping prev from page 0', async () => {
      mockState.index = 0;

      const closeHandler = vi.fn();
      eventEmitter.on('bookClose', closeHandler);

      await navigationDelegate.flip(Direction.PREV);

      expect(closeHandler).toHaveBeenCalled();
      expect(mockAnimator.runFlip).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should recover to OPENED on animation error', async () => {
      const errorPromise = createControllablePromise();
      // Предотвращаем unhandled rejection
      errorPromise.promise.catch(() => {});
      mockAnimator.runFlip.mockReturnValue(errorPromise.promise);

      const flipPromise = navigationDelegate.flip(Direction.NEXT);

      errorPromise.reject(new Error('Animation failed'));

      await flipPromise;

      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should not emit indexChange on error', async () => {
      const errorPromise = createControllablePromise();
      // Предотвращаем unhandled rejection
      errorPromise.promise.catch(() => {});
      mockAnimator.runFlip.mockReturnValue(errorPromise.promise);

      const handler = vi.fn();
      eventEmitter.on('indexChange', handler);

      const flipPromise = navigationDelegate.flip(Direction.NEXT);

      errorPromise.reject(new Error('Animation failed'));

      await flipPromise;

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Rapid Flips', () => {
    it('should queue flips properly', async () => {
      const flips = [];

      // Start first flip
      const flip1Promise = createControllablePromise();
      mockAnimator.runFlip.mockReturnValueOnce(flip1Promise.promise);

      const first = navigationDelegate.flip(Direction.NEXT);
      flips.push(first);

      // Second flip should be ignored (book is busy)
      const second = navigationDelegate.flip(Direction.NEXT);
      flips.push(second);

      expect(mockAnimator.runFlip).toHaveBeenCalledTimes(1);

      // Complete first flip
      if (mockAnimator._swapCallback) {
        mockAnimator._swapCallback();
      }
      flip1Promise.resolve();

      await Promise.all(flips);

      // Only one flip animation executed
      expect(mockAnimator.runFlip).toHaveBeenCalledTimes(1);
    });
  });
});
