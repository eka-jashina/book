/**
 * TESTS: SwipeHint
 * Тесты для подсказки о жесте свайпа на мобильных устройствах
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SwipeHint } from '@utils/SwipeHint.js';

describe('SwipeHint', () => {
  let mockEl;

  beforeEach(() => {
    vi.useFakeTimers();

    mockEl = document.createElement('div');
    mockEl.id = 'swipe-hint';
    mockEl.hidden = true;
    document.body.appendChild(mockEl);

    // По умолчанию — мобильный экран
    global.__setMediaQuery('(min-width: 769px)', false);
    localStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should find swipe-hint element', () => {
      const hint = new SwipeHint();
      expect(hint._el).toBe(mockEl);
    });

    it('should set timer to null', () => {
      const hint = new SwipeHint();
      expect(hint._timer).toBeNull();
    });

    it('should handle missing element', () => {
      mockEl.remove();
      const hint = new SwipeHint();
      expect(hint._el).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // showIfNeeded
  // ═══════════════════════════════════════════════════════════════════════════

  describe('showIfNeeded', () => {
    it('should show hint on mobile with no previous view', () => {
      const hint = new SwipeHint();
      hint.showIfNeeded();

      expect(mockEl.hidden).toBe(false);
    });

    it('should not show if element missing', () => {
      mockEl.remove();
      const hint = new SwipeHint();
      hint.showIfNeeded(); // should not throw
    });

    it('should not show on desktop', () => {
      // SwipeHint вызывает window.matchMedia('(min-width: 769px)').matches
      // Нужно чтобы он возвращал true (десктоп)
      const origMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn((query) => ({
        matches: query === '(min-width: 769px)' ? true : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }));

      const hint = new SwipeHint();
      hint.showIfNeeded();

      expect(mockEl.hidden).toBe(true);
      window.matchMedia = origMatchMedia;
    });

    it('should not show if already shown before', () => {
      localStorage.getItem.mockReturnValue('1');
      const hint = new SwipeHint();
      hint.showIfNeeded();

      expect(mockEl.hidden).toBe(true);
    });

    it('should show hint even if localStorage throws (cannot check prior views)', () => {
      localStorage.getItem.mockImplementation(() => { throw new Error('Quota'); });
      const hint = new SwipeHint();
      hint.showIfNeeded();

      // StorageManager.getRaw() возвращает null при ошибке → подсказка показывается
      expect(mockEl.hidden).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _show
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_show', () => {
    it('should set element to visible', () => {
      const hint = new SwipeHint();
      hint.showIfNeeded();

      expect(mockEl.hidden).toBe(false);
    });

    it('should add visible class via requestAnimationFrame', () => {
      const hint = new SwipeHint();
      hint.showIfNeeded();

      // RAF вызывается через setTimeout(16ms)
      vi.advanceTimersByTime(20);
      expect(mockEl.classList.contains('swipe-hint--visible')).toBe(true);
    });

    it('should auto-hide after 3500ms', () => {
      const hint = new SwipeHint();
      hint.showIfNeeded();
      vi.advanceTimersByTime(20); // RAF

      vi.advanceTimersByTime(3500);

      expect(mockEl.classList.contains('swipe-hint--visible')).toBe(false);
    });

    it('should save to localStorage on auto-hide', () => {
      const hint = new SwipeHint();
      hint.showIfNeeded();
      vi.advanceTimersByTime(20); // RAF

      vi.advanceTimersByTime(3500);

      expect(localStorage.setItem).toHaveBeenCalledWith('flipbook-swipe-hint-shown', '1');
    });

    it('should hide element after transition (400ms after hide)', () => {
      const hint = new SwipeHint();
      hint.showIfNeeded();
      vi.advanceTimersByTime(20); // RAF

      vi.advanceTimersByTime(3500); // auto-hide
      expect(mockEl.hidden).toBe(false); // ещё не hidden — ждём transition

      vi.advanceTimersByTime(400); // transition
      expect(mockEl.hidden).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _hide via interaction
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_hide via interaction', () => {
    it('should hide on click', () => {
      const hint = new SwipeHint();
      hint.showIfNeeded();
      vi.advanceTimersByTime(20); // RAF

      mockEl.click();

      expect(mockEl.classList.contains('swipe-hint--visible')).toBe(false);
      expect(localStorage.setItem).toHaveBeenCalledWith('flipbook-swipe-hint-shown', '1');
    });

    it('should hide on touchstart', () => {
      const hint = new SwipeHint();
      hint.showIfNeeded();
      vi.advanceTimersByTime(20); // RAF

      const touch = new TouchEvent('touchstart', {
        touches: [{ clientX: 0, clientY: 0, identifier: 0 }],
        targetTouches: [{ clientX: 0, clientY: 0, identifier: 0 }],
        changedTouches: [{ clientX: 0, clientY: 0, identifier: 0 }],
      });
      mockEl.dispatchEvent(touch);

      expect(mockEl.classList.contains('swipe-hint--visible')).toBe(false);
    });

    it('should handle localStorage.setItem failure gracefully', () => {
      localStorage.setItem.mockImplementation(() => { throw new Error('Quota'); });

      const hint = new SwipeHint();
      hint.showIfNeeded();
      vi.advanceTimersByTime(20);

      // Не должен выбросить ошибку
      mockEl.click();
      expect(mockEl.classList.contains('swipe-hint--visible')).toBe(false);
    });
  });
});
