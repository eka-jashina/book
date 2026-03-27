/**
 * Unit tests for SettingsDelegate
 * Settings application and change handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mocks
const { mockCssVars, mockAnnounce } = vi.hoisted(() => ({
  mockCssVars: {
    invalidateCache: vi.fn(),
    getNumber: vi.fn((name, defaultVal) => defaultVal),
  },
  mockAnnounce: vi.fn(),
}));

vi.mock('../../../../js/utils/index.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    cssVars: mockCssVars,
    announce: mockAnnounce,
  };
});

vi.mock('../../../../js/config.js', () => {
  const cfg = {
    FONTS: {
      georgia: 'Georgia, serif',
      merriweather: "'Merriweather', serif",
      times: "'Times New Roman', serif",
    },
  };
  return { CONFIG: cfg, getConfig: () => cfg };
});

const { SettingsDelegate } = await import('../../../../js/core/delegates/SettingsDelegate.js');
const { DelegateEvents } = await import('../../../../js/core/delegates/BaseDelegate.js');

describe('SettingsDelegate', () => {
  let delegate;
  let mockDeps;
  let mockHtml;
  let eventHandlers;

  beforeEach(() => {
    // Event handlers to capture emitted events
    eventHandlers = {
      onSettingsUpdate: vi.fn(),
      onRepaginate: vi.fn(),
    };

    mockHtml = {
      style: {
        setProperty: vi.fn(),
        removeProperty: vi.fn(),
      },
      dataset: {},
    };

    mockDeps = {
      dom: {
        get: vi.fn((key) => {
          if (key === 'html') return mockHtml;
          return null;
        }),
      },
      settings: {
        get: vi.fn((key) => {
          const values = {
            font: 'georgia',
            fontSize: 18,
            theme: 'light',
            soundEnabled: true,
            soundVolume: 0.5,
            ambientVolume: 0.5,
            ambientType: 'rain',
          };
          return values[key];
        }),
        set: vi.fn(),
      },
      soundManager: {
        setEnabled: vi.fn(),
        setVolume: vi.fn(),
      },
      ambientManager: {
        setVolume: vi.fn(),
        setType: vi.fn(),
      },
      debugPanel: {
        toggle: vi.fn(),
      },
      stateMachine: {
        current: 'OPENED',
        get isOpened() { return this.current === 'OPENED'; },
      },
      mediaQueries: {
        get: vi.fn((key) => key === 'mobile' ? false : null),
      },
      state: {
        index: 0,
        chapterStarts: [],
      },
    };

    delegate = new SettingsDelegate(mockDeps);

    // Subscribe to delegate events
    delegate.on(DelegateEvents.SETTINGS_UPDATE, eventHandlers.onSettingsUpdate);
    delegate.on(DelegateEvents.REPAGINATE, eventHandlers.onRepaginate);

    // Reset mocks
    mockCssVars.invalidateCache.mockClear();
    mockCssVars.getNumber.mockImplementation((name, defaultVal) => defaultVal);
    mockAnnounce.mockClear();
  });

  afterEach(() => {
    delegate.destroy();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should store debugPanel reference', () => {
      expect(delegate.debugPanel).toBe(mockDeps.debugPanel);
    });

    it('should extend EventEmitter', () => {
      expect(typeof delegate.on).toBe('function');
      expect(typeof delegate.emit).toBe('function');
    });

    it('should throw error if required dependencies are missing', () => {
      expect(() => new SettingsDelegate({})).toThrow('SettingsDelegate');
    });
  });

  describe('apply', () => {
    it('should apply font setting', () => {
      delegate.apply();

      expect(mockHtml.style.setProperty).toHaveBeenCalledWith(
        '--reader-font-family',
        'Georgia, serif'
      );
    });

    it('should apply fontSize setting', () => {
      delegate.apply();

      expect(mockHtml.style.setProperty).toHaveBeenCalledWith(
        '--reader-font-size',
        '18px'
      );
    });

    it('should apply sound settings', () => {
      delegate.apply();

      expect(mockDeps.soundManager.setEnabled).toHaveBeenCalledWith(true);
      expect(mockDeps.soundManager.setVolume).toHaveBeenCalledWith(0.5);
    });

    it('should apply ambient volume', () => {
      delegate.apply();

      expect(mockDeps.ambientManager.setVolume).toHaveBeenCalledWith(0.5);
    });

    it('should invalidate CSS cache', () => {
      delegate.apply();

      expect(mockCssVars.invalidateCache).toHaveBeenCalled();
    });

    it('should handle missing HTML element', () => {
      mockDeps.dom.get.mockReturnValue(null);

      expect(() => delegate.apply()).not.toThrow();
    });

    it('should use default font if unknown font key', () => {
      mockDeps.settings.get.mockImplementation((key) => {
        if (key === 'font') return 'unknown_font';
        return null;
      });

      delegate.apply();

      expect(mockHtml.style.setProperty).toHaveBeenCalledWith(
        '--reader-font-family',
        'Georgia, serif'
      );
    });
  });

  describe('handleChange', () => {
    it('should save setting value', () => {
      delegate.handleChange('theme', 'dark');

      expect(mockDeps.settings.set).toHaveBeenCalledWith('theme', 'dark');
    });

    it('should not save action values directly', () => {
      delegate.handleChange('fontSize', 'increase');

      expect(mockDeps.settings.set).not.toHaveBeenCalledWith('fontSize', 'increase');
    });

    it('should emit settingsUpdate event', () => {
      delegate.handleChange('theme', 'dark');

      expect(eventHandlers.onSettingsUpdate).toHaveBeenCalled();
    });

    describe('fontSize handling', () => {
      it('should increase font size', () => {
        mockDeps.settings.get.mockImplementation((key) => key === 'fontSize' ? 18 : null);

        delegate.handleChange('fontSize', 'increase');

        expect(mockDeps.settings.set).toHaveBeenCalledWith('fontSize', 19);
        expect(mockHtml.style.setProperty).toHaveBeenCalledWith('--reader-font-size', '19px');
      });

      it('should decrease font size', () => {
        mockDeps.settings.get.mockImplementation((key) => key === 'fontSize' ? 18 : null);

        delegate.handleChange('fontSize', 'decrease');

        expect(mockDeps.settings.set).toHaveBeenCalledWith('fontSize', 17);
      });

      it('should not exceed max font size', () => {
        mockDeps.settings.get.mockImplementation((key) => key === 'fontSize' ? 22 : null);
        mockCssVars.getNumber.mockImplementation((name, defaultVal) => {
          if (name === '--font-max') return 22;
          return defaultVal;
        });

        delegate.handleChange('fontSize', 'increase');

        expect(mockDeps.settings.set).not.toHaveBeenCalledWith('fontSize', 23);
      });

      it('should not go below min font size', () => {
        mockDeps.settings.get.mockImplementation((key) => key === 'fontSize' ? 14 : null);
        mockCssVars.getNumber.mockImplementation((name, defaultVal) => {
          if (name === '--font-min') return 14;
          return defaultVal;
        });

        delegate.handleChange('fontSize', 'decrease');

        expect(mockDeps.settings.set).not.toHaveBeenCalledWith('fontSize', 13);
      });

      it('should emit repaginate event when opened', () => {
        mockDeps.settings.get.mockImplementation((key) => key === 'fontSize' ? 18 : null);

        delegate.handleChange('fontSize', 'increase');

        expect(eventHandlers.onRepaginate).toHaveBeenCalledWith(true);
      });

      it('should announce font size change', () => {
        mockDeps.settings.get.mockImplementation((key) => key === 'fontSize' ? 18 : null);

        delegate.handleChange('fontSize', 'increase');

        expect(mockAnnounce).toHaveBeenCalledWith('Размер шрифта: 19');
      });

      it('should not announce when size unchanged', () => {
        mockDeps.settings.get.mockImplementation((key) => key === 'fontSize' ? 22 : null);
        mockCssVars.getNumber.mockImplementation((name, defaultVal) => {
          if (name === '--font-max') return 22;
          return defaultVal;
        });

        delegate.handleChange('fontSize', 'increase');

        expect(mockAnnounce).not.toHaveBeenCalled();
      });
    });

    describe('font handling', () => {
      it('should apply new font', () => {
        delegate.handleChange('font', 'merriweather');

        expect(mockHtml.style.setProperty).toHaveBeenCalledWith(
          '--reader-font-family',
          "'Merriweather', serif"
        );
      });

      it('should emit repaginate event when opened', () => {
        delegate.handleChange('font', 'merriweather');

        expect(eventHandlers.onRepaginate).toHaveBeenCalledWith(true);
      });

      it('should announce font change', () => {
        delegate.handleChange('font', 'merriweather');

        expect(mockAnnounce).toHaveBeenCalledWith('Шрифт: Merriweather');
      });

      it('should announce georgia font', () => {
        delegate.handleChange('font', 'georgia');

        expect(mockAnnounce).toHaveBeenCalledWith('Шрифт: Georgia');
      });
    });

    describe('theme handling', () => {
      it('should apply light theme', () => {
        delegate.handleChange('theme', 'light');

        expect(mockHtml.dataset.theme).toBe('');
      });

      it('should apply dark theme', () => {
        delegate.handleChange('theme', 'dark');

        expect(mockHtml.dataset.theme).toBe('dark');
      });

      it('should apply bw theme', () => {
        delegate.handleChange('theme', 'bw');

        expect(mockHtml.dataset.theme).toBe('bw');
      });

      it('should announce light theme', () => {
        delegate.handleChange('theme', 'light');

        expect(mockAnnounce).toHaveBeenCalledWith('Светлая тема');
      });

      it('should announce dark theme', () => {
        delegate.handleChange('theme', 'dark');

        expect(mockAnnounce).toHaveBeenCalledWith('Тёмная тема');
      });

      it('should announce bw theme', () => {
        delegate.handleChange('theme', 'bw');

        expect(mockAnnounce).toHaveBeenCalledWith('Чёрно-белая тема');
      });
    });

    describe('sound handling', () => {
      it('should toggle sound', () => {
        delegate.handleChange('soundEnabled', false);

        expect(mockDeps.soundManager.setEnabled).toHaveBeenCalledWith(false);
      });

      it('should set sound volume with number', () => {
        delegate.handleChange('soundVolume', 0.8);

        expect(mockDeps.soundManager.setVolume).toHaveBeenCalledWith(0.8);
      });

      it('should increase sound volume', () => {
        mockDeps.settings.get.mockImplementation((key) => key === 'soundVolume' ? 0.5 : null);

        delegate.handleChange('soundVolume', 'increase');

        expect(mockDeps.settings.set).toHaveBeenCalledWith('soundVolume', 0.6);
        expect(mockDeps.soundManager.setVolume).toHaveBeenCalledWith(0.6);
      });

      it('should decrease sound volume', () => {
        mockDeps.settings.get.mockImplementation((key) => key === 'soundVolume' ? 0.5 : null);

        delegate.handleChange('soundVolume', 'decrease');

        expect(mockDeps.settings.set).toHaveBeenCalledWith('soundVolume', 0.4);
      });

      it('should not exceed max volume', () => {
        mockDeps.settings.get.mockImplementation((key) => key === 'soundVolume' ? 1.0 : null);

        delegate.handleChange('soundVolume', 'increase');

        expect(mockDeps.soundManager.setVolume).not.toHaveBeenCalled();
      });

      it('should clamp volume to valid range', () => {
        delegate.handleChange('soundVolume', 1.5);

        expect(mockDeps.soundManager.setVolume).toHaveBeenCalledWith(1);
      });
    });

    describe('debug handling', () => {
      it('should toggle debug panel', () => {
        delegate.handleChange('debug', true);

        expect(mockDeps.debugPanel.toggle).toHaveBeenCalled();
      });
    });

    describe('ambient handling', () => {
      it('should change ambient type', () => {
        delegate.handleChange('ambientType', 'fireplace');

        expect(mockDeps.ambientManager.setType).toHaveBeenCalledWith('fireplace', true);
      });

      it('should change ambient volume', () => {
        delegate.handleChange('ambientVolume', 0.7);

        expect(mockDeps.ambientManager.setVolume).toHaveBeenCalledWith(0.7);
      });
    });

    describe('fullscreen handling', () => {
      it('should request fullscreen when not in fullscreen', () => {
        const mockRequestFullscreen = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(document, 'fullscreenElement', { value: null, writable: true });
        document.documentElement.requestFullscreen = mockRequestFullscreen;

        delegate.handleChange('fullscreen', true);

        expect(mockRequestFullscreen).toHaveBeenCalled();
      });

      it('should exit fullscreen when in fullscreen', () => {
        const mockExitFullscreen = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(document, 'fullscreenElement', { value: document.body, writable: true });
        document.exitFullscreen = mockExitFullscreen;

        delegate.handleChange('fullscreen', true);

        expect(mockExitFullscreen).toHaveBeenCalled();
      });
    });
  });

  describe('destroy', () => {
    it('should clear references', () => {
      delegate.destroy();

      expect(delegate.debugPanel).toBeNull();
    });

    it('should nullify _fontController', () => {
      delegate.destroy();
      expect(delegate._fontController).toBeNull();
    });

    it('should nullify _audioController', () => {
      delegate.destroy();
      expect(delegate._audioController).toBeNull();
    });

    it('should destroy and nullify _themeController', () => {
      const themeDestroySpy = vi.spyOn(delegate._themeController, 'destroy');
      delegate.destroy();
      expect(themeDestroySpy).toHaveBeenCalled();
      expect(delegate._themeController).toBeNull();
    });

    it('should remove all event listeners', () => {
      delegate.destroy();

      // Emitting events after destroy should not call handlers
      delegate.emit(DelegateEvents.SETTINGS_UPDATE);
      delegate.emit(DelegateEvents.REPAGINATE, true);

      expect(eventHandlers.onSettingsUpdate).not.toHaveBeenCalled();
      expect(eventHandlers.onRepaginate).not.toHaveBeenCalled();
    });
  });

  describe('handleChange - repagination only when opened', () => {
    it('should not emit repaginate for fontSize when book is closed', () => {
      mockDeps.stateMachine.current = 'CLOSED';
      mockDeps.settings.get.mockImplementation((key) => key === 'fontSize' ? 18 : null);

      delegate.handleChange('fontSize', 'increase');

      expect(eventHandlers.onRepaginate).not.toHaveBeenCalled();
    });

    it('should not emit repaginate for font change when closed', () => {
      mockDeps.stateMachine.current = 'CLOSED';

      delegate.handleChange('font', 'merriweather');

      expect(eventHandlers.onRepaginate).not.toHaveBeenCalled();
    });
  });

  describe('_handleDebug - missing debugPanel guard', () => {
    it('should not throw when debugPanel is null', () => {
      delegate.debugPanel = null;
      expect(() => delegate.handleChange('debug', true)).not.toThrow();
    });
  });

  describe('apply - html element guard', () => {
    it('should log error and return early when html element not found', () => {
      mockDeps.dom.get.mockReturnValue(null);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      delegate.apply();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('HTML element not found')
      );
      errorSpy.mockRestore();
    });
  });
});
