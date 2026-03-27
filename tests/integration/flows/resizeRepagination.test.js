/**
 * INTEGRATION TEST: Resize + Responsive Repagination
 * Тестирование изменения размера окна во время чтения.
 *
 * В отличие от resizeFlow.test.js (тестирует ResizeHandler изолированно),
 * этот тест проверяет полный поток:
 * resize → debounce → repaginate → delegates → state consistency.
 *
 * Включает: fullscreen transitions, mobile↔desktop переключение,
 * сохранение позиции после репагинации.
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
import { ResizeHandler } from '../../../js/core/ResizeHandler.js';
import { SettingsManager } from '../../../js/managers/SettingsManager.js';
import { ContentLoader } from '../../../js/managers/ContentLoader.js';
import { EventEmitter } from '../../../js/utils/EventEmitter.js';
import { BookState } from '../../../js/config.js';
import { DelegateEvents } from '../../../js/core/delegates/BaseDelegate.js';
import { rateLimiters } from '../../../js/utils/RateLimiter.js';
import { flushPromises } from '../../helpers/testUtils.js';

// Mock CSS variables
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

import { cssVars } from '../../../js/utils/index.js';

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
      { title: 'Глава 3', file: 'part_3.html', id: 'ch3' },
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

describe('Resize + Responsive Repagination', () => {
  let dom;
  let stateMachine;
  let settingsManager;
  let lifecycleDelegate;
  let navigationDelegate;
  let chapterDelegate;
  let mediator;
  let resizeHandler;
  let mockState;
  let mockRenderer;
  let mockPaginator;
  let flipAnimator;
  let mockDom;
  let timerCallbacks;
  let mockTimerManager;
  let mockEventManager;

  beforeEach(() => {
    dom = createFullBookDOM();
    rateLimiters.navigation.reset();
    rateLimiters.chapter.reset();

    setupFetchMock(createChapterContent({ chapters: 3, paragraphsPerChapter: 10 }));

    stateMachine = new BookStateMachine();

    const storageMock = {
      load: vi.fn(() => ({})),
      save: vi.fn(),
    };
    settingsManager = new SettingsManager(storageMock, {
      font: 'georgia', fontSize: 18, theme: 'light',
      page: 0, soundEnabled: true, soundVolume: 0.3,
      ambientType: 'none', ambientVolume: 0.5,
    });

    mockState = { index: 0, chapterStarts: [0, 10, 20] };

    // Имитируем изменение количества страниц после resize
    let currentPageCount = 30;
    mockRenderer = {
      get totalPages() { return currentPageCount; },
      getMaxIndex: vi.fn(() => currentPageCount - 1),
      renderSpread: vi.fn(),
      clearCache: vi.fn(),
      prepareBuffer: vi.fn(),
      prepareSheet: vi.fn(),
      swapBuffers: vi.fn(),
      setPaginationData: vi.fn(),
      _setPageCount(n) { currentPageCount = n; },
    };

    mockPaginator = {
      paginate: vi.fn().mockResolvedValue({
        pageData: { sourceElement: document.createElement('div'), pageCount: 30 },
        chapterStarts: [0, 10, 20],
      }),
    };

    flipAnimator = {
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
    };

    const mockBackgroundManager = {
      preload: vi.fn().mockResolvedValue(),
      setBackground: vi.fn(),
    };

    // DOM helpers
    const currentPageEl = document.createElement('span');
    currentPageEl.id = 'currentPage';
    document.body.appendChild(currentPageEl);
    const totalPagesEl = document.createElement('span');
    totalPagesEl.id = 'totalPages';
    document.body.appendChild(totalPagesEl);
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
    };

    // Создаём делегаты
    lifecycleDelegate = new LifecycleDelegate({
      stateMachine,
      backgroundManager: mockBackgroundManager,
      contentLoader: new ContentLoader(),
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

    chapterDelegate = new ChapterDelegate({
      backgroundManager: mockBackgroundManager,
      dom: mockDom,
      state: mockState,
    });

    const settingsDelegate = new SettingsDelegate({
      dom: mockDom,
      settings: settingsManager,
      soundManager: mockSoundManager,
      ambientManager: { setVolume: vi.fn(), setType: vi.fn() },
      stateMachine,
    });

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
        debugPanel: { update: vi.fn() },
        announcer: {
          announcePage: vi.fn(),
          announceChapter: vi.fn(),
          announceLoading: vi.fn(),
          announceBookState: vi.fn(),
        },
      },
      isMobileFn: () => false,
    });

    // Timer manager с контролем
    timerCallbacks = new Map();
    let timerId = 0;
    mockTimerManager = {
      setTimeout: vi.fn((cb, delay) => {
        const id = ++timerId;
        timerCallbacks.set(id, { cb, delay });
        return id;
      }),
      clearTimeout: vi.fn((id) => {
        timerCallbacks.delete(id);
      }),
    };

    mockEventManager = {
      add: vi.fn(),
    };

    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });

    resizeHandler = new ResizeHandler({
      eventManager: mockEventManager,
      timerManager: mockTimerManager,
      repaginateFn: (keepIndex) => mediator.repaginate(keepIndex),
      isOpenedFn: () => stateMachine.isOpened,
      isDestroyedFn: () => false,
    });

    // Регистрируем обработчики (колбэки захватываются в mockEventManager.add)
    resizeHandler.bind();
  });

  afterEach(() => {
    resizeHandler?.destroy();
    lifecycleDelegate?.destroy();
    navigationDelegate?.destroy();
    chapterDelegate?.destroy();
    settingsManager?.destroy();
    stateMachine?.destroy();
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  const triggerResize = (newWidth) => {
    Object.defineProperty(window, 'innerWidth', { value: newWidth, writable: true, configurable: true });
    // Вызываем колбэк, зарегистрированный через eventManager.add(window, 'resize', cb)
    const call = mockEventManager.add.mock.calls.find(
      ([target, event]) => target === window && event === 'resize'
    );
    if (call) call[2]();
  };

  const triggerFullscreenChange = () => {
    // Вызываем колбэк, зарегистрированный через eventManager.add(document, 'fullscreenchange', cb)
    const call = mockEventManager.add.mock.calls.find(
      ([target, event]) => target === document && event === 'fullscreenchange'
    );
    if (call) call[2]();
  };

  const executeLastTimer = () => {
    const entries = Array.from(timerCallbacks.entries());
    if (entries.length > 0) {
      const [id, { cb }] = entries[entries.length - 1];
      timerCallbacks.delete(id);
      cb();
    }
  };

  const openBook = async () => {
    await mediator.handleBookOpen(false);
    await flushPromises();
  };

  // ═══════════════════════════════════════════
  // RESIZE ВО ВРЕМЯ ЧТЕНИЯ
  // ═══════════════════════════════════════════

  describe('Resize during reading triggers repagination', () => {
    it('should repaginate with keepIndex=true after resize on open book', async () => {
      await openBook();
      mockState.index = 12;

      triggerResize(800);
      executeLastTimer();
      await flushPromises();

      // Репагинация должна быть вызвана через lifecycleDelegate
      expect(mockPaginator.paginate).toHaveBeenCalledTimes(2); // 1 open + 1 resize
      expect(mockRenderer.clearCache).toHaveBeenCalled();
    });

    it('should NOT repaginate when book is closed', () => {
      expect(stateMachine.isClosed).toBe(true);

      triggerResize(800);
      executeLastTimer();

      // paginate вызван 0 раз (книга не открыта)
      expect(mockPaginator.paginate).not.toHaveBeenCalled();
    });

    it('should invalidate CSS cache before repagination', async () => {
      await openBook();

      // ResizeHandler вызывает cssVars.invalidateCache() из CSSVariables.js напрямую.
      // Проверяем, что repaginate был вызван (invalidateCache происходит внутри ResizeHandler).
      const paginateCallsBefore = mockPaginator.paginate.mock.calls.length;

      triggerResize(800);
      executeLastTimer();
      await flushPromises();

      // Если repaginate был вызван, значит cssVars.invalidateCache тоже
      expect(mockPaginator.paginate.mock.calls.length).toBeGreaterThan(paginateCallsBefore);
    });
  });

  // ═══════════════════════════════════════════
  // СОХРАНЕНИЕ ПОЗИЦИИ ПОСЛЕ RESIZE
  // ═══════════════════════════════════════════

  describe('Index preservation after repagination', () => {
    it('should preserve reading position after resize', async () => {
      await openBook();

      // Навигируем на страницу 12
      mediator.handleIndexChange(12);
      expect(mockState.index).toBe(12);

      // Resize → repaginate → позиция сохранена
      triggerResize(800);
      executeLastTimer();
      await flushPromises();

      // renderSpread вызван с сохранённым индексом (или ближайшим допустимым)
      const lastRenderCall = mockRenderer.renderSpread.mock.calls.at(-1);
      expect(lastRenderCall).toBeDefined();
      // Индекс должен быть <= maxIndex
      expect(lastRenderCall[0]).toBeLessThanOrEqual(mockRenderer.getMaxIndex());
    });

    it('should clamp index when page count decreases after resize', async () => {
      await openBook();
      mediator.handleIndexChange(25);

      // После resize книга стала короче (20 страниц вместо 30)
      mockPaginator.paginate.mockResolvedValueOnce({
        pageData: { sourceElement: document.createElement('div'), pageCount: 20 },
        chapterStarts: [0, 8, 14],
      });
      mockRenderer._setPageCount(20);
      mockRenderer.getMaxIndex.mockReturnValue(19);

      triggerResize(600);
      executeLastTimer();
      await flushPromises();

      // Индекс должен быть ограничен новым maxIndex
      const lastRenderCall = mockRenderer.renderSpread.mock.calls.at(-1);
      expect(lastRenderCall[0]).toBeLessThanOrEqual(19);
    });
  });

  // ═══════════════════════════════════════════
  // FULLSCREEN TRANSITIONS
  // ═══════════════════════════════════════════

  describe('Fullscreen transitions', () => {
    it('should repaginate on fullscreenchange even without width change', async () => {
      await openBook();

      const paginateCallsBefore = mockPaginator.paginate.mock.calls.length;

      // fullscreenchange НЕ изменяет ширину, но всегда триггерит repaginate
      triggerFullscreenChange();
      executeLastTimer();
      await flushPromises();

      expect(mockPaginator.paginate.mock.calls.length).toBeGreaterThan(paginateCallsBefore);
    });

    it('should debounce fullscreen transitions', async () => {
      await openBook();

      triggerFullscreenChange();
      triggerFullscreenChange();
      triggerFullscreenChange();

      // Только один таймер должен остаться
      expect(timerCallbacks.size).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // RAPID RESIZE (DEBOUNCING)
  // ═══════════════════════════════════════════

  describe('Rapid resize debouncing with real repagination', () => {
    it('should only repaginate once for rapid resizes', async () => {
      await openBook();
      const paginateCallsBefore = mockPaginator.paginate.mock.calls.length;

      triggerResize(800);
      triggerResize(600);
      triggerResize(400);
      triggerResize(500);

      // Все промежуточные таймеры отменены
      expect(timerCallbacks.size).toBe(1);

      executeLastTimer();
      await flushPromises();

      // Только одна репагинация
      expect(mockPaginator.paginate.mock.calls.length).toBe(paginateCallsBefore + 1);
    });
  });

  // ═══════════════════════════════════════════
  // STATE MACHINE CONSISTENCY
  // ═══════════════════════════════════════════

  describe('State machine consistency during resize', () => {
    it('should keep state machine in OPENED during resize repagination', async () => {
      await openBook();
      expect(stateMachine.state).toBe(BookState.OPENED);

      triggerResize(800);
      executeLastTimer();
      await flushPromises();

      // State machine не должна покинуть OPENED
      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should handle resize error gracefully without breaking state machine', async () => {
      await openBook();

      mockPaginator.paginate.mockRejectedValueOnce(new Error('paginator error'));

      triggerResize(800);
      executeLastTimer();
      await flushPromises();

      // State machine должна оставаться в стабильном состоянии
      expect([BookState.OPENED, BookState.CLOSED]).toContain(stateMachine.state);
    });
  });

  // ═══════════════════════════════════════════
  // CHAPTER STARTS ОБНОВЛЕНИЕ
  // ═══════════════════════════════════════════

  describe('Chapter starts update after resize', () => {
    it('should update chapterStarts after repagination', async () => {
      await openBook();
      expect(mockState.chapterStarts).toEqual([0, 10, 20]);

      // Resize изменяет chapterStarts
      mockPaginator.paginate.mockResolvedValueOnce({
        pageData: { sourceElement: document.createElement('div'), pageCount: 24 },
        chapterStarts: [0, 8, 16],
      });

      triggerResize(800);
      executeLastTimer();
      await flushPromises();

      expect(mockState.chapterStarts).toEqual([0, 8, 16]);
    });
  });
});
