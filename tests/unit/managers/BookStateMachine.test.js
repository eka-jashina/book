/**
 * Тесты для BookStateMachine
 * Конечный автомат состояний книги
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookStateMachine } from '../../../js/managers/BookStateMachine.js';
import { BookState } from '../../../js/config.js';

describe('BookStateMachine', () => {
  let fsm;

  beforeEach(() => {
    fsm = new BookStateMachine();
  });

  describe('constructor', () => {
    it('should initialize with CLOSED state by default', () => {
      expect(fsm.state).toBe(BookState.CLOSED);
    });

    it('should accept custom initial state', () => {
      const customFsm = new BookStateMachine(BookState.OPENED);
      expect(customFsm.state).toBe(BookState.OPENED);
    });

    it('should initialize empty listeners set', () => {
      expect(fsm._listeners.size).toBe(0);
    });
  });

  describe('state getter', () => {
    it('should return current state', () => {
      expect(fsm.state).toBe(BookState.CLOSED);
    });
  });

  describe('isClosed', () => {
    it('should return true when CLOSED', () => {
      expect(fsm.isClosed).toBe(true);
    });

    it('should return false when not CLOSED', () => {
      fsm.transitionTo(BookState.OPENING);
      expect(fsm.isClosed).toBe(false);
    });
  });

  describe('isOpened', () => {
    it('should return false when CLOSED', () => {
      expect(fsm.isOpened).toBe(false);
    });

    it('should return true when OPENED', () => {
      fsm.transitionTo(BookState.OPENING);
      fsm.transitionTo(BookState.OPENED);
      expect(fsm.isOpened).toBe(true);
    });
  });

  describe('isFlipping', () => {
    it('should return false when not FLIPPING', () => {
      expect(fsm.isFlipping).toBe(false);
    });

    it('should return true when FLIPPING', () => {
      fsm.transitionTo(BookState.OPENING);
      fsm.transitionTo(BookState.OPENED);
      fsm.transitionTo(BookState.FLIPPING);
      expect(fsm.isFlipping).toBe(true);
    });
  });

  describe('isBusy', () => {
    it('should return false when CLOSED', () => {
      expect(fsm.isBusy).toBe(false);
    });

    it('should return true when OPENING', () => {
      fsm.transitionTo(BookState.OPENING);
      expect(fsm.isBusy).toBe(true);
    });

    it('should return false when OPENED', () => {
      fsm.transitionTo(BookState.OPENING);
      fsm.transitionTo(BookState.OPENED);
      expect(fsm.isBusy).toBe(false);
    });

    it('should return true when FLIPPING', () => {
      fsm.transitionTo(BookState.OPENING);
      fsm.transitionTo(BookState.OPENED);
      fsm.transitionTo(BookState.FLIPPING);
      expect(fsm.isBusy).toBe(true);
    });

    it('should return true when CLOSING', () => {
      fsm.transitionTo(BookState.OPENING);
      fsm.transitionTo(BookState.OPENED);
      fsm.transitionTo(BookState.CLOSING);
      expect(fsm.isBusy).toBe(true);
    });
  });

  describe('canTransitionTo', () => {
    it('should allow CLOSED -> OPENING', () => {
      expect(fsm.canTransitionTo(BookState.OPENING)).toBe(true);
    });

    it('should not allow CLOSED -> OPENED', () => {
      expect(fsm.canTransitionTo(BookState.OPENED)).toBe(false);
    });

    it('should not allow CLOSED -> FLIPPING', () => {
      expect(fsm.canTransitionTo(BookState.FLIPPING)).toBe(false);
    });

    it('should allow OPENING -> OPENED', () => {
      fsm.transitionTo(BookState.OPENING);
      expect(fsm.canTransitionTo(BookState.OPENED)).toBe(true);
    });

    it('should not allow OPENING -> FLIPPING', () => {
      fsm.transitionTo(BookState.OPENING);
      expect(fsm.canTransitionTo(BookState.FLIPPING)).toBe(false);
    });

    it('should allow OPENED -> FLIPPING', () => {
      fsm.transitionTo(BookState.OPENING);
      fsm.transitionTo(BookState.OPENED);
      expect(fsm.canTransitionTo(BookState.FLIPPING)).toBe(true);
    });

    it('should allow OPENED -> CLOSING', () => {
      fsm.transitionTo(BookState.OPENING);
      fsm.transitionTo(BookState.OPENED);
      expect(fsm.canTransitionTo(BookState.CLOSING)).toBe(true);
    });

    it('should allow FLIPPING -> OPENED', () => {
      fsm.transitionTo(BookState.OPENING);
      fsm.transitionTo(BookState.OPENED);
      fsm.transitionTo(BookState.FLIPPING);
      expect(fsm.canTransitionTo(BookState.OPENED)).toBe(true);
    });

    it('should allow CLOSING -> CLOSED', () => {
      fsm.transitionTo(BookState.OPENING);
      fsm.transitionTo(BookState.OPENED);
      fsm.transitionTo(BookState.CLOSING);
      expect(fsm.canTransitionTo(BookState.CLOSED)).toBe(true);
    });

    it('should return false for unknown state', () => {
      expect(fsm.canTransitionTo('unknown')).toBe(false);
    });
  });

  describe('transitionTo', () => {
    it('should change state on valid transition', () => {
      const result = fsm.transitionTo(BookState.OPENING);
      expect(result).toBe(true);
      expect(fsm.state).toBe(BookState.OPENING);
    });

    it('should return false on invalid transition', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = fsm.transitionTo(BookState.FLIPPING);
      expect(result).toBe(false);
      expect(fsm.state).toBe(BookState.CLOSED);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid state transition'));
      warnSpy.mockRestore();
    });

    it('should notify listeners on valid transition', () => {
      const listener = vi.fn();
      fsm.subscribe(listener);
      fsm.transitionTo(BookState.OPENING);
      expect(listener).toHaveBeenCalledWith(BookState.OPENING, BookState.CLOSED);
    });

    it('should not notify listeners on invalid transition', () => {
      const listener = vi.fn();
      fsm.subscribe(listener);
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      fsm.transitionTo(BookState.FLIPPING);
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const badListener = vi.fn(() => { throw new Error('test'); });
      const goodListener = vi.fn();

      fsm.subscribe(badListener);
      fsm.subscribe(goodListener);

      fsm.transitionTo(BookState.OPENING);

      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith('State listener error:', expect.any(Error));
      errorSpy.mockRestore();
    });
  });

  describe('subscribe', () => {
    it('should add listener', () => {
      const listener = vi.fn();
      fsm.subscribe(listener);
      expect(fsm._listeners.size).toBe(1);
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = fsm.subscribe(listener);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should remove listener when unsubscribe called', () => {
      const listener = vi.fn();
      const unsubscribe = fsm.subscribe(listener);
      unsubscribe();
      expect(fsm._listeners.size).toBe(0);
    });

    it('should not notify after unsubscribe', () => {
      const listener = vi.fn();
      const unsubscribe = fsm.subscribe(listener);
      unsubscribe();
      fsm.transitionTo(BookState.OPENING);
      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      fsm.subscribe(listener1);
      fsm.subscribe(listener2);
      fsm.transitionTo(BookState.OPENING);
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('forceTransitionTo', () => {
    it('should allow force transition to OPENED (recovery state)', () => {
      fsm.forceTransitionTo(BookState.OPENED);
      expect(fsm.state).toBe(BookState.OPENED);
    });

    it('should allow force transition to CLOSED (recovery state)', () => {
      fsm.transitionTo(BookState.OPENING);
      fsm.forceTransitionTo(BookState.CLOSED);
      expect(fsm.state).toBe(BookState.CLOSED);
    });

    it('should reject non-recovery states (e.g. FLIPPING)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      fsm.forceTransitionTo(BookState.FLIPPING);
      expect(fsm.state).toBe(BookState.CLOSED); // Unchanged
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should reject OPENING as non-recovery state', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      fsm.forceTransitionTo(BookState.OPENING);
      expect(fsm.state).toBe(BookState.CLOSED); // Unchanged
      warnSpy.mockRestore();
    });

    it('should notify listeners', () => {
      const listener = vi.fn();
      fsm.subscribe(listener);
      fsm.forceTransitionTo(BookState.OPENED);
      expect(listener).toHaveBeenCalledWith(BookState.OPENED, BookState.CLOSED);
    });

    it('should not notify if state unchanged', () => {
      const listener = vi.fn();
      fsm.subscribe(listener);
      fsm.forceTransitionTo(BookState.CLOSED);
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const badListener = vi.fn(() => { throw new Error('test'); });
      fsm.subscribe(badListener);

      fsm.forceTransitionTo(BookState.OPENED);

      expect(errorSpy).toHaveBeenCalledWith('State listener error:', expect.any(Error));
      errorSpy.mockRestore();
    });
  });

  describe('reset', () => {
    it('should notify listeners by default when state changes', () => {
      const listener = vi.fn();
      fsm.subscribe(listener);
      fsm.transitionTo(BookState.OPENING);
      listener.mockClear();

      fsm.reset();

      expect(fsm.state).toBe(BookState.CLOSED);
      expect(listener).toHaveBeenCalledWith(BookState.CLOSED, BookState.OPENING);
    });

    it('should not notify listeners when silent option is true', () => {
      const listener = vi.fn();
      fsm.subscribe(listener);
      fsm.transitionTo(BookState.OPENING);
      listener.mockClear();

      fsm.reset(BookState.CLOSED, { silent: true });

      expect(fsm.state).toBe(BookState.CLOSED);
      expect(listener).not.toHaveBeenCalled();
    });

    it('should not notify listeners when state does not change', () => {
      const listener = vi.fn();
      fsm.subscribe(listener);

      fsm.reset(BookState.CLOSED);

      expect(fsm.state).toBe(BookState.CLOSED);
      expect(listener).not.toHaveBeenCalled();
    });

    it('should accept custom state', () => {
      fsm.reset(BookState.OPENED);
      expect(fsm.state).toBe(BookState.OPENED);
    });

    it('should default to CLOSED', () => {
      fsm.transitionTo(BookState.OPENING);
      fsm.reset();
      expect(fsm.state).toBe(BookState.CLOSED);
    });
  });

  describe('destroy', () => {
    it('should clear all listeners', () => {
      fsm.subscribe(() => {});
      fsm.subscribe(() => {});
      fsm.destroy();
      expect(fsm._listeners.size).toBe(0);
    });
  });

  describe('full lifecycle', () => {
    it('should complete open -> flip -> close cycle', () => {
      const states = [];
      fsm.subscribe((newState) => states.push(newState));

      // Open book
      expect(fsm.transitionTo(BookState.OPENING)).toBe(true);
      expect(fsm.transitionTo(BookState.OPENED)).toBe(true);

      // Flip pages
      expect(fsm.transitionTo(BookState.FLIPPING)).toBe(true);
      expect(fsm.transitionTo(BookState.OPENED)).toBe(true);
      expect(fsm.transitionTo(BookState.FLIPPING)).toBe(true);
      expect(fsm.transitionTo(BookState.OPENED)).toBe(true);

      // Close book
      expect(fsm.transitionTo(BookState.CLOSING)).toBe(true);
      expect(fsm.transitionTo(BookState.CLOSED)).toBe(true);

      expect(states).toEqual([
        BookState.OPENING,
        BookState.OPENED,
        BookState.FLIPPING,
        BookState.OPENED,
        BookState.FLIPPING,
        BookState.OPENED,
        BookState.CLOSING,
        BookState.CLOSED,
      ]);
    });
  });
});
