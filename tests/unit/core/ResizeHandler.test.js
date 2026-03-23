/**
 * Тесты для ResizeHandler
 * Обработка изменения размера окна с дебаунсингом
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResizeHandler } from '../../../js/core/ResizeHandler.js';

// Mock CSSVariables
vi.mock('../../../js/utils/CSSVariables.js', () => ({
  cssVars: {
    getTime: vi.fn().mockReturnValue(150),
    invalidateCache: vi.fn(),
  },
}));

import { cssVars } from '../../../js/utils/CSSVariables.js';

describe('ResizeHandler', () => {
  let handler;
  let mockContext;
  let originalInnerWidth;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Save original window.innerWidth
    originalInnerWidth = window.innerWidth;

    // Set initial width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    mockContext = {
      eventManager: {
        add: vi.fn(),
      },
      timerManager: {
        setTimeout: vi.fn((fn, delay) => {
          return setTimeout(fn, delay);
        }),
        clearTimeout: vi.fn((id) => {
          clearTimeout(id);
        }),
      },
      repaginateFn: vi.fn(),
      isOpenedFn: vi.fn().mockReturnValue(true),
      isDestroyedFn: vi.fn().mockReturnValue(false),
    };

    handler = new ResizeHandler(mockContext);
  });

  afterEach(() => {
    vi.useRealTimers();

    // Restore window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  describe('constructor', () => {
    it('should store event manager reference', () => {
      expect(handler.eventManager).toBe(mockContext.eventManager);
    });

    it('should store timer manager reference', () => {
      expect(handler.timerManager).toBe(mockContext.timerManager);
    });

    it('should store repaginate function', () => {
      expect(handler.repaginateFn).toBe(mockContext.repaginateFn);
    });

    it('should store isOpened function', () => {
      expect(handler.isOpenedFn).toBe(mockContext.isOpenedFn);
    });

    it('should store isDestroyed function', () => {
      expect(handler.isDestroyedFn).toBe(mockContext.isDestroyedFn);
    });

    it('should initialize resizeTimer to null', () => {
      expect(handler.resizeTimer).toBeNull();
    });

    it('should get debounce delay from CSS variables', () => {
      expect(cssVars.getTime).toHaveBeenCalledWith('--timing-resize-debounce', 150);
      expect(handler.debounceDelay).toBe(150);
    });

    it('should store initial window width', () => {
      expect(handler.lastWidth).toBe(1024);
    });
  });

  describe('bind', () => {
    it('should add resize event listener', () => {
      handler.bind();

      expect(mockContext.eventManager.add).toHaveBeenCalledWith(
        window,
        'resize',
        expect.any(Function)
      );
    });

    it('should add fullscreenchange event listener', () => {
      handler.bind();

      expect(mockContext.eventManager.add).toHaveBeenCalledWith(
        document,
        'fullscreenchange',
        expect.any(Function)
      );
    });

    it('should add webkitfullscreenchange event listener', () => {
      handler.bind();

      expect(mockContext.eventManager.add).toHaveBeenCalledWith(
        document,
        'webkitfullscreenchange',
        expect.any(Function)
      );
    });
  });

  describe('_handleResize', () => {
    it('should ignore resize if width unchanged', () => {
      // Width is same as lastWidth (1024)
      handler._handleResize();

      expect(mockContext.timerManager.setTimeout).not.toHaveBeenCalled();
    });

    it('should debounce resize handling', () => {
      // Change width
      window.innerWidth = 800;

      handler._handleResize();

      expect(mockContext.timerManager.setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        150
      );
    });

    it('should update lastWidth on resize', () => {
      window.innerWidth = 800;

      handler._handleResize();

      expect(handler.lastWidth).toBe(800);
    });

    it('should clear previous timer on new resize', () => {
      handler.resizeTimer = 123;
      window.innerWidth = 800;

      handler._handleResize();

      expect(mockContext.timerManager.clearTimeout).toHaveBeenCalledWith(123);
    });

    it('should invalidate CSS cache and repaginate after debounce', () => {
      window.innerWidth = 800;

      handler._handleResize();
      vi.advanceTimersByTime(150);

      expect(cssVars.invalidateCache).toHaveBeenCalled();
      expect(mockContext.repaginateFn).toHaveBeenCalledWith(true);
    });

    it('should not repaginate if book is closed', () => {
      mockContext.isOpenedFn.mockReturnValue(false);
      window.innerWidth = 800;

      handler._handleResize();
      vi.advanceTimersByTime(150);

      expect(mockContext.repaginateFn).not.toHaveBeenCalled();
    });

    it('should not repaginate if destroyed', () => {
      mockContext.isDestroyedFn.mockReturnValue(true);
      window.innerWidth = 800;

      handler._handleResize();
      vi.advanceTimersByTime(150);

      expect(mockContext.repaginateFn).not.toHaveBeenCalled();
    });
  });

  describe('_handleFullscreenChange', () => {
    it('should always trigger repagination regardless of width change', () => {
      // Width stays the same — unlike _handleResize, this should still repaginate
      handler._handleFullscreenChange();
      vi.advanceTimersByTime(150);

      expect(cssVars.invalidateCache).toHaveBeenCalled();
      expect(mockContext.repaginateFn).toHaveBeenCalledWith(true);
    });

    it('should update lastWidth', () => {
      window.innerWidth = 800;

      handler._handleFullscreenChange();

      expect(handler.lastWidth).toBe(800);
    });

    it('should clear previous timer', () => {
      handler.resizeTimer = 789;

      handler._handleFullscreenChange();

      expect(mockContext.timerManager.clearTimeout).toHaveBeenCalledWith(789);
    });

    it('should not repaginate if book is closed', () => {
      mockContext.isOpenedFn.mockReturnValue(false);

      handler._handleFullscreenChange();
      vi.advanceTimersByTime(150);

      expect(mockContext.repaginateFn).not.toHaveBeenCalled();
    });

    it('should not repaginate if destroyed', () => {
      mockContext.isDestroyedFn.mockReturnValue(true);

      handler._handleFullscreenChange();
      vi.advanceTimersByTime(150);

      expect(mockContext.repaginateFn).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should clear resize timer', () => {
      handler.resizeTimer = 456;

      handler.destroy();

      expect(mockContext.timerManager.clearTimeout).toHaveBeenCalledWith(456);
      expect(handler.resizeTimer).toBeNull();
    });

    it('should not fail if no timer', () => {
      handler.resizeTimer = null;

      expect(() => handler.destroy()).not.toThrow();
    });
  });
});
