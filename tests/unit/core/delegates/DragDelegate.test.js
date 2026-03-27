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

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEC-BASED: bind — регистрация событий (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('bind — event registration (spec-based)', () => {
    it('should register "resize" event on window to invalidate cached rect', () => {
      delegate.bind();

      const resizeCall = mockDeps.eventManager.add.mock.calls.find(
        (c) => c[0] === window && c[1] === 'resize'
      );
      expect(resizeCall).toBeDefined();
    });

    it('resize handler should clear _cachedBookRect', () => {
      delegate.bind();

      // Найдём handler для resize
      const resizeCall = mockDeps.eventManager.add.mock.calls.find(
        (c) => c[0] === window && c[1] === 'resize'
      );
      delegate._cachedBookRect = { left: 0, width: 500 };
      resizeCall[2](); // вызвать handler
      expect(delegate._cachedBookRect).toBeNull();
    });

    it('should register "mousedown" on each corner zone', () => {
      delegate.bind();

      const mousedownCalls = mockDeps.eventManager.add.mock.calls.filter(
        (c) => c[1] === 'mousedown'
      );
      expect(mousedownCalls.length).toBe(2); // 2 corner zones
    });

    it('should register "touchstart" on each corner zone with passive:false', () => {
      delegate.bind();

      const touchstartCalls = mockDeps.eventManager.add.mock.calls.filter(
        (c) => c[1] === 'touchstart'
      );
      expect(touchstartCalls.length).toBe(2);
      touchstartCalls.forEach((call) => {
        expect(call[3]).toEqual({ passive: false });
      });
    });

    it('should register "touchmove" on document with passive:false', () => {
      delegate.bind();

      const touchmoveCall = mockDeps.eventManager.add.mock.calls.find(
        (c) => c[0] === document && c[1] === 'touchmove'
      );
      expect(touchmoveCall).toBeDefined();
      expect(touchmoveCall[3]).toEqual({ passive: false });
    });

    it('should register "touchend" on document', () => {
      delegate.bind();

      const touchendCall = mockDeps.eventManager.add.mock.calls.find(
        (c) => c[0] === document && c[1] === 'touchend'
      );
      expect(touchendCall).toBeDefined();
    });

    it('mousedown on corner zone should call _startDrag with direction', () => {
      delegate.bind();

      const startSpy = vi.spyOn(delegate, '_startDrag');
      // Найдём mousedown handler для corner zone с dir="next"
      const mousedownCalls = mockDeps.eventManager.add.mock.calls.filter(
        (c) => c[1] === 'mousedown'
      );
      // Первая зона — next (создана первой в beforeEach)
      const fakeEvent = { clientX: 500, preventDefault: vi.fn(), stopPropagation: vi.fn() };
      mousedownCalls[0][2](fakeEvent);

      expect(fakeEvent.preventDefault).toHaveBeenCalled();
      expect(fakeEvent.stopPropagation).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalledWith(fakeEvent, 'next');
    });

    it('touchstart on corner zone should call _startDrag with first touch', () => {
      delegate.bind();

      const startSpy = vi.spyOn(delegate, '_startDrag');
      const touchstartCalls = mockDeps.eventManager.add.mock.calls.filter(
        (c) => c[1] === 'touchstart'
      );
      const fakeTouch = { clientX: 300 };
      const fakeEvent = {
        touches: [fakeTouch],
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };
      touchstartCalls[0][2](fakeEvent);

      expect(fakeEvent.preventDefault).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalledWith(fakeTouch, 'next');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEC-BASED: _scheduleUpdate — RAF batching (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_scheduleUpdate — RAF batching (spec-based)', () => {
    let rafCallback;

    beforeEach(() => {
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafCallback = cb;
        return 42;
      });
      delegate.isDragging = true;
      delegate.direction = 'next';
      delegate.bookRect = { left: 0 };
      delegate.bookWidth = 1000;
    });

    it('should request animation frame on first call', () => {
      delegate._scheduleUpdate({ clientX: 500 });

      expect(window.requestAnimationFrame).toHaveBeenCalled();
    });

    it('should not request another RAF if one is pending', () => {
      delegate._scheduleUpdate({ clientX: 500 });
      delegate._scheduleUpdate({ clientX: 600 });

      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    });

    it('RAF callback should update angle from pending event', () => {
      const updateSpy = vi.spyOn(delegate, '_updateAngleFromEvent');
      delegate._scheduleUpdate({ clientX: 500 });

      rafCallback();

      expect(updateSpy).toHaveBeenCalledWith({ clientX: 500 });
    });

    it('RAF callback should use latest event if multiple scheduled', () => {
      const updateSpy = vi.spyOn(delegate, '_updateAngleFromEvent');
      delegate._scheduleUpdate({ clientX: 300 });
      delegate._scheduleUpdate({ clientX: 700 });

      rafCallback();

      expect(updateSpy).toHaveBeenCalledWith({ clientX: 700 });
    });

    it('RAF callback should clear _rafId allowing new requests', () => {
      delegate._scheduleUpdate({ clientX: 500 });
      rafCallback();

      // Теперь можно запросить новый RAF
      delegate._scheduleUpdate({ clientX: 600 });
      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);
    });

    it('RAF callback should not update if no longer dragging', () => {
      const updateSpy = vi.spyOn(delegate, '_updateAngleFromEvent');
      delegate._scheduleUpdate({ clientX: 500 });

      delegate.isDragging = false;
      rafCallback();

      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEC-BASED: _onMouseMove / _onTouchMove (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('mouse/touch move handlers (spec-based)', () => {
    it('_onMouseMove should schedule update when dragging', () => {
      delegate.isDragging = true;
      const scheduleSpy = vi.spyOn(delegate, '_scheduleUpdate');

      delegate._onMouseMove({ clientX: 400 });

      expect(scheduleSpy).toHaveBeenCalledWith({ clientX: 400 });
    });

    it('_onMouseMove should do nothing when not dragging', () => {
      delegate.isDragging = false;
      const scheduleSpy = vi.spyOn(delegate, '_scheduleUpdate');

      delegate._onMouseMove({ clientX: 400 });

      expect(scheduleSpy).not.toHaveBeenCalled();
    });

    it('_onTouchMove should schedule update when dragging', () => {
      delegate.isDragging = true;
      const scheduleSpy = vi.spyOn(delegate, '_scheduleUpdate');

      delegate._onTouchMove({
        touches: [{ clientX: 400 }],
        preventDefault: vi.fn(),
      });

      expect(scheduleSpy).toHaveBeenCalledWith({ clientX: 400 });
    });

    it('_onTouchMove should preventDefault to block scrolling', () => {
      delegate.isDragging = true;
      const event = {
        touches: [{ clientX: 400 }],
        preventDefault: vi.fn(),
      };

      delegate._onTouchMove(event);

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('_onTouchMove should do nothing when not dragging', () => {
      delegate.isDragging = false;
      const scheduleSpy = vi.spyOn(delegate, '_scheduleUpdate');
      const event = {
        touches: [{ clientX: 400 }],
        preventDefault: vi.fn(),
      };

      delegate._onTouchMove(event);

      expect(scheduleSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEC-BASED: _onMouseUp / _onTouchEnd (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('mouse/touch end handlers (spec-based)', () => {
    it('_onMouseUp should call _endDrag when dragging', () => {
      delegate.isDragging = true;
      delegate.direction = 'next';
      const endSpy = vi.spyOn(delegate, '_endDrag');

      delegate._onMouseUp();

      expect(endSpy).toHaveBeenCalled();
    });

    it('_onMouseUp should do nothing when not dragging', () => {
      delegate.isDragging = false;
      const endSpy = vi.spyOn(delegate, '_endDrag');

      delegate._onMouseUp();

      expect(endSpy).not.toHaveBeenCalled();
    });

    it('_onTouchEnd should call _endDrag when dragging', () => {
      delegate.isDragging = true;
      delegate.direction = 'next';
      const endSpy = vi.spyOn(delegate, '_endDrag');

      delegate._onTouchEnd();

      expect(endSpy).toHaveBeenCalled();
    });

    it('_onTouchEnd should do nothing when not dragging', () => {
      delegate.isDragging = false;
      const endSpy = vi.spyOn(delegate, '_endDrag');

      delegate._onTouchEnd();

      expect(endSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEC-BASED: _updateAngleFromEvent — arithmetic (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_updateAngleFromEvent arithmetic (spec-based)', () => {
    beforeEach(() => {
      delegate.bookRect = { left: 100 };
      delegate.bookWidth = 800;
    });

    it('next: should subtract bookRect.left from clientX for relative position', () => {
      delegate.direction = 'next';
      // clientX=500, left=100 → x=400, progress=400/800=0.5, angle=(1-0.5)*180=90
      delegate._updateAngleFromEvent({ clientX: 500 });
      expect(delegate.currentAngle).toBe(90);
    });

    it('next: clientX at left edge of book should give 180°', () => {
      delegate.direction = 'next';
      // clientX=100, left=100 → x=0, progress=0, angle=(1-0)*180=180
      delegate._updateAngleFromEvent({ clientX: 100 });
      expect(delegate.currentAngle).toBe(180);
    });

    it('next: clientX at right edge of book should give 0°', () => {
      delegate.direction = 'next';
      // clientX=900, left=100 → x=800, progress=1, angle=(1-1)*180=0
      delegate._updateAngleFromEvent({ clientX: 900 });
      expect(delegate.currentAngle).toBe(0);
    });

    it('prev: should subtract bookRect.left from clientX for relative position', () => {
      delegate.direction = 'prev';
      // clientX=500, left=100 → x=400, progress=400/800=0.5, angle=0.5*180=90
      delegate._updateAngleFromEvent({ clientX: 500 });
      expect(delegate.currentAngle).toBe(90);
    });

    it('prev: clientX at left edge should give 0°', () => {
      delegate.direction = 'prev';
      // clientX=100, left=100 → x=0, progress=0, angle=0
      delegate._updateAngleFromEvent({ clientX: 100 });
      expect(delegate.currentAngle).toBe(0);
    });

    it('prev: clientX at right edge should give 180°', () => {
      delegate.direction = 'prev';
      // clientX=900, left=100 → x=800, progress=1, angle=180
      delegate._updateAngleFromEvent({ clientX: 900 });
      expect(delegate.currentAngle).toBe(180);
    });

    it('should not update if bookRect is null', () => {
      delegate.direction = 'next';
      delegate.bookRect = null;
      delegate.currentAngle = 45;

      delegate._updateAngleFromEvent({ clientX: 500 });

      expect(delegate.currentAngle).toBe(45); // unchanged
    });

    it('should not update if bookWidth is 0', () => {
      delegate.direction = 'next';
      delegate.bookWidth = 0;
      delegate.currentAngle = 45;

      delegate._updateAngleFromEvent({ clientX: 500 });

      expect(delegate.currentAngle).toBe(45); // unchanged
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEC-BASED: _endDrag — animation callbacks (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_endDrag — animation callbacks (spec-based)', () => {
    beforeEach(() => {
      delegate.isDragging = true;
      delegate.direction = 'next';
      // Перехватываем animate чтобы получить callbacks
      delegate.dragAnimator.animate = vi.fn();
    });

    it('onUpdate callback should set currentAngle and render', () => {
      delegate.currentAngle = 120;
      delegate._endDrag();

      const onUpdate = delegate.dragAnimator.animate.mock.calls[0][2];
      const renderSpy = vi.spyOn(delegate, '_render');

      onUpdate(150);

      expect(delegate.currentAngle).toBe(150);
      expect(renderSpy).toHaveBeenCalled();
    });

    it('onComplete callback should call _finish with willComplete=true when angle > 90', () => {
      delegate.currentAngle = 120;
      const finishSpy = vi.spyOn(delegate, '_finish');

      delegate._endDrag();

      const onComplete = delegate.dragAnimator.animate.mock.calls[0][3];
      onComplete();

      expect(finishSpy).toHaveBeenCalledWith(true);
    });

    it('onComplete callback should call _finish with willComplete=false when angle <= 90', () => {
      delegate.currentAngle = 60;
      const finishSpy = vi.spyOn(delegate, '_finish');

      delegate._endDrag();

      const onComplete = delegate.dragAnimator.animate.mock.calls[0][3];
      onComplete();

      expect(finishSpy).toHaveBeenCalledWith(false);
    });

    it('angle exactly 90 should NOT complete (<=90 means cancel)', () => {
      delegate.currentAngle = 90;

      delegate._endDrag();

      // Animate to 0 (cancel), not to 180 (complete)
      expect(delegate.dragAnimator.animate).toHaveBeenCalledWith(
        90, 0, expect.any(Function), expect.any(Function)
      );
    });

    it('should recover state if animation throws', () => {
      delegate.dragAnimator.animate.mockImplementation(() => {
        throw new Error('animation failure');
      });

      delegate.currentAngle = 120;
      const finishSpy = vi.spyOn(delegate, '_finish');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      delegate._endDrag();

      expect(consoleSpy).toHaveBeenCalled();
      expect(finishSpy).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEC-BASED: _startDrag guard conditions (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_startDrag guard conditions (spec-based)', () => {
    it('should block drag when busy (OPENING state)', () => {
      mockDeps.stateMachine.current = 'OPENING';

      delegate._startDrag({ clientX: 500 }, 'next');

      expect(delegate.isDragging).toBe(false);
    });

    it('should block drag when busy (CLOSING state)', () => {
      mockDeps.stateMachine.current = 'CLOSING';

      delegate._startDrag({ clientX: 500 }, 'next');

      expect(delegate.isDragging).toBe(false);
    });

    it('should reuse cached bookRect on subsequent drags', () => {
      delegate._startDrag({ clientX: 500 }, 'next');
      expect(mockBook.getBoundingClientRect).toHaveBeenCalledTimes(1);

      // Завершаем первый drag
      delegate._finish(false);

      // Второй drag — rect уже в кеше
      mockDeps.stateMachine.current = 'OPENED';
      delegate._startDrag({ clientX: 500 }, 'next');
      // getBoundingClientRect не вызывается снова (кеш)
      expect(mockBook.getBoundingClientRect).toHaveBeenCalledTimes(1);
    });

    it('should re-fetch bookRect after resize invalidates cache', () => {
      delegate.bind();

      delegate._startDrag({ clientX: 500 }, 'next');
      expect(mockBook.getBoundingClientRect).toHaveBeenCalledTimes(1);

      delegate._finish(false);

      // Симулируем resize
      const resizeCall = mockDeps.eventManager.add.mock.calls.find(
        (c) => c[0] === window && c[1] === 'resize'
      );
      resizeCall[2]();

      // Следующий drag должен заново получить rect
      mockDeps.stateMachine.current = 'OPENED';
      delegate._startDrag({ clientX: 500 }, 'next');
      expect(mockBook.getBoundingClientRect).toHaveBeenCalledTimes(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEC-BASED: canFlipNext boundary (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('canFlipNext boundary (spec-based)', () => {
    it('should return true when index + pagesPerFlip equals maxIndex', () => {
      // Desktop: pagesPerFlip=2, index=98, max=100 → 98+2=100 <= 100 → true
      mockDeps.state.index = 98;
      mockDeps.renderer.getMaxIndex.mockReturnValue(100);

      expect(delegate.canFlipNext()).toBe(true);
    });
  });
});
