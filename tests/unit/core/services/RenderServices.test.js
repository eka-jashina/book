/**
 * TESTS: RenderServices
 * Тесты для группы сервисов рендеринга и анимации
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { MockBookRenderer, MockBookAnimator, MockLoadingIndicator, MockAsyncPaginator } = vi.hoisted(() => {
  const MockBookRenderer = vi.fn(function () {
    this.renderSpread = vi.fn();
    this.renderSingle = vi.fn();
    this.swapBuffers = vi.fn();
    this.clear = vi.fn();
    this.loadedImageUrls = new Set();
  });
  const MockBookAnimator = vi.fn(function () {
    this.getTimings = vi.fn(() => ({ lift: 240, rotate: 900, drop: 160 }));
    this.destroy = vi.fn();
  });
  const MockLoadingIndicator = vi.fn(function () {
    this.show = vi.fn();
    this.hide = vi.fn();
    this.setProgress = vi.fn();
    this.setPhase = vi.fn();
  });
  const MockAsyncPaginator = vi.fn(function () {
    this.paginate = vi.fn();
    this.destroy = vi.fn();
    this.on = vi.fn();
    this.off = vi.fn();
  });
  return { MockBookRenderer, MockBookAnimator, MockLoadingIndicator, MockAsyncPaginator };
});

vi.mock('@core/BookRenderer.js', () => ({ BookRenderer: MockBookRenderer }));
vi.mock('@core/BookAnimator.js', () => ({ BookAnimator: MockBookAnimator }));
vi.mock('@core/LoadingIndicator.js', () => ({ LoadingIndicator: MockLoadingIndicator }));
vi.mock('@managers/AsyncPaginator.js', () => ({ AsyncPaginator: MockAsyncPaginator }));
vi.mock('@utils/HTMLSanitizer.js', () => ({
  sanitizer: { sanitize: vi.fn((html) => html) },
}));

import { RenderServices } from '@core/services/RenderServices.js';

describe('RenderServices', () => {
  let services;
  let mockCore;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCore = {
      dom: {
        getMultiple: vi.fn((...keys) => {
          const result = {};
          for (const key of keys) {
            result[key] = document.createElement('div');
            result[key].id = key;
          }
          return result;
        }),
      },
      timerManager: {
        setTimeout: vi.fn(),
        clearTimeout: vi.fn(),
        clear: vi.fn(),
      },
    };

    services = new RenderServices(mockCore);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should create BookRenderer', () => {
      expect(MockBookRenderer).toHaveBeenCalledOnce();
      expect(services.renderer).toBeDefined();
    });

    it('should create BookAnimator', () => {
      expect(MockBookAnimator).toHaveBeenCalledOnce();
      expect(services.animator).toBeDefined();
    });

    it('should create AsyncPaginator', () => {
      expect(MockAsyncPaginator).toHaveBeenCalledOnce();
      expect(services.paginator).toBeDefined();
    });

    it('should create LoadingIndicator', () => {
      expect(MockLoadingIndicator).toHaveBeenCalledOnce();
      expect(services.loadingIndicator).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _createRenderer
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_createRenderer()', () => {
    it('should request page elements from DOMManager', () => {
      expect(mockCore.dom.getMultiple).toHaveBeenCalledWith(
        'leftA', 'rightA', 'leftB', 'rightB', 'sheetFront', 'sheetBack'
      );
    });

    it('should pass page elements to BookRenderer constructor', () => {
      const call = MockBookRenderer.mock.calls[0][0];
      expect(call).toHaveProperty('leftActive');
      expect(call).toHaveProperty('rightActive');
      expect(call).toHaveProperty('leftBuffer');
      expect(call).toHaveProperty('rightBuffer');
      expect(call).toHaveProperty('sheetFront');
      expect(call).toHaveProperty('sheetBack');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _createAnimator
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_createAnimator()', () => {
    it('should request book elements from DOMManager', () => {
      expect(mockCore.dom.getMultiple).toHaveBeenCalledWith(
        'book', 'bookWrap', 'cover', 'sheet'
      );
    });

    it('should pass timerManager to BookAnimator constructor', () => {
      const call = MockBookAnimator.mock.calls[0][0];
      expect(call.timerManager).toBe(mockCore.timerManager);
    });

    it('should pass book elements to BookAnimator constructor', () => {
      const call = MockBookAnimator.mock.calls[0][0];
      expect(call).toHaveProperty('book');
      expect(call).toHaveProperty('bookWrap');
      expect(call).toHaveProperty('cover');
      expect(call).toHaveProperty('sheet');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _createPaginator
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_createPaginator()', () => {
    it('should create AsyncPaginator with sanitizer', () => {
      const call = MockAsyncPaginator.mock.calls[0][0];
      expect(call).toHaveProperty('sanitizer');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _createLoadingIndicator
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_createLoadingIndicator()', () => {
    it('should request loading elements from DOMManager', () => {
      expect(mockCore.dom.getMultiple).toHaveBeenCalledWith(
        'loadingOverlay', 'loadingProgress'
      );
    });

    it('should pass overlay and progress elements to LoadingIndicator', () => {
      expect(MockLoadingIndicator).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DESTROY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('destroy()', () => {
    it('should destroy animator', () => {
      const destroySpy = services.animator.destroy;
      services.destroy();
      expect(destroySpy).toHaveBeenCalledOnce();
    });

    it('should destroy paginator', () => {
      const destroySpy = services.paginator.destroy;
      services.destroy();
      expect(destroySpy).toHaveBeenCalledOnce();
    });

    it('should nullify all references', () => {
      services.destroy();
      expect(services.renderer).toBeNull();
      expect(services.animator).toBeNull();
      expect(services.paginator).toBeNull();
      expect(services.loadingIndicator).toBeNull();
    });

    it('should handle already nullified services', () => {
      services.animator = null;
      services.paginator = null;
      expect(() => services.destroy()).not.toThrow();
    });
  });
});
