/**
 * INTEGRATION TEST: BookController Lifecycle
 * Полный цикл: DI → делегаты → state machine → анимация → рендеринг → destroy.
 *
 * Проверяет, что BookController корректно собирает граф зависимостей,
 * инициализируется, проводит книгу через все состояния и корректно уничтожается.
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
import { ResizeHandler } from '../../../js/core/ResizeHandler.js';
import { SubscriptionManager } from '../../../js/core/SubscriptionManager.js';
import { EventEmitter } from '../../../js/utils/EventEmitter.js';
import { BookState, Direction } from '../../../js/config.js';
import { DelegateEvents } from '../../../js/core/delegates/BaseDelegate.js';
import { rateLimiters } from '../../../js/utils/RateLimiter.js';
import { flushPromises } from '../../helpers/testUtils.js';

// Mock CSS variables и announce
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

// Mock config с тестовыми главами
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
  return {
    ...actual,
    CONFIG,
    getConfig: () => CONFIG,
  };
});

describe('BookController Lifecycle', () => {
  let dom;
  let stateMachine;
  let contentLoader;
  let settingsManager;
  let lifecycleDelegate;
  let navigationDelegate;
  let settingsDelegate;
  let chapterDelegate;
  let mediator;
  let mockState;
  let mockRenderer;
  let mockPaginator;
  let flipAnimator;
  let storageMock;
  let mockSoundManager;
  let mockBackgroundManager;
  let mockDom;
  let mockDebugPanel;
  let mockAnnouncer;

  const createControllablePromise = () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  beforeEach(() => {
    dom = createFullBookDOM();

    rateLimiters.navigation.reset();
    rateLimiters.chapter.reset();

    const testContent = createChapterContent({ chapters: 2, paragraphsPerChapter: 5 });
    setupFetchMock(testContent);

    stateMachine = new BookStateMachine();

    let savedData = {};
    storageMock = {
      load: vi.fn(() => ({ ...savedData })),
      save: vi.fn((data) => { savedData = { ...savedData, ...data }; }),
      clear: vi.fn(() => { savedData = {}; }),
    };

    settingsManager = new SettingsManager(storageMock, {
      font: 'georgia', fontSize: 18, theme: 'light',
      page: 0, soundEnabled: true, soundVolume: 0.3,
      ambientType: 'none', ambientVolume: 0.5,
    });

    contentLoader = new ContentLoader();
    mockState = { index: 0, chapterStarts: [] };

    mockRenderer = {
      totalPages: 20,
      getMaxIndex: vi.fn().mockReturnValue(19),
      renderSpread: vi.fn(),
      clearCache: vi.fn(),
      prepareBuffer: vi.fn(),
      prepareSheet: vi.fn(),
      swapBuffers: vi.fn(),
      setPaginationData: vi.fn(),
    };

    mockPaginator = {
      paginate: vi.fn().mockResolvedValue({
        pageData: { sourceElement: document.createElement('div'), pageCount: 20, pageWidth: 400, pageHeight: 600 },
        chapterStarts: [0, 10],
      }),
    };

    flipAnimator = {
      runFlip: vi.fn(),
      runOpenAnimation: vi.fn().mockResolvedValue('completed'),
      finishOpenAnimation: vi.fn().mockResolvedValue(),
      runCloseAnimation: vi.fn().mockResolvedValue(),
      abort: vi.fn(),
      _swapCallback: null,
    };

    mockSoundManager = {
      play: vi.fn(),
      preload: vi.fn().mockResolvedValue(),
      setEnabled: vi.fn(),
      setVolume: vi.fn(),
    };

    mockBackgroundManager = {
      preload: vi.fn().mockResolvedValue(),
      setBackground: vi.fn(),
    };

    // Добавляем элементы для page counter
    const pageCounter = document.createElement('div');
    pageCounter.className = 'page-counter';
    const currentPageEl = document.createElement('span');
    currentPageEl.id = 'currentPage';
    const totalPagesEl = document.createElement('span');
    totalPagesEl.id = 'totalPages';
    pageCounter.appendChild(currentPageEl);
    pageCounter.appendChild(totalPagesEl);
    document.body.appendChild(pageCounter);

    const readingProgress = document.createElement('div');
    readingProgress.id = 'readingProgress';
    document.body.appendChild(readingProgress);

    const tocBtn = document.createElement('button');
    tocBtn.id = 'tocBtn';
    document.body.appendChild(tocBtn);

    mockDom = {
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

    mockDebugPanel = { update: vi.fn() };
    mockAnnouncer = {
      announcePage: vi.fn(),
      announceChapter: vi.fn(),
      announceLoading: vi.fn(),
      announceBookState: vi.fn(),
    };

    // ── Фаза 3: Создание делегатов (как делает BookControllerBuilder) ──
    lifecycleDelegate = new LifecycleDelegate({
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

    navigationDelegate = new NavigationDelegate({
      stateMachine,
      renderer: mockRenderer,
      animator: flipAnimator,
      settings: settingsManager,
      soundManager: mockSoundManager,
      mediaQueries: { isMobile: false },
      state: mockState,
    });

    settingsDelegate = new SettingsDelegate({
      dom: mockDom,
      settings: settingsManager,
      soundManager: mockSoundManager,
      ambientManager: { setVolume: vi.fn(), setType: vi.fn() },
      stateMachine,
    });

    chapterDelegate = new ChapterDelegate({
      backgroundManager: mockBackgroundManager,
      dom: mockDom,
      state: mockState,
    });

    // ── Фаза 4: Создание медиатора ──
    mediator = new DelegateMediator({
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
  });

  afterEach(() => {
    settingsManager?.destroy();
    stateMachine?.destroy();
    lifecycleDelegate?.destroy();
    navigationDelegate?.destroy();
    settingsDelegate?.destroy();
    chapterDelegate?.destroy();
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // ПОЛНЫЙ ЖИЗНЕННЫЙ ЦИКЛ
  // ═══════════════════════════════════════════

  describe('DI graph assembly', () => {
    it('should assemble all delegates with correct dependencies', () => {
      expect(lifecycleDelegate).toBeDefined();
      expect(navigationDelegate).toBeDefined();
      expect(settingsDelegate).toBeDefined();
      expect(chapterDelegate).toBeDefined();
      expect(mediator).toBeDefined();
    });

    it('should share state object between mediator and delegates', () => {
      // Медиатор и делегаты работают с одним и тем же state
      mediator.handleIndexChange(5);

      expect(mockState.index).toBe(5);
      expect(settingsManager.get('page')).toBe(5);
    });

    it('should wire delegate events to mediator correctly', () => {
      const pageData = { pageCount: 20, sourceElement: null };
      lifecycleDelegate.emit(DelegateEvents.PAGINATION_COMPLETE, {
        pageData,
        chapterStarts: [0, 10],
      });

      expect(mockRenderer.setPaginationData).toHaveBeenCalledWith(pageData);
      expect(mockState.chapterStarts).toEqual([0, 10]);
    });
  });

  describe('Full open → navigate → close cycle', () => {
    const openBook = async () => {
      await mediator.handleBookOpen(false);
      await flushPromises();
    };

    it('should open book: CLOSED → OPENING → OPENED', async () => {
      expect(stateMachine.state).toBe(BookState.CLOSED);

      await openBook();

      expect(stateMachine.state).toBe(BookState.OPENED);
      expect(flipAnimator.runOpenAnimation).toHaveBeenCalled();
      expect(mockPaginator.paginate).toHaveBeenCalled();
      expect(mockRenderer.renderSpread).toHaveBeenCalledWith(0, false);
    });

    it('should navigate: OPENED → FLIPPING → OPENED', async () => {
      await openBook();

      const fp = createControllablePromise();
      flipAnimator.runFlip.mockImplementation((dir, cb) => {
        flipAnimator._swapCallback = cb;
        return fp.promise;
      });

      const flipPromise = navigationDelegate.flip(Direction.NEXT);

      expect(stateMachine.state).toBe(BookState.FLIPPING);
      expect(mockRenderer.prepareBuffer).toHaveBeenCalled();
      expect(mockRenderer.prepareSheet).toHaveBeenCalled();

      // Завершаем анимацию
      if (flipAnimator._swapCallback) flipAnimator._swapCallback();
      fp.resolve();
      await flipPromise;

      expect(stateMachine.state).toBe(BookState.OPENED);
      expect(mockState.index).toBe(2); // desktop: step=2
    });

    it('should close book: OPENED → CLOSING → CLOSED', async () => {
      await openBook();

      await lifecycleDelegate.close();
      await flushPromises();

      expect(stateMachine.state).toBe(BookState.CLOSED);
      expect(flipAnimator.runCloseAnimation).toHaveBeenCalled();
      expect(mockRenderer.clearCache).toHaveBeenCalled();
    });

    it('should complete full cycle: open → flip 3 times → close', async () => {
      await openBook();
      expect(stateMachine.state).toBe(BookState.OPENED);

      // 3 перелистывания
      for (let i = 0; i < 3; i++) {
        rateLimiters.navigation.reset();

        const fp = createControllablePromise();
        flipAnimator.runFlip.mockImplementation((dir, cb) => {
          flipAnimator._swapCallback = cb;
          return fp.promise;
        });

        const flipPromise = navigationDelegate.flip(Direction.NEXT);
        if (flipAnimator._swapCallback) flipAnimator._swapCallback();
        fp.resolve();
        await flipPromise;
      }

      expect(mockState.index).toBe(6); // 3 * 2 (desktop step)
      expect(stateMachine.state).toBe(BookState.OPENED);

      // Закрытие
      await lifecycleDelegate.close();
      await flushPromises();

      expect(stateMachine.state).toBe(BookState.CLOSED);
    });
  });

  describe('State machine guards', () => {
    it('should not open book if already opening', async () => {
      // Ставим в OPENING
      stateMachine.transitionTo(BookState.OPENING);

      await lifecycleDelegate.open(0);

      // runOpenAnimation НЕ вызван повторно (isBusy=true)
      expect(flipAnimator.runOpenAnimation).not.toHaveBeenCalled();
    });

    it('should not flip when book is not opened', async () => {
      // Книга закрыта
      expect(stateMachine.isClosed).toBe(true);

      // flip(NEXT) на закрытой книге → emit BOOK_OPEN (не executeFlip)
      const openSpy = vi.fn();
      navigationDelegate.on(DelegateEvents.BOOK_OPEN, openSpy);

      await navigationDelegate.flip(Direction.NEXT);

      expect(openSpy).toHaveBeenCalled();
      expect(flipAnimator.runFlip).not.toHaveBeenCalled();
    });

    it('should not flip when animation is in progress', async () => {
      // Открываем книгу
      await mediator.handleBookOpen(false);
      await flushPromises();

      // Ставим в FLIPPING
      stateMachine.transitionTo(BookState.FLIPPING);

      await navigationDelegate.flip(Direction.NEXT);

      // Навигация не должна была начать новый flip
      expect(flipAnimator.runFlip).not.toHaveBeenCalled();
    });

    it('should not close book when already closing', async () => {
      await mediator.handleBookOpen(false);
      await flushPromises();

      stateMachine.transitionTo(BookState.CLOSING);

      await lifecycleDelegate.close();

      // runCloseAnimation НЕ вызван (isBusy=true)
      expect(flipAnimator.runCloseAnimation).not.toHaveBeenCalled();
    });
  });

  describe('Error recovery', () => {
    it('should recover to CLOSED on open animation failure', async () => {
      flipAnimator.runOpenAnimation.mockRejectedValueOnce(new Error('animation failed'));

      await mediator.handleBookOpen(false);
      await flushPromises();

      expect(stateMachine.state).toBe(BookState.CLOSED);
    });

    it('should recover to OPENED on flip error', async () => {
      await mediator.handleBookOpen(false);
      await flushPromises();

      flipAnimator.runFlip.mockRejectedValueOnce(new Error('flip failed'));

      await navigationDelegate.flip(Direction.NEXT);
      await flushPromises();

      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should recover to OPENED on close animation error', async () => {
      await mediator.handleBookOpen(false);
      await flushPromises();

      flipAnimator.runCloseAnimation.mockRejectedValueOnce(new Error('close failed'));

      await lifecycleDelegate.close();
      await flushPromises();

      // CLOSING → OPENED по recovery map (см. LifecycleDelegate._recoverToSafeState)
      expect(stateMachine.state).toBe(BookState.OPENED);
    });
  });

  describe('Destroy and cleanup', () => {
    it('should destroy all delegates without errors', async () => {
      await mediator.handleBookOpen(false);
      await flushPromises();

      expect(() => {
        lifecycleDelegate.destroy();
        navigationDelegate.destroy();
        settingsDelegate.destroy();
        chapterDelegate.destroy();
      }).not.toThrow();
    });

    it('should throw on use-after-free for lifecycle delegate', async () => {
      lifecycleDelegate.destroy();

      await expect(lifecycleDelegate.open(0)).rejects.toThrow(/use-after-free/);
    });

    it('should throw on use-after-free for navigation delegate', async () => {
      navigationDelegate.destroy();

      await expect(navigationDelegate.flip(Direction.NEXT)).rejects.toThrow(/use-after-free/);
    });

    it('should throw on use-after-free for lifecycle close', async () => {
      await mediator.handleBookOpen(false);
      await flushPromises();

      lifecycleDelegate.destroy();

      // Повторный close на уничтоженном делегате
      await expect(lifecycleDelegate.close()).rejects.toThrow(/use-after-free/);
    });
  });

  describe('Settings persistence across lifecycle', () => {
    it('should save page position during navigation', async () => {
      await mediator.handleBookOpen(false);
      await flushPromises();

      // Симулируем навигацию через mediator
      mediator.handleIndexChange(6);

      expect(settingsManager.get('page')).toBe(6);
      expect(storageMock.save).toHaveBeenCalled();
    });

    it('should restore page position on continue reading', async () => {
      // Устанавливаем сохранённую позицию
      settingsManager.set('page', 8);

      await mediator.handleBookOpen(true);
      await flushPromises();

      // startIndex должен быть 8
      expect(mockRenderer.renderSpread).toHaveBeenCalledWith(8, false);
    });

    it('should clamp restored position to max index', async () => {
      // Сохранённая позиция больше максимума
      settingsManager.set('page', 100);

      await mediator.handleBookOpen(true);
      await flushPromises();

      // Должна быть ограничена maxIndex (19)
      expect(mockRenderer.renderSpread).toHaveBeenCalledWith(
        expect.any(Number),
        false
      );
      const calledIndex = mockRenderer.renderSpread.mock.calls[0][0];
      expect(calledIndex).toBeLessThanOrEqual(19);
    });
  });
});
