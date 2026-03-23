/**
 * Тесты для SettingsValidator
 * Валидация и санитизация настроек перед применением к DOM
 */
import { describe, it, expect } from 'vitest';
import {
  sanitizeSetting,
  sanitizeSettings,
  isValidCSSColor,
  isValidFontSize,
  isValidTheme,
  sanitizeFontSize,
  sanitizeVolume,
} from '../../../js/utils/SettingsValidator.js';

describe('SettingsValidator', () => {

  // ─── isValidCSSColor ──────────────────────────────────────────────────────

  describe('isValidCSSColor', () => {
    it('should accept valid hex colors (#rrggbb)', () => {
      expect(isValidCSSColor('#ff0000')).toBe(true);
      expect(isValidCSSColor('#3a2d1f')).toBe(true);
      expect(isValidCSSColor('#000000')).toBe(true);
      expect(isValidCSSColor('#ffffff')).toBe(true);
    });

    it('should accept short hex colors (#rgb)', () => {
      expect(isValidCSSColor('#f00')).toBe(true);
      expect(isValidCSSColor('#abc')).toBe(true);
    });

    it('should accept hex colors with alpha (#rrggbbaa)', () => {
      expect(isValidCSSColor('#ff000080')).toBe(true);
      expect(isValidCSSColor('#abcd')).toBe(true);
    });

    it('should accept rgb() and rgba()', () => {
      expect(isValidCSSColor('rgb(255, 0, 0)')).toBe(true);
      expect(isValidCSSColor('rgba(0, 0, 0, 0.5)')).toBe(true);
    });

    it('should accept hsl() and hsla()', () => {
      expect(isValidCSSColor('hsl(120, 100%, 50%)')).toBe(true);
      expect(isValidCSSColor('hsla(0, 0%, 0%, 0.5)')).toBe(true);
    });

    it('should accept named CSS colors', () => {
      expect(isValidCSSColor('red')).toBe(true);
      expect(isValidCSSColor('black')).toBe(true);
      expect(isValidCSSColor('transparent')).toBe(true);
    });

    it('should reject invalid values', () => {
      expect(isValidCSSColor('')).toBe(false);
      expect(isValidCSSColor(null)).toBe(false);
      expect(isValidCSSColor(undefined)).toBe(false);
      expect(isValidCSSColor(123)).toBe(false);
      expect(isValidCSSColor('#gg0000')).toBe(false);
      expect(isValidCSSColor('#12345')).toBe(false);
      expect(isValidCSSColor('notacolor')).toBe(false);
      expect(isValidCSSColor('<script>')).toBe(false);
    });

    it('should reject CSS injection attempts', () => {
      expect(isValidCSSColor('red; background: url(evil)')).toBe(false);
      expect(isValidCSSColor('expression(alert(1))')).toBe(false);
    });
  });

  // ─── isValidFontSize ──────────────────────────────────────────────────────

  describe('isValidFontSize', () => {
    it('should accept valid font sizes', () => {
      expect(isValidFontSize(14)).toBe(true);
      expect(isValidFontSize(18)).toBe(true);
      expect(isValidFontSize(22)).toBe(true);
      expect(isValidFontSize(8)).toBe(true);
      expect(isValidFontSize(72)).toBe(true);
    });

    it('should reject values outside absolute bounds', () => {
      expect(isValidFontSize(7)).toBe(false);
      expect(isValidFontSize(73)).toBe(false);
      expect(isValidFontSize(-1)).toBe(false);
      expect(isValidFontSize(0)).toBe(false);
      expect(isValidFontSize(1000)).toBe(false);
    });

    it('should reject non-finite numbers', () => {
      expect(isValidFontSize(NaN)).toBe(false);
      expect(isValidFontSize(Infinity)).toBe(false);
      expect(isValidFontSize(-Infinity)).toBe(false);
    });

    it('should reject non-number values', () => {
      expect(isValidFontSize('18')).toBe(false);
      expect(isValidFontSize(null)).toBe(false);
      expect(isValidFontSize(undefined)).toBe(false);
    });
  });

  // ─── isValidTheme ─────────────────────────────────────────────────────────

  describe('isValidTheme', () => {
    it('should accept valid themes', () => {
      expect(isValidTheme('light')).toBe(true);
      expect(isValidTheme('dark')).toBe(true);
      expect(isValidTheme('bw')).toBe(true);
    });

    it('should reject invalid themes', () => {
      expect(isValidTheme('sepia')).toBe(false);
      expect(isValidTheme('')).toBe(false);
      expect(isValidTheme(null)).toBe(false);
      expect(isValidTheme(123)).toBe(false);
      expect(isValidTheme('<script>alert(1)</script>')).toBe(false);
    });
  });

  // ─── sanitizeFontSize ─────────────────────────────────────────────────────

  describe('sanitizeFontSize', () => {
    it('should return valid font size as-is (rounded)', () => {
      expect(sanitizeFontSize(18, 18)).toBe(18);
      expect(sanitizeFontSize(14, 18)).toBe(14);
    });

    it('should round fractional values', () => {
      expect(sanitizeFontSize(18.7, 18)).toBe(19);
      expect(sanitizeFontSize(14.3, 18)).toBe(14);
    });

    it('should clamp to absolute bounds', () => {
      expect(sanitizeFontSize(5, 18)).toBe(8);
      expect(sanitizeFontSize(100, 18)).toBe(72);
      expect(sanitizeFontSize(-10, 18)).toBe(8);
    });

    it('should clamp to custom min/max', () => {
      expect(sanitizeFontSize(10, 18, 14, 22)).toBe(14);
      expect(sanitizeFontSize(30, 18, 14, 22)).toBe(22);
    });

    it('should return default for non-finite values', () => {
      expect(sanitizeFontSize(NaN, 18)).toBe(18);
      expect(sanitizeFontSize(Infinity, 18)).toBe(18);
      expect(sanitizeFontSize('abc', 18)).toBe(18);
      expect(sanitizeFontSize(null, 18)).toBe(18);
      expect(sanitizeFontSize(undefined, 18)).toBe(18);
    });

    it('should coerce string numbers', () => {
      expect(sanitizeFontSize('20', 18)).toBe(20);
      expect(sanitizeFontSize('16.5', 18)).toBe(17);
    });
  });

  // ─── sanitizeVolume ───────────────────────────────────────────────────────

  describe('sanitizeVolume', () => {
    it('should return valid volume as-is', () => {
      expect(sanitizeVolume(0.5, 0.3)).toBe(0.5);
      expect(sanitizeVolume(0, 0.3)).toBe(0);
      expect(sanitizeVolume(1, 0.3)).toBe(1);
    });

    it('should clamp to 0..1 range', () => {
      expect(sanitizeVolume(-0.5, 0.3)).toBe(0);
      expect(sanitizeVolume(1.5, 0.3)).toBe(1);
      expect(sanitizeVolume(100, 0.3)).toBe(1);
    });

    it('should return default for non-finite values', () => {
      expect(sanitizeVolume(NaN, 0.3)).toBe(0.3);
      expect(sanitizeVolume(Infinity, 0.3)).toBe(0.3);
      expect(sanitizeVolume('abc', 0.3)).toBe(0.3);
      expect(sanitizeVolume(null, 0.3)).toBe(0.3);
      expect(sanitizeVolume(undefined, 0.3)).toBe(0.3);
    });

    it('should coerce string numbers', () => {
      expect(sanitizeVolume('0.7', 0.3)).toBe(0.7);
    });
  });

  // ─── sanitizeSetting ──────────────────────────────────────────────────────

  describe('sanitizeSetting', () => {
    it('should sanitize fontSize', () => {
      expect(sanitizeSetting('fontSize', NaN, 18)).toBe(18);
      expect(sanitizeSetting('fontSize', 20, 18)).toBe(20);
      expect(sanitizeSetting('fontSize', -5, 18)).toBe(8);
    });

    it('should sanitize theme', () => {
      expect(sanitizeSetting('theme', 'dark', 'light')).toBe('dark');
      expect(sanitizeSetting('theme', 'invalid', 'light')).toBe('light');
    });

    it('should sanitize font', () => {
      expect(sanitizeSetting('font', 'inter', 'georgia')).toBe('inter');
      expect(sanitizeSetting('font', '', 'georgia')).toBe('georgia');
      expect(sanitizeSetting('font', null, 'georgia')).toBe('georgia');
    });

    it('should sanitize page', () => {
      expect(sanitizeSetting('page', 5, 0)).toBe(5);
      expect(sanitizeSetting('page', -1, 0)).toBe(0);
      expect(sanitizeSetting('page', 1.5, 0)).toBe(0);
      expect(sanitizeSetting('page', NaN, 0)).toBe(0);
    });

    it('should sanitize soundEnabled', () => {
      expect(sanitizeSetting('soundEnabled', true, true)).toBe(true);
      expect(sanitizeSetting('soundEnabled', false, true)).toBe(false);
      expect(sanitizeSetting('soundEnabled', 'true', true)).toBe(true);
      expect(sanitizeSetting('soundEnabled', 'false', true)).toBe(false);
      expect(sanitizeSetting('soundEnabled', 'invalid', true)).toBe(true);
    });

    it('should sanitize soundVolume', () => {
      expect(sanitizeSetting('soundVolume', 0.5, 0.3)).toBe(0.5);
      expect(sanitizeSetting('soundVolume', -1, 0.3)).toBe(0);
      expect(sanitizeSetting('soundVolume', NaN, 0.3)).toBe(0.3);
    });

    it('should sanitize ambientType', () => {
      expect(sanitizeSetting('ambientType', 'rain', 'none')).toBe('rain');
      expect(sanitizeSetting('ambientType', '', 'none')).toBe('none');
    });

    it('should sanitize ambientVolume', () => {
      expect(sanitizeSetting('ambientVolume', 0.7, 0.5)).toBe(0.7);
      expect(sanitizeSetting('ambientVolume', 2, 0.5)).toBe(1);
    });

    it('should pass through unknown keys unchanged', () => {
      expect(sanitizeSetting('unknownKey', 'anyValue', 'default')).toBe('anyValue');
    });
  });

  // ─── sanitizeSettings ─────────────────────────────────────────────────────

  describe('sanitizeSettings', () => {
    const defaults = {
      font: 'georgia',
      fontSize: 18,
      theme: 'light',
      page: 0,
      soundEnabled: true,
      soundVolume: 0.3,
      ambientType: 'none',
      ambientVolume: 0.5,
    };

    it('should sanitize all known settings', () => {
      const corrupted = {
        font: '',
        fontSize: NaN,
        theme: 'hacked',
        page: -5,
        soundEnabled: 'maybe',
        soundVolume: 999,
        ambientType: null,
        ambientVolume: -1,
      };

      const result = sanitizeSettings(corrupted, defaults);

      expect(result.font).toBe('georgia');
      expect(result.fontSize).toBe(18);
      expect(result.theme).toBe('light');
      expect(result.page).toBe(0);
      expect(result.soundEnabled).toBe(true);
      expect(result.soundVolume).toBe(1);
      expect(result.ambientType).toBe('none');
      expect(result.ambientVolume).toBe(0);
    });

    it('should pass through valid settings unchanged', () => {
      const valid = {
        font: 'inter',
        fontSize: 20,
        theme: 'dark',
        page: 10,
        soundEnabled: false,
        soundVolume: 0.7,
        ambientType: 'rain',
        ambientVolume: 0.8,
      };

      const result = sanitizeSettings(valid, defaults);

      expect(result).toEqual(valid);
    });

    it('should not modify original object', () => {
      const original = { fontSize: NaN, theme: 'invalid' };
      const result = sanitizeSettings(original, defaults);

      expect(original.fontSize).toBeNaN();
      expect(original.theme).toBe('invalid');
      expect(result.fontSize).toBe(18);
      expect(result.theme).toBe('light');
    });

    it('should skip keys not present in defaults', () => {
      const settings = { customKey: 'customValue', fontSize: 20 };
      const result = sanitizeSettings(settings, defaults);

      expect(result.customKey).toBe('customValue');
      expect(result.fontSize).toBe(20);
    });
  });
});
