/**
 * Unit tests for BookControllerBuilder
 * Pure factory for constructing the DI graph in three phases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════════════════

const { mockConfig, mockMediaQueries } = vi.hoisted(() => ({
  mockConfig: {
    CHAPTERS: [
      { id: 'ch1', file: 'content/part_1.html', bg: 'images/bg1.webp' },
    ],
    DEFAULT_SETTINGS: {
      font: 'georgia',
      fontSize: 18,
      theme: 'light',
      page: 0,
      soundEnabled: true,
      soundVolume: 0.3,
    },
  },
  mockMediaQueries: {
    isMobile: false,
    get: vi.fn(() => false),
  },
}));

// Track all created instances
let mockInstances = {};

const resetMockInstances = () => {
  mockInstances = {
    coreServices: null,
    audioServices: null,
    renderServices: null,
    contentServices: null,
    settings: null,
    stateMachine: null,
    debugPanel: null,
    factory: null,
  };
};

// Mock config
vi.mock('../../../js/config.js', () => ({
  CONFIG: mockConfig,
  getConfig: () => mockConfig,
}));

// Mock utils/index.js (for mediaQueries used by BookDIConfig)
vi.mock('../../../js/utils/index.js', () => ({
  mediaQueries: mockMediaQueries,
}));

// Mock delegates
vi.mock('../../../js/core/delegates/index.js', () => ({
  NavigationDelegate: class MockNavigationDelegate {
    constructor(deps) { this._deps = deps; this.destroy = vi.fn(); }
  },
  LifecycleDelegate: class MockLifecycleDelegate {
    constructor(deps) { this._deps = deps; this.destroy = vi.fn(); }
  },
  SettingsDelegate: class MockSettingsDelegate {
    constructor(deps) { this._deps = deps; this.destroy = vi.fn(); }
  },
  ChapterDelegate: class MockChapterDelegate {
    constructor(deps) { this._deps = deps; this.destroy = vi.fn(); }
  },
  DragDelegate: class MockDragDelegate {
    constructor(deps) { this._deps = deps; this.destroy = vi.fn(); }
  },
}));

// Mock ComponentFactory
vi.mock('../../../js/core/ComponentFactory.js', () => ({
  ComponentFactory: class MockComponentFactory {
    static createCoreServices() {
      mockInstances.coreServices = {
        dom: {
          get: vi.fn(() => document.createElement('div')),
          getMultiple: vi.fn((...keys) => {
            const result = {};
            keys.forEach(key => { result[key] = document.createElement('div'); });
            return result;
          }),
        },
        eventManager: { add: vi.fn(), remove: vi.fn(), removeAll: vi.fn() },
        timerManager: { setTimeout: vi.fn(), clearAll: vi.fn() },
        storage: { load: vi.fn(() => ({})), save: vi.fn() },
        destroy: vi.fn(),
      };
      return mockInstances.coreServices;
    }

    constructor(core) {
      this.core = core;
      mockInstances.factory = this;
    }

    createSettingsManager(options) {
      mockInstances.settings = {
        get: vi.fn((key) => mockConfig.DEFAULT_SETTINGS[key]),
        set: vi.fn(),
        getAll: vi.fn(() => ({ ...mockConfig.DEFAULT_SETTINGS })),
        applyServerProgress: vi.fn(),
        destroy: vi.fn(),
        _options: options,
      };
      return mockInstances.settings;
    }

    createAudioServices(settings) {
      mockInstances.audioServices = {
        soundManager: { play: vi.fn(), setVolume: vi.fn() },
        ambientManager: { play: vi.fn(), stop: vi.fn(), setVolume: vi.fn() },
        setupAmbientLoadingCallbacks: vi.fn(),
        destroy: vi.fn(),
        _settings: settings,
      };
      return mockInstances.audioServices;
    }

    createRenderServices() {
      mockInstances.renderServices = {
        renderer: { totalPages: 0, renderSpread: vi.fn() },
        animator: { runFlip: vi.fn() },
        paginator: { on: vi.fn(), paginate: vi.fn() },
        loadingIndicator: { show: vi.fn(), hide: vi.fn() },
        destroy: vi.fn(),
      };
      return mockInstances.renderServices;
    }

    createContentServices(options) {
      mockInstances.contentServices = {
        contentLoader: { load: vi.fn() },
        backgroundManager: { preloadAll: vi.fn(), getForChapter: vi.fn() },
        destroy: vi.fn(),
        _options: options,
      };
      return mockInstances.contentServices;
    }

    createStateMachine() {
      mockInstances.stateMachine = {
        state: 'CLOSED',
        transitionTo: vi.fn(),
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
  },
}));

// Import after mocks
const { buildBookComponents, createReadOnlyState } = await import(
  '../../../js/core/BookControllerBuilder.js'
);

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('createReadOnlyState', () => {
  it('should allow reading properties from state', () => {
    const state = { index: 5, chapterStarts: [0, 50] };
    const readOnly = createReadOnlyState(state);

    expect(readOnly.index).toBe(5);
    expect(readOnly.chapterStarts).toEqual([0, 50]);
  });

  it('should throw on property assignment', () => {
    const state = { index: 0, chapterStarts: [] };
    const readOnly = createReadOnlyState(state);

    expect(() => { readOnly.index = 10; }).toThrow('read-only');
    expect(() => { readOnly.index = 10; }).toThrow('index');
  });

  it('should throw on property deletion', () => {
    const state = { index: 0, chapterStarts: [] };
    const readOnly = createReadOnlyState(state);

    expect(() => { delete readOnly.index; }).toThrow('read-only');
    expect(() => { delete readOnly.index; }).toThrow('index');
  });

  it('should reflect changes made to the original state', () => {
    const state = { index: 0, chapterStarts: [] };
    const readOnly = createReadOnlyState(state);

    state.index = 42;
    expect(readOnly.index).toBe(42);
  });

  it('should return undefined for non-existent properties', () => {
    const state = { index: 0 };
    const readOnly = createReadOnlyState(state);

    expect(readOnly.nonExistent).toBeUndefined();
  });

  it('should preserve Object.keys enumeration', () => {
    const state = { index: 0, chapterStarts: [0, 10] };
    const readOnly = createReadOnlyState(state);

    expect(Object.keys(readOnly)).toEqual(['index', 'chapterStarts']);
  });
});

describe('buildBookComponents', () => {
  let state;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockInstances();
    state = { index: 0, chapterStarts: [] };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Phase 1: Services ──

  describe('phase 1: services', () => {
    it('should create core services', () => {
      const result = buildBookComponents({ state });
      expect(result.core).toBe(mockInstances.coreServices);
    });

    it('should create factory with core services', () => {
      buildBookComponents({ state });
      expect(mockInstances.factory.core).toBe(mockInstances.coreServices);
    });

    it('should create settings manager', () => {
      const result = buildBookComponents({ state });
      expect(result.settings).toBe(mockInstances.settings);
    });

    it('should pass apiClient and bookId to settings manager', () => {
      const apiClient = { get: vi.fn() };
      buildBookComponents({ state, apiClient, bookId: 'book-123' });
      expect(mockInstances.settings._options).toEqual({
        apiClient,
        bookId: 'book-123',
      });
    });

    it('should default apiClient and bookId to null', () => {
      buildBookComponents({ state });
      expect(mockInstances.settings._options).toEqual({
        apiClient: null,
        bookId: null,
      });
    });

    it('should apply server progress when provided', () => {
      const serverProgress = { page: 15, chapter: 2 };
      buildBookComponents({ state, serverProgress });
      expect(mockInstances.settings.applyServerProgress).toHaveBeenCalledWith(serverProgress);
    });

    it('should not apply server progress when not provided', () => {
      buildBookComponents({ state });
      expect(mockInstances.settings.applyServerProgress).not.toHaveBeenCalled();
    });

    it('should create audio services with settings', () => {
      const result = buildBookComponents({ state });
      expect(result.audio).toBe(mockInstances.audioServices);
      expect(mockInstances.audioServices._settings).toBe(mockInstances.settings);
    });

    it('should create render services', () => {
      const result = buildBookComponents({ state });
      expect(result.render).toBe(mockInstances.renderServices);
    });

    it('should create content services', () => {
      const result = buildBookComponents({ state });
      expect(result.content).toBe(mockInstances.contentServices);
    });

    it('should pass publicMode=false for owner readerMode', () => {
      buildBookComponents({ state, readerMode: 'owner' });
      expect(mockInstances.contentServices._options.publicMode).toBe(false);
    });

    it('should pass publicMode=true for guest readerMode', () => {
      buildBookComponents({ state, readerMode: 'guest' });
      expect(mockInstances.contentServices._options.publicMode).toBe(true);
    });

    it('should pass publicMode=true for embed readerMode', () => {
      buildBookComponents({ state, readerMode: 'embed' });
      expect(mockInstances.contentServices._options.publicMode).toBe(true);
    });

    it('should default readerMode to owner', () => {
      buildBookComponents({ state });
      expect(mockInstances.contentServices._options.publicMode).toBe(false);
    });

    it('should pass apiClient and bookId to content services', () => {
      const apiClient = { get: vi.fn() };
      buildBookComponents({ state, apiClient, bookId: 'book-456' });
      expect(mockInstances.contentServices._options.apiClient).toBe(apiClient);
      expect(mockInstances.contentServices._options.bookId).toBe('book-456');
    });

    it('should setup ambient loading callbacks with ambient pills element', () => {
      buildBookComponents({ state });
      expect(mockInstances.audioServices.setupAmbientLoadingCallbacks).toHaveBeenCalled();
      expect(mockInstances.coreServices.dom.get).toHaveBeenCalledWith('ambientPills');
    });
  });

  // ── Phase 2: Components ──

  describe('phase 2: components', () => {
    it('should create state machine', () => {
      const result = buildBookComponents({ state });
      expect(result.stateMachine).toBe(mockInstances.stateMachine);
    });

    it('should create debug panel', () => {
      const result = buildBookComponents({ state });
      expect(result.debugPanel).toBe(mockInstances.debugPanel);
    });
  });

  // ── Phase 3: Delegates ──

  describe('phase 3: delegates', () => {
    it('should create all five delegates', () => {
      const result = buildBookComponents({ state });
      expect(result.delegates.chapter).toBeDefined();
      expect(result.delegates.navigation).toBeDefined();
      expect(result.delegates.lifecycle).toBeDefined();
      expect(result.delegates.settings).toBeDefined();
      expect(result.delegates.drag).toBeDefined();
    });

    it('should pass read-only state to delegates', () => {
      const result = buildBookComponents({ state });

      // Delegates receive a Proxy — verify read-only behavior
      const delegateState = result.delegates.chapter._deps.state;
      expect(delegateState.index).toBe(0);
      expect(() => { delegateState.index = 999; }).toThrow('read-only');
    });

    it('should pass core services dependencies to delegates', () => {
      const result = buildBookComponents({ state });
      // ChapterDelegate receives dom from core
      expect(result.delegates.chapter._deps.dom).toBe(mockInstances.coreServices.dom);
    });

    it('should pass audio services dependencies to delegates', () => {
      const result = buildBookComponents({ state });
      // NavigationDelegate receives soundManager from audio
      expect(result.delegates.navigation._deps.soundManager).toBe(
        mockInstances.audioServices.soundManager
      );
    });

    it('should pass render services dependencies to delegates', () => {
      const result = buildBookComponents({ state });
      // NavigationDelegate receives renderer and animator from render
      expect(result.delegates.navigation._deps.renderer).toBe(
        mockInstances.renderServices.renderer
      );
      expect(result.delegates.navigation._deps.animator).toBe(
        mockInstances.renderServices.animator
      );
    });

    it('should pass content services dependencies to delegates', () => {
      const result = buildBookComponents({ state });
      // ChapterDelegate receives backgroundManager from content
      expect(result.delegates.chapter._deps.backgroundManager).toBe(
        mockInstances.contentServices.backgroundManager
      );
    });

    it('should pass stateMachine to delegates', () => {
      const result = buildBookComponents({ state });
      expect(result.delegates.navigation._deps.stateMachine).toBe(mockInstances.stateMachine);
    });

    it('should pass settings to delegates', () => {
      const result = buildBookComponents({ state });
      expect(result.delegates.navigation._deps.settings).toBe(mockInstances.settings);
    });
  });

  // ── Return structure ──

  describe('return value', () => {
    it('should return all expected properties', () => {
      const result = buildBookComponents({ state });

      expect(result).toHaveProperty('core');
      expect(result).toHaveProperty('factory');
      expect(result).toHaveProperty('settings');
      expect(result).toHaveProperty('audio');
      expect(result).toHaveProperty('render');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('stateMachine');
      expect(result).toHaveProperty('debugPanel');
      expect(result).toHaveProperty('delegates');
    });

    it('should return factory instance', () => {
      const result = buildBookComponents({ state });
      expect(result.factory).toBe(mockInstances.factory);
    });
  });
});
