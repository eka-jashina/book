/**
 * INTEGRATION TEST: DelegateMediator
 * Тестирование координации событий между делегатами через DelegateMediator.
 * Проверяет маршрутизацию событий, обновление состояния и UI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createFullBookDOM,
  cleanupIntegrationDOM,
} from '../../helpers/integrationUtils.js';

import { DelegateMediator } from '../../../js/core/DelegateMediator.js';
import { BookStateMachine } from '../../../js/managers/BookStateMachine.js';
import { SettingsManager } from '../../../js/managers/SettingsManager.js';
import { EventEmitter } from '../../../js/utils/EventEmitter.js';
import { DelegateEvents } from '../../../js/core/delegates/BaseDelegate.js';

// Mock CONFIG — preserve BookState and other exports from config.js
vi.mock('../../../js/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  const CONFIG = {
    ...actual.CONFIG,
    CHAPTERS: [
      { title: 'Глава 1', file: 'part_1.html' },
      { title: 'Глава 2', file: 'part_2.html' },
      { title: 'Глава 3', file: 'part_3.html' },
    ],
    APPEARANCE: null,
    SETTINGS_VISIBILITY: null,
  };
  return {
    ...actual,
    CONFIG,
    getConfig: () => CONFIG,
  };
});

describe('DelegateMediator Integration', () => {
  let dom;
  let state;
  let stateMachine;
  let settingsManager;
  let mediator;

  // Delegate mocks (extending EventEmitter for event support)
  let navigationDelegate;
  let lifecycleDelegate;
  let settingsDelegate;
  let chapterDelegate;
  let dragDelegate;

  // Service mocks
  let mockRenderer;
  let mockDom;
  let mockEventManager;
  let mockDebugPanel;
  let mockAnnouncer;

  const createDelegateEmitter = () => {
    const emitter = new EventEmitter();
    emitter.destroy = vi.fn();
    return emitter;
  };

  beforeEach(() => {
    dom = createFullBookDOM();

    state = { index: 0, chapterStarts: [0, 10, 20] };

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

    // Create delegate emitters
    navigationDelegate = createDelegateEmitter();
    lifecycleDelegate = createDelegateEmitter();
    lifecycleDelegate.open = vi.fn().mockResolvedValue();
    lifecycleDelegate.close = vi.fn().mockResolvedValue();
    lifecycleDelegate.repaginate = vi.fn().mockResolvedValue();

    settingsDelegate = createDelegateEmitter();
    chapterDelegate = createDelegateEmitter();
    chapterDelegate.getCurrentChapter = vi.fn((index) => {
      if (index >= 20) return 2;
      if (index >= 10) return 1;
      return 0;
    });
    chapterDelegate.updateBackground = vi.fn();

    dragDelegate = createDelegateEmitter();

    // Service mocks
    mockRenderer = {
      totalPages: 30,
      setPaginationData: vi.fn(),
      getMaxIndex: vi.fn().mockReturnValue(29),
    };

    // Add DOM elements for page counter
    const pageCounter = document.createElement('div');
    pageCounter.className = 'page-counter';
    const currentPageEl = document.createElement('span');
    currentPageEl.id = 'currentPage';
    const totalPagesEl = document.createElement('span');
    totalPagesEl.id = 'totalPages';
    pageCounter.appendChild(currentPageEl);
    pageCounter.appendChild(totalPagesEl);
    document.body.appendChild(pageCounter);

    // Add reading progress bar
    const readingProgress = document.createElement('div');
    readingProgress.id = 'readingProgress';
    document.body.appendChild(readingProgress);

    // Add TOC button
    const tocBtn = document.createElement('button');
    tocBtn.id = 'tocBtn';
    document.body.appendChild(tocBtn);

    mockDom = {
      get: (id) => {
        const map = {
          currentPage: currentPageEl,
          totalPages: totalPagesEl,
          readingProgress: readingProgress,
          tocBtn: tocBtn,
        };
        return map[id] || document.getElementById(id) || null;
      },
    };

    mockEventManager = { count: 5 };
    mockDebugPanel = { update: vi.fn() };
    mockAnnouncer = {
      announcePage: vi.fn(),
      announceChapter: vi.fn(),
      announceLoading: vi.fn(),
      announceBookState: vi.fn(),
    };

    mediator = new DelegateMediator({
      state,
      delegates: {
        navigation: navigationDelegate,
        lifecycle: lifecycleDelegate,
        settings: settingsDelegate,
        chapter: chapterDelegate,
        drag: dragDelegate,
      },
      services: {
        settings: settingsManager,
        renderer: mockRenderer,
        dom: mockDom,
        eventManager: mockEventManager,
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
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  describe('INDEX_CHANGE event routing', () => {
    it('should update state when navigation emits INDEX_CHANGE', () => {
      navigationDelegate.emit(DelegateEvents.INDEX_CHANGE, 5);

      expect(state.index).toBe(5);
      expect(settingsManager.get('page')).toBe(5);
    });

    it('should update state when lifecycle emits INDEX_CHANGE', () => {
      lifecycleDelegate.emit(DelegateEvents.INDEX_CHANGE, 12);

      expect(state.index).toBe(12);
      expect(settingsManager.get('page')).toBe(12);
    });

    it('should update state when drag emits INDEX_CHANGE', () => {
      dragDelegate.emit(DelegateEvents.INDEX_CHANGE, 8);

      expect(state.index).toBe(8);
      expect(settingsManager.get('page')).toBe(8);
    });

    it('should update navigation UI on index change', () => {
      navigationDelegate.emit(DelegateEvents.INDEX_CHANGE, 4);

      const currentPageEl = mockDom.get('currentPage');
      const totalPagesEl = mockDom.get('totalPages');

      expect(currentPageEl.textContent).toBe('5'); // 1-based
      expect(totalPagesEl.textContent).toBe('30');
    });

    it('should update progress bar on index change', () => {
      navigationDelegate.emit(DelegateEvents.INDEX_CHANGE, 14);

      const progressBar = mockDom.get('readingProgress');
      const progress = progressBar.style.getPropertyValue('--progress-width');
      expect(progress).toBe('50%'); // 15/30 = 50%
    });

    it('should update debug panel on index change', () => {
      navigationDelegate.emit(DelegateEvents.INDEX_CHANGE, 3);

      expect(mockDebugPanel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          currentPage: 3,
          totalPages: 30,
        })
      );
    });

    it('should update chapter background on index change', () => {
      navigationDelegate.emit(DelegateEvents.INDEX_CHANGE, 15);

      expect(chapterDelegate.updateBackground).toHaveBeenCalledWith(15, false);
    });
  });

  describe('Chapter change announcements', () => {
    it('should announce page for same chapter', () => {
      state.index = 5;
      navigationDelegate.emit(DelegateEvents.INDEX_CHANGE, 7);

      expect(mockAnnouncer.announcePage).toHaveBeenCalledWith(8, 30);
      expect(mockAnnouncer.announceChapter).not.toHaveBeenCalled();
    });

    it('should announce chapter when crossing boundary', () => {
      state.index = 8; // Chapter 0
      navigationDelegate.emit(DelegateEvents.INDEX_CHANGE, 12); // Chapter 1

      expect(mockAnnouncer.announceChapter).toHaveBeenCalledWith('Глава 2', 2);
      expect(mockAnnouncer.announcePage).not.toHaveBeenCalled();
    });
  });

  describe('PAGINATION_COMPLETE event routing', () => {
    it('should update renderer and state on pagination complete', () => {
      const pageData = { pageCount: 50, sourceElement: null };
      const chapterStarts = [0, 15, 35];

      lifecycleDelegate.emit(DelegateEvents.PAGINATION_COMPLETE, { pageData, chapterStarts });

      expect(mockRenderer.setPaginationData).toHaveBeenCalledWith(pageData);
      expect(state.chapterStarts).toEqual([0, 15, 35]);
    });

    it('should hide TOC button for single chapter', () => {
      const pageData = { pageCount: 20, sourceElement: null };
      const chapterStarts = [0];

      lifecycleDelegate.emit(DelegateEvents.PAGINATION_COMPLETE, { pageData, chapterStarts });

      const tocBtn = mockDom.get('tocBtn');
      expect(tocBtn.hidden).toBe(true);
    });

    it('should show TOC button for multiple chapters', () => {
      const pageData = { pageCount: 50, sourceElement: null };
      const chapterStarts = [0, 15, 35];

      lifecycleDelegate.emit(DelegateEvents.PAGINATION_COMPLETE, { pageData, chapterStarts });

      const tocBtn = mockDom.get('tocBtn');
      expect(tocBtn.hidden).toBe(false);
    });
  });

  describe('BOOK_OPEN / BOOK_CLOSE routing', () => {
    it('should open book via lifecycle delegate', async () => {
      await mediator.handleBookOpen(false);

      expect(mockAnnouncer.announceLoading).toHaveBeenCalledWith('книги');
      expect(lifecycleDelegate.open).toHaveBeenCalledWith(0);
      expect(mockAnnouncer.announceBookState).toHaveBeenCalledWith(true);
    });

    it('should open book at saved position for continue reading', async () => {
      settingsManager.set('page', 15);

      await mediator.handleBookOpen(true);

      expect(lifecycleDelegate.open).toHaveBeenCalledWith(15);
    });

    it('should close book via lifecycle delegate', async () => {
      await mediator.handleBookClose();

      expect(lifecycleDelegate.close).toHaveBeenCalled();
      expect(mockAnnouncer.announceBookState).toHaveBeenCalledWith(false);
    });

    it('should route BOOK_CLOSE from navigation to close', async () => {
      const closePromise = new Promise(resolve => {
        lifecycleDelegate.close.mockImplementation(() => {
          resolve();
          return Promise.resolve();
        });
      });

      navigationDelegate.emit(DelegateEvents.BOOK_CLOSE);
      await closePromise;

      expect(lifecycleDelegate.close).toHaveBeenCalled();
    });
  });

  describe('SETTINGS_UPDATE and REPAGINATE routing', () => {
    it('should update debug on settings update', () => {
      settingsDelegate.emit(DelegateEvents.SETTINGS_UPDATE);

      expect(mockDebugPanel.update).toHaveBeenCalled();
    });

    it('should trigger repagination via lifecycle delegate', async () => {
      settingsDelegate.emit(DelegateEvents.REPAGINATE, true);

      // Wait for async repaginate
      await vi.waitFor(() => {
        expect(lifecycleDelegate.repaginate).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('CHAPTER_UPDATE routing', () => {
    it('should update background on lifecycle chapter update', () => {
      lifecycleDelegate.emit(DelegateEvents.CHAPTER_UPDATE);

      expect(chapterDelegate.updateBackground).toHaveBeenCalledWith(
        state.index, false
      );
    });

    it('should update background on drag chapter update', () => {
      state.index = 12;
      dragDelegate.emit(DelegateEvents.CHAPTER_UPDATE);

      expect(chapterDelegate.updateBackground).toHaveBeenCalledWith(12, false);
    });
  });

  describe('Mobile mode handling', () => {
    it('should pass isMobile=true to updateBackground when mobile', () => {
      // Create mediator with mobile mode
      const mobileMediator = new DelegateMediator({
        state,
        delegates: {
          navigation: createDelegateEmitter(),
          lifecycle: createDelegateEmitter(),
          settings: createDelegateEmitter(),
          chapter: chapterDelegate,
          drag: createDelegateEmitter(),
        },
        services: {
          settings: settingsManager,
          renderer: mockRenderer,
          dom: mockDom,
          eventManager: mockEventManager,
          stateMachine,
          debugPanel: mockDebugPanel,
          announcer: mockAnnouncer,
        },
        isMobileFn: () => true,
      });

      mobileMediator.updateChapterBackground();

      expect(chapterDelegate.updateBackground).toHaveBeenCalledWith(
        state.index, true
      );
    });
  });

  describe('Multi-delegate event coordination', () => {
    it('should handle rapid index changes from different delegates', () => {
      navigationDelegate.emit(DelegateEvents.INDEX_CHANGE, 2);
      expect(state.index).toBe(2);

      dragDelegate.emit(DelegateEvents.INDEX_CHANGE, 6);
      expect(state.index).toBe(6);

      lifecycleDelegate.emit(DelegateEvents.INDEX_CHANGE, 0);
      expect(state.index).toBe(0);

      // Settings should reflect last value
      expect(settingsManager.get('page')).toBe(0);
    });

    it('should handle pagination complete followed by index change', () => {
      const pageData = { pageCount: 40, sourceElement: null };
      lifecycleDelegate.emit(DelegateEvents.PAGINATION_COMPLETE, {
        pageData,
        chapterStarts: [0, 12, 25],
      });

      expect(state.chapterStarts).toEqual([0, 12, 25]);

      // Now navigate
      navigationDelegate.emit(DelegateEvents.INDEX_CHANGE, 13);

      expect(chapterDelegate.getCurrentChapter).toHaveBeenCalledWith(13);
    });
  });
});
