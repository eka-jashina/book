/**
 * Тесты для ComponentFactory
 * Фабрика для создания компонентов приложения (сервисные группы)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFactory } from '../../../js/core/ComponentFactory.js';

// Mock all imports
vi.mock('../../../js/config.js', () => {
  const CONFIG = {
    DEFAULT_SETTINGS: {
      font: 'georgia',
      fontSize: 18,
      theme: 'light',
      soundEnabled: true,
      soundVolume: 0.3,
      ambientType: 'none',
      ambientVolume: 0.5,
    },
    SOUNDS: {
      pageFlip: '/sounds/page-flip.mp3',
      bookOpen: '/sounds/cover-flip.mp3',
      bookClose: '/sounds/cover-flip.mp3',
    },
    AMBIENT: {
      none: { label: 'None', file: null },
      rain: { label: 'Rain', file: '/sounds/ambient/rain.mp3' },
    },
    VIRTUALIZATION: {
      cacheLimit: 12,
    },
  };
  return { CONFIG, getConfig: () => CONFIG };
});

vi.mock('../../../js/managers/index.js', () => {
  const BookStateMachine = vi.fn(function() { this.type = 'stateMachine'; });
  const SettingsManager = vi.fn(function() { this.type = 'settingsManager'; });
  return { BookStateMachine, SettingsManager };
});

vi.mock('../../../js/core/DebugPanel.js', () => {
  const DebugPanel = vi.fn(function() { this.type = 'debugPanel'; });
  return { DebugPanel };
});

vi.mock('../../../js/core/EventController.js', () => {
  const EventController = vi.fn(function() { this.type = 'eventController'; });
  return { EventController };
});

vi.mock('../../../js/core/services/index.js', () => {
  const CoreServices = vi.fn(function() { this.type = 'coreServices'; });
  const AudioServices = vi.fn(function() { this.type = 'audioServices'; });
  const RenderServices = vi.fn(function() { this.type = 'renderServices'; });
  const ContentServices = vi.fn(function() { this.type = 'contentServices'; });
  return { CoreServices, AudioServices, RenderServices, ContentServices };
});

import { BookStateMachine, SettingsManager } from '../../../js/managers/index.js';
import { DebugPanel } from '../../../js/core/DebugPanel.js';
import { EventController } from '../../../js/core/EventController.js';
import { CoreServices, AudioServices, RenderServices, ContentServices } from '../../../js/core/services/index.js';

describe('ComponentFactory', () => {
  let factory;
  let mockCore;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCore = {
      dom: {
        get: vi.fn().mockReturnValue(document.createElement('div')),
        getMultiple: vi.fn().mockReturnValue({
          debugInfo: document.createElement('div'),
          debugState: document.createElement('div'),
          debugTotal: document.createElement('div'),
          debugCurrent: document.createElement('div'),
          debugCache: document.createElement('div'),
          debugMemory: document.createElement('div'),
          debugListeners: document.createElement('div'),
        }),
      },
      eventManager: { add: vi.fn() },
      timerManager: { setTimeout: vi.fn() },
      storage: { load: vi.fn(), save: vi.fn() },
    };

    factory = new ComponentFactory(mockCore);
  });

  describe('constructor', () => {
    it('should store core reference', () => {
      expect(factory.core).toBe(mockCore);
    });
  });

  describe('static createCoreServices', () => {
    it('should create CoreServices', () => {
      const result = ComponentFactory.createCoreServices();

      expect(CoreServices).toHaveBeenCalled();
      expect(result.type).toBe('coreServices');
    });
  });

  describe('createAudioServices', () => {
    it('should create AudioServices with settings', () => {
      const mockSettings = { type: 'settings' };
      const result = factory.createAudioServices(mockSettings);

      expect(AudioServices).toHaveBeenCalledWith(mockSettings);
      expect(result.type).toBe('audioServices');
    });
  });

  describe('createRenderServices', () => {
    it('should create RenderServices with core', () => {
      const result = factory.createRenderServices();

      expect(RenderServices).toHaveBeenCalledWith(mockCore);
      expect(result.type).toBe('renderServices');
    });
  });

  describe('createContentServices', () => {
    it('should create ContentServices', () => {
      const result = factory.createContentServices();

      expect(ContentServices).toHaveBeenCalled();
      expect(result.type).toBe('contentServices');
    });
  });

  describe('createStateMachine', () => {
    it('should create BookStateMachine', () => {
      const result = factory.createStateMachine();

      expect(BookStateMachine).toHaveBeenCalled();
      expect(result.type).toBe('stateMachine');
    });
  });

  describe('createSettingsManager', () => {
    it('should create SettingsManager with storage and defaults', () => {
      const result = factory.createSettingsManager();

      expect(SettingsManager).toHaveBeenCalledWith(
        mockCore.storage,
        expect.objectContaining({ font: 'georgia' }),
        {}
      );
      expect(result.type).toBe('settingsManager');
    });
  });

  describe('createDebugPanel', () => {
    it('should create DebugPanel with DOM elements', () => {
      const result = factory.createDebugPanel();

      expect(mockCore.dom.getMultiple).toHaveBeenCalledWith(
        'debugInfo', 'debugState', 'debugTotal', 'debugCurrent',
        'debugCache', 'debugMemory', 'debugListeners'
      );
      expect(DebugPanel).toHaveBeenCalled();
      expect(result.type).toBe('debugPanel');
    });
  });

  describe('createEventController', () => {
    it('should create EventController with handlers', () => {
      const handlers = {
        onFlip: vi.fn(),
        onTOCClick: vi.fn(),
        onOpen: vi.fn(),
        onSettings: vi.fn(),
        isBusy: vi.fn(),
        isOpened: vi.fn(),
      };

      const result = factory.createEventController(handlers);

      expect(mockCore.dom.get).toHaveBeenCalledWith('book');
      expect(EventController).toHaveBeenCalledWith(
        expect.objectContaining({
          book: expect.any(Object),
          eventManager: mockCore.eventManager,
          ...handlers,
        })
      );
      expect(result.type).toBe('eventController');
    });
  });
});
