/**
 * INTEGRATION TEST: State Machine Edge Cases
 * Тестирование граничных случаев и интеграции state machine с компонентами
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
import { NavigationDelegate } from '../../../js/core/delegates/NavigationDelegate.js';
import { BookState, Direction } from '../../../js/config.js';
import { EventEmitter } from '../../../js/utils/EventEmitter.js';
import { ContentLoader } from '../../../js/managers/ContentLoader.js';
import { rateLimiters } from '../../../js/utils/RateLimiter.js';

describe('State Machine Integration', () => {
  let dom;
  let stateMachine;
  let contentLoader;
  let eventEmitter;

  beforeEach(() => {
    dom = createFullBookDOM();
    stateMachine = new BookStateMachine();
    contentLoader = new ContentLoader();
    eventEmitter = new EventEmitter();

    const testContent = createChapterContent({ chapters: 2, paragraphsPerChapter: 3 });
    setupFetchMock(testContent);
  });

  afterEach(() => {
    stateMachine?.destroy();
    contentLoader?.destroy();
    eventEmitter?.destroy();
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  describe('Valid State Transitions', () => {
    it('should follow CLOSED → OPENING → OPENED path', () => {
      expect(stateMachine.state).toBe(BookState.CLOSED);

      expect(stateMachine.transitionTo(BookState.OPENING)).toBe(true);
      expect(stateMachine.state).toBe(BookState.OPENING);

      expect(stateMachine.transitionTo(BookState.OPENED)).toBe(true);
      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should follow OPENED → FLIPPING → OPENED cycle', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);

      expect(stateMachine.transitionTo(BookState.FLIPPING)).toBe(true);
      expect(stateMachine.state).toBe(BookState.FLIPPING);

      expect(stateMachine.transitionTo(BookState.OPENED)).toBe(true);
      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should follow OPENED → CLOSING → CLOSED path', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);

      expect(stateMachine.transitionTo(BookState.CLOSING)).toBe(true);
      expect(stateMachine.state).toBe(BookState.CLOSING);

      expect(stateMachine.transitionTo(BookState.CLOSED)).toBe(true);
      expect(stateMachine.state).toBe(BookState.CLOSED);
    });

    it('should allow multiple OPENED ⇄ FLIPPING cycles', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);

      for (let i = 0; i < 5; i++) {
        expect(stateMachine.transitionTo(BookState.FLIPPING)).toBe(true);
        expect(stateMachine.transitionTo(BookState.OPENED)).toBe(true);
      }

      expect(stateMachine.state).toBe(BookState.OPENED);
    });
  });

  describe('Invalid State Transitions', () => {
    it('should reject CLOSED → OPENED (skip OPENING)', () => {
      expect(stateMachine.transitionTo(BookState.OPENED)).toBe(false);
      expect(stateMachine.state).toBe(BookState.CLOSED);
    });

    it('should reject CLOSED → FLIPPING', () => {
      expect(stateMachine.transitionTo(BookState.FLIPPING)).toBe(false);
      expect(stateMachine.state).toBe(BookState.CLOSED);
    });

    it('should reject CLOSED → CLOSING', () => {
      expect(stateMachine.transitionTo(BookState.CLOSING)).toBe(false);
      expect(stateMachine.state).toBe(BookState.CLOSED);
    });

    it('should reject OPENING → FLIPPING (skip OPENED)', () => {
      stateMachine.transitionTo(BookState.OPENING);

      expect(stateMachine.transitionTo(BookState.FLIPPING)).toBe(false);
      expect(stateMachine.state).toBe(BookState.OPENING);
    });

    it('should reject OPENING → CLOSING', () => {
      stateMachine.transitionTo(BookState.OPENING);

      expect(stateMachine.transitionTo(BookState.CLOSING)).toBe(false);
      expect(stateMachine.state).toBe(BookState.OPENING);
    });

    it('should reject FLIPPING → CLOSING (skip OPENED)', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);
      stateMachine.transitionTo(BookState.FLIPPING);

      expect(stateMachine.transitionTo(BookState.CLOSING)).toBe(false);
      expect(stateMachine.state).toBe(BookState.FLIPPING);
    });

    it('should reject FLIPPING → CLOSED', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);
      stateMachine.transitionTo(BookState.FLIPPING);

      expect(stateMachine.transitionTo(BookState.CLOSED)).toBe(false);
      expect(stateMachine.state).toBe(BookState.FLIPPING);
    });

    it('should reject CLOSING → OPENED (reverse)', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);
      stateMachine.transitionTo(BookState.CLOSING);

      expect(stateMachine.transitionTo(BookState.OPENED)).toBe(false);
      expect(stateMachine.state).toBe(BookState.CLOSING);
    });

    it('should reject transition to same state', () => {
      expect(stateMachine.transitionTo(BookState.CLOSED)).toBe(false);

      stateMachine.transitionTo(BookState.OPENING);
      expect(stateMachine.transitionTo(BookState.OPENING)).toBe(false);
    });
  });

  describe('isBusy Flag', () => {
    it('should be false when CLOSED', () => {
      expect(stateMachine.isBusy).toBe(false);
    });

    it('should be true when OPENING', () => {
      stateMachine.transitionTo(BookState.OPENING);
      expect(stateMachine.isBusy).toBe(true);
    });

    it('should be false when OPENED', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);
      expect(stateMachine.isBusy).toBe(false);
    });

    it('should be true when FLIPPING', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);
      stateMachine.transitionTo(BookState.FLIPPING);
      expect(stateMachine.isBusy).toBe(true);
    });

    it('should be true when CLOSING', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);
      stateMachine.transitionTo(BookState.CLOSING);
      expect(stateMachine.isBusy).toBe(true);
    });
  });

  describe('State Getters', () => {
    it('should correctly report isClosed', () => {
      expect(stateMachine.isClosed).toBe(true);
      stateMachine.transitionTo(BookState.OPENING);
      expect(stateMachine.isClosed).toBe(false);
    });

    it('should correctly report isOpened', () => {
      expect(stateMachine.isOpened).toBe(false);
      stateMachine.transitionTo(BookState.OPENING);
      expect(stateMachine.isOpened).toBe(false);
      stateMachine.transitionTo(BookState.OPENED);
      expect(stateMachine.isOpened).toBe(true);
    });

    it('should correctly report isFlipping', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);
      expect(stateMachine.isFlipping).toBe(false);
      stateMachine.transitionTo(BookState.FLIPPING);
      expect(stateMachine.isFlipping).toBe(true);
    });
  });

  describe('Subscriber Notifications', () => {
    it('should notify subscribers on valid transition', () => {
      const listener = vi.fn();
      stateMachine.subscribe(listener);

      stateMachine.transitionTo(BookState.OPENING);

      expect(listener).toHaveBeenCalledWith(BookState.OPENING, BookState.CLOSED);
    });

    it('should not notify subscribers on invalid transition', () => {
      const listener = vi.fn();
      stateMachine.subscribe(listener);

      stateMachine.transitionTo(BookState.FLIPPING); // Invalid from CLOSED

      expect(listener).not.toHaveBeenCalled();
    });

    it('should notify multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      stateMachine.subscribe(listener1);
      stateMachine.subscribe(listener2);
      stateMachine.subscribe(listener3);

      stateMachine.transitionTo(BookState.OPENING);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe correctly', () => {
      const listener = vi.fn();
      const unsubscribe = stateMachine.subscribe(listener);

      stateMachine.transitionTo(BookState.OPENING);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      stateMachine.transitionTo(BookState.OPENED);
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should continue notifying other subscribers if one throws', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();

      stateMachine.subscribe(errorListener);
      stateMachine.subscribe(normalListener);

      // Should not throw
      expect(() => {
        stateMachine.transitionTo(BookState.OPENING);
      }).not.toThrow();

      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('forceTransitionTo', () => {
    it('should force transition regardless of validity', () => {
      // Force an invalid transition
      stateMachine.forceTransitionTo(BookState.OPENED);

      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should notify subscribers on forced transition', () => {
      const listener = vi.fn();
      stateMachine.subscribe(listener);

      stateMachine.forceTransitionTo(BookState.OPENED);

      expect(listener).toHaveBeenCalledWith(BookState.OPENED, BookState.CLOSED);
    });

    it('should not notify if state unchanged', () => {
      const listener = vi.fn();
      stateMachine.subscribe(listener);

      stateMachine.forceTransitionTo(BookState.CLOSED); // Same state

      expect(listener).not.toHaveBeenCalled();
    });

    it('should allow recovery from stuck OPENING state', () => {
      stateMachine.transitionTo(BookState.OPENING);
      // Pretend open failed, need to go back to CLOSED

      stateMachine.forceTransitionTo(BookState.CLOSED);

      expect(stateMachine.state).toBe(BookState.CLOSED);
      expect(stateMachine.isClosed).toBe(true);
    });

    it('should allow recovery from stuck CLOSING state', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);
      stateMachine.transitionTo(BookState.CLOSING);
      // Pretend close failed, need to go back to OPENED

      stateMachine.forceTransitionTo(BookState.OPENED);

      expect(stateMachine.state).toBe(BookState.OPENED);
      expect(stateMachine.isOpened).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset to CLOSED by default', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);

      stateMachine.reset();

      expect(stateMachine.state).toBe(BookState.CLOSED);
    });

    it('should reset to specified state', () => {
      stateMachine.reset(BookState.OPENED);

      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should notify subscribers by default', () => {
      const listener = vi.fn();
      stateMachine.subscribe(listener);

      stateMachine.transitionTo(BookState.OPENING);
      listener.mockClear();

      stateMachine.reset(BookState.CLOSED);

      expect(listener).toHaveBeenCalledWith(BookState.CLOSED, BookState.OPENING);
    });

    it('should not notify subscribers when silent option is true', () => {
      const listener = vi.fn();
      stateMachine.subscribe(listener);

      stateMachine.transitionTo(BookState.OPENING);
      listener.mockClear();

      stateMachine.reset(BookState.CLOSED, { silent: true });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Integration with LifecycleDelegate', () => {
    let lifecycleDelegate;
    let mockAnimator;
    let mockRenderer;
    let mockPaginator;
    let resolveOpen;
    let resolveFinish;

    const createControllablePromise = () => {
      let resolve, reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };

    beforeEach(() => {
      const openPromise = createControllablePromise();
      const finishPromise = createControllablePromise();
      resolveOpen = openPromise.resolve;
      resolveFinish = finishPromise.resolve;

      mockAnimator = {
        runOpenAnimation: vi.fn().mockReturnValue(openPromise.promise),
        finishOpenAnimation: vi.fn().mockReturnValue(finishPromise.promise),
        runCloseAnimation: vi.fn().mockResolvedValue(),
        abort: vi.fn(),
      };

      mockRenderer = {
        renderSpread: vi.fn(),
        getMaxIndex: vi.fn().mockReturnValue(10),
        clearCache: vi.fn(),
      };

      mockPaginator = {
        paginate: vi.fn().mockResolvedValue({
          pageData: { sourceElement: document.createElement('div'), pageCount: 2, pageWidth: 400, pageHeight: 600 },
          chapterStarts: [0],
        }),
      };

      lifecycleDelegate = new LifecycleDelegate({
        stateMachine,
        backgroundManager: { preload: vi.fn().mockResolvedValue() },
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
        state: { index: 0, chapterStarts: [] },
      });
    });

    afterEach(() => {
      lifecycleDelegate?.destroy();
    });

    it('should block open when already OPENING', async () => {
      const open1 = lifecycleDelegate.open(0);

      expect(stateMachine.state).toBe(BookState.OPENING);

      // Second open should be blocked
      const open2 = lifecycleDelegate.open(0);

      expect(mockAnimator.runOpenAnimation).toHaveBeenCalledTimes(1);

      // Complete first open
      resolveOpen('completed');
      await Promise.resolve();
      resolveFinish();
      await open1;
      await open2;
    });

    it('should recover state if open fails mid-OPENING', async () => {
      mockAnimator.runOpenAnimation.mockRejectedValue(new Error('Failed'));

      await lifecycleDelegate.open(0);

      // Should recover to CLOSED
      expect(stateMachine.state).toBe(BookState.CLOSED);
    });

    it('should prevent close when in OPENING state', async () => {
      const openPromise = lifecycleDelegate.open(0);

      expect(stateMachine.state).toBe(BookState.OPENING);

      // Try to close while opening
      await lifecycleDelegate.close();

      // Should not have called close animation
      expect(mockAnimator.runCloseAnimation).not.toHaveBeenCalled();

      // Complete open
      resolveOpen('completed');
      await Promise.resolve();
      resolveFinish();
      await openPromise;
    });
  });

  describe('Integration with NavigationDelegate', () => {
    let navigationDelegate;
    let mockAnimator;
    let resolveFlip;

    const createControllablePromise = () => {
      let resolve, reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };

    beforeEach(() => {
      // Сброс rate limiter для изоляции тестов
      rateLimiters.navigation.reset();

      // Set state to OPENED
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);

      const flipPromise = createControllablePromise();
      resolveFlip = flipPromise.resolve;

      mockAnimator = {
        runFlip: vi.fn().mockImplementation((dir, cb) => {
          mockAnimator._swapCallback = cb;
          return flipPromise.promise;
        }),
      };

      navigationDelegate = new NavigationDelegate({
        stateMachine,
        renderer: {
          getMaxIndex: vi.fn().mockReturnValue(10),
          prepareBuffer: vi.fn(),
          prepareSheet: vi.fn(),
          swapBuffers: vi.fn(),
        },
        animator: mockAnimator,
        settings: { get: vi.fn() },
        soundManager: { play: vi.fn() },
        mediaQueries: { isMobile: false },
        state: { index: 2, chapterStarts: [0, 4] },
      });
    });

    afterEach(() => {
      navigationDelegate?.destroy();
    });

    it('should block flip when state is FLIPPING', async () => {
      const flip1 = navigationDelegate.flip(Direction.NEXT);

      expect(stateMachine.state).toBe(BookState.FLIPPING);

      // Second flip should be blocked
      await navigationDelegate.flip(Direction.NEXT);

      expect(mockAnimator.runFlip).toHaveBeenCalledTimes(1);

      // Complete first flip
      if (mockAnimator._swapCallback) mockAnimator._swapCallback();
      resolveFlip();
      await flip1;
    });

    it('should return to OPENED after flip completes', async () => {
      const flipPromise = navigationDelegate.flip(Direction.NEXT);

      expect(stateMachine.state).toBe(BookState.FLIPPING);

      if (mockAnimator._swapCallback) mockAnimator._swapCallback();
      resolveFlip();
      await flipPromise;

      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should recover to OPENED if flip fails', async () => {
      const errorPromise = createControllablePromise();
      // Предотвращаем unhandled rejection
      errorPromise.promise.catch(() => {});
      mockAnimator.runFlip.mockReturnValue(errorPromise.promise);

      const flipPromise = navigationDelegate.flip(Direction.NEXT);

      expect(stateMachine.state).toBe(BookState.FLIPPING);

      errorPromise.reject(new Error('Flip failed'));
      await flipPromise;

      expect(stateMachine.state).toBe(BookState.OPENED);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle rapid state transitions', () => {
      const transitions = [
        BookState.OPENING,
        BookState.OPENED,
        BookState.FLIPPING,
        BookState.OPENED,
        BookState.FLIPPING,
        BookState.OPENED,
        BookState.CLOSING,
        BookState.CLOSED,
      ];

      for (const state of transitions) {
        const result = stateMachine.transitionTo(state);
        expect(result).toBe(true);
      }

      expect(stateMachine.state).toBe(BookState.CLOSED);
    });

    it('should maintain consistency with subscriber failures', () => {
      let callCount = 0;

      // Add a listener that throws every other time
      stateMachine.subscribe(() => {
        callCount++;
        if (callCount % 2 === 0) {
          throw new Error('Intermittent failure');
        }
      });

      // Multiple transitions
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);
      stateMachine.transitionTo(BookState.FLIPPING);
      stateMachine.transitionTo(BookState.OPENED);

      // State should still be consistent
      expect(stateMachine.state).toBe(BookState.OPENED);
      expect(callCount).toBe(4);
    });
  });

  describe('State History Tracking', () => {
    it('should track complete lifecycle', () => {
      const history = [];
      stateMachine.subscribe((newState, oldState) => {
        history.push({ from: oldState, to: newState });
      });

      // Full cycle: open, flip, flip, close
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);
      stateMachine.transitionTo(BookState.FLIPPING);
      stateMachine.transitionTo(BookState.OPENED);
      stateMachine.transitionTo(BookState.FLIPPING);
      stateMachine.transitionTo(BookState.OPENED);
      stateMachine.transitionTo(BookState.CLOSING);
      stateMachine.transitionTo(BookState.CLOSED);

      expect(history).toEqual([
        { from: BookState.CLOSED, to: BookState.OPENING },
        { from: BookState.OPENING, to: BookState.OPENED },
        { from: BookState.OPENED, to: BookState.FLIPPING },
        { from: BookState.FLIPPING, to: BookState.OPENED },
        { from: BookState.OPENED, to: BookState.FLIPPING },
        { from: BookState.FLIPPING, to: BookState.OPENED },
        { from: BookState.OPENED, to: BookState.CLOSING },
        { from: BookState.CLOSING, to: BookState.CLOSED },
      ]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown state in canTransitionTo', () => {
      expect(stateMachine.canTransitionTo('UNKNOWN_STATE')).toBe(false);
    });

    it('should create with custom initial state', () => {
      const customMachine = new BookStateMachine(BookState.OPENED);

      expect(customMachine.state).toBe(BookState.OPENED);
      expect(customMachine.isOpened).toBe(true);

      customMachine.destroy();
    });

    it('should clear all listeners on destroy', () => {
      const listener = vi.fn();
      stateMachine.subscribe(listener);

      stateMachine.destroy();

      // Force a state change
      stateMachine._state = BookState.OPENING;
      stateMachine.transitionTo(BookState.OPENED);

      // Listener should not be called
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
