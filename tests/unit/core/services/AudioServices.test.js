/**
 * TESTS: AudioServices
 * Тесты для группы аудио-сервисов (звуковые эффекты + амбиент)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { MockSoundManager, MockAmbientManager } = vi.hoisted(() => {
  const MockSoundManager = vi.fn(function () {
    this.register = vi.fn(() => this);
    this.preload = vi.fn();
    this.play = vi.fn();
    this.setEnabled = vi.fn();
    this.setVolume = vi.fn();
    this.stopAll = vi.fn();
    this.destroy = vi.fn();
  });
  const MockAmbientManager = vi.fn(function () {
    this.register = vi.fn(() => this);
    this.setType = vi.fn();
    this.play = vi.fn();
    this.stop = vi.fn();
    this.pause = vi.fn();
    this.resume = vi.fn();
    this.setVolume = vi.fn();
    this.destroy = vi.fn();
    this.onLoadStart = null;
    this.onLoadEnd = null;
  });
  return { MockSoundManager, MockAmbientManager };
});

vi.mock('@managers/SoundManager.js', () => ({ SoundManager: MockSoundManager }));
vi.mock('@managers/AmbientManager.js', () => ({ AmbientManager: MockAmbientManager }));
vi.mock('@/config.js', () => {
  const CONFIG = Object.freeze({
    SOUNDS: {
      pageFlip: '/sounds/page-flip.mp3',
      bookOpen: '/sounds/cover-flip.mp3',
      bookClose: '/sounds/cover-flip.mp3',
    },
    AMBIENT: {
      none: { label: 'Без звука', icon: '✕', file: null },
      rain: { label: 'Дождь', icon: '🌧️', file: '/sounds/ambient/rain.mp3' },
      fireplace: { label: 'Камин', icon: '🔥', file: '/sounds/ambient/fireplace.mp3' },
      cafe: { label: 'Кафе', icon: '☕', file: '/sounds/ambient/cafe.mp3' },
    },
  });
  return { CONFIG, getConfig: () => CONFIG };
});

import { AudioServices } from '@core/services/AudioServices.js';

describe('AudioServices', () => {
  let services;
  let mockSettings;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = {
      get: vi.fn((key) => {
        const values = {
          soundEnabled: true,
          soundVolume: 0.3,
          ambientType: 'none',
          ambientVolume: 0.5,
        };
        return values[key];
      }),
    };
    services = new AudioServices(mockSettings);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should create SoundManager with settings', () => {
      expect(MockSoundManager).toHaveBeenCalledWith({
        enabled: true,
        volume: 0.3,
      });
      expect(services.soundManager).toBeDefined();
    });

    it('should create AmbientManager with settings', () => {
      expect(MockAmbientManager).toHaveBeenCalledWith({
        currentType: 'none',
        volume: 0.5,
      });
      expect(services.ambientManager).toBeDefined();
    });

    it('should read settings values via get()', () => {
      expect(mockSettings.get).toHaveBeenCalledWith('soundEnabled');
      expect(mockSettings.get).toHaveBeenCalledWith('soundVolume');
      expect(mockSettings.get).toHaveBeenCalledWith('ambientType');
      expect(mockSettings.get).toHaveBeenCalledWith('ambientVolume');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SOUND REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('sound registration', () => {
    it('should register pageFlip with preload and pool size 3', () => {
      expect(services.soundManager.register).toHaveBeenCalledWith(
        'pageFlip', '/sounds/page-flip.mp3', { preload: true, poolSize: 3 }
      );
    });

    it('should register bookOpen with preload and pool size 1', () => {
      expect(services.soundManager.register).toHaveBeenCalledWith(
        'bookOpen', '/sounds/cover-flip.mp3', { preload: true, poolSize: 1 }
      );
    });

    it('should register bookClose with preload and pool size 1', () => {
      expect(services.soundManager.register).toHaveBeenCalledWith(
        'bookClose', '/sounds/cover-flip.mp3', { preload: true, poolSize: 1 }
      );
    });

    it('should register exactly 3 sounds', () => {
      expect(services.soundManager.register).toHaveBeenCalledTimes(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AMBIENT REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ambient registration', () => {
    it('should register ambient sounds with files (skip none)', () => {
      expect(services.ambientManager.register).toHaveBeenCalledWith('rain', '/sounds/ambient/rain.mp3');
      expect(services.ambientManager.register).toHaveBeenCalledWith('fireplace', '/sounds/ambient/fireplace.mp3');
      expect(services.ambientManager.register).toHaveBeenCalledWith('cafe', '/sounds/ambient/cafe.mp3');
    });

    it('should not register ambient "none" (no file)', () => {
      const calls = services.ambientManager.register.mock.calls;
      const types = calls.map(c => c[0]);
      expect(types).not.toContain('none');
    });

    it('should register exactly 3 ambient sounds', () => {
      expect(services.ambientManager.register).toHaveBeenCalledTimes(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setupAmbientLoadingCallbacks
  // ═══════════════════════════════════════════════════════════════════════════

  describe('setupAmbientLoadingCallbacks()', () => {
    it('should do nothing when ambientPills is null', () => {
      services.setupAmbientLoadingCallbacks(null);
      // No error thrown
    });

    it('should set onLoadStart callback', () => {
      const container = document.createElement('div');
      services.setupAmbientLoadingCallbacks(container);
      expect(services.ambientManager.onLoadStart).toBeInstanceOf(Function);
    });

    it('should set onLoadEnd callback', () => {
      const container = document.createElement('div');
      services.setupAmbientLoadingCallbacks(container);
      expect(services.ambientManager.onLoadEnd).toBeInstanceOf(Function);
    });

    it('should set data-loading attribute on pill via onLoadStart', () => {
      const container = document.createElement('div');
      const pill = document.createElement('button');
      pill.dataset.type = 'rain';
      container.appendChild(pill);

      services.setupAmbientLoadingCallbacks(container);
      services.ambientManager.onLoadStart('rain');

      expect(pill.dataset.loading).toBe('true');
    });

    it('should clear data-loading attribute via onLoadEnd', () => {
      const container = document.createElement('div');
      const pill = document.createElement('button');
      pill.dataset.type = 'rain';
      pill.dataset.loading = 'true';
      container.appendChild(pill);

      services.setupAmbientLoadingCallbacks(container);
      services.ambientManager.onLoadEnd('rain');

      expect(pill.dataset.loading).toBe('false');
    });

    it('should not throw if pill for type not found', () => {
      const container = document.createElement('div');
      services.setupAmbientLoadingCallbacks(container);
      expect(() => services.ambientManager.onLoadStart('nonexistent')).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DESTROY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('destroy()', () => {
    it('should destroy soundManager', () => {
      const destroySpy = services.soundManager.destroy;
      services.destroy();
      expect(destroySpy).toHaveBeenCalledOnce();
    });

    it('should destroy ambientManager', () => {
      const destroySpy = services.ambientManager.destroy;
      services.destroy();
      expect(destroySpy).toHaveBeenCalledOnce();
    });

    it('should nullify all references', () => {
      services.destroy();
      expect(services.soundManager).toBeNull();
      expect(services.ambientManager).toBeNull();
    });

    it('should handle already nullified managers', () => {
      services.soundManager = null;
      services.ambientManager = null;
      expect(() => services.destroy()).not.toThrow();
    });
  });
});
