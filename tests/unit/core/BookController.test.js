/**
 * Unit tests for BookController
 * Main application coordinator with dependency injection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════════════════

// Hoist mocks for config and utilities
const { mockMediaQueries, mockConfig, mockDelegateEvents } = vi.hoisted(() => ({
  mockMediaQueries: {
    isMobile: false,
    get: vi.fn((key) => key === 'mobile' ? false : null),
  },
  mockConfig: {
    CHAPTERS: [
      { id: 'ch1', file: 'content/part_1.html', bg: 'images/bg1.webp' },
      { id: 'ch2', file: 'content/part_2.html', bg: 'images/bg2.webp' },
    ],
    VIRTUALIZATION: { cacheLimit: 12 },
    DEFAULT_SETTINGS: {
      font: 'georgia',
      fontSize: 18,
      theme: 'light',
      page: 0,
      soundEnabled: true,
      soundVolume: 0.3,
    },
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

// Store all mock instances for test assertions
let mockInstances = {};

// Reset mock instances before each test
const resetMockInstances = () => {
  mockInstances = {
    coreServices: null,
    audioServices: null,
    renderServices: null,
    contentServices: null,
    settings: null,
    stateMachine: null,
    debugPanel: null,
    eventController: null,
    navigationDelegate: null,
    lifecycleDelegate: null,
    settingsDelegate: null,
    chapterDelegate: null,
    dragDelegate: null,
    appInitializer: null,
    subscriptionManager: null,
    resizeHandler: null,
    mediator: null,
  };
};

vi.mock('@i18n', () => ({ t: vi.fn((key) => key) }));

// Mock utils
vi.mock('../../../js/utils/index.js', () => ({
  mediaQueries: mockMediaQueries,
  getAnnouncer: () => ({
    announce: () => {},
    announcePage: () => {},
    announceChapter: () => {},
    announceLoading: () => {},
    announceLoadingComplete: () => {},
    announceError: () => {},
    announceSetting: () => {},
    announceBookState: () => {},
    clear: () => {},
    destroy: () => {},
  }),
  ErrorHandler: class {
    static handle() {}
  },
}));

// Mock config
vi.mock('../../../js/config.js', () => ({
  CONFIG: mockConfig,
  getConfig: () => mockConfig,
  BookState: {
    CLOSED: 'CLOSED',
    OPENING: 'OPENING',
    OPENED: 'OPENED',
    FLIPPING: 'FLIPPING',
    CLOSING: 'CLOSING',
  },
  Direction: {
    NEXT: 'next',
    PREV: 'prev',
  },
}));

// Mock ComponentFactory
vi.mock('../../../js/core/ComponentFactory.js', () => ({
  ComponentFactory: class MockComponentFactory {
    static createCoreServices() {
      mockInstances.coreServices = {
        dom: {
          get: vi.fn((key) => {
            const el = document.createElement('div');
            if (key === 'currentPage' || key === 'totalPages') {
              return document.createElement('span');
            }
            return el;
          }),
          getMultiple: vi.fn((...keys) => {
            const result = {};
            keys.forEach(key => {
              result[key] = document.createElement('div');
            });
            return result;
          }),
          resetBookDOM: vi.fn(),
        },
        eventManager: {
          add: vi.fn(),
          remove: vi.fn(),
          removeAll: vi.fn(),
          count: 0,
        },
        timerManager: {
          setTimeout: vi.fn((fn) => { fn(); return 1; }),
          clearTimeout: vi.fn(),
          debounce: vi.fn((fn) => fn),
          clearAll: vi.fn(),
        },
        storage: {
          load: vi.fn(() => ({})),
          save: vi.fn(),
        },
        destroy: vi.fn(),
      };
      return mockInstances.coreServices;
    }

    constructor(core) {
      this.core = core;
    }

    createSettingsManager() {
      mockInstances.settings = {
        get: vi.fn((key) => mockConfig.DEFAULT_SETTINGS[key]),
        set: vi.fn(),
        getAll: vi.fn(() => ({ ...mockConfig.DEFAULT_SETTINGS })),
        destroy: vi.fn(),
      };
      return mockInstances.settings;
    }

    createAudioServices(settings) {
      mockInstances.audioServices = {
        soundManager: {
          play: vi.fn(),
          setVolume: vi.fn(),
        },
        ambientManager: {
          play: vi.fn(),
          stop: vi.fn(),
          setVolume: vi.fn(),
        },
        setupAmbientLoadingCallbacks: vi.fn(),
        destroy: vi.fn(),
      };
      return mockInstances.audioServices;
    }

    createRenderServices() {
      mockInstances.renderServices = {
        renderer: {
          totalPages: 0,
          setPaginationData: vi.fn(),
          renderSpread: vi.fn(),
        },
        animator: {
          runFlip: vi.fn().mockResolvedValue(undefined),
        },
        paginator: {
          on: vi.fn(),
          paginate: vi.fn().mockResolvedValue({ pageData: null, chapterStarts: [] }),
        },
        loadingIndicator: {
          show: vi.fn(),
          hide: vi.fn(),
        },
        destroy: vi.fn(),
      };
      return mockInstances.renderServices;
    }

    createContentServices() {
      mockInstances.contentServices = {
        contentLoader: {
          load: vi.fn().mockResolvedValue('<article>Test</article>'),
        },
        backgroundManager: {
          preloadAll: vi.fn().mockResolvedValue(undefined),
          getForChapter: vi.fn(() => 'images/bg1.webp'),
        },
        destroy: vi.fn(),
      };
      return mockInstances.contentServices;
    }

    createStateMachine() {
      mockInstances.stateMachine = {
        state: 'CLOSED',
        get isClosed() { return this.state === 'CLOSED'; },
        get isOpened() { return this.state === 'OPENED'; },
        get isBusy() { return ['OPENING', 'CLOSING', 'FLIPPING'].includes(this.state); },
        transitionTo: vi.fn(function(newState) {
          this.state = newState;
          return true;
        }),
        subscribe: vi.fn(() => vi.fn()),
        destroy: vi.fn(),
      };
      return mockInstances.stateMachine;
    }

    createDebugPanel() {
      mockInstances.debugPanel = {
        update: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
      };
      return mockInstances.debugPanel;
    }

    createEventController(handlers) {
      mockInstances.eventController = {
        bind: vi.fn(),
        destroy: vi.fn(),
        handlers,
      };
      return mockInstances.eventController;
    }
  },
}));

// Mock DelegateMediator using class
vi.mock('../../../js/core/DelegateMediator.js', () => ({
  DelegateMediator: class MockDelegateMediator {
    constructor(deps) {
      this.handleIndexChange = vi.fn();
      this.handlePaginationComplete = vi.fn();
      this.handleBookOpen = vi.fn().mockResolvedValue(undefined);
      this.handleBookClose = vi.fn().mockResolvedValue(undefined);
      this.repaginate = vi.fn().mockResolvedValue(undefined);
      this.updateChapterBackground = vi.fn();
      this.updateDebug = vi.fn();
      this.updateNavigationUI = vi.fn();
      this._deps = deps;
      mockInstances.mediator = this;
    }
  },
}));

// Mock SubscriptionManager using class
vi.mock('../../../js/core/SubscriptionManager.js', () => ({
  SubscriptionManager: class MockSubscriptionManager {
    constructor() {
      this.subscribeToState = vi.fn();
      this.subscribeToPagination = vi.fn();
      this.subscribeToMediaQueries = vi.fn();
      this.subscribeToSwipeHint = vi.fn();
      this.unsubscribeAll = vi.fn();
      mockInstances.subscriptionManager = this;
    }
  },
}));

// Mock ResizeHandler using class
vi.mock('../../../js/core/ResizeHandler.js', () => ({
  ResizeHandler: class MockResizeHandler {
    constructor(deps) {
      this.bind = vi.fn();
      this.destroy = vi.fn();
      this._deps = deps;
      mockInstances.resizeHandler = this;
    }
  },
}));

// Mock AppInitializer using class
vi.mock('../../../js/core/AppInitializer.js', () => ({
  AppInitializer: class MockAppInitializer {
    constructor(deps) {
      this.initialize = vi.fn().mockResolvedValue(undefined);
      this.destroy = vi.fn();
      this._deps = deps;
      mockInstances.appInitializer = this;
    }
  },
}));

// Helper to create delegate mock methods
const createDelegateMockMethods = () => {
  const handlers = new Map();
  return {
    on: vi.fn((event, handler) => {
      if (!handlers.has(event)) {
        handlers.set(event, []);
      }
      handlers.get(event).push(handler);
      return () => {
        const list = handlers.get(event);
        const idx = list.indexOf(handler);
        if (idx > -1) list.splice(idx, 1);
      };
    }),
    emit: vi.fn((event, ...args) => {
      const list = handlers.get(event) || [];
      list.forEach(h => h(...args));
    }),
    destroy: vi.fn(),
    __handlers: handlers,
  };
};

// Mock delegates using classes
vi.mock('../../../js/core/delegates/index.js', () => ({
  NavigationDelegate: class MockNavigationDelegate {
    constructor() {
      const methods = createDelegateMockMethods();
      Object.assign(this, methods);
      this.flip = vi.fn().mockResolvedValue(undefined);
      this.handleTOCNavigation = vi.fn();
      mockInstances.navigationDelegate = this;
    }
  },
  LifecycleDelegate: class MockLifecycleDelegate {
    constructor() {
      const methods = createDelegateMockMethods();
      Object.assign(this, methods);
      this.open = vi.fn().mockResolvedValue(undefined);
      this.close = vi.fn().mockResolvedValue(undefined);
      this.repaginate = vi.fn().mockResolvedValue(undefined);
      mockInstances.lifecycleDelegate = this;
    }
  },
  SettingsDelegate: class MockSettingsDelegate {
    constructor() {
      const methods = createDelegateMockMethods();
      Object.assign(this, methods);
      this.handleChange = vi.fn();
      this.applyAll = vi.fn();
      mockInstances.settingsDelegate = this;
    }
  },
  ChapterDelegate: class MockChapterDelegate {
    constructor() {
      const methods = createDelegateMockMethods();
      Object.assign(this, methods);
      this.updateBackground = vi.fn();
      this.getCurrentChapter = vi.fn().mockReturnValue(0);
      mockInstances.chapterDelegate = this;
    }
  },
  DragDelegate: class MockDragDelegate {
    constructor() {
      const methods = createDelegateMockMethods();
      Object.assign(this, methods);
      this.isActive = false;
      this.bind = vi.fn();
      mockInstances.dragDelegate = this;
    }
  },
  DelegateEvents: mockDelegateEvents,
}));

// Import after mocks
const { BookController } = await import('../../../js/core/BookController.js');

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('BookController', () => {
  let controller;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockInstances();
    controller = new BookController();
  });

  afterEach(() => {
    controller?.destroy();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default state', () => {
      expect(controller.state).toEqual({
        index: 0,
        chapterStarts: [],
      });
    });

    it('should set isDestroyed to false', () => {
      expect(controller.isDestroyed).toBe(false);
    });

    it('should create all service groups', () => {
      expect(controller.core).toBeDefined();
      expect(controller.audio).toBeDefined();
      expect(controller.render).toBeDefined();
      expect(controller.content).toBeDefined();
    });

    it('should create settings manager', () => {
      expect(controller.settings).toBeDefined();
      expect(typeof controller.settings.get).toBe('function');
    });

    it('should create state machine', () => {
      expect(controller.stateMachine).toBeDefined();
    });

    it('should create all delegates', () => {
      expect(controller.navigationDelegate).toBeDefined();
      expect(controller.lifecycleDelegate).toBeDefined();
      expect(controller.settingsDelegate).toBeDefined();
      expect(controller.chapterDelegate).toBeDefined();
      expect(controller.dragDelegate).toBeDefined();
    });

    it('should create mediator', () => {
      expect(controller.mediator).toBeDefined();
    });

    it('should create event controller', () => {
      expect(controller.eventController).toBeDefined();
    });

    it('should create debug panel', () => {
      expect(controller.debugPanel).toBeDefined();
    });

    it('should setup subscription manager', () => {
      expect(controller.subscriptions).toBeDefined();
    });

    it('should setup resize handler', () => {
      expect(controller.resizeHandler).toBeDefined();
    });

    it('should setup ambient loading callbacks', () => {
      expect(mockInstances.audioServices.setupAmbientLoadingCallbacks).toHaveBeenCalled();
    });
  });

  describe('_assertDependencies', () => {
    it('should not throw when all dependencies are present', () => {
      expect(() => {
        controller._assertDependencies(
          { core: controller.core, audio: controller.audio },
          'testPhase'
        );
      }).not.toThrow();
    });

    it('should throw when a dependency is null', () => {
      expect(() => {
        controller._assertDependencies(
          { core: controller.core, missing: null },
          'testPhase'
        );
      }).toThrow('BookController.testPhase');
    });

    it('should throw when a dependency is undefined', () => {
      expect(() => {
        controller._assertDependencies(
          { core: controller.core, missing: undefined },
          'testPhase'
        );
      }).toThrow('BookController.testPhase');
    });

    it('should list all missing dependency names in error', () => {
      expect(() => {
        controller._assertDependencies(
          { a: null, b: undefined, c: controller.core },
          'testPhase'
        );
      }).toThrow('a, b');
    });

    it('should include initialization order hint in error message', () => {
      expect(() => {
        controller._assertDependencies(
          { missing: null },
          'testPhase'
        );
      }).toThrow('Проверьте порядок инициализации');
    });

    it('should accept falsy but non-nullish values (0, false, empty string)', () => {
      expect(() => {
        controller._assertDependencies(
          { num: 0, bool: false, str: '' },
          'testPhase'
        );
      }).not.toThrow();
    });
  });

  describe('initialization phase validation', () => {
    it('_createMediator should throw if delegates are missing', () => {
      const ctrl = Object.create(BookController.prototype);
      ctrl.navigationDelegate = null;
      ctrl.lifecycleDelegate = null;
      ctrl.settingsDelegate = null;
      ctrl.chapterDelegate = null;
      ctrl.dragDelegate = null;
      ctrl.stateMachine = null;
      ctrl.settings = null;
      ctrl.render = null;
      ctrl.core = null;
      ctrl.debugPanel = null;
      ctrl.factory = null;
      expect(() => ctrl._createMediator()).toThrow('_createMediator');
    });

    it('_setupManagers should throw if core/mediator are missing', () => {
      const ctrl = Object.create(BookController.prototype);
      ctrl.core = null;
      ctrl.mediator = null;
      ctrl.stateMachine = null;
      expect(() => ctrl._setupManagers()).toThrow('_setupManagers');
    });
  });

  describe('computed properties', () => {
    describe('isMobile', () => {
      it('should return mediaQueries.isMobile value (false)', () => {
        mockMediaQueries.isMobile = false;
        expect(controller.isMobile).toBe(false);
      });

      it('should return mediaQueries.isMobile value (true)', () => {
        mockMediaQueries.isMobile = true;
        expect(controller.isMobile).toBe(true);
        mockMediaQueries.isMobile = false; // Reset
      });
    });

    describe('index', () => {
      it('should get index from state', () => {
        controller.state.index = 5;
        expect(controller.index).toBe(5);
      });

      it('should set index in state', () => {
        controller.index = 10;
        expect(controller.state.index).toBe(10);
      });
    });

    describe('chapterStarts', () => {
      it('should get chapterStarts from state', () => {
        controller.state.chapterStarts = [0, 50, 100];
        expect(controller.chapterStarts).toEqual([0, 50, 100]);
      });

      it('should set chapterStarts in state', () => {
        controller.chapterStarts = [0, 30, 60];
        expect(controller.state.chapterStarts).toEqual([0, 30, 60]);
      });
    });
  });

  describe('mediator creation', () => {
    it('should pass state to mediator', () => {
      expect(mockInstances.mediator._deps.state).toBe(controller.state);
    });

    it('should pass all delegates to mediator', () => {
      const delegates = mockInstances.mediator._deps.delegates;
      expect(delegates.navigation).toBe(controller.navigationDelegate);
      expect(delegates.lifecycle).toBe(controller.lifecycleDelegate);
      expect(delegates.settings).toBe(controller.settingsDelegate);
      expect(delegates.chapter).toBe(controller.chapterDelegate);
      expect(delegates.drag).toBe(controller.dragDelegate);
    });

    it('should pass services to mediator', () => {
      const services = mockInstances.mediator._deps.services;
      expect(services.settings).toBe(controller.settings);
      expect(services.renderer).toBe(controller.render.renderer);
      expect(services.dom).toBe(controller.core.dom);
      expect(services.eventManager).toBe(controller.core.eventManager);
      expect(services.stateMachine).toBe(controller.stateMachine);
      expect(services.debugPanel).toBe(controller.debugPanel);
    });

    it('should pass isMobileFn to mediator', () => {
      const isMobileFn = mockInstances.mediator._deps.isMobileFn;
      expect(typeof isMobileFn).toBe('function');

      mockMediaQueries.isMobile = true;
      expect(isMobileFn()).toBe(true);
      mockMediaQueries.isMobile = false;
      expect(isMobileFn()).toBe(false);
    });
  });

  describe('init', () => {
    it('should call initializer.initialize', async () => {
      await controller.init();
      expect(mockInstances.appInitializer.initialize).toHaveBeenCalled();
    });

    it('should subscribe to state machine', async () => {
      await controller.init();
      expect(mockInstances.subscriptionManager.subscribeToState).toHaveBeenCalled();
    });

    it('should subscribe to paginator', async () => {
      await controller.init();
      expect(mockInstances.subscriptionManager.subscribeToPagination).toHaveBeenCalled();
    });

    it('should subscribe to media queries', async () => {
      await controller.init();
      expect(mockInstances.subscriptionManager.subscribeToMediaQueries).toHaveBeenCalled();
    });

    it('should bind resize handler', async () => {
      await controller.init();
      expect(mockInstances.resizeHandler.bind).toHaveBeenCalled();
    });

    it('should not initialize if already destroyed', async () => {
      controller.isDestroyed = true;
      await controller.init();
      expect(mockInstances.appInitializer.initialize).not.toHaveBeenCalled();
    });

    it('should update debug panel via mediator after init', async () => {
      await controller.init();
      expect(mockInstances.mediator.updateDebug).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should set isDestroyed to true', () => {
      controller.destroy();
      expect(controller.isDestroyed).toBe(true);
    });

    it('should unsubscribe all subscriptions', () => {
      controller.destroy();
      expect(mockInstances.subscriptionManager.unsubscribeAll).toHaveBeenCalled();
    });

    it('should destroy resize handler', () => {
      controller.destroy();
      expect(mockInstances.resizeHandler.destroy).toHaveBeenCalled();
    });

    it('should destroy all delegates', () => {
      controller.destroy();
      expect(mockInstances.navigationDelegate.destroy).toHaveBeenCalled();
      expect(mockInstances.lifecycleDelegate.destroy).toHaveBeenCalled();
      expect(mockInstances.settingsDelegate.destroy).toHaveBeenCalled();
      expect(mockInstances.chapterDelegate.destroy).toHaveBeenCalled();
      expect(mockInstances.dragDelegate.destroy).toHaveBeenCalled();
    });

    it('should destroy event controller', () => {
      controller.destroy();
      expect(mockInstances.eventController.destroy).toHaveBeenCalled();
    });

    it('should destroy service groups and other components', () => {
      controller.destroy();

      expect(mockInstances.audioServices.destroy).toHaveBeenCalled();
      expect(mockInstances.renderServices.destroy).toHaveBeenCalled();
      expect(mockInstances.contentServices.destroy).toHaveBeenCalled();
      expect(mockInstances.coreServices.destroy).toHaveBeenCalled();
      expect(mockInstances.appInitializer.destroy).toHaveBeenCalled();
      expect(mockInstances.stateMachine.destroy).toHaveBeenCalled();
      expect(mockInstances.settings.destroy).toHaveBeenCalled();
      expect(mockInstances.coreServices.dom.resetBookDOM).toHaveBeenCalled();
    });

    it('should nullify all references', () => {
      controller.destroy();
      expect(controller.state).toBeNull();
      expect(controller.mediator).toBeNull();
      expect(controller.core).toBeNull();
      expect(controller.audio).toBeNull();
      expect(controller.render).toBeNull();
      expect(controller.content).toBeNull();
      expect(controller.factory).toBeNull();
      expect(controller.settings).toBeNull();
      expect(controller.stateMachine).toBeNull();
      expect(controller.navigationDelegate).toBeNull();
      expect(controller.settingsDelegate).toBeNull();
      expect(controller.lifecycleDelegate).toBeNull();
      expect(controller.chapterDelegate).toBeNull();
      expect(controller.dragDelegate).toBeNull();
      expect(controller.eventController).toBeNull();
    });

    it('should not destroy twice', () => {
      controller.destroy();

      // Reset call counts after first destroy
      vi.clearAllMocks();

      controller.destroy();
      // Should not call destroy methods again
      expect(mockInstances.subscriptionManager.unsubscribeAll).not.toHaveBeenCalled();
    });
  });
});

describe('BookController event controller callbacks', () => {
  let controller;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockInstances();
    controller = new BookController();
  });

  afterEach(() => {
    controller?.destroy();
  });

  it('isBusy should return true when stateMachine is busy', () => {
    const handlers = mockInstances.eventController.handlers;
    mockInstances.stateMachine.state = 'FLIPPING';

    expect(handlers.isBusy()).toBe(true);
  });

  it('isBusy should return true when dragDelegate is active', () => {
    const handlers = mockInstances.eventController.handlers;
    mockInstances.stateMachine.state = 'OPENED';
    mockInstances.dragDelegate.isActive = true;

    expect(handlers.isBusy()).toBe(true);
  });

  it('isBusy should return false when neither busy nor dragging', () => {
    const handlers = mockInstances.eventController.handlers;
    mockInstances.stateMachine.state = 'OPENED';
    mockInstances.dragDelegate.isActive = false;

    expect(handlers.isBusy()).toBe(false);
  });

  it('isOpened should return stateMachine.isOpened', () => {
    const handlers = mockInstances.eventController.handlers;

    mockInstances.stateMachine.state = 'OPENED';
    expect(handlers.isOpened()).toBe(true);

    mockInstances.stateMachine.state = 'CLOSED';
    expect(handlers.isOpened()).toBe(false);
  });

  it('onFlip callback should call navigationDelegate.flip', () => {
    const handlers = mockInstances.eventController.handlers;
    handlers.onFlip('next');

    expect(mockInstances.navigationDelegate.flip).toHaveBeenCalledWith('next');
  });

  it('onTOCClick callback should call navigationDelegate.handleTOCNavigation', () => {
    const handlers = mockInstances.eventController.handlers;
    handlers.onTOCClick(2);

    expect(mockInstances.navigationDelegate.handleTOCNavigation).toHaveBeenCalledWith(2);
  });

  it('onSettings callback should call settingsDelegate.handleChange', () => {
    const handlers = mockInstances.eventController.handlers;
    handlers.onSettings('theme', 'dark');

    expect(mockInstances.settingsDelegate.handleChange).toHaveBeenCalledWith('theme', 'dark');
  });

  it('onOpen callback should call mediator.handleBookOpen', () => {
    const handlers = mockInstances.eventController.handlers;
    handlers.onOpen(true);

    expect(mockInstances.mediator.handleBookOpen).toHaveBeenCalledWith(true);
  });

  it('getFontSize callback should read from settings', () => {
    const handlers = mockInstances.eventController.handlers;
    expect(handlers.getFontSize).toBeDefined();

    mockInstances.settings.get.mockReturnValue(20);
    expect(handlers.getFontSize()).toBe(20);
    expect(mockInstances.settings.get).toHaveBeenCalledWith('fontSize');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTOR OPTIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('BookController constructor options', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should store provided options', () => {
    vi.clearAllMocks();
    resetMockInstances();
    const mockApi = { saveProgress: vi.fn() };
    const owner = { id: 'user-1', name: 'Author' };
    const ctrl = new BookController(null, {
      apiClient: mockApi,
      bookId: 'book-42',
      readerMode: 'guest',
      bookOwner: owner,
    });
    expect(ctrl._apiClient).toBe(mockApi);
    expect(ctrl._bookId).toBe('book-42');
    expect(ctrl._readerMode).toBe('guest');
    expect(ctrl._bookOwner).toBe(owner);
    ctrl.destroy();
  });

  it('should use defaults when options are omitted', () => {
    vi.clearAllMocks();
    resetMockInstances();
    const ctrl = new BookController();
    expect(ctrl._apiClient).toBeNull();
    expect(ctrl._bookOwner).toBeNull();
    expect(ctrl._readerMode).toBe('owner');
    ctrl.destroy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// _assertAlive
// ═══════════════════════════════════════════════════════════════════════════

describe('BookController _assertAlive', () => {
  let controller;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockInstances();
    controller = new BookController();
  });

  afterEach(() => {
    controller?.destroy();
    vi.restoreAllMocks();
  });

  it('should not throw when controller is alive', () => {
    expect(() => controller._assertAlive()).not.toThrow();
  });

  it('should throw when controller is destroyed', () => {
    controller.destroy();
    expect(() => controller._assertAlive()).toThrow('use-after-free');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// _setupSyncIndicator
// ═══════════════════════════════════════════════════════════════════════════

describe('BookController _setupSyncIndicator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('should set onSyncStateChange callback when api and bookId provided', () => {
    vi.clearAllMocks();
    resetMockInstances();
    // Создаём DOM-элементы индикатора
    const el = document.createElement('div');
    el.id = 'sync-indicator';
    el.hidden = true;
    const textEl = document.createElement('span');
    textEl.id = 'sync-indicator-text';
    document.body.appendChild(el);
    document.body.appendChild(textEl);

    const ctrl = new BookController(null, {
      apiClient: { saveProgress: vi.fn() },
      bookId: 'book-1',
    });

    expect(ctrl.settings.onSyncStateChange).toBeDefined();
    ctrl.destroy();
  });

  it('should not set callback if sync-indicator element is missing', () => {
    vi.clearAllMocks();
    resetMockInstances();
    // Нет DOM-элементов
    const ctrl = new BookController(null, {
      apiClient: { saveProgress: vi.fn() },
      bookId: 'book-1',
    });

    expect(ctrl.settings.onSyncStateChange).toBeUndefined();
    ctrl.destroy();
  });

  it('should show syncing state with correct class and text', () => {
    vi.clearAllMocks();
    resetMockInstances();
    const el = document.createElement('div');
    el.id = 'sync-indicator';
    el.hidden = true;
    const textEl = document.createElement('span');
    textEl.id = 'sync-indicator-text';
    document.body.appendChild(el);
    document.body.appendChild(textEl);

    const ctrl = new BookController(null, {
      apiClient: { saveProgress: vi.fn() },
      bookId: 'book-1',
    });

    ctrl.settings.onSyncStateChange('syncing');
    expect(el.hidden).toBe(false);
    expect(el.classList.contains('sync-indicator--syncing')).toBe(true);
    expect(textEl.textContent).toBe('common.saving');
    ctrl.destroy();
  });

  it('should show synced state and auto-hide after timeout', () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetMockInstances();
    const el = document.createElement('div');
    el.id = 'sync-indicator';
    el.hidden = true;
    const textEl = document.createElement('span');
    textEl.id = 'sync-indicator-text';
    document.body.appendChild(el);
    document.body.appendChild(textEl);

    const ctrl = new BookController(null, {
      apiClient: { saveProgress: vi.fn() },
      bookId: 'book-1',
    });

    ctrl.settings.onSyncStateChange('synced');
    expect(el.classList.contains('sync-indicator--synced')).toBe(true);
    expect(textEl.textContent).toBe('common.saved');
    expect(el.hidden).toBe(false);

    vi.advanceTimersByTime(2000);
    expect(el.hidden).toBe(true);

    ctrl.destroy();
    vi.useRealTimers();
  });

  it('should show error state', () => {
    vi.clearAllMocks();
    resetMockInstances();
    const el = document.createElement('div');
    el.id = 'sync-indicator';
    el.hidden = true;
    const textEl = document.createElement('span');
    textEl.id = 'sync-indicator-text';
    document.body.appendChild(el);
    document.body.appendChild(textEl);

    const ctrl = new BookController(null, {
      apiClient: { saveProgress: vi.fn() },
      bookId: 'book-1',
    });

    ctrl.settings.onSyncStateChange('error');
    expect(el.classList.contains('sync-indicator--error')).toBe(true);
    expect(textEl.textContent).toBe('common.notSaved');
    ctrl.destroy();
  });

  it('should reset className before applying new state', () => {
    vi.clearAllMocks();
    resetMockInstances();
    const el = document.createElement('div');
    el.id = 'sync-indicator';
    const textEl = document.createElement('span');
    textEl.id = 'sync-indicator-text';
    document.body.appendChild(el);
    document.body.appendChild(textEl);

    const ctrl = new BookController(null, {
      apiClient: { saveProgress: vi.fn() },
      bookId: 'book-1',
    });

    ctrl.settings.onSyncStateChange('syncing');
    ctrl.settings.onSyncStateChange('synced');
    // Предыдущий класс syncing должен быть сброшен
    expect(el.classList.contains('sync-indicator--syncing')).toBe(false);
    expect(el.classList.contains('sync-indicator--synced')).toBe(true);
    ctrl.destroy();
  });

  it('should set base class sync-indicator on state change', () => {
    vi.clearAllMocks();
    resetMockInstances();
    const el = document.createElement('div');
    el.id = 'sync-indicator';
    el.className = 'something-else';
    const textEl = document.createElement('span');
    textEl.id = 'sync-indicator-text';
    document.body.appendChild(el);
    document.body.appendChild(textEl);

    const ctrl = new BookController(null, {
      apiClient: { saveProgress: vi.fn() },
      bookId: 'book-1',
    });

    ctrl.settings.onSyncStateChange('syncing');
    // Базовый класс должен быть sync-indicator (не пустой, не старый)
    expect(el.className).toContain('sync-indicator');
    expect(el.className).not.toContain('something-else');
    ctrl.destroy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// destroy error collection
// ═══════════════════════════════════════════════════════════════════════════

describe('BookController destroy error handling', () => {
  let controller;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockInstances();
    controller = new BookController();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should collect errors from failing components and log them', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Заставляем один из делегатов бросить ошибку при destroy
    mockInstances.navigationDelegate.destroy.mockImplementation(() => {
      throw new Error('nav destroy failed');
    });

    controller.destroy();

    // Ошибка должна быть залогирована, а не проброшена
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('ошибок при очистке'),
      expect.arrayContaining([expect.any(Error)])
    );
  });

  it('should continue destroying other components when one fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInstances.navigationDelegate.destroy.mockImplementation(() => {
      throw new Error('nav failed');
    });

    controller.destroy();

    // Остальные делегаты всё равно должны быть уничтожены
    expect(mockInstances.settingsDelegate.destroy).toHaveBeenCalled();
    expect(mockInstances.lifecycleDelegate.destroy).toHaveBeenCalled();
    expect(mockInstances.chapterDelegate.destroy).toHaveBeenCalled();
    expect(mockInstances.dragDelegate.destroy).toHaveBeenCalled();
  });

  it('should not log errors when all components destroy cleanly', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    controller.destroy();

    expect(consoleSpy).not.toHaveBeenCalled();
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// init error recovery
// ═══════════════════════════════════════════════════════════════════════════

describe('BookController init error recovery', () => {
  let controller;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockInstances();
    controller = new BookController();
  });

  afterEach(() => {
    controller?.destroy();
    vi.restoreAllMocks();
  });

  it('should cleanup subscriptions on init failure', async () => {
    mockInstances.appInitializer.initialize.mockRejectedValue(new Error('init failed'));

    await expect(controller.init()).rejects.toThrow('init failed');

    expect(mockInstances.subscriptionManager.unsubscribeAll).toHaveBeenCalled();
  });

  it('should cleanup resize handler on init failure', async () => {
    mockInstances.appInitializer.initialize.mockRejectedValue(new Error('init failed'));

    await expect(controller.init()).rejects.toThrow('init failed');

    expect(mockInstances.resizeHandler.destroy).toHaveBeenCalled();
  });

  it('should subscribe to swipe hint after successful init', async () => {
    await controller.init();
    expect(mockInstances.subscriptionManager.subscribeToSwipeHint).toHaveBeenCalledWith(
      controller.stateMachine
    );
  });

  it('should pass updateDebug callback to subscribeToState', async () => {
    await controller.init();
    // subscribeToState третий аргумент — callback, который вызывает mediator.updateDebug
    const callback = mockInstances.subscriptionManager.subscribeToState.mock.calls[0][2];
    mockInstances.mediator.updateDebug.mockClear();
    callback();
    expect(mockInstances.mediator.updateDebug).toHaveBeenCalled();
  });

  it('should pass repaginate callback to subscribeToMediaQueries', async () => {
    await controller.init();
    const repaginateFn = mockInstances.subscriptionManager.subscribeToMediaQueries.mock.calls[0][0];
    mockInstances.mediator.repaginate.mockClear();
    repaginateFn(true);
    expect(mockInstances.mediator.repaginate).toHaveBeenCalledWith(true);
  });

  it('should pass isOpened callback to subscribeToMediaQueries', async () => {
    await controller.init();
    const isOpenedFn = mockInstances.subscriptionManager.subscribeToMediaQueries.mock.calls[0][1];
    mockInstances.stateMachine.state = 'OPENED';
    expect(isOpenedFn()).toBe(true);
    mockInstances.stateMachine.state = 'CLOSED';
    expect(isOpenedFn()).toBe(false);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// AppInitializer & ResizeHandler dependency passing
// ═══════════════════════════════════════════════════════════════════════════

describe('BookController dependency wiring', () => {
  let controller;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockInstances();
    controller = new BookController();
  });

  afterEach(() => {
    controller?.destroy();
    vi.restoreAllMocks();
  });

  it('should pass all required deps to AppInitializer', () => {
    vi.clearAllMocks();
    resetMockInstances();
    const ctrl = new BookController(null, { readerMode: 'guest', bookOwner: { id: 'u1' }, bookId: 'b1' });
    const deps = mockInstances.appInitializer._deps;

    expect(deps.dom).toBe(ctrl.core.dom);
    expect(deps.settings).toBe(ctrl.settings);
    expect(deps.settingsDelegate).toBe(ctrl.settingsDelegate);
    expect(deps.backgroundManager).toBe(ctrl.content.backgroundManager);
    expect(deps.eventController).toBe(ctrl.eventController);
    expect(deps.dragDelegate).toBe(ctrl.dragDelegate);
    expect(deps.lifecycleDelegate).toBe(ctrl.lifecycleDelegate);
    expect(deps.readerMode).toBe('guest');
    expect(deps.bookOwner).toEqual({ id: 'u1' });
    expect(deps.bookId).toBe('b1');
    ctrl.destroy();
  });

  it('should pass functional callbacks to ResizeHandler', () => {
    vi.clearAllMocks();
    resetMockInstances();
    const ctrl = new BookController();
    const deps = mockInstances.resizeHandler._deps;

    expect(deps.eventManager).toBe(ctrl.core.eventManager);
    expect(deps.timerManager).toBe(ctrl.core.timerManager);

    // repaginateFn должен вызывать mediator.repaginate
    mockInstances.mediator.repaginate.mockClear();
    deps.repaginateFn(true);
    expect(mockInstances.mediator.repaginate).toHaveBeenCalledWith(true);

    // isOpenedFn должен возвращать stateMachine.isOpened
    mockInstances.stateMachine.state = 'OPENED';
    expect(deps.isOpenedFn()).toBe(true);
    mockInstances.stateMachine.state = 'CLOSED';
    expect(deps.isOpenedFn()).toBe(false);

    // isDestroyedFn должен возвращать controller.isDestroyed
    expect(deps.isDestroyedFn()).toBe(false);
    ctrl.destroy();
  });
});

