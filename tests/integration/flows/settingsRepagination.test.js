/**
 * INTEGRATION TEST: Settings → Repagination
 * Тестирование изменения настроек (fontSize, font) с последующей репагинацией.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createFullBookDOM,
  cleanupIntegrationDOM,
  createChapterContent,
  setupFetchMock,
} from '../../helpers/integrationUtils.js';

import { BookStateMachine } from '../../../js/managers/BookStateMachine.js';
import { SettingsDelegate } from '../../../js/core/delegates/SettingsDelegate.js';
import { LifecycleDelegate } from '../../../js/core/delegates/LifecycleDelegate.js';
import { BookState } from '../../../js/config.js';
import { SettingsManager } from '../../../js/managers/SettingsManager.js';
import { DelegateEvents } from '../../../js/core/delegates/BaseDelegate.js';
import { ContentLoader } from '../../../js/managers/ContentLoader.js';

// Mock announce и cssVars, но сохраняем rateLimiters
vi.mock('../../../js/utils/index.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    cssVars: {
      getNumber: vi.fn((key, def) => def),
      getTime: vi.fn((key, def) => def),
      invalidateCache: vi.fn(),
    },
    announce: vi.fn(),
  };
});

describe('Settings → Repagination', () => {
  let dom;
  let stateMachine;
  let settingsDelegate;
  let lifecycleDelegate;
  let settingsManager;
  let contentLoader;
  let mockState;
  let mockRenderer;
  let mockPaginator;
  let repaginateCallCount;

  const createStorageMock = (data = {}) => ({
    load: vi.fn(() => ({ ...data })),
    save: vi.fn(),
    clear: vi.fn(),
  });

  beforeEach(() => {
    dom = createFullBookDOM();

    stateMachine = new BookStateMachine();
    contentLoader = new ContentLoader();

    const testContent = createChapterContent({ chapters: 2, paragraphsPerChapter: 3 });
    setupFetchMock(testContent);

    const storage = createStorageMock({
      font: 'georgia',
      fontSize: 18,
      theme: 'light',
      soundEnabled: true,
      soundVolume: 0.3,
      ambientType: 'none',
      ambientVolume: 0.5,
    });

    settingsManager = new SettingsManager(storage, {
      font: 'georgia',
      fontSize: 18,
      theme: 'light',
      soundEnabled: true,
      soundVolume: 0.3,
      ambientType: 'none',
      ambientVolume: 0.5,
    });

    mockState = {
      index: 10,
      chapterStarts: [0, 8],
    };

    mockRenderer = {
      getMaxIndex: vi.fn().mockReturnValue(20),
      renderSpread: vi.fn(),
      clearCache: vi.fn(),
    };

    mockPaginator = {
      paginate: vi.fn().mockResolvedValue({
        pageData: { sourceElement: document.createElement('div'), pageCount: 21, pageWidth: 400, pageHeight: 600 },
        chapterStarts: [0, 8],
      }),
    };

    const htmlEl = document.documentElement;

    settingsDelegate = new SettingsDelegate({
      dom: {
        get: (id) => {
          if (id === 'html') return htmlEl;
          return null;
        },
      },
      settings: settingsManager,
      soundManager: { setEnabled: vi.fn(), setVolume: vi.fn() },
      ambientManager: { setVolume: vi.fn(), setType: vi.fn() },
      stateMachine,
    });

    lifecycleDelegate = new LifecycleDelegate({
      stateMachine,
      backgroundManager: { preload: vi.fn().mockResolvedValue(), setBackground: vi.fn() },
      contentLoader,
      paginator: mockPaginator,
      renderer: mockRenderer,
      animator: {
        runOpenAnimation: vi.fn().mockResolvedValue('completed'),
        finishOpenAnimation: vi.fn().mockResolvedValue(),
        abort: vi.fn(),
      },
      loadingIndicator: { show: vi.fn(), hide: vi.fn() },
      soundManager: { play: vi.fn(), preload: vi.fn().mockResolvedValue() },
      mediaQueries: { isMobile: false },
      dom: {
        get: (id) => {
          const map = { book: dom.book, leftA: dom.leftA, rightA: dom.rightA };
          return map[id] || null;
        },
      },
      state: mockState,
    });

    // Wire delegates: settings REPAGINATE → lifecycle.repaginate
    repaginateCallCount = 0;
    settingsDelegate.on(DelegateEvents.REPAGINATE, async (keepIndex) => {
      repaginateCallCount++;
      await lifecycleDelegate.repaginate(keepIndex);
    });

    lifecycleDelegate.on(DelegateEvents.PAGINATION_COMPLETE, ({ pageData, chapterStarts }) => {
      mockState.chapterStarts = chapterStarts;
      mockRenderer.getMaxIndex.mockReturnValue(pageData.pageCount - 1);
    });

    lifecycleDelegate.on(DelegateEvents.INDEX_CHANGE, (index) => {
      mockState.index = index;
    });
  });

  afterEach(() => {
    settingsDelegate?.destroy();
    lifecycleDelegate?.destroy();
    settingsManager?.destroy();
    stateMachine?.destroy();
    contentLoader?.destroy();
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  describe('Font size change → repagination', () => {
    it('should trigger repagination when fontSize increases (book opened)', async () => {
      // Открываем книгу
      await lifecycleDelegate.open(0);
      mockState.index = 10;

      settingsDelegate.handleChange('fontSize', 'increase');

      // Ждём async repagination
      await vi.waitFor(() => {
        expect(repaginateCallCount).toBeGreaterThan(0);
      });
    });

    it('should trigger repagination when fontSize decreases', async () => {
      await lifecycleDelegate.open(0);
      mockState.index = 10;

      settingsDelegate.handleChange('fontSize', 'decrease');

      await vi.waitFor(() => {
        expect(repaginateCallCount).toBeGreaterThan(0);
      });
    });

    it('should NOT trigger repagination when fontSize at max', async () => {
      await lifecycleDelegate.open(0);
      settingsManager.set('fontSize', 22); // already at max

      settingsDelegate.handleChange('fontSize', 'increase');

      // Не должно быть вызвано repaginate
      expect(repaginateCallCount).toBe(0);
    });

    it('should NOT trigger repagination when fontSize at min', async () => {
      await lifecycleDelegate.open(0);
      settingsManager.set('fontSize', 14); // already at min

      settingsDelegate.handleChange('fontSize', 'decrease');

      expect(repaginateCallCount).toBe(0);
    });

    it('should update CSS variable on fontSize change', async () => {
      await lifecycleDelegate.open(0);

      settingsDelegate.handleChange('fontSize', 'increase');

      const html = document.documentElement;
      const fontSize = html.style.getPropertyValue('--reader-font-size');
      expect(fontSize).toBe('19px');
    });

    it('should preserve reading position after fontSize change', async () => {
      await lifecycleDelegate.open(0);
      mockState.index = 10;

      settingsDelegate.handleChange('fontSize', 'increase');

      await vi.waitFor(() => {
        expect(repaginateCallCount).toBeGreaterThan(0);
      });

      // Index should be preserved (or clamped to max)
      expect(mockState.index).toBeLessThanOrEqual(20);
    });
  });

  describe('Font change → repagination', () => {
    it('should trigger repagination when font changes', async () => {
      await lifecycleDelegate.open(0);
      mockState.index = 10;

      settingsDelegate.handleChange('font', 'merriweather');

      await vi.waitFor(() => {
        expect(repaginateCallCount).toBeGreaterThan(0);
      });
    });

    it('should update CSS variable on font change', async () => {
      await lifecycleDelegate.open(0);

      settingsDelegate.handleChange('font', 'inter');

      const html = document.documentElement;
      const fontFamily = html.style.getPropertyValue('--reader-font-family');
      expect(fontFamily).toContain('Inter');
    });

    it('should save new font to settings', async () => {
      await lifecycleDelegate.open(0);

      settingsDelegate.handleChange('font', 'roboto');

      expect(settingsManager.get('font')).toBe('roboto');
    });
  });

  describe('Theme change (no repagination)', () => {
    it('should NOT trigger repagination on theme change', async () => {
      await lifecycleDelegate.open(0);

      settingsDelegate.handleChange('theme', 'dark');

      expect(repaginateCallCount).toBe(0);
    });

    it('should update data-theme attribute', async () => {
      await lifecycleDelegate.open(0);

      settingsDelegate.handleChange('theme', 'dark');

      expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('should clear data-theme for light theme', async () => {
      await lifecycleDelegate.open(0);

      settingsDelegate.handleChange('theme', 'dark');
      settingsDelegate.handleChange('theme', 'light');

      expect(document.documentElement.dataset.theme).toBe('');
    });
  });

  describe('Settings when book is closed', () => {
    it('should NOT trigger repagination when book is closed', () => {
      // Книга закрыта (не открывали)
      settingsDelegate.handleChange('fontSize', 'increase');

      expect(repaginateCallCount).toBe(0);
    });

    it('should still save setting when book is closed', () => {
      settingsDelegate.handleChange('font', 'inter');

      expect(settingsManager.get('font')).toBe('inter');
    });
  });

  describe('apply() applies all settings at once', () => {
    it('should apply font, fontSize, and theme to DOM', () => {
      settingsDelegate.apply();

      const html = document.documentElement;
      expect(html.style.getPropertyValue('--reader-font-family')).toBeTruthy();
      expect(html.style.getPropertyValue('--reader-font-size')).toBe('18px');
    });
  });
});
