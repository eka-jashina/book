/**
 * UNIT TEST: enrichConfigFromIDB.js
 * Тесты обогащения конфигурации данными из IndexedDB
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deepFreeze } from '../../../js/config/configHelpers.js';

// Мок IdbStorage — перехватываем динамический import() внутри enrichConfigFromIDB
let mockIdbGetResult = null;

vi.mock('../../../js/utils/IdbStorage.js', () => {
  return {
    IdbStorage: class MockIdbStorage {
      async get() {
        if (mockIdbGetResult instanceof Error) throw mockIdbGetResult;
        return mockIdbGetResult;
      }
    },
  };
});

vi.mock('@utils/IdbStorage.js', () => {
  return {
    IdbStorage: class MockIdbStorage {
      async get() {
        if (mockIdbGetResult instanceof Error) throw mockIdbGetResult;
        return mockIdbGetResult;
      }
    },
  };
});

import { enrichConfigFromIDB } from '../../../js/config/enrichConfigFromIDB.js';

// ═════════════════════════════════════════════════════════════════════════════
// enrichConfigFromIDB
// ═════════════════════════════════════════════════════════════════════════════

describe('enrichConfigFromIDB', () => {
  beforeEach(() => {
    mockIdbGetResult = null;
  });

  it('should return original config when no IDB markers present', async () => {
    const config = deepFreeze({
      DECORATIVE_FONT: null,
      CUSTOM_FONTS: [],
      AMBIENT: { none: { file: null } },
      APPEARANCE: { light: {}, dark: {} },
    });

    const result = await enrichConfigFromIDB(config);
    expect(result).toBe(config);
  });

  it('should return original config when IDB load fails', async () => {
    mockIdbGetResult = new Error('IDB unavailable');

    const config = deepFreeze({
      DECORATIVE_FONT: { _idb: true, dataUrl: null },
      CUSTOM_FONTS: [],
      AMBIENT: { none: { file: null } },
      APPEARANCE: { light: {}, dark: {} },
    });

    const result = await enrichConfigFromIDB(config);
    expect(result).toBe(config);
  });

  it('should return original config when IDB returns null', async () => {
    mockIdbGetResult = null;

    const config = deepFreeze({
      DECORATIVE_FONT: { _idb: true, dataUrl: null },
      CUSTOM_FONTS: [],
      AMBIENT: { none: { file: null } },
      APPEARANCE: { light: {}, dark: {} },
    });

    const result = await enrichConfigFromIDB(config);
    expect(result).toBe(config);
  });

  it('should enrich decorative font from IDB', async () => {
    mockIdbGetResult = {
      books: [{ id: 'b1', decorativeFont: { dataUrl: 'data:font/woff2;base64,REAL_DATA' } }],
      activeBookId: 'b1',
    };

    const config = deepFreeze({
      DECORATIVE_FONT: { _idb: true, family: 'Fancy', dataUrl: null },
      CUSTOM_FONTS: [],
      AMBIENT: { none: { file: null } },
      APPEARANCE: { light: {}, dark: {} },
    });

    const result = await enrichConfigFromIDB(config);
    expect(result).not.toBe(config);
    expect(result.DECORATIVE_FONT.dataUrl).toBe('data:font/woff2;base64,REAL_DATA');
    expect(result.DECORATIVE_FONT.family).toBe('Fancy');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('should enrich ambient files from IDB', async () => {
    mockIdbGetResult = {
      books: [{ id: 'b1', ambients: [{ id: 'rain', file: 'data:audio/mp3;base64,RAIN_DATA' }] }],
      activeBookId: 'b1',
    };

    const config = deepFreeze({
      DECORATIVE_FONT: null,
      CUSTOM_FONTS: [],
      AMBIENT: {
        rain: { label: 'Rain', icon: '🌧️', file: null, _idb: true },
        none: { label: 'None', icon: '✕', file: null },
      },
      APPEARANCE: { light: {}, dark: {} },
    });

    const result = await enrichConfigFromIDB(config);
    expect(result.AMBIENT.rain.file).toBe('data:audio/mp3;base64,RAIN_DATA');
    expect(result.AMBIENT.none.file).toBeNull();
  });

  it('should enrich custom reading fonts from IDB', async () => {
    mockIdbGetResult = {
      books: [{ id: 'b1' }],
      activeBookId: 'b1',
      readingFonts: [{ id: 'my-font', dataUrl: 'data:font/woff2;base64,FONT_DATA' }],
    };

    const config = deepFreeze({
      DECORATIVE_FONT: null,
      CUSTOM_FONTS: [{ id: 'my-font', label: 'My Font', family: '"MyFont"', _idb: true, dataUrl: null }],
      AMBIENT: { none: { file: null } },
      APPEARANCE: { light: {}, dark: {} },
    });

    const result = await enrichConfigFromIDB(config);
    expect(result.CUSTOM_FONTS[0].dataUrl).toBe('data:font/woff2;base64,FONT_DATA');
  });

  it('should enrich appearance coverBgImage from IDB', async () => {
    mockIdbGetResult = {
      books: [{
        id: 'b1',
        appearance: {
          light: { coverBgImage: 'data:image/png;base64,COVER_IMG' },
          dark: {},
        },
      }],
      activeBookId: 'b1',
    };

    const config = deepFreeze({
      DECORATIVE_FONT: null,
      CUSTOM_FONTS: [],
      AMBIENT: { none: { file: null } },
      APPEARANCE: {
        light: { _idbCoverBgImage: true, coverBgImage: null, bgPage: '#fff' },
        dark: { bgPage: '#000' },
      },
    });

    const result = await enrichConfigFromIDB(config);
    expect(result.APPEARANCE.light.coverBgImage).toBe('data:image/png;base64,COVER_IMG');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('should enrich appearance customTextureData from IDB', async () => {
    mockIdbGetResult = {
      books: [{
        id: 'b1',
        appearance: {
          light: {},
          dark: { customTextureData: 'data:image/png;base64,TEXTURE' },
        },
      }],
      activeBookId: 'b1',
    };

    const config = deepFreeze({
      DECORATIVE_FONT: null,
      CUSTOM_FONTS: [],
      AMBIENT: { none: { file: null } },
      APPEARANCE: {
        light: {},
        dark: { _idbCustomTexture: true, customTextureData: null },
      },
    });

    const result = await enrichConfigFromIDB(config);
    expect(result.APPEARANCE.dark.customTextureData).toBe('data:image/png;base64,TEXTURE');
  });

  it('should handle multiple enrichments simultaneously', async () => {
    mockIdbGetResult = {
      books: [{
        id: 'b1',
        decorativeFont: { dataUrl: 'data:font;base64,DECO' },
        ambients: [{ id: 'fire', file: 'data:audio;base64,FIRE' }],
        appearance: {
          light: { coverBgImage: 'data:image;base64,BG' },
          dark: {},
        },
      }],
      activeBookId: 'b1',
      readingFonts: [{ id: 'f1', dataUrl: 'data:font;base64,F1' }],
    };

    const config = deepFreeze({
      DECORATIVE_FONT: { _idb: true, dataUrl: null },
      CUSTOM_FONTS: [{ id: 'f1', _idb: true, dataUrl: null }],
      AMBIENT: {
        fire: { _idb: true, file: null },
        none: { file: null },
      },
      APPEARANCE: {
        light: { _idbCoverBgImage: true, coverBgImage: null },
        dark: {},
      },
    });

    const result = await enrichConfigFromIDB(config);
    expect(result.DECORATIVE_FONT.dataUrl).toBe('data:font;base64,DECO');
    expect(result.CUSTOM_FONTS[0].dataUrl).toBe('data:font;base64,F1');
    expect(result.AMBIENT.fire.file).toBe('data:audio;base64,FIRE');
    expect(result.APPEARANCE.light.coverBgImage).toBe('data:image;base64,BG');
  });
});
