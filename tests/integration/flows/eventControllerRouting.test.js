/**
 * INTEGRATION TEST: EventController Routing
 * Маршрутизация событий: EventController → делегаты → state machine → mediator.
 *
 * В отличие от events.test.js (тестирует EventController с мок-коллбэками),
 * этот тест проверяет полную цепочку: пользовательский ввод → EventController →
 * реальные делегаты → state machine → обновление состояния через DelegateMediator.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createFullBookDOM,
  cleanupIntegrationDOM,
  createChapterContent,
  setupFetchMock,
} from '../../helpers/integrationUtils.js';

import { EventController } from '../../../js/core/EventController.js';
import { EventListenerManager } from '../../../js/utils/EventListenerManager.js';
import { BookStateMachine } from '../../../js/managers/BookStateMachine.js';
import { NavigationDelegate } from '../../../js/core/delegates/NavigationDelegate.js';
import { LifecycleDelegate } from '../../../js/core/delegates/LifecycleDelegate.js';
import { SettingsDelegate } from '../../../js/core/delegates/SettingsDelegate.js';
import { ChapterDelegate } from '../../../js/core/delegates/ChapterDelegate.js';
import { DelegateMediator } from '../../../js/core/DelegateMediator.js';
import { SettingsManager } from '../../../js/managers/SettingsManager.js';
import { ContentLoader } from '../../../js/managers/ContentLoader.js';
import { EventEmitter } from '../../../js/utils/EventEmitter.js';
import { BookState, Direction } from '../../../js/config.js';
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

vi.mock('../../../js/utils/ErrorHandler.js', () => ({
  ErrorHandler: { handle: vi.fn() },
}));

vi.mock('../../../js/utils/Analytics.js', () => ({
  updateReadingPage: vi.fn(),
  trackChapterCompleted: vi.fn(),
  trackReadingSessionStart: vi.fn(),
  trackReadingSessionEnd: vi.fn(),
  trackFontChanged: vi.fn(),
  trackThemeChanged: vi.fn(),
  trackFontSizeChanged: vi.fn(),
  trackSoundToggle: vi.fn(),
  trackAmbientChanged: vi.fn(),
  trackSettingsChanged: vi.fn(),
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

describe('EventController → Delegate Routing', () => {
  let dom;
  let eventManager;
  let eventController;
  let stateMachine;
  let settingsManager;
  let navigationDelegate;
  let lifecycleDelegate;
  let settingsDelegate;
  let chapterDelegate;
  let mediator;
  let mockState;
  let mockRenderer;
  let flipAnimator;
  let mockDom;
  let bookElement;

  const createControllablePromise = () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };

  /**
   * Открыть книгу, чтобы тесты навигации могли перелистывать
   */
  const openBookForTesting = async () => {
    await mediator.handleBookOpen(false);
    await flushPromises();
  };

  beforeEach(() => {
    dom = createFullBookDOM();

    rateLimiters.navigation.reset();
    rateLimiters.chapter.reset();

    setupFetchMock(createChapterContent({ chapters: 2 }));

    eventManager = new EventListenerManager();
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

    mockState = { index: 0, chapterStarts: [0, 10] };

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

    flipAnimator = {
      runFlip: vi.fn(),
      runOpenAnimation: vi.fn().mockResolvedValue('completed'),
      finishOpenAnimation: vi.fn().mockResolvedValue(),
      runCloseAnimation: vi.fn().mockResolvedValue(),
      abort: vi.fn(),
      _swapCallback: null,
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

    // DOM-элементы для UI
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
    };

    const mockDebugPanel = { update: vi.fn() };
    const mockAnnouncer = {
      announcePage: vi.fn(),
      announceChapter: vi.fn(),
      announceLoading: vi.fn(),
      announceBookState: vi.fn(),
    };

    lifecycleDelegate = new LifecycleDelegate({
      stateMachine,
      backgroundManager: mockBackgroundManager,
      contentLoader: new ContentLoader(),
      paginator: {
        paginate: vi.fn().mockResolvedValue({
          pageData: { sourceElement: document.createElement('div'), pageCount: 20 },
          chapterStarts: [0, 10],
        }),
      },
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

    // Собираем EventController с реальными делегатами
    bookElement = dom.book;

    eventController = new EventController({
      book: bookElement,
      eventManager,
      onFlip: (dir) => navigationDelegate.flip(dir),
      onTOCClick: (ch) => navigationDelegate.handleTOCNavigation(ch),
      onOpen: (cont) => mediator.handleBookOpen(cont),
      onSettings: (k, v) => settingsDelegate.handleChange(k, v),
      isBusy: () => stateMachine.isBusy,
      isOpened: () => stateMachine.isOpened,
      getFontSize: () => settingsManager.get('fontSize'),
    });
  });

  afterEach(() => {
    eventController?.destroy();
    eventManager?.clear();
    lifecycleDelegate?.destroy();
    navigationDelegate?.destroy();
    settingsDelegate?.destroy();
    chapterDelegate?.destroy();
    settingsManager?.destroy();
    stateMachine?.destroy();
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // KEYBOARD → NAVIGATION → STATE MACHINE
  // ═══════════════════════════════════════════

  describe('Keyboard → NavigationDelegate → StateMachine', () => {
    beforeEach(() => {
      eventController.bind({});
    });

    it('ArrowRight on closed book should trigger BOOK_OPEN event', async () => {
      expect(stateMachine.isClosed).toBe(true);

      const openSpy = vi.fn();
      navigationDelegate.on(DelegateEvents.BOOK_OPEN, openSpy);

      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight', bubbles: true,
      }));
      await flushPromises();

      expect(openSpy).toHaveBeenCalled();
    });

    it('ArrowRight on open book should transition OPENED → FLIPPING → OPENED', async () => {
      await openBookForTesting();
      expect(stateMachine.state).toBe(BookState.OPENED);

      const fp = createControllablePromise();
      flipAnimator.runFlip.mockImplementation((dir, cb) => {
        flipAnimator._swapCallback = cb;
        return fp.promise;
      });

      // Нажимаем ArrowRight
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight', bubbles: true,
      }));
      await flushPromises();

      expect(stateMachine.state).toBe(BookState.FLIPPING);

      // Завершаем анимацию
      if (flipAnimator._swapCallback) flipAnimator._swapCallback();
      fp.resolve();
      await flushPromises();

      expect(stateMachine.state).toBe(BookState.OPENED);
      expect(mockState.index).toBe(2); // desktop step = 2
    });

    it('ArrowLeft on first page should emit BOOK_CLOSE', async () => {
      await openBookForTesting();
      mockState.index = 0;

      const closeSpy = vi.fn();
      navigationDelegate.on(DelegateEvents.BOOK_CLOSE, closeSpy);

      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowLeft', bubbles: true,
      }));
      await flushPromises();

      expect(closeSpy).toHaveBeenCalled();
    });

    it('keyboard events should be blocked when busy (FLIPPING)', async () => {
      await openBookForTesting();

      // Ставим в FLIPPING
      stateMachine.transitionTo(BookState.FLIPPING);

      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight', bubbles: true,
      }));
      await flushPromises();

      // runFlip не должен быть вызван (вызов от открытия книги уже был)
      expect(flipAnimator.runFlip).not.toHaveBeenCalled();
    });

    it('keyboard events should be ignored when focused on input', async () => {
      await openBookForTesting();

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const event = new KeyboardEvent('keydown', {
        key: 'ArrowRight', bubbles: true,
      });
      // Установить target на input
      Object.defineProperty(event, 'target', { value: input });
      document.dispatchEvent(event);
      await flushPromises();

      expect(flipAnimator.runFlip).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // TOC CLICK → CHAPTER NAVIGATION
  // ═══════════════════════════════════════════

  describe('TOC click → ChapterNavigation → State update', () => {
    beforeEach(() => {
      // Создаём TOC внутри book
      const toc = document.createElement('ul');
      toc.className = 'toc';

      const li1 = document.createElement('li');
      li1.dataset.chapter = '0';
      li1.textContent = 'Chapter 1';

      const li2 = document.createElement('li');
      li2.dataset.chapter = '1';
      li2.textContent = 'Chapter 2';

      toc.appendChild(li1);
      toc.appendChild(li2);
      bookElement.appendChild(toc);

      eventController.bind({});
    });

    it('should navigate to chapter when TOC item clicked on open book', async () => {
      await openBookForTesting();
      mockState.chapterStarts = [0, 10];

      const fp = createControllablePromise();
      flipAnimator.runFlip.mockImplementation((dir, cb) => {
        flipAnimator._swapCallback = cb;
        return fp.promise;
      });

      const li = bookElement.querySelector('.toc li[data-chapter="1"]');
      li.click();
      await flushPromises();

      // Должен начать flip к главе 1 (pageIndex=10)
      expect(stateMachine.state).toBe(BookState.FLIPPING);
      expect(mockRenderer.prepareBuffer).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // SETTINGS → DELEGATE → REPAGINATE
  // ═══════════════════════════════════════════

  describe('Settings change → SettingsDelegate → repaginate', () => {
    beforeEach(() => {
      eventController.bind({});
    });

    it('should propagate font change through delegate to settings manager', () => {
      settingsDelegate.handleChange('font', 'merriweather');

      expect(settingsManager.get('font')).toBe('merriweather');
    });

    it('should emit REPAGINATE event on font change when book is open', async () => {
      await openBookForTesting();

      const repaginateSpy = vi.fn();
      settingsDelegate.on(DelegateEvents.REPAGINATE, repaginateSpy);

      settingsDelegate.handleChange('font', 'inter');

      expect(repaginateSpy).toHaveBeenCalled();
    });

    it('should emit SETTINGS_UPDATE on theme change', () => {
      const updateSpy = vi.fn();
      settingsDelegate.on(DelegateEvents.SETTINGS_UPDATE, updateSpy);

      settingsDelegate.handleChange('theme', 'dark');

      expect(updateSpy).toHaveBeenCalled();
      expect(settingsManager.get('theme')).toBe('dark');
    });
  });

  // ═══════════════════════════════════════════
  // ПОРЯДОК ВЫЗОВОВ В ПОЛНОЙ ЦЕПОЧКЕ
  // ═══════════════════════════════════════════

  describe('Event ordering in full chain', () => {
    beforeEach(() => {
      eventController.bind({});
    });

    it('should execute flip phases in order: transition → sound → prepare → animate → swap → transition', async () => {
      await openBookForTesting();

      const callOrder = [];

      stateMachine.subscribe((newState) => {
        callOrder.push(`state:${newState}`);
      });

      const fp = createControllablePromise();
      flipAnimator.runFlip.mockImplementation((dir, cb) => {
        callOrder.push('animate');
        flipAnimator._swapCallback = cb;
        return fp.promise;
      });

      mockRenderer.prepareBuffer.mockImplementation(() => {
        callOrder.push('prepareBuffer');
      });
      mockRenderer.prepareSheet.mockImplementation(() => {
        callOrder.push('prepareSheet');
      });
      mockRenderer.swapBuffers.mockImplementation(() => {
        callOrder.push('swapBuffers');
      });

      const flipPromise = navigationDelegate.flip(Direction.NEXT);

      // Перед завершением анимации
      expect(callOrder).toContain('state:flipping');
      expect(callOrder).toContain('prepareBuffer');
      expect(callOrder).toContain('prepareSheet');
      expect(callOrder).toContain('animate');

      // Завершаем
      if (flipAnimator._swapCallback) flipAnimator._swapCallback();
      fp.resolve();
      await flipPromise;

      expect(callOrder).toContain('swapBuffers');
      expect(callOrder).toContain('state:opened');

      // Порядок: state:flipping → prepare → animate → swap → state:opened
      const flippingIdx = callOrder.indexOf('state:flipping');
      const prepareIdx = callOrder.indexOf('prepareBuffer');
      const animateIdx = callOrder.indexOf('animate');
      const swapIdx = callOrder.indexOf('swapBuffers');
      const openedIdx = callOrder.indexOf('state:opened');

      expect(flippingIdx).toBeLessThan(prepareIdx);
      expect(prepareIdx).toBeLessThan(animateIdx);
      expect(animateIdx).toBeLessThan(swapIdx);
      expect(swapIdx).toBeLessThan(openedIdx);
    });
  });

  // ═══════════════════════════════════════════
  // CONCURRENT EVENTS
  // ═══════════════════════════════════════════

  describe('Concurrent event handling', () => {
    beforeEach(() => {
      eventController.bind({});
    });

    it('should block second flip while first is in progress', async () => {
      await openBookForTesting();

      const fp = createControllablePromise();
      flipAnimator.runFlip.mockImplementation((dir, cb) => {
        flipAnimator._swapCallback = cb;
        return fp.promise;
      });

      // Первый flip
      navigationDelegate.flip(Direction.NEXT);
      await flushPromises();

      expect(stateMachine.state).toBe(BookState.FLIPPING);

      // Второй flip — должен быть заблокирован (isBusy)
      await navigationDelegate.flip(Direction.NEXT);

      // runFlip вызван только один раз
      expect(flipAnimator.runFlip).toHaveBeenCalledTimes(1);

      // Завершаем первый
      if (flipAnimator._swapCallback) flipAnimator._swapCallback();
      fp.resolve();
      await flushPromises();
    });

    it('should block keyboard navigation while flipping', async () => {
      await openBookForTesting();

      const fp = createControllablePromise();
      flipAnimator.runFlip.mockImplementation((dir, cb) => {
        flipAnimator._swapCallback = cb;
        return fp.promise;
      });

      // Начинаем flip
      navigationDelegate.flip(Direction.NEXT);
      await flushPromises();

      // Клавиатура во время анимации — EventController проверяет isBusy()
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight', bubbles: true,
      }));
      await flushPromises();

      // Только один вызов runFlip
      expect(flipAnimator.runFlip).toHaveBeenCalledTimes(1);

      if (flipAnimator._swapCallback) flipAnimator._swapCallback();
      fp.resolve();
      await flushPromises();
    });

    it('should handle rapid settings changes without crashing', async () => {
      await openBookForTesting();

      // Быстрая последовательность смен настроек
      expect(() => {
        settingsDelegate.handleChange('theme', 'dark');
        settingsDelegate.handleChange('theme', 'light');
        settingsDelegate.handleChange('theme', 'bw');
        settingsDelegate.handleChange('fontSize', 'increase');
        settingsDelegate.handleChange('fontSize', 'decrease');
      }).not.toThrow();

      expect(settingsManager.get('theme')).toBe('bw');
    });
  });
});
