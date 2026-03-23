/**
 * UNIT TEST: DragAnimator
 * Тестирование анимации угла поворота при drag-перелистывании
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DragAnimator } from '../../../js/core/delegates/DragAnimator.js';

describe('DragAnimator', () => {
  let animator;

  beforeEach(() => {
    animator = new DragAnimator();
  });

  afterEach(() => {
    animator.destroy();
  });

  describe('constructor', () => {
    it('should initialize with null animation id', () => {
      expect(animator._animationId).toBeNull();
    });
  });

  describe('animate', () => {
    it('should call onFrame with interpolated angles', async () => {
      const frames = [];
      const onFrame = vi.fn((angle) => frames.push(angle));
      const onComplete = vi.fn();

      animator.animate(0, 180, onFrame, onComplete);

      // Ждём завершения анимации (RAF mock: 16ms per frame)
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(onFrame).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledOnce();
    });

    it('should call onComplete when animation finishes', async () => {
      const onComplete = vi.fn();

      animator.animate(90, 180, () => {}, onComplete);

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(onComplete).toHaveBeenCalledOnce();
    });

    it('should start from startAngle', async () => {
      const frames = [];
      const onFrame = (angle) => frames.push(angle);

      animator.animate(45, 180, onFrame, () => {});

      // Первый кадр должен быть близок к startAngle
      await new Promise(resolve => setTimeout(resolve, 30));

      expect(frames.length).toBeGreaterThan(0);
      // Первый кадр не может быть меньше startAngle при анимации вверх
      expect(frames[0]).toBeGreaterThanOrEqual(45);
    });

    it('should end at targetAngle', async () => {
      const frames = [];
      const onFrame = (angle) => frames.push(angle);

      animator.animate(0, 180, onFrame, () => {});

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Последний кадр должен быть targetAngle
      expect(frames[frames.length - 1]).toBe(180);
    });

    it('should animate from high to low angle', async () => {
      const frames = [];
      const onFrame = (angle) => frames.push(angle);
      const onComplete = vi.fn();

      animator.animate(170, 0, onFrame, onComplete);

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(onComplete).toHaveBeenCalledOnce();
      expect(frames[frames.length - 1]).toBe(0);
    });

    it('should cancel previous animation when starting new one', async () => {
      const onComplete1 = vi.fn();
      const onComplete2 = vi.fn();

      animator.animate(0, 180, () => {}, onComplete1);
      animator.animate(90, 0, () => {}, onComplete2);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Вторая анимация должна завершиться, первая — нет
      expect(onComplete2).toHaveBeenCalledOnce();
      expect(onComplete1).not.toHaveBeenCalled();
    });

    it('should set _animationId during animation', () => {
      animator.animate(0, 180, () => {}, () => {});

      expect(animator._animationId).not.toBeNull();
    });

    it('should clear _animationId after animation completes', async () => {
      animator.animate(0, 180, () => {}, () => {});

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(animator._animationId).toBeNull();
    });
  });

  describe('cancel', () => {
    it('should stop ongoing animation', async () => {
      const onFrame = vi.fn();
      const onComplete = vi.fn();

      animator.animate(0, 180, onFrame, onComplete);
      animator.cancel();

      await new Promise(resolve => setTimeout(resolve, 500));

      expect(onComplete).not.toHaveBeenCalled();
    });

    it('should set _animationId to null', () => {
      animator.animate(0, 180, () => {}, () => {});
      animator.cancel();

      expect(animator._animationId).toBeNull();
    });

    it('should be safe to call when no animation is running', () => {
      expect(() => animator.cancel()).not.toThrow();
    });
  });

  describe('_calculateDuration', () => {
    it('should return longer duration for larger angle delta', () => {
      const short = animator._calculateDuration(80, 90);  // delta = 10
      const long = animator._calculateDuration(0, 180);   // delta = 180

      expect(long).toBeGreaterThan(short);
    });

    it('should return at least 150ms', () => {
      const duration = animator._calculateDuration(89, 90); // delta = 1
      expect(duration).toBeGreaterThanOrEqual(150);
    });

    it('should handle reverse direction (target < start)', () => {
      const duration = animator._calculateDuration(180, 0);
      expect(duration).toBeGreaterThanOrEqual(150);
    });
  });

  describe('_easeInOutQuad', () => {
    it('should return 0 for t=0', () => {
      expect(animator._easeInOutQuad(0)).toBe(0);
    });

    it('should return 1 for t=1', () => {
      expect(animator._easeInOutQuad(1)).toBe(1);
    });

    it('should return 0.5 for t=0.5', () => {
      expect(animator._easeInOutQuad(0.5)).toBe(0.5);
    });

    it('should ease in during first half (value < t)', () => {
      const t = 0.25;
      const eased = animator._easeInOutQuad(t);
      expect(eased).toBeLessThan(t);
    });

    it('should ease out during second half (value > t)', () => {
      const t = 0.75;
      const eased = animator._easeInOutQuad(t);
      expect(eased).toBeGreaterThan(t);
    });

    it('should be monotonically increasing', () => {
      let prev = 0;
      for (let t = 0; t <= 1; t += 0.1) {
        const val = animator._easeInOutQuad(t);
        expect(val).toBeGreaterThanOrEqual(prev);
        prev = val;
      }
    });
  });

  describe('destroy', () => {
    it('should cancel any running animation', async () => {
      const onComplete = vi.fn();

      animator.animate(0, 180, () => {}, onComplete);
      animator.destroy();

      await new Promise(resolve => setTimeout(resolve, 500));

      expect(onComplete).not.toHaveBeenCalled();
    });

    it('should be safe to call multiple times', () => {
      expect(() => {
        animator.destroy();
        animator.destroy();
      }).not.toThrow();
    });
  });
});
