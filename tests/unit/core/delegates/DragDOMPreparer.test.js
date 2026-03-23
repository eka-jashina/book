/**
 * Unit tests for DragDOMPreparer
 * DOM preparation and cleanup for drag page flipping
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

const { DragDOMPreparer } = await import('../../../../js/core/delegates/DragDOMPreparer.js');

describe('DragDOMPreparer', () => {
  let preparer;
  let mockDom;
  let mockRenderer;
  let mockBook;
  let mockSheet;
  let mockElements;

  beforeEach(() => {
    mockBook = document.createElement('div');
    mockSheet = document.createElement('div');

    mockElements = {
      leftActive: document.createElement('div'),
      rightActive: document.createElement('div'),
      leftBuffer: document.createElement('div'),
      rightBuffer: document.createElement('div'),
    };

    mockDom = {
      get: vi.fn((key) => {
        if (key === 'book') return mockBook;
        if (key === 'sheet') return mockSheet;
        if (key === 'flipShadow') return null;
        return null;
      }),
    };

    mockRenderer = {
      prepareBuffer: vi.fn(),
      prepareSheet: vi.fn(),
      elements: mockElements,
    };

    preparer = new DragDOMPreparer(mockDom, mockRenderer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should store dom and renderer references', () => {
      expect(preparer.dom).toBe(mockDom);
      expect(preparer.renderer).toBe(mockRenderer);
    });

    it('should initialize _pageRefs to null', () => {
      expect(preparer._pageRefs).toBeNull();
    });
  });

  describe('prepare', () => {
    it('should set noTransition on book', () => {
      preparer.prepare('next', 50, 2, false);

      expect(mockBook.dataset.noTransition).toBe('true');
    });

    it('should call renderer.prepareBuffer with correct next index (next)', () => {
      preparer.prepare('next', 50, 2, false);

      expect(mockRenderer.prepareBuffer).toHaveBeenCalledWith(52, false);
    });

    it('should call renderer.prepareBuffer with correct next index (prev)', () => {
      preparer.prepare('prev', 50, 2, false);

      expect(mockRenderer.prepareBuffer).toHaveBeenCalledWith(48, false);
    });

    it('should call renderer.prepareSheet', () => {
      preparer.prepare('next', 50, 2, false);

      expect(mockRenderer.prepareSheet).toHaveBeenCalledWith(50, 52, 'next', false);
    });

    it('should set sheet dataset for drag mode', () => {
      preparer.prepare('next', 50, 2, false);

      expect(mockSheet.dataset.direction).toBe('next');
      expect(mockSheet.dataset.phase).toBe('drag');
      expect(mockSheet.classList.contains('no-transition')).toBe(true);
    });

    it('should set book state to flipping and add dragging attr', () => {
      preparer.prepare('next', 50, 2, false);

      expect(mockBook.dataset.state).toBe('flipping');
      expect(mockBook.dataset.dragging).toBe('');
    });

    describe('_showUnderPage (via prepare)', () => {
      it('should show right buffer and hide right active for next direction (desktop)', () => {
        preparer.prepare('next', 50, 2, false);

        expect(mockElements.rightBuffer.dataset.buffer).toBe('false');
        expect(mockElements.rightBuffer.dataset.dragVisible).toBe('true');
        expect(mockElements.rightActive.dataset.dragHidden).toBe('true');
      });

      it('should show left buffer and hide left active for prev direction (desktop)', () => {
        preparer.prepare('prev', 50, 2, false);

        expect(mockElements.leftBuffer.dataset.buffer).toBe('false');
        expect(mockElements.leftBuffer.dataset.dragVisible).toBe('true');
        expect(mockElements.leftActive.dataset.dragHidden).toBe('true');
      });

      it('should show right buffer and hide right active for mobile', () => {
        preparer.prepare('next', 50, 1, true);

        expect(mockElements.rightBuffer.dataset.buffer).toBe('false');
        expect(mockElements.rightBuffer.dataset.dragVisible).toBe('true');
        expect(mockElements.rightActive.dataset.dragHidden).toBe('true');
      });

      it('should show right buffer for mobile even in prev direction', () => {
        preparer.prepare('prev', 50, 1, true);

        expect(mockElements.rightBuffer.dataset.buffer).toBe('false');
        expect(mockElements.rightBuffer.dataset.dragVisible).toBe('true');
        expect(mockElements.rightActive.dataset.dragHidden).toBe('true');
      });

      it('should store page refs', () => {
        preparer.prepare('next', 50, 2, false);

        expect(preparer._pageRefs).toEqual({
          leftActive: mockElements.leftActive,
          rightActive: mockElements.rightActive,
          leftBuffer: mockElements.leftBuffer,
          rightBuffer: mockElements.rightBuffer,
        });
      });
    });
  });

  describe('cleanupSheet', () => {
    beforeEach(() => {
      // Setup sheet in drag state
      mockSheet.dataset.phase = 'drag';
      mockSheet.dataset.direction = 'next';
      mockSheet.classList.add('no-transition');
      mockSheet.style.transform = 'translateZ(1px) rotateY(-90deg)';
      mockBook.dataset.dragging = '';
    });

    it('should remove no-transition class from sheet', () => {
      preparer.cleanupSheet();

      expect(mockSheet.classList.contains('no-transition')).toBe(false);
    });

    it('should remove inline transform from sheet', () => {
      preparer.cleanupSheet();

      expect(mockSheet.style.transform).toBe('');
    });

    it('should delete phase and direction from sheet dataset', () => {
      preparer.cleanupSheet();

      expect(mockSheet.dataset.phase).toBeUndefined();
      expect(mockSheet.dataset.direction).toBeUndefined();
    });

    it('should delete dragging from book dataset', () => {
      preparer.cleanupSheet();

      expect(mockBook.dataset.dragging).toBeUndefined();
    });
  });

  describe('cleanupPages', () => {
    beforeEach(() => {
      // Setup page refs as if a drag happened
      preparer._pageRefs = {
        leftActive: mockElements.leftActive,
        rightActive: mockElements.rightActive,
        leftBuffer: mockElements.leftBuffer,
        rightBuffer: mockElements.rightBuffer,
      };

      // Simulate drag state on elements
      mockElements.rightActive.dataset.dragHidden = 'true';
      mockElements.rightBuffer.dataset.dragVisible = 'true';
      mockElements.rightBuffer.dataset.buffer = 'false';
    });

    it('should set book state to opened', () => {
      preparer.cleanupPages(true);

      expect(mockBook.dataset.state).toBe('opened');
    });

    it('should remove dragHidden from all active pages', () => {
      mockElements.leftActive.dataset.dragHidden = 'true';

      preparer.cleanupPages(true);

      expect(mockElements.leftActive.dataset.dragHidden).toBeUndefined();
      expect(mockElements.rightActive.dataset.dragHidden).toBeUndefined();
    });

    it('should remove dragVisible from all buffer pages', () => {
      mockElements.leftBuffer.dataset.dragVisible = 'true';

      preparer.cleanupPages(true);

      expect(mockElements.leftBuffer.dataset.dragVisible).toBeUndefined();
      expect(mockElements.rightBuffer.dataset.dragVisible).toBeUndefined();
    });

    it('should NOT restore buffer attrs when completed', () => {
      preparer.cleanupPages(true);

      // Buffer should NOT be reset to true — swapBuffers handles that
      expect(mockElements.rightBuffer.dataset.buffer).toBe('false');
    });

    it('should restore buffer attrs when cancelled', () => {
      mockElements.leftBuffer.dataset.buffer = 'false';

      preparer.cleanupPages(false);

      expect(mockElements.leftBuffer.dataset.buffer).toBe('true');
      expect(mockElements.rightBuffer.dataset.buffer).toBe('true');
    });

    it('should set noTransition on book when completed', () => {
      preparer.cleanupPages(true);

      expect(mockBook.dataset.noTransition).toBe('true');
    });

    it('should clear _pageRefs', () => {
      preparer.cleanupPages(true);

      expect(preparer._pageRefs).toBeNull();
    });

    it('should schedule noTransition removal via RAF', () => {
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        cb();
        return 0;
      });

      preparer.cleanupPages(true);

      expect(rafSpy).toHaveBeenCalled();
      expect(mockBook.dataset.noTransition).toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('should clear _pageRefs', () => {
      preparer._pageRefs = { leftActive: mockElements.leftActive };

      preparer.destroy();

      expect(preparer._pageRefs).toBeNull();
    });

    it('should clear dom and renderer references', () => {
      preparer.destroy();

      expect(preparer.dom).toBeNull();
      expect(preparer.renderer).toBeNull();
    });
  });
});
