/**
 * Тесты для AudioController
 * Управление звуками: переключение, громкость, ambient-звуки
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../../js/utils/index.js', () => ({
  sanitizeVolume: vi.fn((val, def) => {
    if (typeof val !== 'number' || isNaN(val)) return def;
    return Math.max(0, Math.min(1, val));
  }),
}));

import { AudioController } from '../../../../js/core/delegates/AudioController.js';

describe('AudioController', () => {
  let controller;
  let mockSettings;
  let mockSoundManager;
  let mockAmbientManager;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSettings = {
      get: vi.fn((key) => {
        const defaults = {
          soundEnabled: true,
          soundVolume: 0.3,
          ambientVolume: 0.5,
        };
        return defaults[key];
      }),
      set: vi.fn(),
    };

    mockSoundManager = {
      setEnabled: vi.fn(),
      setVolume: vi.fn(),
    };

    mockAmbientManager = {
      setVolume: vi.fn(),
      setType: vi.fn(),
    };

    controller = new AudioController({
      settings: mockSettings,
      soundManager: mockSoundManager,
      ambientManager: mockAmbientManager,
    });
  });

  describe('constructor', () => {
    it('should store dependencies', () => {
      expect(controller._settings).toBe(mockSettings);
      expect(controller._soundManager).toBe(mockSoundManager);
      expect(controller._ambientManager).toBe(mockAmbientManager);
    });
  });

  describe('apply', () => {
    it('should apply sound enabled setting', () => {
      controller.apply();
      expect(mockSoundManager.setEnabled).toHaveBeenCalledWith(true);
    });

    it('should apply sound volume', () => {
      controller.apply();
      expect(mockSoundManager.setVolume).toHaveBeenCalledWith(0.3);
    });

    it('should apply ambient volume', () => {
      controller.apply();
      expect(mockAmbientManager.setVolume).toHaveBeenCalledWith(0.5);
    });

    it('should handle missing soundManager', () => {
      controller._soundManager = null;
      expect(() => controller.apply()).not.toThrow();
    });

    it('should handle missing ambientManager', () => {
      controller._ambientManager = null;
      expect(() => controller.apply()).not.toThrow();
    });
  });

  describe('handleSoundToggle', () => {
    it('should enable sound manager', () => {
      controller.handleSoundToggle(true);
      expect(mockSoundManager.setEnabled).toHaveBeenCalledWith(true);
    });

    it('should disable sound manager', () => {
      controller.handleSoundToggle(false);
      expect(mockSoundManager.setEnabled).toHaveBeenCalledWith(false);
    });

    it('should handle missing soundManager', () => {
      controller._soundManager = null;
      expect(() => controller.handleSoundToggle(true)).not.toThrow();
    });
  });

  describe('handleSoundVolume', () => {
    it('should set volume directly when given a number', () => {
      controller.handleSoundVolume(0.7);
      expect(mockSoundManager.setVolume).toHaveBeenCalledWith(0.7);
    });

    it('should clamp volume to 0-1 range', () => {
      controller.handleSoundVolume(1.5);
      expect(mockSoundManager.setVolume).toHaveBeenCalledWith(1);

      controller.handleSoundVolume(-0.5);
      expect(mockSoundManager.setVolume).toHaveBeenCalledWith(0);
    });

    it('should increase volume by step', () => {
      controller.handleSoundVolume('increase');
      expect(mockSettings.set).toHaveBeenCalledWith('soundVolume', expect.closeTo(0.4, 1));
      expect(mockSoundManager.setVolume).toHaveBeenCalledWith(expect.closeTo(0.4, 1));
    });

    it('should decrease volume by step', () => {
      controller.handleSoundVolume('decrease');
      expect(mockSettings.set).toHaveBeenCalledWith('soundVolume', expect.closeTo(0.2, 1));
      expect(mockSoundManager.setVolume).toHaveBeenCalledWith(expect.closeTo(0.2, 1));
    });

    it('should not go below 0', () => {
      mockSettings.get.mockReturnValue(0);
      controller.handleSoundVolume('decrease');
      // Volume stays at 0, no set call because newVolume === current
      expect(mockSettings.set).not.toHaveBeenCalled();
    });

    it('should not go above 1', () => {
      mockSettings.get.mockReturnValue(1);
      controller.handleSoundVolume('increase');
      expect(mockSettings.set).not.toHaveBeenCalled();
    });

    it('should handle missing soundManager', () => {
      controller._soundManager = null;
      expect(() => controller.handleSoundVolume(0.5)).not.toThrow();
      expect(() => controller.handleSoundVolume('increase')).not.toThrow();
    });
  });

  describe('handleAmbientType', () => {
    it('should set ambient type with fade', () => {
      controller.handleAmbientType('rain');
      expect(mockAmbientManager.setType).toHaveBeenCalledWith('rain', true);
    });

    it('should handle missing ambientManager', () => {
      controller._ambientManager = null;
      expect(() => controller.handleAmbientType('rain')).not.toThrow();
    });
  });

  describe('handleAmbientVolume', () => {
    it('should set ambient volume', () => {
      controller.handleAmbientVolume(0.8);
      expect(mockAmbientManager.setVolume).toHaveBeenCalledWith(0.8);
    });

    it('should handle missing ambientManager', () => {
      controller._ambientManager = null;
      expect(() => controller.handleAmbientVolume(0.5)).not.toThrow();
    });
  });
});
