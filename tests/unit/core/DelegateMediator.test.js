/**
 * Unit tests for DelegateMediator
 * Coordinates events between delegates, updates state and UI
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════════════════

const { mockConfig, mockDelegateEvents } = vi.hoisted(() => ({
  mockConfig: {
    CHAPTERS: [
      { id: 'ch1', file: 'content/part_1.html', bg: 'images/bg1.webp', title: 'Глава 1' },
      { id: 'ch2', file: 'content/part_2.html', bg: 'images/bg2.webp', title: 'Глава 2' },
    ],
    VIRTUALIZATION: { cacheLimit: 50 },
  },
  mockDelegateEvents: {
    INDEX_CHANGE: 'indexChange',
    BOOK_OPEN: 'bookOpen',
    BOOK_CLOSE: 'bookClose',
    PAGINATION_COMPLETE: 'paginationComplete',
    CHAPTER_UPDATE: 'chapterUpdate',
    SETTINGS_UPDATE: 'settingsUpdate',
    REPAGINATE: 'repaginate',
  },
}));

vi.mock('../../../js/config.js', () => ({
  CONFIG: mockConfig,
  getConfig: () => mockConfig,
}));

vi.mock('../../../js/core/delegates/index.js', () => ({
  DelegateEvents: mockDelegateEvents,
}));

const { DelegateMediator } = await import('../../../js/core/DelegateMediator.js');

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const createMockDelegate = () => {
  const handlers = new Map();
  return {
    on: vi.fn((event, handler) => {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(handler);
    }),
    emit(event, ...args) {
      (handlers.get(event) || []).forEach(h => h(...args));
    },
    getCurrentChapter: vi.fn().mockReturnValue(0),
    updateBackground: vi.fn(),
    restoreCoverBackground: vi.fn(),
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    repaginate: vi.fn().mockResolvedValue(undefined),
    flip: vi.fn(),
    handleChange: vi.fn(),
    destroy: vi.fn(),
  };
};

const createDeps = (overrides = {}) => {
  const state = { index: 0, chapterStarts: [0, 50] };
  const delegates = {
    navigation: createMockDelegate(),
    lifecycle: createMockDelegate(),
    settings: createMockDelegate(),
    chapter: createMockDelegate(),
    drag: createMockDelegate(),
  };
  const services = {
    settings: {
      get: vi.fn((key) => key === 'page' ? 5 : null),
      set: vi.fn(),
    },
    renderer: {
      totalPages: 100,
      setPaginationData: vi.fn(),
    },
    dom: {
      get: vi.fn((key) => {
        if (key === 'currentPage') {
          const el = document.createElement('span');
          el.textContent = '0';
          return el;
        }
        if (key === 'totalPages') {
          const el = document.createElement('span');
          el.textContent = '0';
          return el;
        }
        if (key === 'readingProgress') {
          const el = document.createElement('div');
          el.setAttribute('aria-valuenow', '0');
          return el;
        }
        return null;
      }),
    },
    eventManager: { count: 5 },
    stateMachine: { state: 'OPENED' },
    debugPanel: { update: vi.fn() },
    announcer: {
      announcePage: vi.fn(),
      announceChapter: vi.fn(),
      announceLoading: vi.fn(),
      announceBookState: vi.fn(),
    },
  };
  const isMobileFn = vi.fn(() => false);

  return { state, delegates, services, isMobileFn, ...overrides };
};

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('DelegateMediator', () => {
  let deps;
  let mediator;

  beforeEach(() => {
    deps = createDeps();
    mediator = new DelegateMediator(deps);
  });

  describe('constructor', () => {
    it('should subscribe to all delegate events', () => {
      const { navigation, lifecycle, settings, drag } = deps.delegates;

      // Navigation: INDEX_CHANGE, BOOK_OPEN, BOOK_CLOSE
      expect(navigation.on).toHaveBeenCalledWith('indexChange', expect.any(Function));
      expect(navigation.on).toHaveBeenCalledWith('bookOpen', expect.any(Function));
      expect(navigation.on).toHaveBeenCalledWith('bookClose', expect.any(Function));

      // Lifecycle: PAGINATION_COMPLETE, INDEX_CHANGE, CHAPTER_UPDATE
      expect(lifecycle.on).toHaveBeenCalledWith('paginationComplete', expect.any(Function));
      expect(lifecycle.on).toHaveBeenCalledWith('indexChange', expect.any(Function));
      expect(lifecycle.on).toHaveBeenCalledWith('chapterUpdate', expect.any(Function));

      // Settings: SETTINGS_UPDATE, REPAGINATE
      expect(settings.on).toHaveBeenCalledWith('settingsUpdate', expect.any(Function));
      expect(settings.on).toHaveBeenCalledWith('repaginate', expect.any(Function));

      // Drag: INDEX_CHANGE, CHAPTER_UPDATE
      expect(drag.on).toHaveBeenCalledWith('indexChange', expect.any(Function));
      expect(drag.on).toHaveBeenCalledWith('chapterUpdate', expect.any(Function));
    });
  });

  describe('handleIndexChange', () => {
    it('should update state index', () => {
      mediator.handleIndexChange(42);
      expect(deps.state.index).toBe(42);
    });

    it('should save page to settings', () => {
      mediator.handleIndexChange(10);
      expect(deps.services.settings.set).toHaveBeenCalledWith('page', 10);
    });

    it('should update chapter background', () => {
      mediator.handleIndexChange(5);
      expect(deps.delegates.chapter.updateBackground).toHaveBeenCalled();
    });

    it('should update debug panel', () => {
      mediator.handleIndexChange(5);
      expect(deps.services.debugPanel.update).toHaveBeenCalled();
    });

    it('should announce page for screen reader', () => {
      deps.delegates.chapter.getCurrentChapter.mockReturnValue(0);
      mediator.handleIndexChange(5);
      expect(deps.services.announcer.announcePage).toHaveBeenCalledWith(6, 100);
    });

    it('should announce chapter change for screen reader', () => {
      // Start at chapter 0, move to chapter 1
      deps.delegates.chapter.getCurrentChapter
        .mockReturnValueOnce(0)  // oldChapter
        .mockReturnValueOnce(1); // newChapter

      mediator.handleIndexChange(55);
      expect(deps.services.announcer.announceChapter).toHaveBeenCalledWith('Глава 2', 2);
    });
  });

  describe('handlePaginationComplete', () => {
    it('should set pagination data on renderer', () => {
      const pageData = { sourceElement: document.createElement('div'), pageCount: 2, pageWidth: 400, pageHeight: 600 };
      mediator.handlePaginationComplete(pageData, [0]);
      expect(deps.services.renderer.setPaginationData).toHaveBeenCalledWith(pageData);
    });

    it('should update chapterStarts in state', () => {
      mediator.handlePaginationComplete(null, [0, 10, 20]);
      expect(deps.state.chapterStarts).toEqual([0, 10, 20]);
    });
  });

  describe('handleBookOpen', () => {
    it('should announce loading', async () => {
      await mediator.handleBookOpen();
      expect(deps.services.announcer.announceLoading).toHaveBeenCalledWith('книги');
    });

    it('should call lifecycle.open with 0 when not continuing', async () => {
      await mediator.handleBookOpen(false);
      expect(deps.delegates.lifecycle.open).toHaveBeenCalledWith(0);
    });

    it('should call lifecycle.open with saved page when continuing', async () => {
      deps.services.settings.get = vi.fn((key) => key === 'page' ? 42 : null);
      await mediator.handleBookOpen(true);
      expect(deps.delegates.lifecycle.open).toHaveBeenCalledWith(42);
    });

    it('should announce book state after opening', async () => {
      await mediator.handleBookOpen();
      expect(deps.services.announcer.announceBookState).toHaveBeenCalledWith(true);
    });
  });

  describe('handleBookClose', () => {
    it('should call lifecycle.close', async () => {
      await mediator.handleBookClose();
      expect(deps.delegates.lifecycle.close).toHaveBeenCalled();
    });

    it('should announce book state after closing', async () => {
      await mediator.handleBookClose();
      expect(deps.services.announcer.announceBookState).toHaveBeenCalledWith(false);
    });
  });

  describe('repaginate', () => {
    it('should call lifecycle.repaginate with keepIndex', async () => {
      await mediator.repaginate(true);
      expect(deps.delegates.lifecycle.repaginate).toHaveBeenCalledWith(true);
    });
  });

  describe('updateChapterBackground', () => {
    it('should call chapter.updateBackground with current index and mobile state', () => {
      deps.state.index = 15;
      deps.isMobileFn.mockReturnValue(true);

      mediator.updateChapterBackground();

      expect(deps.delegates.chapter.updateBackground).toHaveBeenCalledWith(15, true);
    });
  });

  describe('updateDebug', () => {
    it('should call debugPanel.update with correct data', () => {
      deps.state.index = 5;

      mediator.updateDebug();

      expect(deps.services.debugPanel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'OPENED',
          totalPages: 100,
          currentPage: 5,
          listenerCount: 5,
        })
      );
    });
  });

  describe('updateNavigationUI', () => {
    let currentPageEl;
    let totalPagesEl;
    let progressBar;

    beforeEach(() => {
      currentPageEl = document.createElement('span');
      totalPagesEl = document.createElement('span');
      progressBar = document.createElement('div');

      const pageCounter = document.createElement('div');
      pageCounter.className = 'page-counter';
      pageCounter.appendChild(currentPageEl);

      deps.services.dom.get = vi.fn((key) => {
        if (key === 'currentPage') return currentPageEl;
        if (key === 'totalPages') return totalPagesEl;
        if (key === 'readingProgress') return progressBar;
        return null;
      });

      deps.services.renderer.totalPages = 100;
      deps.state.index = 49;

      // Recreate mediator with updated deps
      mediator = new DelegateMediator(deps);
    });

    it('should update current page display (1-based)', () => {
      mediator.updateNavigationUI();
      expect(currentPageEl.textContent).toBe('50');
    });

    it('should update total pages display', () => {
      mediator.updateNavigationUI();
      expect(totalPagesEl.textContent).toBe('100');
    });

    it('should update progress bar CSS variable', () => {
      mediator.updateNavigationUI();
      expect(progressBar.style.getPropertyValue('--progress-width')).toBe('50%');
    });

    it('should update progress bar aria-valuenow', () => {
      mediator.updateNavigationUI();
      expect(progressBar.getAttribute('aria-valuenow')).toBe('50');
    });

    it('should handle missing elements gracefully', () => {
      deps.services.dom.get = vi.fn(() => null);
      mediator = new DelegateMediator(deps);
      expect(() => mediator.updateNavigationUI()).not.toThrow();
    });

    it('should handle zero total pages', () => {
      deps.services.renderer.totalPages = 0;
      deps.state.index = 0;
      mediator = new DelegateMediator(deps);

      expect(() => mediator.updateNavigationUI()).not.toThrow();
    });
  });

  describe('delegate event routing', () => {
    it('should route navigation INDEX_CHANGE to handleIndexChange', () => {
      deps.delegates.navigation.emit('indexChange', 10);
      expect(deps.state.index).toBe(10);
    });

    it('should route lifecycle PAGINATION_COMPLETE to handlePaginationComplete', () => {
      const pageData = { sourceElement: document.createElement('div'), pageCount: 1, pageWidth: 400, pageHeight: 600 };
      deps.delegates.lifecycle.emit('paginationComplete', { pageData, chapterStarts: [0, 5] });
      expect(deps.services.renderer.setPaginationData).toHaveBeenCalledWith(pageData);
      expect(deps.state.chapterStarts).toEqual([0, 5]);
    });

    it('should route settings SETTINGS_UPDATE to updateDebug', () => {
      deps.delegates.settings.emit('settingsUpdate');
      expect(deps.services.debugPanel.update).toHaveBeenCalled();
    });

    it('should route settings REPAGINATE to repaginate', () => {
      deps.delegates.settings.emit('repaginate', true);
      expect(deps.delegates.lifecycle.repaginate).toHaveBeenCalledWith(true);
    });

    it('should route drag INDEX_CHANGE to handleIndexChange', () => {
      deps.delegates.drag.emit('indexChange', 20);
      expect(deps.state.index).toBe(20);
    });

    it('should route drag CHAPTER_UPDATE to updateChapterBackground', () => {
      deps.delegates.drag.emit('chapterUpdate');
      expect(deps.delegates.chapter.updateBackground).toHaveBeenCalled();
    });
  });
});
