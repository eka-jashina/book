/**
 * TESTS: CSSVariables
 * Тесты для кэшированного чтения CSS custom properties
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CSSVariables } from '@utils/CSSVariables.js';

describe('CSSVariables', () => {
  let cssVars;
  let mockElement;
  let mockGetPropertyValue;

  beforeEach(() => {
    // Создаём мок для getPropertyValue
    mockGetPropertyValue = vi.fn((prop) => {
      const values = {
        '--timing-lift': '240ms',
        '--timing-rotate': '0.9s',
        '--timing-drop': '160ms',
        '--font-size': '18px',
        '--pages-per-flip': '2',
        '--perspective': '1600px',
        '--empty': '',
        '--zero': '0',
        '--unitless-time': '300',
      };
      return values[prop] || '';
    });

    // Мокаем getComputedStyle
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: mockGetPropertyValue,
    });

    mockElement = document.createElement('div');
    cssVars = new CSSVariables(mockElement);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should store the element', () => {
      expect(cssVars.element).toBe(mockElement);
    });

    it('should initialize with empty cache', () => {
      expect(cssVars._cache.size).toBe(0);
    });

    it('should initialize with null computedStyle', () => {
      expect(cssVars._computedStyle).toBeNull();
    });

    it('should use document.documentElement as default element', () => {
      const defaultVars = new CSSVariables();
      expect(defaultVars.element).toBe(document.documentElement);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LAZY INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('lazy initialization', () => {
    it('should not call getComputedStyle until first access', () => {
      // Создаём новый экземпляр после сброса счётчика
      window.getComputedStyle.mockClear();
      const newVars = new CSSVariables(mockElement);

      expect(window.getComputedStyle).not.toHaveBeenCalled();

      newVars.get('--timing-lift');

      expect(window.getComputedStyle).toHaveBeenCalledOnce();
    });

    it('should reuse computedStyle on subsequent calls', () => {
      cssVars.get('--timing-lift');
      cssVars.get('--timing-rotate');
      cssVars.get('--timing-drop');

      // getComputedStyle вызывается только один раз
      expect(window.getComputedStyle).toHaveBeenCalledOnce();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // get()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('get()', () => {
    it('should return CSS variable value', () => {
      expect(cssVars.get('--timing-lift')).toBe('240ms');
    });

    it('should trim whitespace from values', () => {
      mockGetPropertyValue.mockReturnValueOnce('  240ms  ');
      cssVars.invalidateCache();

      expect(cssVars.get('--spaced')).toBe('240ms');
    });

    it('should return fallback for missing variable', () => {
      expect(cssVars.get('--unknown', 'default')).toBe('default');
    });

    it('should return fallback for empty value', () => {
      expect(cssVars.get('--empty', 'fallback')).toBe('fallback');
    });

    it('should return null as default fallback', () => {
      expect(cssVars.get('--unknown')).toBeNull();
    });

    it('should cache values', () => {
      cssVars.get('--timing-lift');
      cssVars.get('--timing-lift');
      cssVars.get('--timing-lift');

      // getPropertyValue вызывается только один раз
      expect(mockGetPropertyValue).toHaveBeenCalledTimes(1);
    });

    it('should cache null/fallback values', () => {
      cssVars.get('--unknown', 'default');
      cssVars.get('--unknown', 'different');

      // Второй вызов должен вернуть закэшированное значение
      expect(mockGetPropertyValue).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getNumber()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getNumber()', () => {
    it('should parse integer value', () => {
      expect(cssVars.getNumber('--pages-per-flip')).toBe(2);
    });

    it('should parse value with px units', () => {
      expect(cssVars.getNumber('--font-size')).toBe(18);
    });

    it('should parse value with large numbers', () => {
      expect(cssVars.getNumber('--perspective')).toBe(1600);
    });

    it('should return fallback for missing variable', () => {
      expect(cssVars.getNumber('--unknown', 42)).toBe(42);
    });

    it('should return fallback for empty value', () => {
      expect(cssVars.getNumber('--empty', 99)).toBe(99);
    });

    it('should return 0 as default fallback', () => {
      expect(cssVars.getNumber('--unknown')).toBe(0);
    });

    it('should handle zero value', () => {
      expect(cssVars.getNumber('--zero')).toBe(0);
    });

    it('should return fallback for non-numeric value', () => {
      mockGetPropertyValue.mockReturnValueOnce('not a number');
      cssVars.invalidateCache();

      expect(cssVars.getNumber('--invalid', 42)).toBe(42);
    });

    it('should parse float values', () => {
      mockGetPropertyValue.mockReturnValueOnce('0.5');
      cssVars.invalidateCache();

      expect(cssVars.getNumber('--float')).toBe(0.5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getTime()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getTime()', () => {
    it('should parse milliseconds', () => {
      expect(cssVars.getTime('--timing-lift')).toBe(240);
    });

    it('should convert seconds to milliseconds', () => {
      expect(cssVars.getTime('--timing-rotate')).toBe(900);
    });

    it('should return fallback for missing variable', () => {
      expect(cssVars.getTime('--unknown', 500)).toBe(500);
    });

    it('should return fallback for empty value', () => {
      expect(cssVars.getTime('--empty', 1000)).toBe(1000);
    });

    it('should return 0 as default fallback', () => {
      expect(cssVars.getTime('--unknown')).toBe(0);
    });

    it('should handle unitless value as milliseconds', () => {
      expect(cssVars.getTime('--unitless-time')).toBe(300);
    });

    it('should handle fractional seconds', () => {
      mockGetPropertyValue.mockReturnValueOnce('0.25s');
      cssVars.invalidateCache();

      expect(cssVars.getTime('--quarter-second')).toBe(250);
    });

    it('should handle fractional milliseconds', () => {
      mockGetPropertyValue.mockReturnValueOnce('16.67ms');
      cssVars.invalidateCache();

      expect(cssVars.getTime('--frame')).toBeCloseTo(16.67, 1);
    });

    it('should return fallback for non-numeric time value', () => {
      mockGetPropertyValue.mockReturnValueOnce('invalid');
      cssVars.invalidateCache();

      expect(cssVars.getTime('--invalid', 100)).toBe(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // invalidateCache()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('invalidateCache()', () => {
    it('should clear cached values', () => {
      cssVars.get('--timing-lift');
      expect(mockGetPropertyValue).toHaveBeenCalledTimes(1);

      cssVars.invalidateCache();
      cssVars.get('--timing-lift');

      expect(mockGetPropertyValue).toHaveBeenCalledTimes(2);
    });

    it('should reset computedStyle reference', () => {
      cssVars.get('--timing-lift');
      expect(window.getComputedStyle).toHaveBeenCalledTimes(1);

      cssVars.invalidateCache();
      cssVars.get('--timing-lift');

      expect(window.getComputedStyle).toHaveBeenCalledTimes(2);
    });

    it('should allow getting updated values after invalidation', () => {
      // Первое значение
      expect(cssVars.get('--timing-lift')).toBe('240ms');

      // Обновляем мок с новым значением
      mockGetPropertyValue.mockImplementation((prop) => {
        if (prop === '--timing-lift') return '500ms';
        return '';
      });

      // Без invalidateCache() получили бы старое значение
      cssVars.invalidateCache();
      expect(cssVars.get('--timing-lift')).toBe('500ms');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should handle negative values', () => {
      mockGetPropertyValue.mockReturnValueOnce('-10px');
      cssVars.invalidateCache();

      expect(cssVars.getNumber('--negative')).toBe(-10);
    });

    it('should handle variable names without leading dashes', () => {
      // CSS variables должны начинаться с --, но get() просто читает значение
      expect(cssVars.get('invalid-name', 'fallback')).toBe('fallback');
    });

    it('should handle special characters in values', () => {
      mockGetPropertyValue.mockReturnValueOnce('url("image.jpg")');
      cssVars.invalidateCache();

      expect(cssVars.get('--bg-image')).toBe('url("image.jpg")');
    });

    it('should handle calc() expressions', () => {
      mockGetPropertyValue.mockReturnValueOnce('calc(100% - 20px)');
      cssVars.invalidateCache();

      expect(cssVars.get('--calc-value')).toBe('calc(100% - 20px)');
    });

    it('should handle var() references', () => {
      // getComputedStyle обычно разрешает var(), но мы тестируем возврат значения
      mockGetPropertyValue.mockReturnValueOnce('var(--other-var)');
      cssVars.invalidateCache();

      expect(cssVars.get('--ref')).toBe('var(--other-var)');
    });
  });
});
