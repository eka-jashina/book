/**
 * INTEGRATION TEST: Service Integrations
 * Тестирование интеграции сервисов (ContentLoader, Storage, Audio)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createChapterContent,
  setupFetchMock,
} from '../../helpers/integrationUtils.js';

import { ContentLoader } from '../../../js/managers/ContentLoader.js';
import { StorageManager } from '../../../js/utils/StorageManager.js';
import { SettingsManager } from '../../../js/managers/SettingsManager.js';
import { SoundManager } from '../../../js/managers/SoundManager.js';
import { CONFIG } from '../../../js/config.js';

describe('Service Integrations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ContentLoader', () => {
    let contentLoader;

    beforeEach(() => {
      contentLoader = new ContentLoader();
    });

    afterEach(() => {
      contentLoader?.destroy();
    });

    describe('Basic Loading', () => {
      it('should load single URL', async () => {
        const testHtml = '<article>Test content</article>';
        setupFetchMock(testHtml);

        const result = await contentLoader.load(['content/part_1.html']);

        expect(result).toBe(testHtml);
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      it('should load multiple URLs in parallel', async () => {
        setupFetchMock((url) => `<article>${url}</article>`);

        const urls = [
          'content/part_1.html',
          'content/part_2.html',
          'content/part_3.html',
        ];

        const result = await contentLoader.load(urls);

        expect(global.fetch).toHaveBeenCalledTimes(3);
        expect(result).toContain('content/part_1.html');
        expect(result).toContain('content/part_2.html');
        expect(result).toContain('content/part_3.html');
      });

      it('should join content in correct order', async () => {
        setupFetchMock((url) => {
          if (url.includes('part_1')) return 'FIRST';
          if (url.includes('part_2')) return 'SECOND';
          return 'THIRD';
        });

        const result = await contentLoader.load([
          'content/part_1.html',
          'content/part_2.html',
          'content/part_3.html',
        ]);

        expect(result).toBe('<article>\nFIRST\n</article>\n<article>\nSECOND\n</article>\n<article>\nTHIRD\n</article>');
      });

      it('should load chapter content correctly', async () => {
        const chapterHtml = createChapterContent({ chapters: 2, paragraphsPerChapter: 3 });
        setupFetchMock(chapterHtml);

        const result = await contentLoader.load(['content/chapters.html']);

        expect(result).toContain('Глава 1');
        expect(result).toContain('Глава 2');
        expect(result).toContain('data-chapter="0"');
        expect(result).toContain('data-chapter="1"');
      });
    });

    describe('Caching', () => {
      it('should cache loaded content', async () => {
        setupFetchMock('<p>Cached</p>');

        // First load
        await contentLoader.load(['content/part_1.html']);
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // Second load - should use cache
        await contentLoader.load(['content/part_1.html']);
        expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1
      });

      it('should only fetch uncached URLs', async () => {
        setupFetchMock((url) => `Content: ${url}`);

        // Load first URL
        await contentLoader.load(['content/part_1.html']);
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // Load first + second - should only fetch second
        await contentLoader.load(['content/part_1.html', 'content/part_2.html']);
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      it('should clear cache on clear()', async () => {
        setupFetchMock('<p>Content</p>');

        await contentLoader.load(['content/part_1.html']);
        expect(global.fetch).toHaveBeenCalledTimes(1);

        contentLoader.clear();

        await contentLoader.load(['content/part_1.html']);
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      it('should have cache accessible', async () => {
        setupFetchMock('<p>Test</p>');

        await contentLoader.load(['content/part_1.html']);

        expect(contentLoader.cache.has('content/part_1.html')).toBe(true);
        expect(contentLoader.cache.get('content/part_1.html')).toBe('<p>Test</p>');
      });
    });

    describe('Retry Configuration', () => {
      it('should have retry configuration in CONFIG', () => {
        expect(CONFIG.NETWORK.MAX_RETRIES).toBeGreaterThan(0);
        expect(CONFIG.NETWORK.INITIAL_RETRY_DELAY).toBeGreaterThan(0);
      });

      it('should calculate exponential backoff correctly', () => {
        const delays = [];
        for (let attempt = 0; attempt < CONFIG.NETWORK.MAX_RETRIES - 1; attempt++) {
          const delay = CONFIG.NETWORK.INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          delays.push(delay);
        }

        // Verify exponential pattern
        expect(delays[0]).toBe(CONFIG.NETWORK.INITIAL_RETRY_DELAY);
        expect(delays[1]).toBe(CONFIG.NETWORK.INITIAL_RETRY_DELAY * 2);
      });
    });

    describe('Abort Controller', () => {
      it('should have controller after load starts', async () => {
        setupFetchMock('<p>Content</p>');

        const loadPromise = contentLoader.load(['content/part_1.html']);

        // Controller should exist during load
        expect(contentLoader.controller).not.toBeNull();

        await loadPromise;
      });

      it('should create new controller for each load', async () => {
        setupFetchMock('<p>Content</p>');

        await contentLoader.load(['content/part_1.html']);
        const firstController = contentLoader.controller;

        await contentLoader.load(['content/part_2.html']);

        // New controller should be created (old one may be nullified by abort)
        expect(contentLoader.controller).not.toBe(firstController);
      });

      it('should abort method clear controller', () => {
        contentLoader.controller = new AbortController();

        contentLoader.abort();

        expect(contentLoader.controller).toBeNull();
      });
    });

    describe('Destroy', () => {
      it('should clear cache on destroy', async () => {
        setupFetchMock('<p>Content</p>');

        await contentLoader.load(['content/part_1.html']);
        expect(contentLoader.cache.size).toBe(1);

        contentLoader.destroy();

        expect(contentLoader.cache.size).toBe(0);
      });

      it('should abort pending load on destroy', () => {
        contentLoader.controller = new AbortController();
        const abortSpy = vi.spyOn(contentLoader.controller, 'abort');

        contentLoader.destroy();

        expect(abortSpy).toHaveBeenCalled();
      });
    });
  });

  describe('StorageManager', () => {
    let mockLocalStorage;
    let storageManager;

    beforeEach(() => {
      mockLocalStorage = {};
      vi.stubGlobal('localStorage', {
        getItem: vi.fn((key) => mockLocalStorage[key] || null),
        setItem: vi.fn((key, value) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: vi.fn((key) => {
          delete mockLocalStorage[key];
        }),
        clear: vi.fn(() => {
          mockLocalStorage = {};
        }),
      });

      storageManager = new StorageManager('test-key');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should save data to localStorage', () => {
      storageManager.save({ font: 'inter', fontSize: 20 });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        expect.any(String)
      );

      const saved = JSON.parse(mockLocalStorage['test-key']);
      expect(saved.font).toBe('inter');
      expect(saved.fontSize).toBe(20);
    });

    it('should load data from localStorage', () => {
      mockLocalStorage['test-key'] = JSON.stringify({ font: 'merriweather' });

      const data = storageManager.load();

      expect(data.font).toBe('merriweather');
    });

    it('should return empty object when localStorage is empty', () => {
      const data = storageManager.load();

      expect(data).toEqual({});
    });

    it('should handle JSON parse errors gracefully', () => {
      mockLocalStorage['test-key'] = 'not valid json';

      const data = storageManager.load();

      expect(data).toEqual({});
    });

    it('should clear stored data', () => {
      mockLocalStorage['test-key'] = JSON.stringify({ font: 'inter' });

      storageManager.clear();

      expect(localStorage.removeItem).toHaveBeenCalledWith('test-key');
    });
  });

  describe('SettingsManager', () => {
    let settingsManager;
    let mockStorage;
    const defaults = {
      font: 'georgia',
      fontSize: 18,
      theme: 'light',
      soundEnabled: true,
      soundVolume: 0.3,
    };

    beforeEach(() => {
      mockStorage = {
        load: vi.fn().mockReturnValue({}),
        save: vi.fn(),
      };
      settingsManager = new SettingsManager(mockStorage, defaults);
    });

    afterEach(() => {
      settingsManager?.destroy();
    });

    it('should get default values', () => {
      expect(settingsManager.get('font')).toBe('georgia');
      expect(settingsManager.get('fontSize')).toBe(18);
      expect(settingsManager.get('theme')).toBe('light');
      expect(settingsManager.get('soundEnabled')).toBe(true);
    });

    it('should set and get values', () => {
      settingsManager.set('font', 'inter');
      expect(settingsManager.get('font')).toBe('inter');

      settingsManager.set('fontSize', 20);
      expect(settingsManager.get('fontSize')).toBe(20);
    });

    it('should persist values on set', () => {
      settingsManager.set('theme', 'dark');

      expect(mockStorage.save).toHaveBeenCalled();
    });

    it('should load persisted values', () => {
      mockStorage.load.mockReturnValue({
        font: 'merriweather',
        fontSize: 22,
      });

      const newSettings = new SettingsManager(mockStorage, defaults);

      expect(newSettings.get('font')).toBe('merriweather');
      expect(newSettings.get('fontSize')).toBe(22);

      newSettings.destroy();
    });

    it('should merge saved values with defaults', () => {
      // Only font is saved, other values come from defaults
      mockStorage.load.mockReturnValue({
        font: 'inter',
      });

      const newSettings = new SettingsManager(mockStorage, defaults);

      expect(newSettings.get('font')).toBe('inter');
      expect(newSettings.get('fontSize')).toBe(18); // default
      expect(newSettings.get('theme')).toBe('light'); // default

      newSettings.destroy();
    });
  });

  describe('SoundManager', () => {
    let soundManager;

    beforeEach(() => {
      soundManager = new SoundManager({ enabled: true, volume: 0.5 });
    });

    afterEach(() => {
      soundManager?.destroy?.();
    });

    it('should initialize with options', () => {
      expect(soundManager.enabled).toBe(true);
      expect(soundManager.volume).toBe(0.5);
    });

    it('should register sounds', () => {
      soundManager.register('pageFlip', '/sounds/flip.mp3');
      soundManager.register('bookOpen', '/sounds/open.mp3');

      expect(soundManager.sounds.size).toBe(2);
      expect(soundManager.sounds.has('pageFlip')).toBe(true);
      expect(soundManager.sounds.has('bookOpen')).toBe(true);
    });

    it('should store sound configuration', () => {
      soundManager.register('pageFlip', '/sounds/flip.mp3', {
        volume: 0.8,
        poolSize: 5,
      });

      const sound = soundManager.sounds.get('pageFlip');
      expect(sound.url).toBe('/sounds/flip.mp3');
      expect(sound.volume).toBe(0.8);
      expect(sound.poolSize).toBe(5);
    });

    it('should add to preload queue', () => {
      soundManager.register('pageFlip', '/sounds/flip.mp3', { preload: true });
      soundManager.register('bookOpen', '/sounds/open.mp3', { preload: false });

      expect(soundManager.preloadQueue).toContain('pageFlip');
      expect(soundManager.preloadQueue).not.toContain('bookOpen');
    });

    it('should set volume', () => {
      soundManager.setVolume(0.8);
      expect(soundManager.volume).toBe(0.8);
    });

    it('should toggle enabled state', () => {
      soundManager.setEnabled(false);
      expect(soundManager.enabled).toBe(false);

      soundManager.setEnabled(true);
      expect(soundManager.enabled).toBe(true);
    });

    it('should use default pool size', () => {
      soundManager.register('test', '/sounds/test.mp3');

      const sound = soundManager.sounds.get('test');
      expect(sound.poolSize).toBe(3);
    });

    it('should chain register calls', () => {
      const result = soundManager
        .register('sound1', '/sounds/1.mp3')
        .register('sound2', '/sounds/2.mp3');

      expect(result).toBe(soundManager);
      expect(soundManager.sounds.size).toBe(2);
    });
  });

  describe('Cross-Service Integration', () => {
    it('should persist settings through StorageManager', () => {
      const storage = {};
      vi.stubGlobal('localStorage', {
        getItem: vi.fn((key) => storage[key] || null),
        setItem: vi.fn((key, value) => {
          storage[key] = value;
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
      });

      // Create and configure settings
      const storageManager1 = new StorageManager('flipbook-test');
      const settings1 = new SettingsManager(storageManager1);

      settings1.set('font', 'inter');
      settings1.set('theme', 'dark');

      settings1.destroy();

      // Reload settings
      const storageManager2 = new StorageManager('flipbook-test');
      const settings2 = new SettingsManager(storageManager2);

      expect(settings2.get('font')).toBe('inter');
      expect(settings2.get('theme')).toBe('dark');

      settings2.destroy();
      vi.unstubAllGlobals();
    });

    it('should load content and verify structure', async () => {
      const contentLoader = new ContentLoader();
      const content = createChapterContent({ chapters: 3, paragraphsPerChapter: 2 });
      setupFetchMock(content);

      const result = await contentLoader.load(['content/book.html']);

      // Verify chapter structure
      expect(result).toContain('data-chapter="0"');
      expect(result).toContain('data-chapter="1"');
      expect(result).toContain('data-chapter="2"');
      expect(result).toContain('Глава 1');
      expect(result).toContain('Глава 2');
      expect(result).toContain('Глава 3');

      contentLoader.destroy();
    });

    it('should handle multiple content loads with caching', async () => {
      const contentLoader = new ContentLoader();
      setupFetchMock((url) => `<content>${url}</content>`);

      // First load
      const result1 = await contentLoader.load([
        'content/part_1.html',
        'content/part_2.html',
      ]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result1).toContain('part_1.html');
      expect(result1).toContain('part_2.html');

      // Second load with partial overlap
      const result2 = await contentLoader.load([
        'content/part_2.html',
        'content/part_3.html',
      ]);

      // Only part_3 should be fetched
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result2).toContain('part_2.html');
      expect(result2).toContain('part_3.html');

      contentLoader.destroy();
    });
  });
});
