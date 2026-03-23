/**
 * UNIT TEST: configHelpers.js
 * Тесты чистых вспомогательных функций конфигурации
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  deepFreeze,
  resolveAssetPath,
  getActiveBook,
  resolveCoverBg,
  resolveCoverBgFromCover,
  resolveSound,
  buildDefaultSettings,
  buildAppearanceTheme,
  buildSettingsVisibility,
  buildSoundsConfig,
  buildAmbientConfig,
  buildAmbientConfigFromAPI,
  buildFontsConfig,
  buildFontsConfigFromAPI,
  buildCommonConfig,
  loadAdminConfig,
  adminConfigStorage,
} from '../../../js/config/configHelpers.js';

// ═════════════════════════════════════════════════════════════════════════════
// deepFreeze
// ═════════════════════════════════════════════════════════════════════════════

describe('deepFreeze', () => {
  it('should freeze top-level object', () => {
    const obj = { a: 1 };
    deepFreeze(obj);
    expect(Object.isFrozen(obj)).toBe(true);
  });

  it('should freeze nested objects', () => {
    const obj = { nested: { deep: { value: 42 } } };
    deepFreeze(obj);
    expect(Object.isFrozen(obj.nested)).toBe(true);
    expect(Object.isFrozen(obj.nested.deep)).toBe(true);
  });

  it('should freeze arrays', () => {
    const obj = { items: [1, 2, { x: 3 }] };
    deepFreeze(obj);
    expect(Object.isFrozen(obj.items)).toBe(true);
    expect(Object.isFrozen(obj.items[2])).toBe(true);
  });

  it('should return the same object reference', () => {
    const obj = { a: 1 };
    const result = deepFreeze(obj);
    expect(result).toBe(obj);
  });

  it('should not fail on already frozen objects', () => {
    const inner = Object.freeze({ x: 1 });
    const obj = { inner };
    expect(() => deepFreeze(obj)).not.toThrow();
  });

  it('should handle null/undefined values in properties', () => {
    const obj = { a: null, b: undefined, c: 'string', d: 42 };
    expect(() => deepFreeze(obj)).not.toThrow();
    expect(Object.isFrozen(obj)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// resolveAssetPath
// ═════════════════════════════════════════════════════════════════════════════

describe('resolveAssetPath', () => {
  it('should return empty string for falsy value', () => {
    expect(resolveAssetPath(null)).toBe('');
    expect(resolveAssetPath(undefined)).toBe('');
    expect(resolveAssetPath('')).toBe('');
  });

  it('should return data URLs unchanged', () => {
    const dataUrl = 'data:image/png;base64,abc123';
    expect(resolveAssetPath(dataUrl)).toBe(dataUrl);
  });

  it('should return http URLs unchanged', () => {
    expect(resolveAssetPath('http://example.com/img.png')).toBe('http://example.com/img.png');
    expect(resolveAssetPath('https://cdn.example.com/img.png')).toBe('https://cdn.example.com/img.png');
  });

  it('should prepend BASE_URL to relative paths', () => {
    const result = resolveAssetPath('images/bg.webp');
    expect(result).toMatch(/images\/bg\.webp$/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getActiveBook
// ═════════════════════════════════════════════════════════════════════════════

describe('getActiveBook', () => {
  it('should return null for null/undefined config', () => {
    expect(getActiveBook(null)).toBeNull();
    expect(getActiveBook(undefined)).toBeNull();
  });

  it('should find active book by activeBookId', () => {
    const config = {
      books: [
        { id: 'b1', title: 'Book 1' },
        { id: 'b2', title: 'Book 2' },
      ],
      activeBookId: 'b2',
    };
    expect(getActiveBook(config)).toEqual({ id: 'b2', title: 'Book 2' });
  });

  it('should return first book if activeBookId not found', () => {
    const config = {
      books: [{ id: 'b1', title: 'Book 1' }],
      activeBookId: 'nonexistent',
    };
    expect(getActiveBook(config)).toEqual({ id: 'b1', title: 'Book 1' });
  });

  it('should handle legacy format (chapters at top level)', () => {
    const config = {
      chapters: [{ id: 'ch1', file: 'f.html' }],
      cover: { bg: 'cover.webp' },
    };
    const result = getActiveBook(config);
    expect(result).toEqual({ cover: { bg: 'cover.webp' }, chapters: [{ id: 'ch1', file: 'f.html' }] });
  });

  it('should return null for empty books array and no legacy chapters', () => {
    expect(getActiveBook({ books: [] })).toBeNull();
    expect(getActiveBook({})).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// resolveCoverBg
// ═════════════════════════════════════════════════════════════════════════════

describe('resolveCoverBg', () => {
  it('should use fallback when value is empty', () => {
    const result = resolveCoverBg('', 'images/default.webp');
    expect(result).toMatch(/images\/default\.webp$/);
  });

  it('should use fallback when value is null', () => {
    const result = resolveCoverBg(null, 'images/default.webp');
    expect(result).toMatch(/images\/default\.webp$/);
  });

  it('should return http URLs directly', () => {
    expect(resolveCoverBg('http://cdn.com/bg.webp', 'fallback.webp')).toBe('http://cdn.com/bg.webp');
    expect(resolveCoverBg('https://cdn.com/bg.webp', 'fallback.webp')).toBe('https://cdn.com/bg.webp');
  });

  it('should prepend BASE_URL to relative paths', () => {
    const result = resolveCoverBg('images/cover.webp', 'fallback.webp');
    expect(result).toMatch(/images\/cover\.webp$/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// resolveCoverBgFromCover
// ═════════════════════════════════════════════════════════════════════════════

describe('resolveCoverBgFromCover', () => {
  it('should return null when bgMode is none', () => {
    expect(resolveCoverBgFromCover({ bgMode: 'none' }, 'fallback.webp')).toBeNull();
  });

  it('should return custom data when bgMode is custom', () => {
    const cover = { bgMode: 'custom', bgCustomData: 'data:image/png;base64,abc' };
    expect(resolveCoverBgFromCover(cover, 'fallback.webp')).toBe('data:image/png;base64,abc');
  });

  it('should use legacy path for desktop fallback', () => {
    const cover = { bg: 'images/bg-desktop.webp' };
    const result = resolveCoverBgFromCover(cover, 'images/default.webp');
    expect(result).toMatch(/images\/bg-desktop\.webp$/);
  });

  it('should use legacy mobile path for mobile fallback', () => {
    const cover = { bgMobile: 'images/bg-mobile.webp' };
    const result = resolveCoverBgFromCover(cover, 'images/mobile-default.webp');
    expect(result).toMatch(/images\/bg-mobile\.webp$/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// resolveSound
// ═════════════════════════════════════════════════════════════════════════════

describe('resolveSound', () => {
  it('should use fallback when value is empty', () => {
    const result = resolveSound('', 'sounds/flip.mp3');
    expect(result).toMatch(/sounds\/flip\.mp3$/);
  });

  it('should return data URLs directly', () => {
    const data = 'data:audio/mp3;base64,abc';
    expect(resolveSound(data, 'fallback.mp3')).toBe(data);
  });

  it('should return http URLs directly', () => {
    expect(resolveSound('http://cdn.com/sound.mp3', 'fallback.mp3')).toBe('http://cdn.com/sound.mp3');
  });

  it('should prepend BASE_URL to relative paths', () => {
    const result = resolveSound('sounds/custom.mp3', 'fallback.mp3');
    expect(result).toMatch(/sounds\/custom\.mp3$/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildDefaultSettings
// ═════════════════════════════════════════════════════════════════════════════

describe('buildDefaultSettings', () => {
  it('should return all defaults when no source provided', () => {
    const settings = buildDefaultSettings();
    expect(settings).toEqual({
      font: 'georgia',
      fontSize: 18,
      theme: 'light',
      language: 'auto',
      page: 0,
      soundEnabled: true,
      soundVolume: 0.3,
      ambientType: 'none',
      ambientVolume: 0.5,
    });
  });

  it('should override with source values', () => {
    const settings = buildDefaultSettings({ font: 'roboto', fontSize: 22, theme: 'dark' });
    expect(settings.font).toBe('roboto');
    expect(settings.fontSize).toBe(22);
    expect(settings.theme).toBe('dark');
  });

  it('should handle boolean false correctly with nullish coalescing', () => {
    const settings = buildDefaultSettings({ soundEnabled: false, soundVolume: 0 });
    expect(settings.soundEnabled).toBe(false);
    expect(settings.soundVolume).toBe(0);
  });

  it('should always set page to 0', () => {
    const settings = buildDefaultSettings({ page: 42 });
    expect(settings.page).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildAppearanceTheme
// ═════════════════════════════════════════════════════════════════════════════

describe('buildAppearanceTheme', () => {
  it('should return light theme defaults', () => {
    const result = buildAppearanceTheme('light');
    expect(result.coverBgStart).toBe('#3a2d1f');
    expect(result.coverBgEnd).toBe('#2a2016');
    expect(result.coverText).toBe('#f2e9d8');
    expect(result.bgPage).toBe('#fdfcf8');
    expect(result.bgApp).toBe('#e6e3dc');
  });

  it('should return dark theme defaults', () => {
    const result = buildAppearanceTheme('dark');
    expect(result.coverBgStart).toBe('#111111');
    expect(result.coverBgEnd).toBe('#000000');
    expect(result.bgPage).toBe('#1e1e1e');
    expect(result.bgApp).toBe('#121212');
  });

  it('should override defaults with source values', () => {
    const result = buildAppearanceTheme('light', { coverBgStart: '#ff0000', bgPage: '#ffffff' });
    expect(result.coverBgStart).toBe('#ff0000');
    expect(result.bgPage).toBe('#ffffff');
    expect(result.coverBgEnd).toBe('#2a2016'); // still default
  });

  it('should use fieldMap to remap API keys', () => {
    const src = { coverBgImageUrl: 'http://example.com/bg.png' };
    const fieldMap = { coverBgImage: 'coverBgImageUrl' };
    const result = buildAppearanceTheme('light', src, fieldMap);
    expect(result.coverBgImage).toBe('http://example.com/bg.png');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildSettingsVisibility
// ═════════════════════════════════════════════════════════════════════════════

describe('buildSettingsVisibility', () => {
  it('should default all to true', () => {
    const vis = buildSettingsVisibility();
    expect(vis).toEqual({
      fontSize: true, theme: true, font: true,
      fullscreen: true, sound: true, ambient: true,
    });
  });

  it('should override individual settings', () => {
    const vis = buildSettingsVisibility({ fontSize: false, sound: false });
    expect(vis.fontSize).toBe(false);
    expect(vis.sound).toBe(false);
    expect(vis.theme).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildSoundsConfig
// ═════════════════════════════════════════════════════════════════════════════

describe('buildSoundsConfig', () => {
  it('should return default sounds when no source', () => {
    const sounds = buildSoundsConfig();
    expect(sounds.pageFlip).toMatch(/page-flip\.mp3$/);
    expect(sounds.bookOpen).toMatch(/cover-flip\.mp3$/);
    expect(sounds.bookClose).toMatch(/cover-flip\.mp3$/);
  });

  it('should use custom sounds from source', () => {
    const sounds = buildSoundsConfig({
      pageFlip: 'data:audio/mp3;base64,abc',
      bookOpen: 'http://cdn.com/open.mp3',
    });
    expect(sounds.pageFlip).toBe('data:audio/mp3;base64,abc');
    expect(sounds.bookOpen).toBe('http://cdn.com/open.mp3');
    expect(sounds.bookClose).toMatch(/cover-flip\.mp3$/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildAmbientConfig
// ═════════════════════════════════════════════════════════════════════════════

describe('buildAmbientConfig', () => {
  it('should return defaults for empty/null input', () => {
    const result = buildAmbientConfig(null);
    expect(result).toHaveProperty('none');
    expect(result).toHaveProperty('rain');
    expect(result.none.file).toBeNull();
  });

  it('should return defaults for empty array', () => {
    const result = buildAmbientConfig([]);
    expect(result).toHaveProperty('none');
  });

  it('should filter out invisible ambients', () => {
    const ambients = [
      { id: 'rain', label: 'Rain', icon: '🌧️', visible: true, file: 'rain.mp3' },
      { id: 'hidden', label: 'Hidden', icon: '?', visible: false, file: 'hidden.mp3' },
    ];
    const result = buildAmbientConfig(ambients);
    expect(result).toHaveProperty('rain');
    expect(result).not.toHaveProperty('hidden');
  });

  it('should handle data URLs in file field', () => {
    const ambients = [
      { id: 'custom', label: 'Custom', icon: '🎵', visible: true, file: 'data:audio/mp3;base64,abc' },
    ];
    const result = buildAmbientConfig(ambients);
    expect(result.custom.file).toBe('data:audio/mp3;base64,abc');
  });

  it('should handle http URLs in file field', () => {
    const ambients = [
      { id: 'remote', label: 'Remote', icon: '🎵', visible: true, file: 'http://cdn.com/sound.mp3' },
    ];
    const result = buildAmbientConfig(ambients);
    expect(result.remote.file).toBe('http://cdn.com/sound.mp3');
  });

  it('should handle null file', () => {
    const ambients = [
      { id: 'silent', label: 'Silent', icon: '✕', visible: true, file: null },
    ];
    const result = buildAmbientConfig(ambients);
    expect(result.silent.file).toBeNull();
  });

  it('should preserve _idb marker', () => {
    const ambients = [
      { id: 'big', label: 'Big', icon: '🎵', visible: true, file: null, _idb: true },
    ];
    const result = buildAmbientConfig(ambients);
    expect(result.big._idb).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildAmbientConfigFromAPI
// ═════════════════════════════════════════════════════════════════════════════

describe('buildAmbientConfigFromAPI', () => {
  it('should return defaults for null/empty', () => {
    expect(buildAmbientConfigFromAPI(null)).toHaveProperty('none');
    expect(buildAmbientConfigFromAPI([])).toHaveProperty('none');
  });

  it('should build config from API data', () => {
    const apiAmbients = [
      { ambientKey: 'rain', label: 'Rain', shortLabel: 'Rain', icon: '🌧️', visible: true, fileUrl: 'http://s3.com/rain.mp3' },
    ];
    const result = buildAmbientConfigFromAPI(apiAmbients);
    expect(result.rain.label).toBe('Rain');
    expect(result.rain.file).toBe('http://s3.com/rain.mp3');
  });

  it('should filter invisible ambients', () => {
    const apiAmbients = [
      { ambientKey: 'rain', label: 'Rain', icon: '🌧️', visible: false, fileUrl: 'rain.mp3' },
    ];
    const result = buildAmbientConfigFromAPI(apiAmbients);
    // all filtered out → returns defaults
    expect(result).toHaveProperty('none');
  });

  it('should use id as fallback key when no ambientKey', () => {
    const apiAmbients = [
      { id: 'cafe', label: 'Cafe', icon: '☕', visible: true, fileUrl: null },
    ];
    const result = buildAmbientConfigFromAPI(apiAmbients);
    expect(result.cafe.label).toBe('Cafe');
    expect(result.cafe.file).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildFontsConfig
// ═════════════════════════════════════════════════════════════════════════════

describe('buildFontsConfig', () => {
  it('should return defaults for null/empty', () => {
    const result = buildFontsConfig(null);
    expect(result.fonts).toHaveProperty('georgia');
    expect(result.fontsList).toBeNull();
  });

  it('should return defaults for empty array', () => {
    const result = buildFontsConfig([]);
    expect(result.fonts).toHaveProperty('georgia');
  });

  it('should only include enabled fonts', () => {
    const fonts = [
      { id: 'arial', family: 'Arial', enabled: true, builtin: true },
      { id: 'disabled', family: 'Disabled', enabled: false, builtin: true },
    ];
    const result = buildFontsConfig(fonts);
    expect(result.fonts).toHaveProperty('arial');
    expect(result.fonts).not.toHaveProperty('disabled');
  });

  it('should collect custom fonts with dataUrl', () => {
    const fonts = [
      { id: 'custom1', label: 'Custom', family: '"Custom"', enabled: true, builtin: false, dataUrl: 'data:font/woff2;base64,abc' },
    ];
    const result = buildFontsConfig(fonts);
    expect(result.customFonts).toHaveLength(1);
    expect(result.customFonts[0].id).toBe('custom1');
    expect(result.customFonts[0].dataUrl).toBe('data:font/woff2;base64,abc');
  });

  it('should collect custom fonts with _idb marker', () => {
    const fonts = [
      { id: 'idb-font', label: 'IDB', family: '"IDB"', enabled: true, builtin: false, _idb: true },
    ];
    const result = buildFontsConfig(fonts);
    expect(result.customFonts).toHaveLength(1);
    expect(result.customFonts[0]._idb).toBe(true);
    expect(result.customFonts[0].dataUrl).toBeNull();
  });

  it('should not include builtin fonts in customFonts', () => {
    const fonts = [
      { id: 'georgia', family: 'Georgia', enabled: true, builtin: true, dataUrl: null },
    ];
    const result = buildFontsConfig(fonts);
    expect(result.customFonts).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildFontsConfigFromAPI
// ═════════════════════════════════════════════════════════════════════════════

describe('buildFontsConfigFromAPI', () => {
  it('should return defaults for null/empty', () => {
    const result = buildFontsConfigFromAPI(null);
    expect(result.fonts).toHaveProperty('georgia');
    expect(result.fontsList).toBeNull();
    expect(result.customFonts).toEqual([]);
  });

  it('should build fonts from API data', () => {
    const apiFonts = [
      { fontKey: 'roboto', label: 'Roboto', family: 'Roboto', builtin: true, enabled: true },
    ];
    const result = buildFontsConfigFromAPI(apiFonts);
    expect(result.fonts.roboto).toBe('Roboto');
    expect(result.fontsList).toHaveLength(1);
  });

  it('should collect custom fonts with fileUrl', () => {
    const apiFonts = [
      { fontKey: 'custom', label: 'Custom', family: '"Custom"', builtin: false, enabled: true, fileUrl: 'http://s3.com/font.woff2' },
    ];
    const result = buildFontsConfigFromAPI(apiFonts);
    expect(result.customFonts).toHaveLength(1);
    expect(result.customFonts[0].dataUrl).toBe('http://s3.com/font.woff2');
  });

  it('should use id as fallback when fontKey absent', () => {
    const apiFonts = [
      { id: 'inter', label: 'Inter', family: 'Inter', builtin: true, enabled: true },
    ];
    const result = buildFontsConfigFromAPI(apiFonts);
    expect(result.fonts.inter).toBe('Inter');
  });

  it('should return empty fonts when all disabled (no fallback)', () => {
    const apiFonts = [
      { fontKey: 'roboto', label: 'Roboto', family: 'Roboto', builtin: true, enabled: false },
    ];
    const result = buildFontsConfigFromAPI(apiFonts);
    expect(Object.keys(result.fonts).length).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildCommonConfig
// ═════════════════════════════════════════════════════════════════════════════

describe('buildCommonConfig', () => {
  it('should return all expected sections', () => {
    const common = buildCommonConfig();
    expect(common).toHaveProperty('VIRTUALIZATION');
    expect(common).toHaveProperty('LAYOUT');
    expect(common).toHaveProperty('TIMING');
    expect(common).toHaveProperty('UI');
    expect(common).toHaveProperty('NETWORK');
    expect(common).toHaveProperty('AUDIO');
    expect(common).toHaveProperty('TIMING_SAFETY_MARGIN');
  });

  it('should have correct default values', () => {
    const common = buildCommonConfig();
    expect(common.VIRTUALIZATION.cacheLimit).toBe(50);
    expect(common.NETWORK.MAX_RETRIES).toBe(3);
    expect(common.TIMING.FLIP_THROTTLE).toBe(100);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// loadAdminConfig
// ═════════════════════════════════════════════════════════════════════════════

describe('loadAdminConfig', () => {
  it('should return null when localStorage is empty', () => {
    expect(loadAdminConfig()).toBeNull();
  });

  it('should return config data when present', () => {
    const data = { books: [{ id: 'b1' }], activeBookId: 'b1' };
    localStorage.setItem('flipbook-admin-config', JSON.stringify(data));
    const result = loadAdminConfig();
    expect(result).toEqual(data);
  });
});
