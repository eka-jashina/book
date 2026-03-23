/**
 * UNIT TEST: config.js
 * Тестирование конфигурации, enum-значений и иммутабельности
 */

import { describe, it, expect } from 'vitest';
import { CONFIG, createConfig, BookState, FlipPhase, Direction, BoolStr } from '../../js/config.js';

describe('CONFIG', () => {
  it('should be frozen (immutable)', () => {
    expect(Object.isFrozen(CONFIG)).toBe(true);
  });

  it('should not allow adding new properties', () => {
    const before = Object.keys(CONFIG).length;
    try { CONFIG.NEW_PROP = 'test'; } catch {}
    expect(Object.keys(CONFIG).length).toBe(before);
    expect(CONFIG.NEW_PROP).toBeUndefined();
  });

  it('should not allow modifying existing properties', () => {
    const original = CONFIG.STORAGE_KEY;
    try { CONFIG.STORAGE_KEY = 'hacked'; } catch {}
    expect(CONFIG.STORAGE_KEY).toBe(original);
  });

  describe('CHAPTERS', () => {
    it('should have at least one chapter', () => {
      expect(CONFIG.CHAPTERS.length).toBeGreaterThan(0);
    });

    it('each chapter should have required fields', () => {
      for (const chapter of CONFIG.CHAPTERS) {
        expect(chapter).toHaveProperty('id');
        expect(chapter).toHaveProperty('file');
        expect(chapter).toHaveProperty('bg');
        expect(typeof chapter.id).toBe('string');
        expect(typeof chapter.file).toBe('string');
        expect(typeof chapter.bg).toBe('string');
      }
    });

    it('chapter ids should be unique', () => {
      const ids = CONFIG.CHAPTERS.map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('FONTS', () => {
    it('should have at least one font', () => {
      expect(Object.keys(CONFIG.FONTS).length).toBeGreaterThan(0);
    });

    it('should include default font georgia', () => {
      expect(CONFIG.FONTS).toHaveProperty('georgia');
    });

    it('each font value should be a string', () => {
      for (const value of Object.values(CONFIG.FONTS)) {
        expect(typeof value).toBe('string');
      }
    });
  });

  describe('SOUNDS', () => {
    it('should have pageFlip sound', () => {
      expect(CONFIG.SOUNDS).toHaveProperty('pageFlip');
    });

    it('should have bookOpen and bookClose sounds', () => {
      expect(CONFIG.SOUNDS).toHaveProperty('bookOpen');
      expect(CONFIG.SOUNDS).toHaveProperty('bookClose');
    });
  });

  describe('AMBIENT', () => {
    it('should have none option', () => {
      expect(CONFIG.AMBIENT).toHaveProperty('none');
      expect(CONFIG.AMBIENT.none.file).toBeNull();
    });

    it('each ambient type should have label and icon', () => {
      for (const [, config] of Object.entries(CONFIG.AMBIENT)) {
        expect(config).toHaveProperty('label');
        expect(config).toHaveProperty('icon');
      }
    });
  });

  describe('DEFAULT_SETTINGS', () => {
    it('should have all required setting keys', () => {
      const required = ['font', 'fontSize', 'theme', 'page', 'soundEnabled', 'soundVolume', 'ambientType', 'ambientVolume'];
      for (const key of required) {
        expect(CONFIG.DEFAULT_SETTINGS).toHaveProperty(key);
      }
    });

    it('default font should exist in FONTS', () => {
      expect(CONFIG.FONTS).toHaveProperty(CONFIG.DEFAULT_SETTINGS.font);
    });

    it('default fontSize should be reasonable', () => {
      expect(CONFIG.DEFAULT_SETTINGS.fontSize).toBeGreaterThanOrEqual(10);
      expect(CONFIG.DEFAULT_SETTINGS.fontSize).toBeLessThanOrEqual(30);
    });

    it('default volumes should be 0-1 range', () => {
      expect(CONFIG.DEFAULT_SETTINGS.soundVolume).toBeGreaterThanOrEqual(0);
      expect(CONFIG.DEFAULT_SETTINGS.soundVolume).toBeLessThanOrEqual(1);
      expect(CONFIG.DEFAULT_SETTINGS.ambientVolume).toBeGreaterThanOrEqual(0);
      expect(CONFIG.DEFAULT_SETTINGS.ambientVolume).toBeLessThanOrEqual(1);
    });
  });

  describe('NETWORK', () => {
    it('should have positive retry settings', () => {
      expect(CONFIG.NETWORK.MAX_RETRIES).toBeGreaterThan(0);
      expect(CONFIG.NETWORK.INITIAL_RETRY_DELAY).toBeGreaterThan(0);
    });
  });
});

describe('BookState', () => {
  it('should be frozen', () => {
    expect(Object.isFrozen(BookState)).toBe(true);
  });

  it('should have all required states', () => {
    expect(BookState.CLOSED).toBe('closed');
    expect(BookState.OPENING).toBe('opening');
    expect(BookState.OPENED).toBe('opened');
    expect(BookState.FLIPPING).toBe('flipping');
    expect(BookState.CLOSING).toBe('closing');
  });

  it('should have exactly 5 states', () => {
    expect(Object.keys(BookState).length).toBe(5);
  });
});

describe('FlipPhase', () => {
  it('should be frozen', () => {
    expect(Object.isFrozen(FlipPhase)).toBe(true);
  });

  it('should have all required phases', () => {
    expect(FlipPhase.LIFT).toBe('lift');
    expect(FlipPhase.ROTATE).toBe('rotate');
    expect(FlipPhase.DROP).toBe('drop');
    expect(FlipPhase.DRAG).toBe('drag');
  });
});

describe('Direction', () => {
  it('should be frozen', () => {
    expect(Object.isFrozen(Direction)).toBe(true);
  });

  it('should have next and prev', () => {
    expect(Direction.NEXT).toBe('next');
    expect(Direction.PREV).toBe('prev');
  });

  it('should have exactly 2 values', () => {
    expect(Object.keys(Direction).length).toBe(2);
  });
});

describe('BoolStr', () => {
  it('should be frozen', () => {
    expect(Object.isFrozen(BoolStr)).toBe(true);
  });

  it('should have string true and false', () => {
    expect(BoolStr.TRUE).toBe('true');
    expect(BoolStr.FALSE).toBe('false');
  });
});

// ─── createConfig ─────────────────────────────────────────────────────────────

describe('createConfig', () => {
  it('should return a frozen object', () => {
    const config = createConfig(null);
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('should have all required keys', () => {
    const config = createConfig(null);
    expect(Object.keys(config)).toEqual(Object.keys(CONFIG));
  });

  it('should use default chapters when adminConfig is null', () => {
    const config = createConfig(null);
    expect(config.CHAPTERS.length).toBeGreaterThan(0);
    expect(config.STORAGE_KEY).toBe('reader-settings');
  });

  it('should use admin chapters when provided', () => {
    const mockAdmin = {
      books: [{
        id: 'book-1',
        chapters: [
          { id: 'ch-1', file: 'content/ch1.html', bg: 'images/bg1.webp', bgMobile: '' },
        ],
        defaultSettings: {},
        appearance: {},
        sounds: {},
        ambients: [],
        cover: {},
      }],
      activeBookId: 'book-1',
    };
    const config = createConfig(mockAdmin);
    expect(config.STORAGE_KEY).toBe('reader-settings:book-1');
    expect(config.CHAPTERS).toHaveLength(1);
    expect(config.CHAPTERS[0].id).toBe('ch-1');
  });

  it('should apply defaultSettings from admin book', () => {
    const mockAdmin = {
      books: [{
        id: 'book-2',
        chapters: [{ id: 'ch-1', file: '', bg: '', bgMobile: '' }],
        defaultSettings: { font: 'roboto', fontSize: 20, theme: 'dark' },
        appearance: {},
        sounds: {},
        ambients: [],
        cover: {},
      }],
      activeBookId: 'book-2',
    };
    const config = createConfig(mockAdmin);
    expect(config.DEFAULT_SETTINGS.font).toBe('roboto');
    expect(config.DEFAULT_SETTINGS.fontSize).toBe(20);
    expect(config.DEFAULT_SETTINGS.theme).toBe('dark');
  });

  it('should apply settingsVisibility from adminConfig', () => {
    const mockAdmin = {
      books: [],
      settingsVisibility: { fontSize: false, theme: false, font: true, fullscreen: true, sound: false, ambient: true },
    };
    const config = createConfig(mockAdmin);
    expect(config.SETTINGS_VISIBILITY.fontSize).toBe(false);
    expect(config.SETTINGS_VISIBILITY.theme).toBe(false);
    expect(config.SETTINGS_VISIBILITY.sound).toBe(false);
  });

  it('should not call localStorage', () => {
    // createConfig принимает данные явно — localStorage не должен читаться
    const originalGetItem = localStorage.getItem.bind(localStorage);
    let called = false;
    localStorage.getItem = (key) => { called = true; return originalGetItem(key); };
    createConfig(null);
    localStorage.getItem = originalGetItem;
    expect(called).toBe(false);
  });
});
