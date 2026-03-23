/**
 * TESTS: SoundManager
 * Тесты для управления звуковыми эффектами
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SoundManager } from '@managers/SoundManager.js';

// Фабрика для создания мок-аудио
function createMockAudio() {
  return {
    volume: 1,
    preload: '',
    currentTime: 0,
    playbackRate: 1,
    src: '',
    play: vi.fn().mockResolvedValue(),
    pause: vi.fn(),
    load: vi.fn(),
    addEventListener: vi.fn((event, handler) => {
      if (event === 'canplaythrough') {
        Promise.resolve().then(() => handler());
      }
    }),
    removeEventListener: vi.fn(),
  };
}

describe('SoundManager', () => {
  let manager;
  let mockAudioInstances;
  let originalAudio;

  beforeEach(() => {
    mockAudioInstances = [];

    // Сохраняем оригинальный Audio и заменяем на мок-конструктор
    originalAudio = global.Audio;
    global.Audio = function MockAudio(url) {
      const audio = createMockAudio();
      audio.src = url || '';
      mockAudioInstances.push(audio);
      return audio;
    };

    manager = new SoundManager();
  });

  afterEach(() => {
    manager.destroy();
    global.Audio = originalAudio;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const mgr = new SoundManager();

      expect(mgr.enabled).toBe(true);
      expect(mgr.volume).toBe(0.3);
      expect(mgr.sounds.size).toBe(0);
      expect(mgr.preloadQueue).toEqual([]);

      mgr.destroy();
    });

    it('should accept custom enabled option', () => {
      const mgr = new SoundManager({ enabled: false });

      expect(mgr.enabled).toBe(false);

      mgr.destroy();
    });

    it('should accept custom volume option', () => {
      const mgr = new SoundManager({ volume: 0.7 });

      expect(mgr.volume).toBe(0.7);

      mgr.destroy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // register()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('register()', () => {
    it('should register sound by name', () => {
      manager.register('click', '/sounds/click.mp3');

      expect(manager.sounds.has('click')).toBe(true);
    });

    it('should store sound configuration', () => {
      manager.register('flip', '/sounds/flip.mp3', { volume: 0.5 });

      const sound = manager.sounds.get('flip');
      expect(sound.url).toBe('/sounds/flip.mp3');
      expect(sound.volume).toBe(0.5);
      expect(sound.loaded).toBe(false);
      expect(sound.audioPool).toEqual([]);
    });

    it('should use default volume if not specified', () => {
      manager.register('beep', '/sounds/beep.mp3');

      const sound = manager.sounds.get('beep');
      expect(sound.volume).toBe(0.3);
    });

    it('should set default poolSize to 3', () => {
      manager.register('sound', '/sounds/sound.mp3');

      const sound = manager.sounds.get('sound');
      expect(sound.poolSize).toBe(3);
    });

    it('should accept custom poolSize', () => {
      manager.register('sound', '/sounds/sound.mp3', { poolSize: 5 });

      const sound = manager.sounds.get('sound');
      expect(sound.poolSize).toBe(5);
    });

    it('should add to preload queue when preload option is true', () => {
      manager.register('preloaded', '/sounds/pre.mp3', { preload: true });

      expect(manager.preloadQueue).toContain('preloaded');
    });

    it('should not add to preload queue by default', () => {
      manager.register('normal', '/sounds/normal.mp3');

      expect(manager.preloadQueue).not.toContain('normal');
    });

    it('should return this for chaining', () => {
      const result = manager.register('a', '/a.mp3');

      expect(result).toBe(manager);
    });

    it('should support chained registration', () => {
      manager
        .register('a', '/a.mp3')
        .register('b', '/b.mp3')
        .register('c', '/c.mp3');

      expect(manager.sounds.size).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // preload()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('preload()', () => {
    it('should load all sounds in preload queue', async () => {
      manager.register('a', '/a.mp3', { preload: true });
      manager.register('b', '/b.mp3', { preload: true });

      await manager.preload();

      expect(manager.sounds.get('a').loaded).toBe(true);
      expect(manager.sounds.get('b').loaded).toBe(true);
    });

    it('should not load sounds not in preload queue', async () => {
      manager.register('preloaded', '/pre.mp3', { preload: true });
      manager.register('lazy', '/lazy.mp3');

      await manager.preload();

      expect(manager.sounds.get('preloaded').loaded).toBe(true);
      expect(manager.sounds.get('lazy').loaded).toBe(false);
    });

    it('should handle empty preload queue', async () => {
      await expect(manager.preload()).resolves.not.toThrow();
    });

    it('should create audio pool for preloaded sounds', async () => {
      manager.register('sound', '/sound.mp3', { preload: true, poolSize: 3 });

      await manager.preload();

      const sound = manager.sounds.get('sound');
      expect(sound.audioPool.length).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _loadSound()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_loadSound()', () => {
    it('should create Audio elements', async () => {
      manager.register('test', '/test.mp3');

      await manager._loadSound('test');

      expect(mockAudioInstances.length).toBeGreaterThan(0);
    });

    it('should set audio properties', async () => {
      manager.register('test', '/test.mp3', { volume: 0.5 });

      await manager._loadSound('test');

      expect(mockAudioInstances[0].volume).toBe(0.5);
      expect(mockAudioInstances[0].preload).toBe('auto');
    });

    it('should mark sound as loaded', async () => {
      manager.register('test', '/test.mp3');

      await manager._loadSound('test');

      expect(manager.sounds.get('test').loaded).toBe(true);
    });

    it('should not reload already loaded sound', async () => {
      manager.register('test', '/test.mp3');

      await manager._loadSound('test');
      const callCount = mockAudioInstances.length;

      await manager._loadSound('test');

      expect(mockAudioInstances.length).toBe(callCount);
    });

    it('should handle non-existent sound gracefully', async () => {
      await expect(manager._loadSound('nonexistent')).resolves.not.toThrow();
    });

    it('should handle load error', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Мокаем Audio чтобы вызывать error вместо canplaythrough
      global.Audio = function MockAudioError(url) {
        const audio = createMockAudio();
        audio.addEventListener = vi.fn((event, handler) => {
          if (event === 'error') {
            Promise.resolve().then(() => handler(new Error('Load failed')));
          }
        });
        mockAudioInstances.push(audio);
        return audio;
      };

      manager.register('error', '/error.mp3');

      await manager._loadSound('error');

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(manager.sounds.get('error').loaded).toBe(false);

      consoleWarnSpy.mockRestore();
    });

    it('should timeout if canplaythrough never fires', async () => {
      vi.useFakeTimers();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Audio, который никогда не вызовет canplaythrough
      global.Audio = function MockAudioHanging(url) {
        const audio = createMockAudio();
        audio.addEventListener = vi.fn(); // Не вызывает никаких событий
        mockAudioInstances.push(audio);
        return audio;
      };

      manager.register('hanging', '/hanging.mp3');

      const loadPromise = manager._loadSound('hanging');

      // Продвигаем таймер на 10 секунд (таймаут загрузки)
      vi.advanceTimersByTime(10000);

      await loadPromise;

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(manager.sounds.get('hanging').loaded).toBe(false);

      consoleWarnSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // play()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('play()', () => {
    it('should not play when disabled', async () => {
      manager.setEnabled(false);
      manager.register('test', '/test.mp3');
      await manager._loadSound('test');

      await manager.play('test');

      // play не должен вызываться если manager отключен
      mockAudioInstances.forEach(audio => {
        expect(audio.play).not.toHaveBeenCalled();
      });
    });

    it('should warn for unregistered sound', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await manager.play('nonexistent');

      expect(consoleWarnSpy).toHaveBeenCalledWith('Sound "nonexistent" not registered');

      consoleWarnSpy.mockRestore();
    });

    it('should load sound if not loaded', async () => {
      manager.register('lazy', '/lazy.mp3');

      expect(manager.sounds.get('lazy').loaded).toBe(false);

      await manager.play('lazy');

      expect(manager.sounds.get('lazy').loaded).toBe(true);
    });

    it('should reset currentTime before playing', async () => {
      manager.register('test', '/test.mp3');
      await manager._loadSound('test');

      const audio = mockAudioInstances[0];
      audio.currentTime = 5;

      await manager.play('test');

      expect(audio.currentTime).toBe(0);
    });

    it('should call audio.play()', async () => {
      manager.register('test', '/test.mp3');
      await manager._loadSound('test');

      await manager.play('test');

      expect(mockAudioInstances[0].play).toHaveBeenCalled();
    });

    it('should apply volume option', async () => {
      manager.register('test', '/test.mp3');
      await manager._loadSound('test');

      await manager.play('test', { volume: 0.8 });

      expect(mockAudioInstances[0].volume).toBe(0.8);
    });

    it('should not persist per-play volume override to next play', async () => {
      const mgr = new SoundManager({ volume: 0.5 });
      mgr.register('test', '/test.mp3', { poolSize: 1 });
      await mgr._loadSound('test');

      await mgr.play('test', { volume: 0.9 });
      expect(mockAudioInstances[0].volume).toBe(0.9);

      // Следующий вызов без options.volume должен сбросить к sound.volume
      await mgr.play('test');
      expect(mockAudioInstances[0].volume).toBe(0.5);

      mgr.destroy();
    });

    it('should apply playbackRate option', async () => {
      manager.register('test', '/test.mp3');
      await manager._loadSound('test');

      await manager.play('test', { playbackRate: 1.5 });

      expect(mockAudioInstances[0].playbackRate).toBe(1.5);
    });

    it('should cycle through audio pool', async () => {
      manager.register('test', '/test.mp3', { poolSize: 3 });
      await manager._loadSound('test');

      // Play 4 times - should cycle through pool
      await manager.play('test');
      await manager.play('test');
      await manager.play('test');
      await manager.play('test');

      // Проверяем что все audio из пула использовались
      expect(mockAudioInstances[0].play).toHaveBeenCalled();
      expect(mockAudioInstances[1].play).toHaveBeenCalled();
      expect(mockAudioInstances[2].play).toHaveBeenCalled();
    });

    it('should handle NotAllowedError silently', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      manager.register('test', '/test.mp3');
      await manager._loadSound('test');

      const error = new Error('Autoplay blocked');
      error.name = 'NotAllowedError';
      mockAudioInstances[0].play = vi.fn().mockRejectedValue(error);

      await manager.play('test');

      // Ждём обработку rejected promise
      await new Promise(resolve => setTimeout(resolve, 10));

      // Не должно быть предупреждения для NotAllowedError
      const warnCalls = consoleWarnSpy.mock.calls.filter(
        call => call[0]?.includes?.('Failed to play')
      );
      expect(warnCalls.length).toBe(0);

      consoleWarnSpy.mockRestore();
    });

    it('should warn for other play errors', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      manager.register('test', '/test.mp3');
      await manager._loadSound('test');

      mockAudioInstances[0].play = vi.fn().mockRejectedValue(new Error('Unknown error'));

      await manager.play('test');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setEnabled()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('setEnabled()', () => {
    it('should enable sounds', () => {
      manager.setEnabled(false);
      manager.setEnabled(true);

      expect(manager.enabled).toBe(true);
    });

    it('should disable sounds', () => {
      manager.setEnabled(false);

      expect(manager.enabled).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setVolume()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('setVolume()', () => {
    it('should set volume', () => {
      manager.setVolume(0.5);

      expect(manager.volume).toBe(0.5);
    });

    it('should clamp volume to minimum 0', () => {
      manager.setVolume(-0.5);

      expect(manager.volume).toBe(0);
    });

    it('should clamp volume to maximum 1', () => {
      manager.setVolume(1.5);

      expect(manager.volume).toBe(1);
    });

    it('should update volume of loaded sounds', async () => {
      manager.register('test', '/test.mp3', { poolSize: 2 });
      await manager._loadSound('test');

      manager.setVolume(0.8);

      mockAudioInstances.forEach(audio => {
        expect(audio.volume).toBe(0.8);
      });
    });

    it('should not fail if no sounds loaded', () => {
      expect(() => manager.setVolume(0.5)).not.toThrow();
    });

    it('should update sound.volume for unloaded sounds', () => {
      manager.register('lazy', '/lazy.mp3');

      manager.setVolume(0.6);

      expect(manager.sounds.get('lazy').volume).toBe(0.6);
    });

    it('should use updated sound.volume when lazy sound is loaded after setVolume', async () => {
      manager.register('lazy', '/lazy.mp3');
      manager.setVolume(0.6);

      await manager._loadSound('lazy');

      mockAudioInstances.forEach(audio => {
        expect(audio.volume).toBe(0.6);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // stopAll()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('stopAll()', () => {
    it('should pause all loaded audio', async () => {
      manager.register('a', '/a.mp3', { preload: true, poolSize: 2 });
      manager.register('b', '/b.mp3', { preload: true, poolSize: 2 });
      await manager.preload();

      manager.stopAll();

      mockAudioInstances.forEach(audio => {
        expect(audio.pause).toHaveBeenCalled();
        expect(audio.currentTime).toBe(0);
      });
    });

    it('should not fail if no sounds loaded', () => {
      manager.register('test', '/test.mp3');

      expect(() => manager.stopAll()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // destroy()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('destroy()', () => {
    it('should stop all sounds', async () => {
      manager.register('test', '/test.mp3');
      await manager._loadSound('test');

      const stopAllSpy = vi.spyOn(manager, 'stopAll');

      manager.destroy();

      expect(stopAllSpy).toHaveBeenCalled();
    });

    it('should clear audio src', async () => {
      manager.register('test', '/test.mp3');
      await manager._loadSound('test');

      const firstAudio = mockAudioInstances[0];

      manager.destroy();

      expect(firstAudio.src).toBe('');
    });

    it('should call audio.load()', async () => {
      manager.register('test', '/test.mp3');
      await manager._loadSound('test');

      const firstAudio = mockAudioInstances[0];

      manager.destroy();

      expect(firstAudio.load).toHaveBeenCalled();
    });

    it('should clear sounds map', async () => {
      manager.register('test', '/test.mp3');
      await manager._loadSound('test');

      manager.destroy();

      expect(manager.sounds.size).toBe(0);
    });

    it('should clear preload queue', () => {
      manager.register('test', '/test.mp3', { preload: true });

      manager.destroy();

      expect(manager.preloadQueue).toEqual([]);
    });

    it('should be safe to call multiple times', async () => {
      manager.register('test', '/test.mp3');
      await manager._loadSound('test');

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
    it('should handle play when not loaded', async () => {
      manager.register('test', '/test.mp3');

      // Попытка воспроизвести - загрузит автоматически
      await expect(manager.play('test')).resolves.not.toThrow();
    });

    it('should handle multiple rapid play calls', async () => {
      manager.register('test', '/test.mp3');
      await manager._loadSound('test');

      await Promise.all([
        manager.play('test'),
        manager.play('test'),
        manager.play('test'),
      ]);

      // Хотя бы один play должен быть вызван
      const playCalls = mockAudioInstances.filter(a => a.play.mock.calls.length > 0);
      expect(playCalls.length).toBeGreaterThan(0);
    });
  });
});
