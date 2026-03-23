/**
 * Unit tests for DragDelegate
 * Drag-based page flipping
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock helpers
vi.mock('../../../../js/core/delegates/DragDOMPreparer.js', () => ({
  DragDOMPreparer: vi.fn(function() {
    this.prepare = vi.fn();
    this.cleanupSheet = vi.fn();
    this.cleanupPages = vi.fn();
    this.destroy = vi.fn();
    this._pageRefs = null;
  }),
}));

vi.mock('../../../../js/core/delegates/DragShadowRenderer.js', () => ({
  DragShadowRenderer: vi.fn(function() {
    this.activate = vi.fn();
    this.update = vi.fn();
    this.reset = vi.fn();
    this.destroy = vi.fn();
  }),
}));

vi.mock('../../../../js/core/delegates/DragAnimator.js', () => ({
  DragAnimator: vi.fn(function() {
    this.animate = vi.fn((from, to, onUpdate, onComplete) => {
      onComplete();
    });
    this.cancel = vi.fn();
    this.destroy = vi.fn();
  }),
}));

vi.mock('../../../../js/config.js', () => ({
  getConfig: () => ({}),
  BookState: {
    CLOSED: 'closed',
    OPENING: 'opening',
    OPENED: 'opened',
    FLIPPING: 'flipping',
    CLOSING: 'closing',
  },
  FlipPhase: {
    LIFT: "lift",
    ROTATE: "rotate",
    DROP: "drop",
    DRAG: "drag",
  },
  Direction: {
    NEXT: "next",
    PREV: "prev",
  },
  BoolStr: {
    TRUE: "true",
    FALSE: "false",
  },
}));

const { DragDelegate } = await import('../../../../js/core/delegates/DragDelegate.js');
const { DelegateEvents } = await import('../../../../js/core/delegates/BaseDelegate.js');

describe('DragDelegate', () => {
  let delegate;
  let mockDeps;
  let mockBook;
  let mockSheet;
  let eventHandlers;

  beforeEach(() => {
    // Event handlers to capture emitted events
    eventHandlers = {
      onIndexChange: vi.fn(),
      onChapterUpdate: vi.fn(),
    };
    // Create mock elements
    mockBook = document.createElement('div');
    mockBook.style.width = '1000px';
    mockBook.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      right: 1000,
      width: 1000,
    }));

    mockSheet = document.createElement('div');

    // Create corner zones
    const nextZone = document.createElement('div');
    nextZone.classList.add('corner-zone');
    nextZone.dataset.dir = 'next';
    mockBook.appendChild(nextZone);

    const prevZone = document.createElement('div');
    prevZone.classList.add('corner-zone');
    prevZone.dataset.dir = 'prev';
    mockBook.appendChild(prevZone);

    mockDeps = {
      stateMachine: {
        current: 'OPENED',
        get isOpened() { return this.current === 'OPENED'; },
        get isBusy() { return ['OPENING', 'CLOSING', 'FLIPPING'].includes(this.current); },
        transitionTo: vi.fn((state) => {
          mockDeps.stateMachine.current = state;
          return true;
        }),
      },
      renderer: {
        getMaxIndex: vi.fn(() => 100),
        prepareBuffer: vi.fn(),
        prepareSheet: vi.fn(),
        swapBuffers: vi.fn(),
        elements: {
          leftActive: document.createElement('div'),
          rightActive: document.createElement('div'),
          leftBuffer: document.createElement('div'),
          rightBuffer: document.createElement('div'),
        },
      },
      animator: {
        runFlip: vi.fn().mockResolvedValue(undefined),
      },
      soundManager: {
        play: vi.fn(),
      },
      settings: {
        get: vi.fn((key) => {
          if (key === 'soundEnabled') return true;
          return null;
        }),
      },
      dom: {
        get: vi.fn((key) => {
          if (key === 'book') return mockBook;
          if (key === 'sheet') return mockSheet;
          return null;
        }),
      },
      eventManager: {
        add: vi.fn(),
        remove: vi.fn(),
      },
      mediaQueries: {
        get: vi.fn((key) => key === 'mobile' ? false : null),
        get isMobile() { return this.get("mobile"); }
      },
      state: {
        index: 50, // Middle of book
        chapterStarts: [0, 50, 100],
      },
    };

    delegate = new DragDelegate(mockDeps);

    // Subscribe to delegate events
    delegate.on(DelegateEvents.INDEX_CHANGE, eventHandlers.onIndexChange);
    delegate.on(DelegateEvents.CHAPTER_UPDATE, eventHandlers.onChapterUpdate);
  });

  afterEach(() => {
    // Only destroy if not already destroyed (for destroy tests)
    if (delegate.dragAnimator) {
      delegate.destroy();
    }
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should store eventManager reference', () => {
      expect(delegate.eventManager).toBe(mockDeps.eventManager);
    });

    it('should initialize drag state', () => {
      expect(delegate.isDragging).toBe(false);
      expect(delegate.direction).toBeNull();
      expect(delegate.currentAngle).toBe(0);
    });

    it('should create helper instances', () => {
      expect(delegate.domPreparer).toBeDefined();
      expect(delegate.shadowRenderer).toBeDefined();
      expect(delegate.dragAnimator).toBeDefined();
    });

    it('should throw error if required dependencies are missing', () => {
      expect(() => new DragDelegate({})).toThrow('DragDelegate');
    });
  });

  describe('isActive', () => {
    it('should return false when not dragging', () => {
      expect(delegate.isActive).toBe(false);
    });

    it('should return true when dragging', () => {
      delegate.isDragging = true;
      expect(delegate.isActive).toBe(true);
    });
  });

  describe('canFlipNext', () => {
    it('should return true if can flip to next page', () => {
      mockDeps.state.index = 50;
      mockDeps.renderer.getMaxIndex.mockReturnValue(100);

      expect(delegate.canFlipNext()).toBe(true);
    });

    it('should return false if at last page', () => {
      mockDeps.state.index = 100;
      mockDeps.renderer.getMaxIndex.mockReturnValue(100);

      expect(delegate.canFlipNext()).toBe(false);
    });

    it('should return false if book not opened', () => {
      mockDeps.stateMachine.current = 'CLOSED';

      expect(delegate.canFlipNext()).toBe(false);
    });
  });

  describe('canFlipPrev', () => {
    it('should return true if can flip to prev page', () => {
      mockDeps.state.index = 50;

      expect(delegate.canFlipPrev()).toBe(true);
    });

    it('should return false if at first page', () => {
      mockDeps.state.index = 0;

      expect(delegate.canFlipPrev()).toBe(false);
    });

    it('should return false if book not opened', () => {
      mockDeps.stateMachine.current = 'CLOSED';

      expect(delegate.canFlipPrev()).toBe(false);
    });
  });

  describe('bind', () => {
    it('should add event listeners to corner zones', () => {
      delegate.bind();

      // Should add mousedown and touchstart to each zone (2 zones * 2 events = 4)
      // Plus 4 global events (mousemove, mouseup, touchmove, touchend)
      expect(mockDeps.eventManager.add).toHaveBeenCalled();
    });

    it('should add global move and up handlers', () => {
      delegate.bind();

      expect(mockDeps.eventManager.add).toHaveBeenCalledWith(
        document,
        'mousemove',
        expect.any(Function)
      );
      expect(mockDeps.eventManager.add).toHaveBeenCalledWith(
        document,
        'mouseup',
        expect.any(Function)
      );
    });

    it('should handle missing book element', () => {
      mockDeps.dom.get.mockReturnValue(null);

      expect(() => delegate.bind()).not.toThrow();
    });
  });

  describe('_startDrag', () => {
    it('should not start if busy', () => {
      mockDeps.stateMachine.current = 'FLIPPING';

      delegate._startDrag({ clientX: 500 }, 'next');

      expect(delegate.isDragging).toBe(false);
    });

    it('should not start next if cannot flip next', () => {
      mockDeps.state.index = 100;
      mockDeps.renderer.getMaxIndex.mockReturnValue(100);

      delegate._startDrag({ clientX: 500 }, 'next');

      expect(delegate.isDragging).toBe(false);
    });

    it('should not start prev if cannot flip prev', () => {
      mockDeps.state.index = 0;

      delegate._startDrag({ clientX: 500 }, 'prev');

      expect(delegate.isDragging).toBe(false);
    });

    it('should transition to FLIPPING', () => {
      delegate._startDrag({ clientX: 500 }, 'next');

      expect(mockDeps.stateMachine.transitionTo).toHaveBeenCalledWith('flipping');
    });

    it('should set drag state', () => {
      delegate._startDrag({ clientX: 500 }, 'next');

      expect(delegate.isDragging).toBe(true);
      expect(delegate.direction).toBe('next');
      expect(delegate.startX).toBe(500);
    });

    it('should capture book rect', () => {
      delegate._startDrag({ clientX: 500 }, 'next');

      expect(mockBook.getBoundingClientRect).toHaveBeenCalled();
      expect(delegate.bookWidth).toBe(1000);
    });

    it('should call domPreparer.prepare', () => {
      delegate._startDrag({ clientX: 500 }, 'next');

      expect(delegate.domPreparer.prepare).toHaveBeenCalledWith('next', 50, 2, false);
    });

    it('should activate shadow renderer', () => {
      delegate._startDrag({ clientX: 500 }, 'next');

      expect(delegate.shadowRenderer.activate).toHaveBeenCalledWith('next');
    });
  });

  describe('_updateAngleFromEvent', () => {
    beforeEach(() => {
      delegate.bookRect = { left: 0 };
      delegate.bookWidth = 1000;
    });

    describe('next direction', () => {
      beforeEach(() => {
        delegate.direction = 'next';
      });

      it('should calculate angle based on position (right edge = 0)', () => {
        delegate._updateAngleFromEvent({ clientX: 1000 });

        expect(delegate.currentAngle).toBe(0);
      });

      it('should calculate angle based on position (left edge = 180)', () => {
        delegate._updateAngleFromEvent({ clientX: 0 });

        expect(delegate.currentAngle).toBe(180);
      });

      it('should calculate angle based on position (middle = 90)', () => {
        delegate._updateAngleFromEvent({ clientX: 500 });

        expect(delegate.currentAngle).toBe(90);
      });
    });

    describe('prev direction', () => {
      beforeEach(() => {
        delegate.direction = 'prev';
      });

      it('should calculate angle based on position (left edge = 0)', () => {
        delegate._updateAngleFromEvent({ clientX: 0 });

        expect(delegate.currentAngle).toBe(0);
      });

      it('should calculate angle based on position (right edge = 180)', () => {
        delegate._updateAngleFromEvent({ clientX: 1000 });

        expect(delegate.currentAngle).toBe(180);
      });
    });

    it('should clamp angle to 0-180', () => {
      delegate.direction = 'next';
      delegate._updateAngleFromEvent({ clientX: 2000 }); // Way off screen

      expect(delegate.currentAngle).toBeGreaterThanOrEqual(0);
      expect(delegate.currentAngle).toBeLessThanOrEqual(180);
    });
  });

  describe('_render', () => {
    beforeEach(() => {
      delegate.currentAngle = 90;
    });

    it('should set inline transform on sheet for next direction', () => {
      delegate.direction = 'next';
      delegate._render();

      expect(mockSheet.style.transform).toBe('translateZ(1px) rotateY(-90deg)');
    });

    it('should set inline transform on sheet for prev direction', () => {
      delegate.direction = 'prev';
      delegate._render();

      expect(mockSheet.style.transform).toBe('translateZ(1px) rotateY(90deg)');
    });

    it('should update shadow renderer', () => {
      delegate.direction = 'next';
      delegate._render();

      expect(delegate.shadowRenderer.update).toHaveBeenCalledWith(90, 'next', false);
    });
  });

  describe('_endDrag', () => {
    beforeEach(() => {
      delegate.isDragging = true;
      delegate.direction = 'next';
    });

    it('should do nothing if not dragging', () => {
      delegate.isDragging = false;
      delegate._endDrag();

      expect(delegate.dragAnimator.animate).not.toHaveBeenCalled();
    });

    it('should set isDragging to false', () => {
      delegate._endDrag();

      expect(delegate.isDragging).toBe(false);
    });

    it('should animate to 180 if angle > 90 (complete flip)', () => {
      delegate.currentAngle = 120;
      delegate._endDrag();

      expect(delegate.dragAnimator.animate).toHaveBeenCalledWith(
        120,
        180,
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should animate to 0 if angle <= 90 (cancel flip)', () => {
      delegate.currentAngle = 60;
      delegate._endDrag();

      expect(delegate.dragAnimator.animate).toHaveBeenCalledWith(
        60,
        0,
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe('_finish', () => {
    beforeEach(() => {
      delegate.direction = 'next';
      delegate.currentAngle = 180;
    });

    it('should call domPreparer.cleanupSheet', () => {
      delegate._finish(true);

      expect(delegate.domPreparer.cleanupSheet).toHaveBeenCalled();
    });

    it('should reset shadow renderer', () => {
      delegate._finish(true);

      expect(delegate.shadowRenderer.reset).toHaveBeenCalled();
    });

    it('should transition back to OPENED', () => {
      delegate._finish(true);

      expect(mockDeps.stateMachine.transitionTo).toHaveBeenCalledWith('opened');
    });

    it('should call _completeFlip when completed is true', () => {
      const completeSpy = vi.spyOn(delegate, '_completeFlip');

      delegate._finish(true);

      expect(completeSpy).toHaveBeenCalledWith('next');
    });

    it('should call _cancelFlip when completed is false', () => {
      const cancelSpy = vi.spyOn(delegate, '_cancelFlip');

      delegate._finish(false);

      expect(cancelSpy).toHaveBeenCalled();
    });

    it('should reset state', () => {
      delegate._finish(true);

      expect(delegate.direction).toBeNull();
      expect(delegate.currentAngle).toBe(0);
    });
  });

  describe('_completeFlip', () => {
    it('should play flip sound', () => {
      delegate._completeFlip('next');

      // Sound is called with options for playback rate variation
      expect(mockDeps.soundManager.play).toHaveBeenCalledWith('pageFlip', expect.objectContaining({
        playbackRate: expect.any(Number),
      }));
    });

    it('should swap buffers', () => {
      delegate._completeFlip('next');

      expect(mockDeps.renderer.swapBuffers).toHaveBeenCalled();
    });

    it('should emit indexChange event with new index (next)', () => {
      delegate._completeFlip('next');

      // 50 + 2 (desktop pagesPerFlip) = 52
      expect(eventHandlers.onIndexChange).toHaveBeenCalledWith(52);
    });

    it('should emit indexChange event with new index (prev)', () => {
      delegate._completeFlip('prev');

      // 50 - 2 = 48
      expect(eventHandlers.onIndexChange).toHaveBeenCalledWith(48);
    });

    it('should emit chapterUpdate event', () => {
      delegate._completeFlip('next');

      expect(eventHandlers.onChapterUpdate).toHaveBeenCalled();
    });

    it('should call domPreparer.cleanupPages with completed=true', () => {
      delegate._completeFlip('next');

      expect(delegate.domPreparer.cleanupPages).toHaveBeenCalledWith(true);
    });
  });

  describe('_cancelFlip', () => {
    it('should call domPreparer.cleanupPages with completed=false', () => {
      delegate._cancelFlip();

      expect(delegate.domPreparer.cleanupPages).toHaveBeenCalledWith(false);
    });
  });

  describe('destroy', () => {
    it('should cancel RAF', () => {
      delegate._rafId = 123;
      const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');

      delegate.destroy();

      expect(cancelSpy).toHaveBeenCalledWith(123);
    });

    it('should cancel drag animator', () => {
      // Capture reference before destroy sets it to null
      const dragAnimator = delegate.dragAnimator;

      delegate.destroy();

      expect(dragAnimator.cancel).toHaveBeenCalled();
    });

    it('should destroy helpers', () => {
      // Capture references before destroy sets them to null
      const domPreparer = delegate.domPreparer;
      const shadowRenderer = delegate.shadowRenderer;
      const dragAnimator = delegate.dragAnimator;

      delegate.destroy();

      expect(domPreparer.destroy).toHaveBeenCalled();
      expect(shadowRenderer.destroy).toHaveBeenCalled();
      expect(dragAnimator.destroy).toHaveBeenCalled();
    });

    it('should reset state', () => {
      delegate.isDragging = true;
      delegate.direction = 'next';
      delegate.currentAngle = 90;

      delegate.destroy();

      expect(delegate.isDragging).toBe(false);
      expect(delegate.direction).toBeNull();
      expect(delegate.currentAngle).toBe(0);
    });

    it('should clear references', () => {
      delegate.destroy();

      expect(delegate.eventManager).toBeNull();
    });

    it('should remove all event listeners', () => {
      delegate.destroy();

      // Emitting events after destroy should not call handlers
      delegate.emit(DelegateEvents.INDEX_CHANGE, 5);
      delegate.emit(DelegateEvents.CHAPTER_UPDATE);

      expect(eventHandlers.onIndexChange).not.toHaveBeenCalled();
      expect(eventHandlers.onChapterUpdate).not.toHaveBeenCalled();
    });
  });
});
