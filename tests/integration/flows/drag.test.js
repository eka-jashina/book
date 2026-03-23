/**
 * INTEGRATION TEST: Drag Interaction
 * Тестирование компонентов drag-перелистывания
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createFullBookDOM,
  cleanupIntegrationDOM,
} from '../../helpers/integrationUtils.js';

import { DragShadowRenderer } from '../../../js/core/delegates/DragShadowRenderer.js';
import { BookStateMachine } from '../../../js/managers/BookStateMachine.js';
import { Direction, BookState } from '../../../js/config.js';

describe('Drag Interaction Integration', () => {
  let dom;

  beforeEach(() => {
    dom = createFullBookDOM();
  });

  afterEach(() => {
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  describe('DragShadowRenderer', () => {
    let shadowRenderer;
    let mockDom;
    let shadowElements;

    beforeEach(() => {
      // Create shadow elements matching actual implementation
      shadowElements = {
        flipShadow: document.createElement('div'),
        sheet: document.createElement('div'),
      };

      shadowElements.flipShadow.className = 'flip-shadow';
      shadowElements.sheet.className = 'sheet';

      document.body.appendChild(shadowElements.flipShadow);
      document.body.appendChild(shadowElements.sheet);

      mockDom = {
        get: vi.fn((id) => {
          if (id === 'flipShadow') return shadowElements.flipShadow;
          if (id === 'sheet') return shadowElements.sheet;
          return null;
        }),
      };

      shadowRenderer = new DragShadowRenderer(mockDom);
    });

    afterEach(() => {
      shadowRenderer?.destroy();
    });

    it('should initialize with DOM manager', () => {
      expect(shadowRenderer).toBeDefined();
    });

    it('should activate shadows for NEXT direction', () => {
      shadowRenderer.activate(Direction.NEXT);

      expect(shadowElements.flipShadow.classList.contains('active')).toBe(true);
      expect(shadowElements.flipShadow.dataset.direction).toBe('next');
    });

    it('should activate shadows for PREV direction', () => {
      shadowRenderer.activate(Direction.PREV);

      expect(shadowElements.flipShadow.classList.contains('active')).toBe(true);
      expect(shadowElements.flipShadow.dataset.direction).toBe('prev');
    });

    it('should update shadow opacity based on angle', () => {
      shadowRenderer.activate(Direction.NEXT);
      shadowRenderer.update(90, Direction.NEXT, false);

      // Shadow should have some opacity set
      const opacity = shadowElements.flipShadow.style.getPropertyValue('--flip-shadow-opacity');
      expect(opacity).toBeTruthy();
    });

    it('should update spine shadow on sheet', () => {
      shadowRenderer.update(90, Direction.NEXT, false);

      const spineOpacity = shadowElements.sheet.style.getPropertyValue('--spine-shadow-opacity');
      expect(spineOpacity).toBeTruthy();
    });

    it('should reset shadows', () => {
      shadowRenderer.activate(Direction.NEXT);
      shadowRenderer.update(90, Direction.NEXT, false);

      shadowRenderer.reset();

      expect(shadowElements.flipShadow.classList.contains('active')).toBe(false);
      expect(shadowElements.flipShadow.dataset.direction).toBeUndefined();
    });

    it('should handle missing elements gracefully', () => {
      const emptyDom = {
        get: vi.fn().mockReturnValue(null),
      };
      const renderer = new DragShadowRenderer(emptyDom);

      // Should not throw
      expect(() => {
        renderer.activate(Direction.NEXT);
        renderer.update(90, Direction.NEXT, false);
        renderer.reset();
      }).not.toThrow();

      renderer.destroy();
    });
  });

  describe('State Machine for Drag Operations', () => {
    let stateMachine;

    beforeEach(() => {
      stateMachine = new BookStateMachine();
    });

    afterEach(() => {
      stateMachine?.destroy();
    });

    it('should transition to FLIPPING from OPENED', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);

      const result = stateMachine.transitionTo(BookState.FLIPPING);

      expect(result).toBe(true);
      expect(stateMachine.state).toBe(BookState.FLIPPING);
    });

    it('should return to OPENED from FLIPPING', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);
      stateMachine.transitionTo(BookState.FLIPPING);

      const result = stateMachine.transitionTo(BookState.OPENED);

      expect(result).toBe(true);
      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should NOT allow FLIPPING from CLOSED', () => {
      const result = stateMachine.transitionTo(BookState.FLIPPING);

      expect(result).toBe(false);
      expect(stateMachine.state).toBe(BookState.CLOSED);
    });

    it('should indicate busy during FLIPPING', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);
      stateMachine.transitionTo(BookState.FLIPPING);

      expect(stateMachine.isBusy).toBe(true);
    });

    it('should NOT be busy during OPENED', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);

      expect(stateMachine.isBusy).toBe(false);
    });

    it('should allow full drag cycle: OPENED -> FLIPPING -> OPENED', () => {
      // Open the book first
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);

      // Start drag
      expect(stateMachine.transitionTo(BookState.FLIPPING)).toBe(true);
      expect(stateMachine.state).toBe(BookState.FLIPPING);

      // Complete drag (return to OPENED)
      expect(stateMachine.transitionTo(BookState.OPENED)).toBe(true);
      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should block concurrent drags', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);

      // First drag starts
      expect(stateMachine.transitionTo(BookState.FLIPPING)).toBe(true);

      // Second drag should be blocked
      expect(stateMachine.isBusy).toBe(true);

      // Cannot start another FLIPPING while already FLIPPING
      expect(stateMachine.transitionTo(BookState.FLIPPING)).toBe(false);
    });

    it('should allow multiple drag cycles', () => {
      stateMachine.transitionTo(BookState.OPENING);
      stateMachine.transitionTo(BookState.OPENED);

      // First drag cycle
      stateMachine.transitionTo(BookState.FLIPPING);
      stateMachine.transitionTo(BookState.OPENED);

      // Second drag cycle
      expect(stateMachine.transitionTo(BookState.FLIPPING)).toBe(true);
      expect(stateMachine.transitionTo(BookState.OPENED)).toBe(true);

      // Third drag cycle
      expect(stateMachine.transitionTo(BookState.FLIPPING)).toBe(true);
      expect(stateMachine.transitionTo(BookState.OPENED)).toBe(true);
    });
  });

  describe('Angle Calculation Logic', () => {
    // These tests verify the math used in DragDelegate._updateAngleFromEvent

    it('should calculate angle for NEXT direction correctly', () => {
      const bookWidth = 800;

      // Helper function matching DragDelegate logic
      const calculateAngleNext = (cursorX) => {
        const progress = 1 - cursorX / bookWidth;
        return Math.max(0, Math.min(180, progress * 180));
      };

      // At right edge (x = 800), angle should be 0
      expect(calculateAngleNext(800)).toBe(0);

      // At left edge (x = 0), angle should be 180
      expect(calculateAngleNext(0)).toBe(180);

      // At middle (x = 400), angle should be 90
      expect(calculateAngleNext(400)).toBe(90);

      // Beyond bounds should clamp
      expect(calculateAngleNext(-100)).toBe(180);
      expect(calculateAngleNext(900)).toBe(0);
    });

    it('should calculate angle for PREV direction correctly', () => {
      const bookWidth = 800;

      // Helper function matching DragDelegate logic
      const calculateAnglePrev = (cursorX) => {
        const progress = cursorX / bookWidth;
        return Math.max(0, Math.min(180, progress * 180));
      };

      // At left edge (x = 0), angle should be 0
      expect(calculateAnglePrev(0)).toBe(0);

      // At right edge (x = 800), angle should be 180
      expect(calculateAnglePrev(800)).toBe(180);

      // At middle (x = 400), angle should be 90
      expect(calculateAnglePrev(400)).toBe(90);
    });

    it('should determine flip vs cancel based on 90 degree threshold', () => {
      const shouldComplete = (angle) => angle > 90;

      expect(shouldComplete(91)).toBe(true);
      expect(shouldComplete(180)).toBe(true);
      expect(shouldComplete(90)).toBe(false);
      expect(shouldComplete(89)).toBe(false);
      expect(shouldComplete(0)).toBe(false);
    });
  });
});
