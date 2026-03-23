/**
 * Тесты для SubscriptionManager
 * Управление подписками на события
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create hoisted mocks
const { mockCssVars, mockMediaQueries } = vi.hoisted(() => {
  return {
    mockCssVars: {
      invalidateCache: vi.fn(),
    },
    mockMediaQueries: {
      subscribe: vi.fn(() => vi.fn()),
    },
  };
});

// Mock the imports
vi.mock('../../../js/utils/CSSVariables.js', () => ({
  cssVars: mockCssVars,
}));

vi.mock('../../../js/utils/MediaQueryManager.js', () => ({
  mediaQueries: mockMediaQueries,
}));

import { SubscriptionManager } from '../../../js/core/SubscriptionManager.js';

describe('SubscriptionManager', () => {
  let manager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new SubscriptionManager();
  });

  describe('constructor', () => {
    it('should initialize empty subscriptions array', () => {
      expect(manager.subscriptions).toEqual([]);
    });
  });

  describe('subscribeToState', () => {
    it('should subscribe to state machine', () => {
      const mockStateMachine = {
        subscribe: vi.fn().mockReturnValue(vi.fn()),
      };
      const mockDom = {
        get: vi.fn().mockReturnValue({ dataset: {} }),
      };
      const updateDebugFn = vi.fn();

      manager.subscribeToState(mockStateMachine, mockDom, updateDebugFn);

      expect(mockStateMachine.subscribe).toHaveBeenCalled();
      expect(manager.subscriptions.length).toBe(1);
    });

    it('should update book dataset on state change', () => {
      const listener = vi.fn();
      const mockStateMachine = {
        subscribe: vi.fn((fn) => {
          listener.mockImplementation(fn);
          return vi.fn();
        }),
      };
      const bookElement = { dataset: {} };
      const mockDom = {
        get: vi.fn().mockReturnValue(bookElement),
      };
      const updateDebugFn = vi.fn();

      manager.subscribeToState(mockStateMachine, mockDom, updateDebugFn);

      // Simulate state change
      listener('opened');

      expect(bookElement.dataset.state).toBe('opened');
      expect(updateDebugFn).toHaveBeenCalled();
    });
  });

  describe('subscribeToPagination', () => {
    it('should subscribe to paginator progress', () => {
      const mockPaginator = {
        on: vi.fn().mockReturnValue(vi.fn()),
      };
      const mockLoadingIndicator = {
        setPhase: vi.fn(),
      };

      manager.subscribeToPagination(mockPaginator, mockLoadingIndicator);

      expect(mockPaginator.on).toHaveBeenCalledWith('progress', expect.any(Function));
      expect(manager.subscriptions.length).toBe(1);
    });

    it('should update loading indicator on progress', () => {
      let progressHandler;
      const mockPaginator = {
        on: vi.fn((event, handler) => {
          progressHandler = handler;
          return vi.fn();
        }),
      };
      const mockLoadingIndicator = {
        setPhase: vi.fn(),
      };

      manager.subscribeToPagination(mockPaginator, mockLoadingIndicator);

      // Simulate progress event
      progressHandler({ phase: 'content', progress: 50 });

      expect(mockLoadingIndicator.setPhase).toHaveBeenCalledWith('content', 50);
    });
  });

  describe('subscribeToMediaQueries', () => {
    it('should subscribe to media queries', () => {
      const repaginateFn = vi.fn();
      const isOpenedFn = vi.fn().mockReturnValue(false);

      manager.subscribeToMediaQueries(repaginateFn, isOpenedFn);

      expect(mockMediaQueries.subscribe).toHaveBeenCalled();
      expect(manager.subscriptions.length).toBe(1);
    });

    it('should invalidate CSS cache on media query change', () => {
      let mediaHandler;
      mockMediaQueries.subscribe.mockImplementation((handler) => {
        mediaHandler = handler;
        return vi.fn();
      });

      const repaginateFn = vi.fn();
      const isOpenedFn = vi.fn().mockReturnValue(false);

      manager.subscribeToMediaQueries(repaginateFn, isOpenedFn);

      // Simulate media query change
      mediaHandler();

      expect(mockCssVars.invalidateCache).toHaveBeenCalled();
    });

    it('should repaginate if book is opened', () => {
      let mediaHandler;
      mockMediaQueries.subscribe.mockImplementation((handler) => {
        mediaHandler = handler;
        return vi.fn();
      });

      const repaginateFn = vi.fn();
      const isOpenedFn = vi.fn().mockReturnValue(true);

      manager.subscribeToMediaQueries(repaginateFn, isOpenedFn);

      // Simulate media query change
      mediaHandler();

      expect(repaginateFn).toHaveBeenCalledWith(true);
    });

    it('should not repaginate if book is closed', () => {
      let mediaHandler;
      mockMediaQueries.subscribe.mockImplementation((handler) => {
        mediaHandler = handler;
        return vi.fn();
      });

      const repaginateFn = vi.fn();
      const isOpenedFn = vi.fn().mockReturnValue(false);

      manager.subscribeToMediaQueries(repaginateFn, isOpenedFn);

      // Simulate media query change
      mediaHandler();

      expect(repaginateFn).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribeAll', () => {
    it('should call all unsubscribe functions', () => {
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();
      const unsub3 = vi.fn();

      manager.subscriptions = [unsub1, unsub2, unsub3];

      manager.unsubscribeAll();

      expect(unsub1).toHaveBeenCalled();
      expect(unsub2).toHaveBeenCalled();
      expect(unsub3).toHaveBeenCalled();
    });

    it('should clear subscriptions array', () => {
      manager.subscriptions = [vi.fn(), vi.fn()];

      manager.unsubscribeAll();

      expect(manager.subscriptions).toEqual([]);
    });

    it('should skip non-function items', () => {
      manager.subscriptions = [vi.fn(), null, undefined, 'string', vi.fn()];

      expect(() => manager.unsubscribeAll()).not.toThrow();
    });
  });
});
