/**
 * INTEGRATION TEST: Ambient Sound Lifecycle
 * Тестирование полного цикла ambient звуков:
 * AmbientManager регистрация → воспроизведение → переключение типов →
 * громкость → fade → пауза/возобновление → AudioController →
 * SettingsManager persistence → visibility change.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AmbientManager } from '../../../js/managers/AmbientManager.js';
import { AudioController } from '../../../js/core/delegates/AudioController.js';
import { SettingsManager } from '../../../js/managers/SettingsManager.js';

// Mock CONFIG for visibility change delay
vi.mock('../../../js/config.js', () => {
  const CONFIG = { AUDIO: { VISIBILITY_RESUME_DELAY: 10 } };
  return { CONFIG, getConfig: () => CONFIG };
});

// Mock sanitizeVolume from utils/index.js
vi.mock('../../../js/utils/index.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    sanitizeVolume: (v, def) => {
      if (typeof v !== 'number' || isNaN(v)) return def ?? 0.5;
      return Math.max(0, Math.min(1, v));
    },
  };
});

describe('Ambient Sound Lifecycle Integration', () => {
  /** @type {AmbientManager} */
  let ambient;
  let mockAudioInstances;

  /**
   * Create a mock Audio constructor that simulates canplaythrough and play/pause
   */
  const setupAudioMock = () => {
    mockAudioInstances = [];

    class MockAudio {
      constructor(url) {
        this.src = url || '';
        this.loop = false;
        this.volume = 1;
        this.currentTime = 0;
        this.preload = '';
        this.paused = true;
        this._listeners = {};
        mockAudioInstances.push(this);
      }

      addEventListener(event, handler, opts) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(handler);
        // Auto-trigger canplaythrough for instant loading
        if (event === 'canplaythrough') {
          setTimeout(() => handler(), 0);
        }
      }

      removeEventListener(event, handler) {
        if (this._listeners[event]) {
          this._listeners[event] = this._listeners[event].filter(h => h !== handler);
        }
      }

      async play() {
        this.paused = false;
        return Promise.resolve();
      }

      pause() {
        this.paused = true;
      }
    }

    vi.stubGlobal('Audio', MockAudio);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    setupAudioMock();
  });

  afterEach(() => {
    if (ambient) {
      ambient.destroy();
      ambient = null;
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // AmbientManager: basic lifecycle
  // ═══════════════════════════════════════════

  describe('AmbientManager: play / stop / switch', () => {
    it('should register sounds and play by type', async () => {
      ambient = new AmbientManager({
        currentType: 'none',
        volume: 0.5,
        sounds: {},
      });

      ambient.register('rain', '/sounds/rain.mp3');
      ambient.register('fireplace', '/sounds/fire.mp3');

      expect(ambient.sounds.rain).toBe('/sounds/rain.mp3');

      // Play rain (no fade for test simplicity)
      const playPromise = ambient.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      await playPromise;

      expect(ambient.isPlaying).toBe(true);
      expect(ambient.currentType).toBe('rain');
      expect(ambient.audio).not.toBeNull();
    });

    it('should stop playback', async () => {
      ambient = new AmbientManager({
        sounds: { rain: '/sounds/rain.mp3' },
        volume: 0.5,
      });

      const playPromise = ambient.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      await playPromise;

      expect(ambient.isPlaying).toBe(true);

      await ambient.stop(false);

      expect(ambient.isPlaying).toBe(false);
      expect(ambient.audio).toBeNull();
    });

    it('should switch between ambient types', async () => {
      ambient = new AmbientManager({
        sounds: {
          rain: '/sounds/rain.mp3',
          fireplace: '/sounds/fire.mp3',
        },
        volume: 0.5,
      });

      // Start rain
      const p1 = ambient.setType('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      await p1;
      expect(ambient.currentType).toBe('rain');
      expect(ambient.isPlaying).toBe(true);

      // Switch to fireplace
      const p2 = ambient.setType('fireplace', false);
      await vi.advanceTimersByTimeAsync(10);
      await p2;
      expect(ambient.currentType).toBe('fireplace');
      expect(ambient.isPlaying).toBe(true);
    });

    it('should stop when setting type to "none"', async () => {
      ambient = new AmbientManager({
        sounds: { rain: '/sounds/rain.mp3' },
        volume: 0.5,
      });

      const p1 = ambient.setType('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      await p1;

      await ambient.setType('none', false);

      expect(ambient.isPlaying).toBe(false);
      expect(ambient.currentType).toBe('none');
    });

    it('should not restart if same type already playing', async () => {
      ambient = new AmbientManager({
        sounds: { rain: '/sounds/rain.mp3' },
        volume: 0.5,
      });

      const p1 = ambient.setType('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      await p1;

      const audioRef = ambient.audio;

      // Set same type again
      await ambient.setType('rain', false);

      // Same audio instance, not recreated
      expect(ambient.audio).toBe(audioRef);
    });
  });

  // ═══════════════════════════════════════════
  // Volume and fade
  // ═══════════════════════════════════════════

  describe('Volume control and fade', () => {
    it('should set volume on current audio', async () => {
      ambient = new AmbientManager({
        sounds: { rain: '/sounds/rain.mp3' },
        volume: 0.5,
      });

      const p = ambient.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      await p;

      ambient.setVolume(0.8);

      expect(ambient.volume).toBe(0.8);
      expect(ambient.audio.volume).toBe(0.8);
    });

    it('should clamp volume to [0, 1]', () => {
      ambient = new AmbientManager({ volume: 0.5 });

      ambient.setVolume(-0.5);
      expect(ambient.volume).toBe(0);

      ambient.setVolume(2.0);
      expect(ambient.volume).toBe(1);
    });

    it('should fade in over 1 second (20 steps)', async () => {
      ambient = new AmbientManager({
        sounds: { rain: '/sounds/rain.mp3' },
        volume: 0.6,
      });

      // Play with fade
      const playPromise = ambient.play('rain', true);
      await vi.advanceTimersByTimeAsync(10); // canplaythrough

      // Audio starts at 0
      expect(ambient.audio.volume).toBe(0);

      // After 500ms (~10 steps): roughly half volume
      await vi.advanceTimersByTimeAsync(500);

      // After full 1000ms: target volume
      await vi.advanceTimersByTimeAsync(600);
      await playPromise;

      expect(ambient.audio.volume).toBeCloseTo(0.6, 1);
    });

    it('should fade out before stopping', async () => {
      ambient = new AmbientManager({
        sounds: { rain: '/sounds/rain.mp3' },
        volume: 0.6,
      });

      const p = ambient.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      await p;

      expect(ambient.audio.volume).toBe(0.6);

      // Stop with fade
      const stopPromise = ambient.stop(true);
      await vi.advanceTimersByTimeAsync(1200); // enough for full fade
      await stopPromise;

      expect(ambient.isPlaying).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // Pause / Resume / Visibility
  // ═══════════════════════════════════════════

  describe('Pause, resume, and visibility', () => {
    it('should pause and resume playback', async () => {
      ambient = new AmbientManager({
        sounds: { rain: '/sounds/rain.mp3' },
        volume: 0.5,
      });

      const p = ambient.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      await p;

      expect(ambient.audio.paused).toBe(false);

      ambient.pause();
      expect(ambient.audio.paused).toBe(true);

      ambient.resume();
      expect(ambient.audio.paused).toBe(false);
    });

    it('should auto-pause on visibility hidden', async () => {
      ambient = new AmbientManager({
        sounds: { rain: '/sounds/rain.mp3' },
        volume: 0.5,
      });

      const p = ambient.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      await p;

      // Simulate tab hidden
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(ambient.audio.paused).toBe(true);

      // Simulate tab visible
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      // Resume happens after delay
      await vi.advanceTimersByTimeAsync(20);

      expect(ambient.audio.paused).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // Audio caching
  // ═══════════════════════════════════════════

  describe('Audio caching', () => {
    it('should cache audio objects and reuse on replay', async () => {
      ambient = new AmbientManager({
        sounds: { rain: '/sounds/rain.mp3' },
        volume: 0.5,
      });

      // First play: creates Audio
      const p1 = ambient.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      await p1;

      const firstAudioCount = mockAudioInstances.length;

      await ambient.stop(false);

      // Second play: should reuse cached
      const p2 = ambient.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      await p2;

      // No new Audio created
      expect(mockAudioInstances.length).toBe(firstAudioCount);
      expect(ambient.audioCache.has('rain')).toBe(true);
    });

    it('should create separate Audio for different types', async () => {
      ambient = new AmbientManager({
        sounds: {
          rain: '/sounds/rain.mp3',
          fire: '/sounds/fire.mp3',
        },
        volume: 0.5,
      });

      const p1 = ambient.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      await p1;
      await ambient.stop(false);

      const p2 = ambient.play('fire', false);
      await vi.advanceTimersByTimeAsync(10);
      await p2;

      expect(ambient.audioCache.size).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // AudioController ↔ AmbientManager
  // ═══════════════════════════════════════════

  describe('AudioController integration with AmbientManager', () => {
    it('should apply ambient volume from settings', () => {
      ambient = new AmbientManager({ volume: 0.5, sounds: {} });

      const storage = {
        load: vi.fn(() => ({ ambientVolume: 0.7, soundEnabled: true, soundVolume: 0.3 })),
        save: vi.fn(),
      };
      const sm = new SettingsManager(storage, {
        font: 'georgia', fontSize: 18, theme: 'light', page: 0,
        soundEnabled: true, soundVolume: 0.3,
        ambientType: 'none', ambientVolume: 0.5,
      });

      const mockSound = {
        setEnabled: vi.fn(),
        setVolume: vi.fn(),
      };

      const controller = new AudioController({
        settings: sm,
        soundManager: mockSound,
        ambientManager: ambient,
      });

      controller.apply();

      expect(ambient.volume).toBe(0.7); // from settings
      expect(mockSound.setEnabled).toHaveBeenCalledWith(true);
      expect(mockSound.setVolume).toHaveBeenCalledWith(0.3);

      sm.destroy();
    });

    it('should switch ambient type through controller', async () => {
      ambient = new AmbientManager({
        sounds: { rain: '/sounds/rain.mp3' },
        volume: 0.5,
      });

      const sm = new SettingsManager(
        { load: vi.fn(() => ({})), save: vi.fn() },
        { font: 'georgia', fontSize: 18, theme: 'light', page: 0, soundEnabled: true, soundVolume: 0.3, ambientType: 'none', ambientVolume: 0.5 },
      );

      const controller = new AudioController({
        settings: sm,
        ambientManager: ambient,
      });

      controller.handleAmbientType('rain');

      // setType is called (async), let it resolve
      await vi.advanceTimersByTimeAsync(1200);

      expect(ambient.currentType).toBe('rain');
      sm.destroy();
    });

    it('should update ambient volume through controller', () => {
      ambient = new AmbientManager({ volume: 0.5, sounds: {} });

      const sm = new SettingsManager(
        { load: vi.fn(() => ({})), save: vi.fn() },
        { font: 'georgia', fontSize: 18, theme: 'light', page: 0, soundEnabled: true, soundVolume: 0.3, ambientType: 'none', ambientVolume: 0.5 },
      );

      const controller = new AudioController({
        settings: sm,
        ambientManager: ambient,
      });

      controller.handleAmbientVolume(0.9);

      expect(ambient.volume).toBe(0.9);
      sm.destroy();
    });

    it('should handle sound volume increase/decrease through controller', () => {
      const storage = {
        load: vi.fn(() => ({ soundVolume: 0.5 })),
        save: vi.fn(),
      };
      const sm = new SettingsManager(storage, {
        font: 'georgia', fontSize: 18, theme: 'light', page: 0,
        soundEnabled: true, soundVolume: 0.5,
        ambientType: 'none', ambientVolume: 0.5,
      });

      const mockSound = { setEnabled: vi.fn(), setVolume: vi.fn() };

      const controller = new AudioController({
        settings: sm,
        soundManager: mockSound,
      });

      controller.handleSoundVolume('increase');
      expect(sm.get('soundVolume')).toBeCloseTo(0.6, 1);
      expect(mockSound.setVolume).toHaveBeenCalledWith(expect.closeTo(0.6, 1));

      controller.handleSoundVolume('decrease');
      expect(sm.get('soundVolume')).toBeCloseTo(0.5, 1);

      sm.destroy();
    });

    it('should set sound volume directly as number', () => {
      const sm = new SettingsManager(
        { load: vi.fn(() => ({})), save: vi.fn() },
        { font: 'georgia', fontSize: 18, theme: 'light', page: 0, soundEnabled: true, soundVolume: 0.3, ambientType: 'none', ambientVolume: 0.5 },
      );

      const mockSound = { setEnabled: vi.fn(), setVolume: vi.fn() };

      const controller = new AudioController({
        settings: sm,
        soundManager: mockSound,
      });

      controller.handleSoundVolume(0.75);
      expect(mockSound.setVolume).toHaveBeenCalledWith(0.75);

      sm.destroy();
    });
  });

  // ═══════════════════════════════════════════
  // Destroy and cleanup
  // ═══════════════════════════════════════════

  describe('Destroy and cleanup', () => {
    it('should clean up all resources on destroy', async () => {
      ambient = new AmbientManager({
        sounds: { rain: '/sounds/rain.mp3', fire: '/sounds/fire.mp3' },
        volume: 0.5,
      });

      const p = ambient.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      await p;

      expect(ambient.isPlaying).toBe(true);
      expect(ambient.audioCache.size).toBe(1);

      ambient.destroy();

      expect(ambient.isPlaying).toBe(false);
      expect(ambient.audio).toBeNull();
      expect(ambient.audioCache.size).toBe(0);
      expect(Object.keys(ambient.sounds)).toHaveLength(0);

      ambient = null; // prevent double-destroy in afterEach
    });

    it('should handle onLoadStart/onLoadEnd callbacks', async () => {
      const onLoadStart = vi.fn();
      const onLoadEnd = vi.fn();

      ambient = new AmbientManager({
        sounds: { rain: '/sounds/rain.mp3' },
        volume: 0.5,
        onLoadStart,
        onLoadEnd,
      });

      const p = ambient.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      await p;

      expect(onLoadStart).toHaveBeenCalledWith('rain');
      expect(onLoadEnd).toHaveBeenCalledWith('rain');
    });

    it('should not call onLoadStart/onLoadEnd on cached replay', async () => {
      const onLoadStart = vi.fn();
      const onLoadEnd = vi.fn();

      ambient = new AmbientManager({
        sounds: { rain: '/sounds/rain.mp3' },
        volume: 0.5,
        onLoadStart,
        onLoadEnd,
      });

      // First play (loads)
      const p1 = ambient.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      await p1;

      onLoadStart.mockClear();
      onLoadEnd.mockClear();

      await ambient.stop(false);

      // Second play (cached)
      const p2 = ambient.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      await p2;

      expect(onLoadStart).not.toHaveBeenCalled();
      expect(onLoadEnd).not.toHaveBeenCalled();
    });
  });
});
