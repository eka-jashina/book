/**
 * INTEGRATION TEST: Settings Management
 * Тестирование применения и изменения настроек с реальными компонентами
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createFullBookDOM,
  cleanupIntegrationDOM,
} from '../../helpers/integrationUtils.js';

import { SettingsManager } from '../../../js/managers/SettingsManager.js';
import { SettingsDelegate } from '../../../js/core/delegates/SettingsDelegate.js';
import { EventEmitter } from '../../../js/utils/EventEmitter.js';
import { CONFIG } from '../../../js/config.js';
import { setGlobalTheme } from '../../../js/utils/GlobalThemeManager.js';

describe('Settings Integration', () => {
  let dom;
  let settingsManager;
  let settingsDelegate;
  let eventEmitter;

  // Mock dependencies
  let mockDom;
  let mockSoundManager;
  let mockAmbientManager;
  let mockDebugPanel;
  let mockStateMachine;
  let htmlElement;

  beforeEach(() => {
    dom = createFullBookDOM();

    // Create a mock HTML element for settings
    htmlElement = document.createElement('html');
    document.body.appendChild(htmlElement);

    // Real settings manager with mock storage
    const mockStorage = {
      load: vi.fn().mockReturnValue({}),
      save: vi.fn(),
    };
    settingsManager = new SettingsManager(mockStorage);
    eventEmitter = new EventEmitter();

    // Mock DOM manager
    mockDom = {
      get: vi.fn((id) => {
        if (id === 'html') return htmlElement;
        return dom[id] || null;
      }),
    };

    // Mock sound manager
    mockSoundManager = {
      setEnabled: vi.fn(),
      setVolume: vi.fn(),
      play: vi.fn(),
    };

    // Mock ambient manager
    mockAmbientManager = {
      setType: vi.fn(),
      setVolume: vi.fn(),
    };

    // Mock debug panel
    mockDebugPanel = {
      toggle: vi.fn(),
    };

    // Mock state machine (for isOpened check)
    mockStateMachine = {
      isOpened: false,
      isBusy: false,
    };

    settingsDelegate = new SettingsDelegate({
      dom: mockDom,
      settings: settingsManager,
      soundManager: mockSoundManager,
      ambientManager: mockAmbientManager,
      debugPanel: mockDebugPanel,
      stateMachine: mockStateMachine,
    });

    // Connect delegate events
    settingsDelegate.on('settingsUpdate', () => {
      eventEmitter.emit('settingsUpdate');
    });
    settingsDelegate.on('repaginate', (keepIndex) => {
      eventEmitter.emit('repaginate', keepIndex);
    });
  });

  afterEach(() => {
    settingsDelegate?.destroy();
    settingsManager?.destroy();
    eventEmitter?.destroy();
    localStorage.removeItem('flipbook-theme');
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  describe('apply() - Initial Settings Application', () => {
    it('should apply font family from settings', () => {
      settingsManager.set('font', 'merriweather');

      settingsDelegate.apply();

      expect(htmlElement.style.getPropertyValue('--reader-font-family'))
        .toBe(CONFIG.FONTS.merriweather);
    });

    it('should apply font size from settings', () => {
      settingsManager.set('fontSize', 20);

      settingsDelegate.apply();

      expect(htmlElement.style.getPropertyValue('--reader-font-size'))
        .toBe('20px');
    });

    it('should apply dark theme', () => {
      setGlobalTheme('dark');

      settingsDelegate.apply();

      expect(htmlElement.dataset.theme).toBe('dark');
    });

    it('should apply light theme (empty data-theme)', () => {
      settingsManager.set('theme', 'light');

      settingsDelegate.apply();

      expect(htmlElement.dataset.theme).toBe('');
    });

    it('should apply sound settings', () => {
      settingsManager.set('soundEnabled', true);
      settingsManager.set('soundVolume', 0.7);

      settingsDelegate.apply();

      expect(mockSoundManager.setEnabled).toHaveBeenCalledWith(true);
      expect(mockSoundManager.setVolume).toHaveBeenCalledWith(0.7);
    });

    it('should apply ambient volume', () => {
      settingsManager.set('ambientVolume', 0.5);

      settingsDelegate.apply();

      expect(mockAmbientManager.setVolume).toHaveBeenCalledWith(0.5);
    });

    it('should use default font when font key is invalid', () => {
      settingsManager.set('font', 'nonexistent');

      settingsDelegate.apply();

      expect(htmlElement.style.getPropertyValue('--reader-font-family'))
        .toBe(CONFIG.FONTS.georgia);
    });
  });

  describe('handleChange() - Font Settings', () => {
    it('should change font and save to settings', () => {
      settingsDelegate.handleChange('font', 'inter');

      expect(settingsManager.get('font')).toBe('inter');
      expect(htmlElement.style.getPropertyValue('--reader-font-family'))
        .toBe(CONFIG.FONTS.inter);
    });

    it('should emit settingsUpdate on font change', () => {
      const handler = vi.fn();
      eventEmitter.on('settingsUpdate', handler);

      settingsDelegate.handleChange('font', 'inter');

      expect(handler).toHaveBeenCalled();
    });

    it('should emit repaginate when book is open and font changes', () => {
      mockStateMachine.isOpened = true;
      const handler = vi.fn();
      eventEmitter.on('repaginate', handler);

      settingsDelegate.handleChange('font', 'inter');

      expect(handler).toHaveBeenCalledWith(true);
    });

    it('should not emit repaginate when book is closed', () => {
      mockStateMachine.isOpened = false;
      const handler = vi.fn();
      eventEmitter.on('repaginate', handler);

      settingsDelegate.handleChange('font', 'inter');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('handleChange() - Font Size', () => {
    beforeEach(() => {
      settingsManager.set('fontSize', 18);
    });

    it('should increase font size', () => {
      settingsDelegate.handleChange('fontSize', 'increase');

      expect(settingsManager.get('fontSize')).toBe(19);
      expect(htmlElement.style.getPropertyValue('--reader-font-size'))
        .toBe('19px');
    });

    it('should decrease font size', () => {
      settingsDelegate.handleChange('fontSize', 'decrease');

      expect(settingsManager.get('fontSize')).toBe(17);
      expect(htmlElement.style.getPropertyValue('--reader-font-size'))
        .toBe('17px');
    });

    it('should not exceed maximum font size', () => {
      settingsManager.set('fontSize', 22);

      settingsDelegate.handleChange('fontSize', 'increase');

      expect(settingsManager.get('fontSize')).toBe(22);
    });

    it('should not go below minimum font size', () => {
      settingsManager.set('fontSize', 14);

      settingsDelegate.handleChange('fontSize', 'decrease');

      expect(settingsManager.get('fontSize')).toBe(14);
    });

    it('should emit repaginate when font size changes and book is open', () => {
      mockStateMachine.isOpened = true;
      const handler = vi.fn();
      eventEmitter.on('repaginate', handler);

      settingsDelegate.handleChange('fontSize', 'increase');

      expect(handler).toHaveBeenCalledWith(true);
    });
  });

  describe('handleChange() - Theme', () => {
    it('should change to dark theme', () => {
      settingsDelegate.handleChange('theme', 'dark');

      expect(settingsManager.get('theme')).toBe('dark');
      expect(htmlElement.dataset.theme).toBe('dark');
    });

    it('should change to light theme', () => {
      settingsManager.set('theme', 'dark');
      htmlElement.dataset.theme = 'dark';

      settingsDelegate.handleChange('theme', 'light');

      expect(settingsManager.get('theme')).toBe('light');
      expect(htmlElement.dataset.theme).toBe('');
    });

    it('should change to bw theme', () => {
      settingsDelegate.handleChange('theme', 'bw');

      expect(settingsManager.get('theme')).toBe('bw');
      expect(htmlElement.dataset.theme).toBe('bw');
    });
  });

  describe('handleChange() - Sound Settings', () => {
    it('should enable sound', () => {
      settingsDelegate.handleChange('soundEnabled', true);

      expect(settingsManager.get('soundEnabled')).toBe(true);
      expect(mockSoundManager.setEnabled).toHaveBeenCalledWith(true);
    });

    it('should disable sound', () => {
      settingsDelegate.handleChange('soundEnabled', false);

      expect(settingsManager.get('soundEnabled')).toBe(false);
      expect(mockSoundManager.setEnabled).toHaveBeenCalledWith(false);
    });

    it('should set sound volume directly', () => {
      settingsDelegate.handleChange('soundVolume', 0.5);

      expect(settingsManager.get('soundVolume')).toBe(0.5);
      expect(mockSoundManager.setVolume).toHaveBeenCalledWith(0.5);
    });

    it('should increase sound volume', () => {
      settingsManager.set('soundVolume', 0.5);

      settingsDelegate.handleChange('soundVolume', 'increase');

      expect(settingsManager.get('soundVolume')).toBeCloseTo(0.6);
      expect(mockSoundManager.setVolume).toHaveBeenCalledWith(0.6);
    });

    it('should decrease sound volume', () => {
      settingsManager.set('soundVolume', 0.5);

      settingsDelegate.handleChange('soundVolume', 'decrease');

      expect(settingsManager.get('soundVolume')).toBeCloseTo(0.4);
      expect(mockSoundManager.setVolume).toHaveBeenCalledWith(0.4);
    });

    it('should not exceed volume maximum (1.0)', () => {
      settingsManager.set('soundVolume', 1.0);

      settingsDelegate.handleChange('soundVolume', 'increase');

      expect(settingsManager.get('soundVolume')).toBe(1.0);
    });

    it('should not go below volume minimum (0)', () => {
      settingsManager.set('soundVolume', 0);

      settingsDelegate.handleChange('soundVolume', 'decrease');

      expect(settingsManager.get('soundVolume')).toBe(0);
    });

    it('should clamp volume to valid range', () => {
      settingsDelegate.handleChange('soundVolume', 1.5);

      expect(mockSoundManager.setVolume).toHaveBeenCalledWith(1);
    });
  });

  describe('handleChange() - Ambient Settings', () => {
    it('should change ambient type', () => {
      settingsDelegate.handleChange('ambientType', 'rain');

      expect(settingsManager.get('ambientType')).toBe('rain');
      expect(mockAmbientManager.setType).toHaveBeenCalledWith('rain', true);
    });

    it('should change ambient type to fireplace', () => {
      settingsDelegate.handleChange('ambientType', 'fireplace');

      expect(mockAmbientManager.setType).toHaveBeenCalledWith('fireplace', true);
    });

    it('should change ambient volume', () => {
      settingsDelegate.handleChange('ambientVolume', 0.7);

      expect(settingsManager.get('ambientVolume')).toBe(0.7);
      expect(mockAmbientManager.setVolume).toHaveBeenCalledWith(0.7);
    });
  });

  describe('handleChange() - Debug Panel', () => {
    it('should toggle debug panel', () => {
      settingsDelegate.handleChange('debug', null);

      expect(mockDebugPanel.toggle).toHaveBeenCalled();
    });
  });

  describe('Settings Persistence', () => {
    it('should save font setting', () => {
      settingsDelegate.handleChange('font', 'inter');

      // SettingsManager auto-saves on set
      expect(settingsManager.get('font')).toBe('inter');
    });

    it('should save theme setting', () => {
      settingsDelegate.handleChange('theme', 'dark');

      expect(settingsManager.get('theme')).toBe('dark');
    });

    it('should save fontSize setting', () => {
      settingsManager.set('fontSize', 18);
      settingsDelegate.handleChange('fontSize', 'increase');

      expect(settingsManager.get('fontSize')).toBe(19);
    });
  });

  describe('Event Emission', () => {
    it('should emit settingsUpdate for all setting changes', () => {
      const handler = vi.fn();
      eventEmitter.on('settingsUpdate', handler);

      settingsDelegate.handleChange('font', 'inter');
      settingsDelegate.handleChange('theme', 'dark');
      settingsDelegate.handleChange('soundEnabled', false);

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should emit repaginate only for font-related changes when book is open', () => {
      mockStateMachine.isOpened = true;
      const repaginateHandler = vi.fn();
      eventEmitter.on('repaginate', repaginateHandler);

      // Font changes trigger repaginate
      settingsDelegate.handleChange('font', 'inter');
      settingsDelegate.handleChange('fontSize', 'increase');

      // Non-font changes don't trigger repaginate
      settingsDelegate.handleChange('theme', 'dark');
      settingsDelegate.handleChange('soundEnabled', false);

      expect(repaginateHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Settings without optional dependencies', () => {
    it('should work without soundManager', () => {
      const delegateNoSound = new SettingsDelegate({
        dom: mockDom,
        settings: settingsManager,
        // No soundManager
      });

      // Should not throw
      expect(() => {
        delegateNoSound.handleChange('soundEnabled', true);
        delegateNoSound.handleChange('soundVolume', 0.5);
      }).not.toThrow();

      delegateNoSound.destroy();
    });

    it('should work without ambientManager', () => {
      const delegateNoAmbient = new SettingsDelegate({
        dom: mockDom,
        settings: settingsManager,
        // No ambientManager
      });

      // Should not throw
      expect(() => {
        delegateNoAmbient.handleChange('ambientType', 'rain');
        delegateNoAmbient.handleChange('ambientVolume', 0.5);
      }).not.toThrow();

      delegateNoAmbient.destroy();
    });

    it('should work without debugPanel', () => {
      const delegateNoDebug = new SettingsDelegate({
        dom: mockDom,
        settings: settingsManager,
        // No debugPanel
      });

      // Should not throw
      expect(() => {
        delegateNoDebug.handleChange('debug', null);
      }).not.toThrow();

      delegateNoDebug.destroy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing HTML element gracefully in apply()', () => {
      mockDom.get.mockReturnValue(null);

      // Should not throw, just log error
      expect(() => settingsDelegate.apply()).not.toThrow();
    });

    it('should handle invalid font key gracefully', () => {
      settingsDelegate.handleChange('font', 'nonexistent_font');

      // Should fall back to default georgia
      expect(htmlElement.style.getPropertyValue('--reader-font-family'))
        .toBe(CONFIG.FONTS.georgia);
    });

    it('should handle undefined volume gracefully', () => {
      settingsManager.set('soundVolume', undefined);

      // increase from undefined should start at 0
      settingsDelegate.handleChange('soundVolume', 'increase');

      // Should handle gracefully
      expect(mockSoundManager.setVolume).toHaveBeenCalled();
    });
  });
});
