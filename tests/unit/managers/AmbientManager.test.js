/**
 * Тесты для AmbientManager
 * Управление фоновыми звуками окружения
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../js/config.js', () => {
  const CONFIG = { AUDIO: { VISIBILITY_RESUME_DELAY: 100 } };
  return { CONFIG, getConfig: () => CONFIG };
});

import { AmbientManager } from '../../../js/managers/AmbientManager.js';

describe('AmbientManager', () => {
  let manager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new AmbientManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('constructor', () => {
    it('should use default options', () => {
      expect(manager.currentType).toBe('none');
      expect(manager.volume).toBe(0.5);
      expect(manager.sounds).toEqual({});
      expect(manager.audio).toBeNull();
      expect(manager.isPlaying).toBe(false);
      expect(manager.isLoading).toBe(false);
    });

    it('should accept custom options', () => {
      const custom = new AmbientManager({
        currentType: 'rain',
        volume: 0.8,
        sounds: { rain: '/rain.mp3' },
      });
      expect(custom.currentType).toBe('rain');
      expect(custom.volume).toBe(0.8);
      expect(custom.sounds).toEqual({ rain: '/rain.mp3' });
      custom.destroy();
    });

    it('should set up visibility listener', () => {
      const spy = vi.spyOn(document, 'addEventListener');
      const m = new AmbientManager();
      expect(spy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      m.destroy();
      spy.mockRestore();
    });
  });

  describe('TYPE_NONE', () => {
    it('should be "none"', () => {
      expect(AmbientManager.TYPE_NONE).toBe('none');
    });
  });

  describe('register', () => {
    it('should register a sound with URL', () => {
      manager.register('rain', '/rain.mp3');
      expect(manager.sounds.rain).toBe('/rain.mp3');
    });

    it('should return this for chaining', () => {
      const result = manager.register('rain', '/rain.mp3');
      expect(result).toBe(manager);
    });
  });

  describe('setVolume', () => {
    it('should set volume', () => {
      manager.setVolume(0.7);
      expect(manager.volume).toBe(0.7);
    });

    it('should clamp volume to 0', () => {
      manager.setVolume(-1);
      expect(manager.volume).toBe(0);
    });

    it('should clamp volume to 1', () => {
      manager.setVolume(2);
      expect(manager.volume).toBe(1);
    });

    it('should update current audio volume when playing', () => {
      const mockAudio = { volume: 0.5, pause: vi.fn(), currentTime: 0, src: '' };
      manager.audio = mockAudio;
      manager.isPlaying = true;

      manager.setVolume(0.8);
      expect(mockAudio.volume).toBe(0.8);
    });

    it('should not update audio volume when not playing', () => {
      const mockAudio = { volume: 0.5, pause: vi.fn(), currentTime: 0, src: '' };
      manager.audio = mockAudio;
      manager.isPlaying = false;

      manager.setVolume(0.8);
      expect(mockAudio.volume).toBe(0.5); // unchanged
    });
  });

  describe('setType', () => {
    it('should stop when set to none', async () => {
      const stopSpy = vi.spyOn(manager, 'stop').mockResolvedValue();

      await manager.setType('none');
      expect(stopSpy).toHaveBeenCalled();
      expect(manager.currentType).toBe('none');
    });

    it('should stop when type has no file', async () => {
      const stopSpy = vi.spyOn(manager, 'stop').mockResolvedValue();
      await manager.setType('unknown');
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should not replay if already playing same type', async () => {
      manager.currentType = 'rain';
      manager.isPlaying = true;
      const playSpy = vi.spyOn(manager, 'play').mockResolvedValue();

      await manager.setType('rain');
      expect(playSpy).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should pause and reset audio', async () => {
      const mockAudio = { pause: vi.fn(), currentTime: 5, volume: 0.5 };
      manager.audio = mockAudio;
      manager.isPlaying = true;

      await manager.stop(false);
      expect(mockAudio.pause).toHaveBeenCalled();
      expect(mockAudio.currentTime).toBe(0);
      expect(manager.audio).toBeNull();
      expect(manager.isPlaying).toBe(false);
    });

    it('should do nothing when no audio', async () => {
      await expect(manager.stop()).resolves.toBeUndefined();
    });
  });

  describe('pause', () => {
    it('should pause playing audio', () => {
      const mockAudio = { pause: vi.fn(), paused: false };
      manager.audio = mockAudio;
      manager.isPlaying = true;

      manager.pause();
      expect(mockAudio.pause).toHaveBeenCalled();
    });

    it('should not pause when not playing', () => {
      const mockAudio = { pause: vi.fn() };
      manager.audio = mockAudio;
      manager.isPlaying = false;

      manager.pause();
      expect(mockAudio.pause).not.toHaveBeenCalled();
    });

    it('should do nothing when no audio', () => {
      expect(() => manager.pause()).not.toThrow();
    });
  });

  describe('resume', () => {
    it('should resume paused audio', () => {
      const mockAudio = { play: vi.fn(() => Promise.resolve()), pause: vi.fn(), paused: true };
      manager.audio = mockAudio;
      manager.isPlaying = true;

      manager.resume();
      expect(mockAudio.play).toHaveBeenCalled();
    });

    it('should not resume if not paused', () => {
      const mockAudio = { play: vi.fn(() => Promise.resolve()), pause: vi.fn(), paused: false };
      manager.audio = mockAudio;
      manager.isPlaying = true;

      manager.resume();
      expect(mockAudio.play).not.toHaveBeenCalled();
    });

    it('should not resume if not playing', () => {
      const mockAudio = { play: vi.fn(() => Promise.resolve()), pause: vi.fn(), paused: true };
      manager.audio = mockAudio;
      manager.isPlaying = false;

      manager.resume();
      expect(mockAudio.play).not.toHaveBeenCalled();
    });
  });

  describe('play with cached audio', () => {
    it('should use cached audio', async () => {
      const mockAudio = {
        volume: 0,
        currentTime: 5,
        play: vi.fn(() => Promise.resolve()),
        pause: vi.fn(),
      };
      manager.audioCache.set('rain', mockAudio);
      manager.sounds = { rain: '/rain.mp3' };

      await manager.play('rain', false);
      expect(manager.audio).toBe(mockAudio);
      expect(mockAudio.volume).toBe(0.5);
      expect(mockAudio.currentTime).toBe(0);
      expect(mockAudio.play).toHaveBeenCalled();
      expect(manager.isPlaying).toBe(true);
    });

    it('should set volume to 0 for fade-in with cache', async () => {
      const mockAudio = {
        volume: 0.5,
        currentTime: 0,
        play: vi.fn(() => Promise.resolve()),
        pause: vi.fn(),
      };
      manager.audioCache.set('rain', mockAudio);
      manager.sounds = { rain: '/rain.mp3' };

      // Don't wait for fade (it uses setInterval)
      manager.play('rain', true);
      expect(mockAudio.volume).toBe(0);
    });

    it('should warn when playing unregistered sound', async () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await manager.play('unknown');
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('unknown'));
      spy.mockRestore();
    });
  });

  describe('destroy', () => {
    it('should remove visibility listener', () => {
      const spy = vi.spyOn(document, 'removeEventListener');
      manager.destroy();
      expect(spy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      spy.mockRestore();
    });

    it('should clear fade interval', () => {
      manager.fadeInterval = setInterval(() => {}, 1000);
      manager.destroy();
      expect(manager.fadeInterval).toBeNull();
    });

    it('should pause and clear current audio', () => {
      const mockAudio = { pause: vi.fn(), currentTime: 0, src: '' };
      manager.audio = mockAudio;
      manager.destroy();
      expect(mockAudio.pause).toHaveBeenCalled();
      expect(manager.audio).toBeNull();
    });

    it('should clear audio cache', () => {
      const mockAudio = { pause: vi.fn(), src: 'test' };
      manager.audioCache.set('rain', mockAudio);
      manager.destroy();
      expect(manager.audioCache.size).toBe(0);
      expect(mockAudio.src).toBe('');
    });

    it('should reset state', () => {
      manager.isPlaying = true;
      manager.sounds = { rain: '/rain.mp3' };
      manager.destroy();
      expect(manager.isPlaying).toBe(false);
      expect(manager.sounds).toEqual({});
    });
  });

  describe('_clearFade', () => {
    it('should clear interval and set to null', () => {
      manager.fadeInterval = setInterval(() => {}, 1000);
      manager._clearFade();
      expect(manager.fadeInterval).toBeNull();
    });

    it('should do nothing if no interval', () => {
      expect(() => manager._clearFade()).not.toThrow();
    });
  });

  describe('_handleVisibilityChange', () => {
    it('should pause when document becomes hidden', () => {
      const pauseSpy = vi.spyOn(manager, 'pause');
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });

      manager._handleVisibilityChange();
      expect(pauseSpy).toHaveBeenCalled();

      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    });

    it('should schedule resume when document becomes visible', () => {
      vi.useFakeTimers();
      const resumeSpy = vi.spyOn(manager, 'resume');
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });

      manager._handleVisibilityChange();
      vi.advanceTimersByTime(100);
      expect(resumeSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('callbacks', () => {
    it('should call onLoadStart and onLoadEnd', async () => {
      const onLoadStart = vi.fn();
      const onLoadEnd = vi.fn();
      const m = new AmbientManager({ onLoadStart, onLoadEnd });
      m.sounds = { rain: '/rain.mp3' };

      // play will trigger new Audio() which will fail in jsdom, but callbacks should fire
      await m.play('rain', false);

      expect(onLoadStart).toHaveBeenCalledWith('rain');
      expect(onLoadEnd).toHaveBeenCalledWith('rain');
      m.destroy();
    });
  });
});
