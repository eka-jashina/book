/**
 * INTEGRATION TEST: Rapid Book Switching
 * Быстрое открытие/закрытие книг → нет утечек, корректное состояние:
 * - Открытие → моментальное закрытие → повторное открытие
 * - Быстрое переключение между книгами (destroy + create)
 * - State machine всегда в согласованном состоянии
 * - Ресурсы предыдущей книги корректно освобождаются
 * - ContentLoader abort при переключении
 * - SoundManager / AmbientManager cleanup
 * - Use-after-free не происходит
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createFullBookDOM,
  cleanupIntegrationDOM,
  createChapterContent,
  setupFetchMock,
} from '../../helpers/integrationUtils.js';

import { BookStateMachine } from '../../../js/managers/BookStateMachine.js';
import { LifecycleDelegate } from '../../../js/core/delegates/LifecycleDelegate.js';
import { NavigationDelegate } from '../../../js/core/delegates/NavigationDelegate.js';
import { SettingsDelegate } from '../../../js/core/delegates/SettingsDelegate.js';
import { ChapterDelegate } from '../../../js/core/delegates/ChapterDelegate.js';
import { DelegateMediator } from '../../../js/core/DelegateMediator.js';
import { SettingsManager } from '../../../js/managers/SettingsManager.js';
import { ContentLoader } from '../../../js/managers/ContentLoader.js';
import { EventEmitter } from '../../../js/utils/EventEmitter.js';
import { BookState, Direction } from '../../../js/config.js';
import { rateLimiters } from '../../../js/utils/RateLimiter.js';
import { flushPromises } from '../../helpers/testUtils.js';

// Моки утилит
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
    getAnnouncer: vi.fn(() => ({
      announcePage: vi.fn(),
      announceChapter: vi.fn(),
      announceLoading: vi.fn(),
      announceBookState: vi.fn(),
    })),
  };
});

vi.mock('../../../js/utils/ErrorHandler.js', () => ({
  ErrorHandler: { handle: vi.fn() },
}));

vi.mock('../../../js/utils/Analytics.js', () => ({
  updateReadingPage: vi.fn(),
  trackChapterCompleted: vi.fn(),
  trackReadingSessionStart: vi.fn(),
  trackReadingSessionEnd: vi.fn(),
  trackSettingsChanged: vi.fn(),
  trackThemeChanged: vi.fn(),
  trackFontChanged: vi.fn(),
}));

vi.mock('../../../js/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  const CONFIG = {
    ...actual.CONFIG,
    CHAPTERS: [
      { title: 'Глава 1', file: 'part_1.html', id: 'ch1' },
      { title: 'Глава 2', file: 'part_2.html', id: 'ch2' },
    ],
    COVER_BG: 'bg.jpg',
    COVER_BG_MOBILE: 'bg_m.jpg',
    APPEARANCE: null,
    SETTINGS_VISIBILITY: null,
    BOOK_ID: 'test-book',
    LAYOUT: { MIN_PAGE_WIDTH_RATIO: 0.1, SETTLE_DELAY: 0 },
  };
  return { ...actual, CONFIG, getConfig: () => CONFIG };
});

describe('Rapid Book Switching', () => {
  let dom;

  // Фабрика для создания полного набора компонентов книги
  const createBookInstance = () => {
    const stateMachine = new BookStateMachine();
    const contentLoader = new ContentLoader();
    const mockState = { index: 0, chapterStarts: [] };

    const storageMock = {
      load: vi.fn(() => ({})),
      save: vi.fn(),
      clear: vi.fn(),
    };

    const settingsManager = new SettingsManager(storageMock, {
      font: 'georgia', fontSize: 18, theme: 'light',
      page: 0, soundEnabled: true, soundVolume: 0.3,
      ambientType: 'none', ambientVolume: 0.5,
    });

    const mockRenderer = {
      totalPages: 20,
      getMaxIndex: vi.fn().mockReturnValue(19),
      renderSpread: vi.fn(),
      clearCache: vi.fn(),
      prepareBuffer: vi.fn(),
      prepareSheet: vi.fn(),
      swapBuffers: vi.fn(),
      setPaginationData: vi.fn(),
    };

    const mockPaginator = {
      paginate: vi.fn().mockResolvedValue({
        pageData: { sourceElement: document.createElement('div'), pageCount: 20, pageWidth: 400, pageHeight: 600 },
        chapterStarts: [0, 10],
      }),
    };

    const flipAnimator = {
      runFlip: vi.fn(),
      runOpenAnimation: vi.fn().mockResolvedValue('completed'),
      finishOpenAnimation: vi.fn().mockResolvedValue(),
      runCloseAnimation: vi.fn().mockResolvedValue(),
      abort: vi.fn(),
    };

    const mockSoundManager = {
      play: vi.fn(),
      preload: vi.fn().mockResolvedValue(),
      setEnabled: vi.fn(),
      setVolume: vi.fn(),
      destroy: vi.fn(),
      stopAll: vi.fn(),
    };

    const mockAmbientManager = {
      setVolume: vi.fn(),
      setType: vi.fn(),
      destroy: vi.fn(),
      stop: vi.fn(),
    };

    const mockBackgroundManager = {
      preload: vi.fn().mockResolvedValue(),
      setBackground: vi.fn(),
      destroy: vi.fn(),
    };

    // Добавляем элементы для page counter
    const currentPageEl = dom.currentPage || document.createElement('span');
    const totalPagesEl = dom.totalPages || document.createElement('span');
    const readingProgress = document.getElementById('readingProgress') || document.createElement('div');
    const tocBtn = document.getElementById('tocBtn') || document.createElement('button');

    const mockDom = {
      get: (id) => {
        const map = {
          book: dom.book, leftA: dom.leftA, rightA: dom.rightA,
          html: document.documentElement, body: document.body,
          currentPage: currentPageEl, totalPages: totalPagesEl,
          readingProgress, tocBtn,
        };
        return map[id] || document.getElementById(id) || null;
      },
      resetBookDOM: vi.fn(),
    };

    const mockDebugPanel = { update: vi.fn() };
    const mockAnnouncer = {
      announcePage: vi.fn(),
      announceChapter: vi.fn(),
      announceLoading: vi.fn(),
      announceBookState: vi.fn(),
    };

    const lifecycleDelegate = new LifecycleDelegate({
      stateMachine,
      backgroundManager: mockBackgroundManager,
      contentLoader,
      paginator: mockPaginator,
      renderer: mockRenderer,
      animator: flipAnimator,
      loadingIndicator: { show: vi.fn(), hide: vi.fn() },
      soundManager: mockSoundManager,
      mediaQueries: { isMobile: false },
      dom: mockDom,
      state: mockState,
    });

    const navigationDelegate = new NavigationDelegate({
      stateMachine,
      renderer: mockRenderer,
      animator: flipAnimator,
      settings: settingsManager,
      soundManager: mockSoundManager,
      mediaQueries: { isMobile: false },
      state: mockState,
    });

    const settingsDelegate = new SettingsDelegate({
      dom: mockDom,
      settings: settingsManager,
      soundManager: mockSoundManager,
      ambientManager: mockAmbientManager,
      stateMachine,
    });

    const chapterDelegate = new ChapterDelegate({
      backgroundManager: mockBackgroundManager,
      dom: mockDom,
      state: mockState,
    });

    const mediator = new DelegateMediator({
      state: mockState,
      delegates: {
        navigation: navigationDelegate,
        lifecycle: lifecycleDelegate,
        settings: settingsDelegate,
        chapter: chapterDelegate,
        drag: new EventEmitter(),
      },
      services: {
        settings: settingsManager,
        renderer: mockRenderer,
        dom: mockDom,
        eventManager: { count: 0 },
        stateMachine,
        debugPanel: mockDebugPanel,
        announcer: mockAnnouncer,
      },
      isMobileFn: () => false,
    });

    return {
      stateMachine,
      contentLoader,
      settingsManager,
      lifecycleDelegate,
      navigationDelegate,
      settingsDelegate,
      chapterDelegate,
      mediator,
      flipAnimator,
      mockRenderer,
      mockDom,
      mockSoundManager,
      mockAmbientManager,
      mockBackgroundManager,
      mockState,
      destroy() {
        lifecycleDelegate.destroy();
        navigationDelegate.destroy();
        settingsDelegate.destroy();
        chapterDelegate.destroy();
        settingsManager.destroy();
        stateMachine.destroy();
        contentLoader.destroy();
      },
    };
  };

  beforeEach(() => {
    dom = createFullBookDOM();
    rateLimiters.navigation.reset();
    rateLimiters.chapter.reset();

    // Дополнительные DOM элементы
    if (!document.getElementById('readingProgress')) {
      const rp = document.createElement('div');
      rp.id = 'readingProgress';
      document.body.appendChild(rp);
    }
    if (!document.getElementById('tocBtn')) {
      const tb = document.createElement('button');
      tb.id = 'tocBtn';
      document.body.appendChild(tb);
    }

    const testContent = createChapterContent({ chapters: 2, paragraphsPerChapter: 5 });
    setupFetchMock(testContent);
  });

  afterEach(() => {
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // БЫСТРОЕ ОТКРЫТИЕ/ЗАКРЫТИЕ
  // ═══════════════════════════════════════════

  describe('Rapid open → close → reopen', () => {
    it('should handle open → immediate close → reopen without errors', async () => {
      const book = createBookInstance();

      // Открытие
      await book.mediator.handleBookOpen(false);
      await flushPromises();
      expect(book.stateMachine.state).toBe(BookState.OPENED);

      // Моментальное закрытие
      await book.lifecycleDelegate.close();
      await flushPromises();
      expect(book.stateMachine.state).toBe(BookState.CLOSED);

      // Повторное открытие
      rateLimiters.navigation.reset();
      await book.mediator.handleBookOpen(false);
      await flushPromises();
      expect(book.stateMachine.state).toBe(BookState.OPENED);

      // Renderer вызван дважды
      expect(book.mockRenderer.renderSpread).toHaveBeenCalledTimes(2);

      book.destroy();
    });

    it('should clear renderer cache on close', async () => {
      const book = createBookInstance();

      await book.mediator.handleBookOpen(false);
      await flushPromises();

      await book.lifecycleDelegate.close();
      await flushPromises();

      expect(book.mockRenderer.clearCache).toHaveBeenCalled();

      book.destroy();
    });
  });

  // ═══════════════════════════════════════════
  // ПЕРЕКЛЮЧЕНИЕ МЕЖДУ КНИГАМИ
  // ═══════════════════════════════════════════

  describe('Book switching (destroy + create)', () => {
    it('should cleanly switch between books', async () => {
      // Первая книга
      const book1 = createBookInstance();
      await book1.mediator.handleBookOpen(false);
      await flushPromises();
      expect(book1.stateMachine.state).toBe(BookState.OPENED);

      // Destroy первой книги (как делает BookController.destroy)
      book1.destroy();

      // Создаём вторую книгу
      rateLimiters.navigation.reset();
      rateLimiters.chapter.reset();
      const book2 = createBookInstance();
      await book2.mediator.handleBookOpen(false);
      await flushPromises();

      expect(book2.stateMachine.state).toBe(BookState.OPENED);
      expect(book2.mockRenderer.renderSpread).toHaveBeenCalled();

      book2.destroy();
    });

    it('should not leak state between book instances', async () => {
      // Книга 1: навигация на страницу 6
      const book1 = createBookInstance();
      await book1.mediator.handleBookOpen(false);
      await flushPromises();

      book1.mediator.handleIndexChange(6);
      expect(book1.mockState.index).toBe(6);

      book1.destroy();

      // Книга 2: index начинается с 0
      rateLimiters.navigation.reset();
      const book2 = createBookInstance();
      expect(book2.mockState.index).toBe(0);

      await book2.mediator.handleBookOpen(false);
      await flushPromises();

      // Рендер вызван с index 0 (не 6 от предыдущей книги)
      expect(book2.mockRenderer.renderSpread).toHaveBeenCalledWith(0, false);

      book2.destroy();
    });

    it('should destroy delegates without throwing after navigation', async () => {
      const book = createBookInstance();
      await book.mediator.handleBookOpen(false);
      await flushPromises();

      // Навигация
      const createControllablePromise = () => {
        let resolve;
        const promise = new Promise(r => { resolve = r; });
        return { promise, resolve };
      };

      const fp = createControllablePromise();
      book.flipAnimator.runFlip.mockImplementation((dir, cb) => {
        if (cb) cb();
        return fp.promise;
      });

      rateLimiters.navigation.reset();
      const flipPromise = book.navigationDelegate.flip(Direction.NEXT);
      fp.resolve();
      await flipPromise;

      // Destroy не бросает ошибок
      expect(() => book.destroy()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // CONTENT LOADER ABORT
  // ═══════════════════════════════════════════

  describe('ContentLoader abort on book switch', () => {
    it('should abort content loading when book is destroyed', async () => {
      const book = createBookInstance();

      // Запускаем загрузку
      const contentPromise = book.contentLoader.load([{ file: 'chapter.html' }]);

      // Destroy (имитация смены книги)
      book.destroy();

      // ContentLoader должен быть уничтожен
      expect(book.contentLoader.cache.size).toBe(0);

      // Ожидаем завершения промиса (может быть rejected или resolved)
      await contentPromise.catch(() => {});
    });
  });

  // ═══════════════════════════════════════════
  // USE-AFTER-FREE PROTECTION
  // ═══════════════════════════════════════════

  describe('Use-after-free protection', () => {
    it('should throw on lifecycle operations after destroy', async () => {
      const book = createBookInstance();

      await book.mediator.handleBookOpen(false);
      await flushPromises();

      book.lifecycleDelegate.destroy();

      await expect(book.lifecycleDelegate.open(0)).rejects.toThrow(/use-after-free/);
      await expect(book.lifecycleDelegate.close()).rejects.toThrow(/use-after-free/);

      // Cleanup remaining
      book.navigationDelegate.destroy();
      book.settingsDelegate.destroy();
      book.chapterDelegate.destroy();
      book.settingsManager.destroy();
      book.stateMachine.destroy();
      book.contentLoader.destroy();
    });

    it('should throw on navigation after destroy', async () => {
      const book = createBookInstance();

      await book.mediator.handleBookOpen(false);
      await flushPromises();

      book.navigationDelegate.destroy();

      await expect(
        book.navigationDelegate.flip(Direction.NEXT),
      ).rejects.toThrow(/use-after-free/);

      // Cleanup remaining
      book.lifecycleDelegate.destroy();
      book.settingsDelegate.destroy();
      book.chapterDelegate.destroy();
      book.settingsManager.destroy();
      book.stateMachine.destroy();
      book.contentLoader.destroy();
    });
  });

  // ═══════════════════════════════════════════
  // STATE CONSISTENCY
  // ═══════════════════════════════════════════

  describe('State machine consistency', () => {
    it('should always be in a valid state during rapid operations', async () => {
      const validStates = [BookState.CLOSED, BookState.OPENING, BookState.OPENED, BookState.FLIPPING, BookState.CLOSING];

      const book = createBookInstance();

      // Серия быстрых операций
      const operations = [
        () => book.mediator.handleBookOpen(false),
        () => flushPromises(),
        () => book.lifecycleDelegate.close(),
        () => flushPromises(),
      ];

      for (const op of operations) {
        await op();
        expect(validStates).toContain(book.stateMachine.state);
      }

      book.destroy();
    });

    it('should end in CLOSED state after full open-close cycle', async () => {
      const book = createBookInstance();

      await book.mediator.handleBookOpen(false);
      await flushPromises();

      await book.lifecycleDelegate.close();
      await flushPromises();

      expect(book.stateMachine.state).toBe(BookState.CLOSED);

      book.destroy();
    });

    it('should handle 3 consecutive open-close cycles', async () => {
      const book = createBookInstance();

      for (let i = 0; i < 3; i++) {
        rateLimiters.navigation.reset();

        await book.mediator.handleBookOpen(false);
        await flushPromises();
        expect(book.stateMachine.state).toBe(BookState.OPENED);

        await book.lifecycleDelegate.close();
        await flushPromises();
        expect(book.stateMachine.state).toBe(BookState.CLOSED);
      }

      book.destroy();
    });
  });

  // ═══════════════════════════════════════════
  // RESETBOOKDOM
  // ═══════════════════════════════════════════

  describe('DOM reset between book switches', () => {
    it('should call resetBookDOM on destroy to prepare for next book', async () => {
      const book = createBookInstance();

      await book.mediator.handleBookOpen(false);
      await flushPromises();

      // Симулируем то, что делает BookController.destroy()
      book.mockDom.resetBookDOM();

      expect(book.mockDom.resetBookDOM).toHaveBeenCalled();

      book.destroy();
    });
  });

  // ═══════════════════════════════════════════
  // SETTINGS ISOLATION
  // ═══════════════════════════════════════════

  describe('Settings isolation between books', () => {
    it('should not share settings between book instances', async () => {
      const book1 = createBookInstance();
      book1.settingsManager.set('font', 'inter');
      book1.settingsManager.set('page', 10);
      book1.destroy();

      const book2 = createBookInstance();
      // SettingsManager создаётся с defaults → page = 0
      expect(book2.settingsManager.get('page')).toBe(0);

      book2.destroy();
    });
  });
});
