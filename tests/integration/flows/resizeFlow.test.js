/**
 * INTEGRATION TEST: Resize Flow
 * Тестирование resize → debounce → repaginate → корректный индекс после пересчёта.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResizeHandler } from '../../../js/core/ResizeHandler.js';

// Mock CSSVariables
vi.mock('../../../js/utils/CSSVariables.js', () => ({
  cssVars: {
    getTime: vi.fn((key, def) => def),
    getNumber: vi.fn((key, def) => def),
    invalidateCache: vi.fn(),
  },
}));

import { cssVars } from '../../../js/utils/CSSVariables.js';

describe('Resize Flow', () => {
  let resizeHandler;
  let repaginateFn;
  let isOpenedFn;
  let isDestroyedFn;
  let mockTimerManager;
  let mockEventManager;
  let timerCallbacks;
  let eventCallbacks;

  beforeEach(() => {
    repaginateFn = vi.fn();
    isOpenedFn = vi.fn().mockReturnValue(true);
    isDestroyedFn = vi.fn().mockReturnValue(false);

    timerCallbacks = new Map();
    let timerId = 0;

    mockTimerManager = {
      setTimeout: vi.fn((cb, delay) => {
        const id = ++timerId;
        timerCallbacks.set(id, { cb, delay });
        return id;
      }),
      clearTimeout: vi.fn((id) => {
        timerCallbacks.delete(id);
      }),
    };

    eventCallbacks = [];
    mockEventManager = {
      add: vi.fn((target, event, handler) => {
        eventCallbacks.push({ target, event, handler });
      }),
    };

    // Начальная ширина
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });

    resizeHandler = new ResizeHandler({
      eventManager: mockEventManager,
      timerManager: mockTimerManager,
      repaginateFn,
      isOpenedFn,
      isDestroyedFn,
    });
  });

  afterEach(() => {
    resizeHandler?.destroy();
    vi.restoreAllMocks();
  });

  const triggerResize = (newWidth) => {
    Object.defineProperty(window, 'innerWidth', { value: newWidth, writable: true, configurable: true });
    resizeHandler._handleResize();
  };

  const executeLastTimer = () => {
    const entries = Array.from(timerCallbacks.entries());
    if (entries.length > 0) {
      const [id, { cb }] = entries[entries.length - 1];
      timerCallbacks.delete(id);
      cb();
    }
  };

  describe('Debounced resize', () => {
    it('should not repaginate immediately on resize', () => {
      triggerResize(800);

      expect(repaginateFn).not.toHaveBeenCalled();
    });

    it('should schedule repagination via timerManager', () => {
      triggerResize(800);

      expect(mockTimerManager.setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        150 // default debounce delay
      );
    });

    it('should repaginate after debounce timer fires', () => {
      triggerResize(800);
      executeLastTimer();

      expect(repaginateFn).toHaveBeenCalledWith(true);
    });

    it('should invalidate CSS cache before repagination', () => {
      triggerResize(800);
      cssVars.invalidateCache.mockClear();

      executeLastTimer();

      expect(cssVars.invalidateCache).toHaveBeenCalled();
    });
  });

  describe('Debounce batching', () => {
    it('should cancel previous timer on rapid resizes', () => {
      triggerResize(800);
      const firstTimerId = mockTimerManager.setTimeout.mock.results[0].value;

      triggerResize(600);

      expect(mockTimerManager.clearTimeout).toHaveBeenCalledWith(firstTimerId);
    });

    it('should only call repaginate once for rapid resizes', () => {
      triggerResize(800);
      triggerResize(600);
      triggerResize(400);

      // Только последний timer должен остаться
      expect(timerCallbacks.size).toBe(1);

      executeLastTimer();

      expect(repaginateFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Width-only detection', () => {
    it('should ignore resize when only height changes', () => {
      // Ширина не меняется (1024 → 1024)
      triggerResize(1024);

      expect(mockTimerManager.setTimeout).not.toHaveBeenCalled();
      expect(repaginateFn).not.toHaveBeenCalled();
    });

    it('should respond to width changes', () => {
      triggerResize(800);

      expect(mockTimerManager.setTimeout).toHaveBeenCalled();
    });

    it('should track last width correctly across multiple resizes', () => {
      triggerResize(800);
      executeLastTimer();
      repaginateFn.mockClear();

      // Та же ширина — игнорировать
      triggerResize(800);
      expect(mockTimerManager.setTimeout).toHaveBeenCalledTimes(1); // only first call

      // Новая ширина — обработать
      triggerResize(600);
      expect(mockTimerManager.setTimeout).toHaveBeenCalledTimes(2);
    });
  });

  describe('State guards', () => {
    it('should not repaginate when book is closed', () => {
      isOpenedFn.mockReturnValue(false);

      triggerResize(800);
      executeLastTimer();

      expect(repaginateFn).not.toHaveBeenCalled();
    });

    it('should not repaginate when component is destroyed', () => {
      isDestroyedFn.mockReturnValue(true);

      triggerResize(800);
      executeLastTimer();

      expect(repaginateFn).not.toHaveBeenCalled();
    });

    it('should repaginate when book is opened and not destroyed', () => {
      isOpenedFn.mockReturnValue(true);
      isDestroyedFn.mockReturnValue(false);

      triggerResize(800);
      executeLastTimer();

      expect(repaginateFn).toHaveBeenCalledWith(true);
    });
  });

  describe('bind()', () => {
    it('should register resize event on window', () => {
      resizeHandler.bind();

      expect(mockEventManager.add).toHaveBeenCalledWith(
        window,
        'resize',
        expect.any(Function)
      );
    });
  });

  describe('destroy()', () => {
    it('should clear pending timer on destroy', () => {
      triggerResize(800);
      const timerId = mockTimerManager.setTimeout.mock.results[0].value;

      resizeHandler.destroy();

      expect(mockTimerManager.clearTimeout).toHaveBeenCalledWith(timerId);
    });

    it('should be safe to destroy without pending timer', () => {
      expect(() => resizeHandler.destroy()).not.toThrow();
    });

    it('should be safe to destroy multiple times', () => {
      resizeHandler.destroy();
      expect(() => resizeHandler.destroy()).not.toThrow();
    });
  });

  describe('Resize → repagination → index preservation', () => {
    it('should pass keepIndex=true to repaginateFn', () => {
      triggerResize(800);
      executeLastTimer();

      expect(repaginateFn).toHaveBeenCalledWith(true);
    });

    it('should handle resize during state transition (book closing)', () => {
      isOpenedFn.mockReturnValue(false);

      triggerResize(800);
      executeLastTimer();

      // Не должно вызывать repaginate для закрытой книги
      expect(repaginateFn).not.toHaveBeenCalled();
    });
  });
});
