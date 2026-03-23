/**
 * INTEGRATION TEST: Audio System
 * Тестирование взаимодействия SoundManager + AmbientManager + AudioController + SettingsManager.
 * Полный цикл: инициализация → настройки → воспроизведение → переключение → очистка.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupIntegrationDOM } from '../../helpers/integrationUtils.js';

import { SoundManager } from '../../../js/managers/SoundManager.js';
import { AmbientManager } from '../../../js/managers/AmbientManager.js';
import { AudioController } from '../../../js/core/delegates/AudioController.js';
import { SettingsManager } from '../../../js/managers/SettingsManager.js';

// Mock CONFIG для AmbientManager
vi.mock('../../../js/config.js', () => {
  const CONFIG = {
    AUDIO: { VISIBILITY_RESUME_DELAY: 100 },
  };
  return { CONFIG, getConfig: () => CONFIG };
});

describe('Audio System Integration', () => {
  let soundManager;
  let ambientManager;
  let audioController;
  let settingsManager;
  let storageMock;

  // Контролируемый Audio мок
  const createMockAudio = () => {
    const listeners = {};
    const audio = {
      src: '',
      volume: 1,
      currentTime: 0,
      loop: false,
      paused: true,
      preload: '',
      playbackRate: 1,
      play: vi.fn().mockResolvedValue(),
      pause: vi.fn(() => { audio.paused = true; }),
      load: vi.fn(),
      addEventListener: vi.fn((event, cb) => {
        listeners[event] = cb;
        // Fire canplaythrough synchronously to resolve the loading promise
        if (event === 'canplaythrough') {
          cb();
        }
      }),
      removeEventListener: vi.fn(),
    };
    return audio;
  };

  beforeEach(() => {
    vi.useFakeTimers();

    // Мок Audio конструктора — needs to be a real class for `new Audio(url)`
    global.Audio = class MockAudioClass {
      constructor(url) {
        const mock = createMockAudio();
        mock.src = url || '';
        Object.assign(this, mock);
        // Copy vi.fn() methods properly
        this.play = mock.play;
        this.pause = mock.pause;
        this.load = mock.load;
        this.addEventListener = mock.addEventListener;
        this.removeEventListener = mock.removeEventListener;
      }
    };

    // Settings storage
    let savedData = {};
    storageMock = {
      load: vi.fn(() => ({ ...savedData })),
      save: vi.fn((data) => { savedData = { ...savedData, ...data }; }),
    };

    settingsManager = new SettingsManager(storageMock, {
      font: 'georgia',
      fontSize: 18,
      theme: 'light',
      page: 0,
      soundEnabled: true,
      soundVolume: 0.3,
      ambientType: 'none',
      ambientVolume: 0.5,
    });

    soundManager = new SoundManager({ enabled: true, volume: 0.3 });
    soundManager.register('pageFlip', '/sounds/page-flip.mp3', { poolSize: 3 });
    soundManager.register('bookOpen', '/sounds/cover-flip.mp3');

    ambientManager = new AmbientManager({
      currentType: 'none',
      volume: 0.5,
      sounds: {
        rain: '/sounds/ambient/rain.mp3',
        fireplace: '/sounds/ambient/fireplace.mp3',
        cafe: '/sounds/ambient/cafe.mp3',
      },
    });

    audioController = new AudioController({
      settings: settingsManager,
      soundManager,
      ambientManager,
    });
  });

  afterEach(() => {
    ambientManager?.destroy();
    soundManager?.destroy();
    settingsManager?.destroy();
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('AudioController.apply() syncs all audio from settings', () => {
    it('should apply sound enabled/volume from settings', () => {
      settingsManager.set('soundEnabled', false);
      settingsManager.set('soundVolume', 0.7);

      audioController.apply();

      expect(soundManager.enabled).toBe(false);
      expect(soundManager.volume).toBe(0.7);
    });

    it('should apply ambient volume from settings', () => {
      settingsManager.set('ambientVolume', 0.8);

      audioController.apply();

      expect(ambientManager.volume).toBe(0.8);
    });

    it('should sanitize invalid volume values', () => {
      settingsManager.set('soundVolume', -5);
      audioController.apply();
      expect(soundManager.volume).toBe(0);

      settingsManager.set('soundVolume', 999);
      audioController.apply();
      expect(soundManager.volume).toBe(1);
    });
  });

  describe('Sound toggle flow', () => {
    it('should toggle sound effects on/off', () => {
      expect(soundManager.enabled).toBe(true);

      audioController.handleSoundToggle(false);
      expect(soundManager.enabled).toBe(false);

      audioController.handleSoundToggle(true);
      expect(soundManager.enabled).toBe(true);
    });

    it('should not play sound when disabled', async () => {
      audioController.handleSoundToggle(false);

      await soundManager.play('pageFlip');
      // When disabled, play returns early
      const sound = soundManager.sounds.get('pageFlip');
      expect(sound.loaded).toBe(false); // Not even loaded
    });
  });

  describe('Sound volume adjustment flow', () => {
    it('should increase volume by step', () => {
      settingsManager.set('soundVolume', 0.5);
      audioController.handleSoundVolume('increase');

      expect(soundManager.volume).toBeCloseTo(0.6, 1);
      expect(settingsManager.get('soundVolume')).toBeCloseTo(0.6, 1);
    });

    it('should decrease volume by step', () => {
      settingsManager.set('soundVolume', 0.5);
      audioController.handleSoundVolume('decrease');

      expect(soundManager.volume).toBeCloseTo(0.4, 1);
      expect(settingsManager.get('soundVolume')).toBeCloseTo(0.4, 1);
    });

    it('should clamp volume at max 1.0', () => {
      settingsManager.set('soundVolume', 0.95);
      audioController.handleSoundVolume('increase');

      expect(soundManager.volume).toBe(1);
    });

    it('should clamp volume at min 0.0', () => {
      settingsManager.set('soundVolume', 0.05);
      audioController.handleSoundVolume('decrease');

      expect(soundManager.volume).toBe(0);
    });

    it('should set exact volume with numeric value', () => {
      audioController.handleSoundVolume(0.42);
      expect(soundManager.volume).toBe(0.42);
    });
  });

  describe('Ambient type switching flow', () => {
    it('should switch ambient type', () => {
      audioController.handleAmbientType('rain');
      expect(ambientManager.currentType).toBe('rain');
    });

    it('should stop ambient when setting to none', () => {
      // handleAmbientType calls setType which is async, but currentType is set synchronously
      audioController.handleAmbientType('rain');
      expect(ambientManager.currentType).toBe('rain');

      // Switch to none — currentType set synchronously in setType()
      audioController.handleAmbientType('none');
      expect(ambientManager.currentType).toBe('none');
    });
  });

  describe('Ambient volume flow', () => {
    it('should set ambient volume', () => {
      audioController.handleAmbientVolume(0.75);
      expect(ambientManager.volume).toBe(0.75);
    });

    it('should sanitize ambient volume out of range', () => {
      audioController.handleAmbientVolume(5);
      expect(ambientManager.volume).toBe(1);

      audioController.handleAmbientVolume(-1);
      expect(ambientManager.volume).toBe(0);
    });
  });

  describe('SoundManager pool and volume propagation', () => {
    it('should update all pool instances when volume changes', async () => {
      // Preload to create pool
      await soundManager._loadSound('pageFlip');
      await vi.advanceTimersByTimeAsync(100);

      const sound = soundManager.sounds.get('pageFlip');
      // Pool should be created
      expect(sound.audioPool.length).toBe(3);

      // Change volume
      soundManager.setVolume(0.8);
      expect(sound.volume).toBe(0.8);
      sound.audioPool.forEach(audio => {
        expect(audio.volume).toBe(0.8);
      });
    });

    it('should stop all sounds on stopAll()', async () => {
      await soundManager._loadSound('pageFlip');
      await soundManager._loadSound('bookOpen');
      await vi.advanceTimersByTimeAsync(100);

      soundManager.stopAll();

      for (const sound of soundManager.sounds.values()) {
        if (sound.loaded) {
          sound.audioPool.forEach(audio => {
            expect(audio.pause).toHaveBeenCalled();
          });
        }
      }
    });
  });

  describe('Full audio session lifecycle', () => {
    it('should handle complete session: apply → play sounds → switch ambient → cleanup', async () => {
      // 1. Apply initial settings
      audioController.apply();
      expect(soundManager.enabled).toBe(true);
      expect(soundManager.volume).toBe(0.3);

      // 2. Play a sound effect
      await soundManager._loadSound('pageFlip');
      await vi.advanceTimersByTimeAsync(100);
      await soundManager.play('pageFlip', { playbackRate: 0.95 });

      const pageFlip = soundManager.sounds.get('pageFlip');
      expect(pageFlip.loaded).toBe(true);
      expect(pageFlip.audioPool[0].play).toHaveBeenCalled();

      // 3. Switch ambient
      audioController.handleAmbientType('fireplace');
      expect(ambientManager.currentType).toBe('fireplace');

      // 4. Adjust volumes
      audioController.handleSoundVolume(0.5);
      audioController.handleAmbientVolume(0.6);
      expect(soundManager.volume).toBe(0.5);
      expect(ambientManager.volume).toBe(0.6);

      // 5. Disable sound effects but keep ambient
      audioController.handleSoundToggle(false);
      expect(soundManager.enabled).toBe(false);

      // 6. Cleanup
      ambientManager.destroy();
      soundManager.destroy();

      expect(soundManager.sounds.size).toBe(0);
      expect(ambientManager.audioCache.size).toBe(0);
    });
  });

  describe('AudioController without optional managers', () => {
    it('should work without soundManager', () => {
      const controller = new AudioController({
        settings: settingsManager,
        ambientManager,
      });

      // Should not throw
      controller.apply();
      controller.handleSoundToggle(true);
      controller.handleSoundVolume('increase');
      controller.handleSoundVolume(0.5);
    });

    it('should work without ambientManager', () => {
      const controller = new AudioController({
        settings: settingsManager,
        soundManager,
      });

      // Should not throw
      controller.apply();
      controller.handleAmbientType('rain');
      controller.handleAmbientVolume(0.5);
    });
  });

  describe('AmbientManager caching', () => {
    it('should cache loaded audio objects by type', async () => {
      vi.useRealTimers();

      await ambientManager.play('rain', false);

      expect(ambientManager.audioCache.has('rain')).toBe(true);
      const cachedAudio = ambientManager.audioCache.get('rain');

      // Playing the same type again should use cache
      await ambientManager.stop(false);
      await ambientManager.play('rain', false);

      // Should reuse the same cached Audio object
      expect(ambientManager.audioCache.get('rain')).toBe(cachedAudio);
      // Cache should still have exactly 1 entry
      expect(ambientManager.audioCache.size).toBe(1);

      vi.useFakeTimers();
    });

    it('should clear all cached audio on destroy', async () => {
      vi.useRealTimers();

      await ambientManager.play('rain', false);

      expect(ambientManager.audioCache.size).toBe(1);

      ambientManager.destroy();
      expect(ambientManager.audioCache.size).toBe(0);
      expect(ambientManager.isPlaying).toBe(false);

      vi.useFakeTimers();
    });
  });

  describe('AmbientManager visibility handling', () => {
    it('should pause on tab hidden and resume on visible', async () => {
      vi.useRealTimers();

      await ambientManager.play('rain', false);

      const audio = ambientManager.audio;
      expect(audio).not.toBeNull();
      ambientManager.isPlaying = true;
      audio.paused = false;

      // Simulate tab hidden
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(audio.pause).toHaveBeenCalled();

      // Simulate tab visible
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      audio.paused = true; // after pause call
      document.dispatchEvent(new Event('visibilitychange'));

      // Wait for resume delay
      await new Promise(r => setTimeout(r, 150));

      expect(audio.play).toHaveBeenCalled();

      vi.useFakeTimers();
    });
  });
});
