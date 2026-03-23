/**
 * TESTS: AmbientManager
 * Тесты для управления фоновыми звуками окружения
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AmbientManager } from '@managers/AmbientManager.js';
import { CONFIG } from '../../../js/config.js';

const VISIBILITY_RESUME_DELAY = CONFIG.AUDIO.VISIBILITY_RESUME_DELAY;

// Фабрика для создания мок-аудио
function createMockAudio() {
  const audio = {
    volume: 1,
    loop: false,
    preload: '',
    currentTime: 0,
    paused: false,
    src: '',
    play: vi.fn().mockResolvedValue(),
    pause: null, // Will be set below
    load: vi.fn(),
    addEventListener: vi.fn((event, handler) => {
      if (event === 'canplaythrough') {
        Promise.resolve().then(() => handler());
      }
    }),
    removeEventListener: vi.fn(),
  };
  // Создаём pause как spy, который также устанавливает paused = true
  audio.pause = vi.fn(() => {
    audio.paused = true;
  });
  return audio;
}

describe('AmbientManager', () => {
  let manager;
  let mockAudioInstances;
  let originalAudio;

  beforeEach(() => {
    vi.useFakeTimers();
    mockAudioInstances = [];

    // Сохраняем оригинальный Audio и заменяем на мок-конструктор
    originalAudio = global.Audio;
    global.Audio = function MockAudio(url) {
      const audio = createMockAudio();
      audio.src = url || '';
      mockAudioInstances.push(audio);
      return audio;
    };

    manager = new AmbientManager();
  });

  afterEach(() => {
    manager.destroy();
    vi.useRealTimers();
    global.Audio = originalAudio;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STATIC PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('static properties', () => {
    it('should have TYPE_NONE constant', () => {
      expect(AmbientManager.TYPE_NONE).toBe('none');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const mgr = new AmbientManager();

      expect(mgr.currentType).toBe('none');
      expect(mgr.volume).toBe(0.5);
      expect(mgr.sounds).toEqual({});
      expect(mgr.isPlaying).toBe(false);
      expect(mgr.isLoading).toBe(false);

      mgr.destroy();
    });

    it('should accept custom currentType', () => {
      const mgr = new AmbientManager({ currentType: 'rain' });
      expect(mgr.currentType).toBe('rain');
      mgr.destroy();
    });

    it('should accept custom volume', () => {
      const mgr = new AmbientManager({ volume: 0.8 });
      expect(mgr.volume).toBe(0.8);
      mgr.destroy();
    });

    it('should accept sounds map', () => {
      const sounds = { rain: '/rain.mp3', fire: '/fire.mp3' };
      const mgr = new AmbientManager({ sounds });
      expect(mgr.sounds).toEqual(sounds);
      mgr.destroy();
    });

    it('should accept onLoadStart callback', () => {
      const onLoadStart = vi.fn();
      const mgr = new AmbientManager({ onLoadStart });
      expect(mgr.onLoadStart).toBe(onLoadStart);
      mgr.destroy();
    });

    it('should accept onLoadEnd callback', () => {
      const onLoadEnd = vi.fn();
      const mgr = new AmbientManager({ onLoadEnd });
      expect(mgr.onLoadEnd).toBe(onLoadEnd);
      mgr.destroy();
    });

    it('should setup visibility listener', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const mgr = new AmbientManager();
      expect(addEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      mgr.destroy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // register()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('register()', () => {
    it('should register sound by type', () => {
      manager.register('rain', '/sounds/rain.mp3');
      expect(manager.sounds.rain).toBe('/sounds/rain.mp3');
    });

    it('should return this for chaining', () => {
      const result = manager.register('rain', '/rain.mp3');
      expect(result).toBe(manager);
    });

    it('should support chained registration', () => {
      manager.register('rain', '/rain.mp3').register('fire', '/fire.mp3').register('cafe', '/cafe.mp3');
      expect(Object.keys(manager.sounds).length).toBe(3);
    });

    it('should override existing registration', () => {
      manager.register('rain', '/old.mp3');
      manager.register('rain', '/new.mp3');
      expect(manager.sounds.rain).toBe('/new.mp3');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setType()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('setType()', () => {
    beforeEach(() => {
      manager.register('rain', '/rain.mp3');
      manager.register('fire', '/fire.mp3');
    });

    it('should set current type', async () => {
      await manager.setType('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      expect(manager.currentType).toBe('rain');
    });

    it('should stop when setting TYPE_NONE', async () => {
      await manager.setType('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      const stopSpy = vi.spyOn(manager, 'stop');
      await manager.setType(AmbientManager.TYPE_NONE, false);
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should stop when setting unknown type', async () => {
      const stopSpy = vi.spyOn(manager, 'stop');
      await manager.setType('unknown', false);
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should not restart if same type and already playing', async () => {
      await manager.setType('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      manager.isPlaying = true;
      const playSpy = vi.spyOn(manager, 'play');
      await manager.setType('rain', false);
      expect(playSpy).not.toHaveBeenCalled();
    });

    it('should play new type', async () => {
      const playSpy = vi.spyOn(manager, 'play');
      await manager.setType('rain', false);
      expect(playSpy).toHaveBeenCalledWith('rain', false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // play()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('play()', () => {
    beforeEach(() => {
      manager.register('rain', '/rain.mp3');
    });

    it('should warn for unregistered type', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await manager.play('unknown', false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Ambient sound "unknown" not registered');
      consoleWarnSpy.mockRestore();
    });

    it('should create Audio element', async () => {
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      expect(mockAudioInstances.length).toBeGreaterThan(0);
    });

    it('should set loop to true', async () => {
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      expect(mockAudioInstances[0].loop).toBe(true);
    });

    it('should set volume', async () => {
      manager.volume = 0.7;
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      expect(mockAudioInstances[0].volume).toBe(0.7);
    });

    it('should set volume to 0 when fade is true', async () => {
      manager.volume = 0.7;
      // Don't await - the promise won't resolve until fade completes
      const playPromise = manager.play('rain', true);
      // Let microtasks run (audio.play() resolves)
      await vi.advanceTimersByTimeAsync(10);
      // Initial volume should be 0 (before fade increases it)
      expect(mockAudioInstances[0].volume).toBe(0);
      // Advance timers to complete fade (50ms × 20 = 1000ms)
      await vi.advanceTimersByTimeAsync(1100);
      await playPromise;
    });

    it('should call audio.play()', async () => {
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      expect(mockAudioInstances[0].play).toHaveBeenCalled();
    });

    it('should set isPlaying to true', async () => {
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      expect(manager.isPlaying).toBe(true);
    });

    it('should call onLoadStart callback', async () => {
      const onLoadStart = vi.fn();
      manager.onLoadStart = onLoadStart;
      await manager.play('rain', false);
      expect(onLoadStart).toHaveBeenCalledWith('rain');
    });

    it('should call onLoadEnd callback', async () => {
      const onLoadEnd = vi.fn();
      manager.onLoadEnd = onLoadEnd;
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      expect(onLoadEnd).toHaveBeenCalledWith('rain');
    });

    it('should cache audio element', async () => {
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      expect(manager.audioCache.has('rain')).toBe(true);
    });

    it('should use cached audio on subsequent plays', async () => {
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      const audioCount = mockAudioInstances.length;
      await manager.stop(false);
      await manager.play('rain', false);
      // Should not create new Audio
      expect(mockAudioInstances.length).toBe(audioCount);
    });

    it('should stop current audio before playing new', async () => {
      manager.register('fire', '/fire.mp3');
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      const stopSpy = vi.spyOn(manager, 'stop');
      await manager.play('fire', false);
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should handle NotAllowedError silently', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Создаем Audio который выбрасывает NotAllowedError
      global.Audio = function MockAudioAutoplayBlocked(url) {
        const audio = createMockAudio();
        audio.src = url || '';
        const error = new Error('Autoplay blocked');
        error.name = 'NotAllowedError';
        audio.play = vi.fn().mockRejectedValue(error);
        mockAudioInstances.push(audio);
        return audio;
      };

      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);

      // Не должно быть предупреждения для NotAllowedError
      const warnCalls = consoleWarnSpy.mock.calls.filter(
        call => call[0]?.includes?.('Failed to play')
      );
      expect(warnCalls.length).toBe(0);
      expect(manager.isPlaying).toBe(false);

      consoleWarnSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // stop()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('stop()', () => {
    beforeEach(async () => {
      manager.register('rain', '/rain.mp3');
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
    });

    it('should pause audio', async () => {
      await manager.stop(false);
      expect(mockAudioInstances[0].pause).toHaveBeenCalled();
    });

    it('should reset currentTime', async () => {
      mockAudioInstances[0].currentTime = 100;
      await manager.stop(false);
      expect(mockAudioInstances[0].currentTime).toBe(0);
    });

    it('should set isPlaying to false', async () => {
      await manager.stop(false);
      expect(manager.isPlaying).toBe(false);
    });

    it('should set audio reference to null', async () => {
      await manager.stop(false);
      expect(manager.audio).toBeNull();
    });

    it('should not fail if no audio', async () => {
      manager.audio = null;
      await expect(manager.stop(false)).resolves.not.toThrow();
    });

    it('should call fadeOut when fade is true', async () => {
      const fadeOutSpy = vi.spyOn(manager, '_fadeOut').mockResolvedValue();
      await manager.stop(true);
      expect(fadeOutSpy).toHaveBeenCalled();
    });

    it('should not call fadeOut when fade is false', async () => {
      const fadeOutSpy = vi.spyOn(manager, '_fadeOut');
      await manager.stop(false);
      expect(fadeOutSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // pause() / resume()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('pause()', () => {
    beforeEach(async () => {
      manager.register('rain', '/rain.mp3');
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
    });

    it('should pause audio', () => {
      manager.pause();
      expect(mockAudioInstances[0].pause).toHaveBeenCalled();
    });

    it('should not fail if not playing', () => {
      manager.isPlaying = false;
      expect(() => manager.pause()).not.toThrow();
    });

    it('should not fail if no audio', () => {
      manager.audio = null;
      expect(() => manager.pause()).not.toThrow();
    });
  });

  describe('resume()', () => {
    beforeEach(async () => {
      manager.register('rain', '/rain.mp3');
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      manager.pause();
    });

    it('should call play on paused audio', () => {
      mockAudioInstances[0].paused = true;
      mockAudioInstances[0].play.mockClear();
      manager.resume();
      expect(mockAudioInstances[0].play).toHaveBeenCalled();
    });

    it('should not play if not paused', () => {
      mockAudioInstances[0].paused = false;
      mockAudioInstances[0].play.mockClear();
      manager.resume();
      expect(mockAudioInstances[0].play).not.toHaveBeenCalled();
    });

    it('should not fail if not playing', () => {
      manager.isPlaying = false;
      expect(() => manager.resume()).not.toThrow();
    });

    it('should handle autoplay error silently', () => {
      mockAudioInstances[0].paused = true;
      mockAudioInstances[0].play = vi.fn().mockRejectedValue(new Error('Autoplay'));
      expect(() => manager.resume()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setVolume()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('setVolume()', () => {
    it('should set volume', () => {
      manager.setVolume(0.8);
      expect(manager.volume).toBe(0.8);
    });

    it('should clamp volume to minimum 0', () => {
      manager.setVolume(-0.5);
      expect(manager.volume).toBe(0);
    });

    it('should clamp volume to maximum 1', () => {
      manager.setVolume(1.5);
      expect(manager.volume).toBe(1);
    });

    it('should update audio volume if playing', async () => {
      manager.register('rain', '/rain.mp3');
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      manager.setVolume(0.9);
      expect(mockAudioInstances[0].volume).toBe(0.9);
    });

    it('should not fail if no audio', () => {
      expect(() => manager.setVolume(0.5)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FADE IN/OUT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_fadeIn()', () => {
    beforeEach(async () => {
      manager.register('rain', '/rain.mp3');
      manager.volume = 0.5;
    });

    it('should gradually increase volume', async () => {
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      mockAudioInstances[0].volume = 0;

      const fadePromise = manager._fadeIn();

      // 20 steps * 50ms = 1000ms
      await vi.advanceTimersByTimeAsync(500);
      expect(mockAudioInstances[0].volume).toBeGreaterThan(0);
      expect(mockAudioInstances[0].volume).toBeLessThan(0.5);

      await vi.advanceTimersByTimeAsync(600);
      await fadePromise;

      expect(mockAudioInstances[0].volume).toBe(0.5);
    });

    it('should clear previous fade', async () => {
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      const clearFadeSpy = vi.spyOn(manager, '_clearFade');
      manager._fadeIn();
      expect(clearFadeSpy).toHaveBeenCalled();
    });
  });

  describe('_fadeOut()', () => {
    beforeEach(async () => {
      manager.register('rain', '/rain.mp3');
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
      mockAudioInstances[0].volume = 0.5;
    });

    it('should gradually decrease volume', async () => {
      const fadePromise = manager._fadeOut();

      await vi.advanceTimersByTimeAsync(500);
      expect(mockAudioInstances[0].volume).toBeGreaterThan(0);
      expect(mockAudioInstances[0].volume).toBeLessThan(0.5);

      await vi.advanceTimersByTimeAsync(600);
      await fadePromise;

      expect(mockAudioInstances[0].volume).toBe(0);
    });

    it('should resolve immediately if no audio', async () => {
      manager.audio = null;
      await expect(manager._fadeOut()).resolves.not.toThrow();
    });

    it('should clear previous fade', async () => {
      const clearFadeSpy = vi.spyOn(manager, '_clearFade');
      manager._fadeOut();
      expect(clearFadeSpy).toHaveBeenCalled();
    });
  });

  describe('_clearFade()', () => {
    it('should clear fade interval', async () => {
      manager.register('rain', '/rain.mp3');
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);

      manager._fadeIn();
      expect(manager.fadeInterval).not.toBeNull();

      manager._clearFade();
      expect(manager.fadeInterval).toBeNull();
    });

    it('should not fail if no interval', () => {
      expect(() => manager._clearFade()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VISIBILITY HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('visibility handling', () => {
    beforeEach(async () => {
      manager.register('rain', '/rain.mp3');
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);
    });

    it('should pause when tab is hidden', () => {
      const pauseSpy = vi.spyOn(manager, 'pause');

      Object.defineProperty(document, 'hidden', {
        value: true,
        configurable: true,
      });

      manager._handleVisibilityChange();

      expect(pauseSpy).toHaveBeenCalled();
    });

    it('should resume when tab becomes visible', () => {
      const resumeSpy = vi.spyOn(manager, 'resume');

      Object.defineProperty(document, 'hidden', {
        value: false,
        configurable: true,
      });

      manager._handleVisibilityChange();

      // Resume happens after delay
      vi.advanceTimersByTime(VISIBILITY_RESUME_DELAY);

      expect(resumeSpy).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // destroy()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('destroy()', () => {
    it('should remove visibility listener', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      manager.destroy();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    it('should clear fade interval', () => {
      const clearFadeSpy = vi.spyOn(manager, '_clearFade');
      manager.destroy();
      expect(clearFadeSpy).toHaveBeenCalled();
    });

    it('should pause current audio', async () => {
      manager.register('rain', '/rain.mp3');
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);

      manager.destroy();

      expect(mockAudioInstances[0].pause).toHaveBeenCalled();
    });

    it('should clear audio cache', async () => {
      manager.register('rain', '/rain.mp3');
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);

      expect(manager.audioCache.size).toBeGreaterThan(0);

      manager.destroy();

      expect(manager.audioCache.size).toBe(0);
    });

    it('should reset isPlaying', async () => {
      manager.register('rain', '/rain.mp3');
      await manager.play('rain', false);
      await vi.advanceTimersByTimeAsync(10);

      manager.destroy();

      expect(manager.isPlaying).toBe(false);
    });

    it('should clear sounds', () => {
      manager.register('rain', '/rain.mp3');
      manager.destroy();
      expect(manager.sounds).toEqual({});
    });

    it('should be safe to call multiple times', () => {
      expect(() => {
        manager.destroy();
        manager.destroy();
      }).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should handle load error', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      global.Audio = function MockAudioError(url) {
        const audio = createMockAudio();
        audio.addEventListener = vi.fn((event, handler) => {
          if (event === 'error') {
            Promise.resolve().then(() => handler({ message: 'Load failed' }));
          }
        });
        mockAudioInstances.push(audio);
        return audio;
      };

      manager.register('error', '/error.mp3');
      await manager.play('error', false);
      await vi.advanceTimersByTimeAsync(10);

      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should handle rapid type switching', async () => {
      manager.register('rain', '/rain.mp3');
      manager.register('fire', '/fire.mp3');

      // Быстрое переключение
      manager.setType('rain', false);
      manager.setType('fire', false);
      manager.setType('rain', false);

      await vi.advanceTimersByTimeAsync(100);

      // Не должно упасть
      expect(manager.currentType).toBeDefined();
    });
  });
});
