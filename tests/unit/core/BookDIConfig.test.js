/**
 * Unit tests for BookDIConfig
 * Centralized DI wiring configuration for all delegates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════════════════

const mockMediaQueries = vi.hoisted(() => ({
  isMobile: false,
  get: vi.fn(() => false),
}));

// Track constructor arguments for each delegate
let delegateConstructorArgs = {};

const resetDelegateArgs = () => {
  delegateConstructorArgs = {
    chapter: null,
    navigation: null,
    lifecycle: null,
    settings: null,
    drag: null,
  };
};

vi.mock('../../../js/utils/index.js', () => ({
  mediaQueries: mockMediaQueries,
}));

vi.mock('../../../js/core/delegates/index.js', () => ({
  ChapterDelegate: class MockChapterDelegate {
    constructor(deps) {
      this._deps = deps;
      delegateConstructorArgs.chapter = deps;
    }
  },
  NavigationDelegate: class MockNavigationDelegate {
    constructor(deps) {
      this._deps = deps;
      delegateConstructorArgs.navigation = deps;
    }
  },
  LifecycleDelegate: class MockLifecycleDelegate {
    constructor(deps) {
      this._deps = deps;
      delegateConstructorArgs.lifecycle = deps;
    }
  },
  SettingsDelegate: class MockSettingsDelegate {
    constructor(deps) {
      this._deps = deps;
      delegateConstructorArgs.settings = deps;
    }
  },
  DragDelegate: class MockDragDelegate {
    constructor(deps) {
      this._deps = deps;
      delegateConstructorArgs.drag = deps;
    }
  },
}));

// Import after mocks
const { createBookDelegates } = await import('../../../js/core/BookDIConfig.js');

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const createMockDeps = () => ({
  core: {
    dom: { get: vi.fn(), getMultiple: vi.fn() },
    eventManager: { add: vi.fn(), remove: vi.fn() },
    timerManager: { setTimeout: vi.fn() },
    storage: { load: vi.fn(), save: vi.fn() },
  },
  audio: {
    soundManager: { play: vi.fn(), setVolume: vi.fn() },
    ambientManager: { play: vi.fn(), stop: vi.fn(), setVolume: vi.fn() },
  },
  render: {
    renderer: { totalPages: 0, renderSpread: vi.fn() },
    animator: { runFlip: vi.fn() },
    paginator: { on: vi.fn(), paginate: vi.fn() },
    loadingIndicator: { show: vi.fn(), hide: vi.fn() },
  },
  content: {
    contentLoader: { load: vi.fn() },
    backgroundManager: { preloadAll: vi.fn(), getForChapter: vi.fn() },
  },
  stateMachine: {
    state: 'CLOSED',
    transitionTo: vi.fn(),
    subscribe: vi.fn(),
  },
  settings: {
    get: vi.fn(),
    set: vi.fn(),
    getAll: vi.fn(),
  },
  debugPanel: {
    update: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
  },
  state: { index: 0, chapterStarts: [0, 50] },
});

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('createBookDelegates', () => {
  let deps;

  beforeEach(() => {
    vi.clearAllMocks();
    resetDelegateArgs();
    deps = createMockDeps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Return structure ──

  describe('return value', () => {
    it('should return all five delegates', () => {
      const delegates = createBookDelegates(deps);

      expect(delegates.chapter).toBeDefined();
      expect(delegates.navigation).toBeDefined();
      expect(delegates.lifecycle).toBeDefined();
      expect(delegates.settings).toBeDefined();
      expect(delegates.drag).toBeDefined();
    });

    it('should return exactly five keys', () => {
      const delegates = createBookDelegates(deps);
      expect(Object.keys(delegates)).toHaveLength(5);
    });
  });

  // ── ChapterDelegate ──

  describe('ChapterDelegate wiring', () => {
    it('should receive backgroundManager from content', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.chapter.backgroundManager).toBe(
        deps.content.backgroundManager
      );
    });

    it('should receive dom from core', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.chapter.dom).toBe(deps.core.dom);
    });

    it('should receive state', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.chapter.state).toBe(deps.state);
    });

    it('should receive exactly 3 dependencies', () => {
      createBookDelegates(deps);
      expect(Object.keys(delegateConstructorArgs.chapter)).toHaveLength(3);
    });
  });

  // ── NavigationDelegate ──

  describe('NavigationDelegate wiring', () => {
    it('should receive stateMachine', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.navigation.stateMachine).toBe(deps.stateMachine);
    });

    it('should receive renderer from render', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.navigation.renderer).toBe(deps.render.renderer);
    });

    it('should receive animator from render', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.navigation.animator).toBe(deps.render.animator);
    });

    it('should receive settings', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.navigation.settings).toBe(deps.settings);
    });

    it('should receive soundManager from audio', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.navigation.soundManager).toBe(deps.audio.soundManager);
    });

    it('should receive mediaQueries', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.navigation.mediaQueries).toBe(mockMediaQueries);
    });

    it('should receive state', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.navigation.state).toBe(deps.state);
    });

    it('should receive exactly 7 dependencies', () => {
      createBookDelegates(deps);
      expect(Object.keys(delegateConstructorArgs.navigation)).toHaveLength(7);
    });
  });

  // ── LifecycleDelegate ──

  describe('LifecycleDelegate wiring', () => {
    it('should receive stateMachine', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.lifecycle.stateMachine).toBe(deps.stateMachine);
    });

    it('should receive backgroundManager from content', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.lifecycle.backgroundManager).toBe(
        deps.content.backgroundManager
      );
    });

    it('should receive contentLoader from content', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.lifecycle.contentLoader).toBe(deps.content.contentLoader);
    });

    it('should receive paginator from render', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.lifecycle.paginator).toBe(deps.render.paginator);
    });

    it('should receive renderer from render', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.lifecycle.renderer).toBe(deps.render.renderer);
    });

    it('should receive animator from render', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.lifecycle.animator).toBe(deps.render.animator);
    });

    it('should receive loadingIndicator from render', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.lifecycle.loadingIndicator).toBe(
        deps.render.loadingIndicator
      );
    });

    it('should receive soundManager from audio', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.lifecycle.soundManager).toBe(deps.audio.soundManager);
    });

    it('should receive ambientManager from audio', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.lifecycle.ambientManager).toBe(deps.audio.ambientManager);
    });

    it('should receive settings', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.lifecycle.settings).toBe(deps.settings);
    });

    it('should receive dom from core', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.lifecycle.dom).toBe(deps.core.dom);
    });

    it('should receive mediaQueries', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.lifecycle.mediaQueries).toBe(mockMediaQueries);
    });

    it('should receive state', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.lifecycle.state).toBe(deps.state);
    });

    it('should receive exactly 13 dependencies', () => {
      createBookDelegates(deps);
      expect(Object.keys(delegateConstructorArgs.lifecycle)).toHaveLength(13);
    });
  });

  // ── SettingsDelegate ──

  describe('SettingsDelegate wiring', () => {
    it('should receive dom from core', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.settings.dom).toBe(deps.core.dom);
    });

    it('should receive settings', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.settings.settings).toBe(deps.settings);
    });

    it('should receive soundManager from audio', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.settings.soundManager).toBe(deps.audio.soundManager);
    });

    it('should receive ambientManager from audio', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.settings.ambientManager).toBe(deps.audio.ambientManager);
    });

    it('should receive debugPanel', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.settings.debugPanel).toBe(deps.debugPanel);
    });

    it('should receive stateMachine', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.settings.stateMachine).toBe(deps.stateMachine);
    });

    it('should receive mediaQueries', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.settings.mediaQueries).toBe(mockMediaQueries);
    });

    it('should receive state', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.settings.state).toBe(deps.state);
    });

    it('should receive exactly 8 dependencies', () => {
      createBookDelegates(deps);
      expect(Object.keys(delegateConstructorArgs.settings)).toHaveLength(8);
    });
  });

  // ── DragDelegate ──

  describe('DragDelegate wiring', () => {
    it('should receive stateMachine', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.drag.stateMachine).toBe(deps.stateMachine);
    });

    it('should receive renderer from render', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.drag.renderer).toBe(deps.render.renderer);
    });

    it('should receive animator from render', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.drag.animator).toBe(deps.render.animator);
    });

    it('should receive soundManager from audio', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.drag.soundManager).toBe(deps.audio.soundManager);
    });

    it('should receive dom from core', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.drag.dom).toBe(deps.core.dom);
    });

    it('should receive eventManager from core', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.drag.eventManager).toBe(deps.core.eventManager);
    });

    it('should receive mediaQueries', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.drag.mediaQueries).toBe(mockMediaQueries);
    });

    it('should receive state', () => {
      createBookDelegates(deps);
      expect(delegateConstructorArgs.drag.state).toBe(deps.state);
    });

    it('should receive exactly 8 dependencies', () => {
      createBookDelegates(deps);
      expect(Object.keys(delegateConstructorArgs.drag)).toHaveLength(8);
    });
  });

  // ── Shared dependencies ──

  describe('shared dependencies across delegates', () => {
    it('should pass the same state reference to all delegates', () => {
      createBookDelegates(deps);

      const stateRef = deps.state;
      expect(delegateConstructorArgs.chapter.state).toBe(stateRef);
      expect(delegateConstructorArgs.navigation.state).toBe(stateRef);
      expect(delegateConstructorArgs.lifecycle.state).toBe(stateRef);
      expect(delegateConstructorArgs.settings.state).toBe(stateRef);
      expect(delegateConstructorArgs.drag.state).toBe(stateRef);
    });

    it('should pass the same mediaQueries to all delegates that need it', () => {
      createBookDelegates(deps);

      expect(delegateConstructorArgs.navigation.mediaQueries).toBe(mockMediaQueries);
      expect(delegateConstructorArgs.lifecycle.mediaQueries).toBe(mockMediaQueries);
      expect(delegateConstructorArgs.settings.mediaQueries).toBe(mockMediaQueries);
      expect(delegateConstructorArgs.drag.mediaQueries).toBe(mockMediaQueries);
    });

    it('should pass the same stateMachine to all delegates that need it', () => {
      createBookDelegates(deps);

      expect(delegateConstructorArgs.navigation.stateMachine).toBe(deps.stateMachine);
      expect(delegateConstructorArgs.lifecycle.stateMachine).toBe(deps.stateMachine);
      expect(delegateConstructorArgs.settings.stateMachine).toBe(deps.stateMachine);
      expect(delegateConstructorArgs.drag.stateMachine).toBe(deps.stateMachine);
    });

    it('should pass the same soundManager to navigation, lifecycle, settings, drag', () => {
      createBookDelegates(deps);

      const sm = deps.audio.soundManager;
      expect(delegateConstructorArgs.navigation.soundManager).toBe(sm);
      expect(delegateConstructorArgs.lifecycle.soundManager).toBe(sm);
      expect(delegateConstructorArgs.settings.soundManager).toBe(sm);
      expect(delegateConstructorArgs.drag.soundManager).toBe(sm);
    });

    it('should pass the same dom to chapter, lifecycle, settings, drag', () => {
      createBookDelegates(deps);

      const dom = deps.core.dom;
      expect(delegateConstructorArgs.chapter.dom).toBe(dom);
      expect(delegateConstructorArgs.lifecycle.dom).toBe(dom);
      expect(delegateConstructorArgs.settings.dom).toBe(dom);
      expect(delegateConstructorArgs.drag.dom).toBe(dom);
    });
  });
});
