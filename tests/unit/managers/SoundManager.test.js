/**
 * Тесты для SoundManager
 * Управление звуковыми эффектами книги
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SoundManager } from '../../../js/managers/SoundManager.js';

describe('SoundManager', () => {
  let manager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new SoundManager();
  });

  afterEach(() => {
    // Clear sounds to avoid issues with mock audio objects lacking methods
    manager.sounds.clear();
    manager.preloadQueue = [];
  });

  describe('constructor', () => {
    it('should use default options', () => {
      expect(manager.enabled).toBe(true);
      expect(manager.volume).toBe(0.3);
      expect(manager.sounds.size).toBe(0);
      expect(manager.preloadQueue).toEqual([]);
    });

    it('should accept custom options', () => {
      const custom = new SoundManager({ enabled: false, volume: 0.8 });
      expect(custom.enabled).toBe(false);
      expect(custom.volume).toBe(0.8);
      custom.destroy();
    });
  });

  describe('register', () => {
    it('should register a sound with URL', () => {
      manager.register('flip', 'sounds/flip.mp3');
      expect(manager.sounds.has('flip')).toBe(true);
    });

    it('should return this for chaining', () => {
      const result = manager.register('flip', 'sounds/flip.mp3');
      expect(result).toBe(manager);
    });

    it('should set sound with default pool size', () => {
      manager.register('flip', 'sounds/flip.mp3');
      const sound = manager.sounds.get('flip');
      expect(sound.poolSize).toBe(3);
      expect(sound.loaded).toBe(false);
      expect(sound.url).toBe('sounds/flip.mp3');
    });

    it('should add to preload queue when preload option set', () => {
      manager.register('flip', 'sounds/flip.mp3', { preload: true });
      expect(manager.preloadQueue).toContain('flip');
    });

    it('should not add to preload queue by default', () => {
      manager.register('flip', 'sounds/flip.mp3');
      expect(manager.preloadQueue).toHaveLength(0);
    });

    it('should accept custom volume', () => {
      manager.register('flip', 'sounds/flip.mp3', { volume: 0.5 });
      const sound = manager.sounds.get('flip');
      expect(sound.volume).toBe(0.5);
    });

    it('should accept custom pool size', () => {
      manager.register('flip', 'sounds/flip.mp3', { poolSize: 5 });
      const sound = manager.sounds.get('flip');
      expect(sound.poolSize).toBe(5);
    });
  });

  describe('setEnabled', () => {
    it('should enable sounds', () => {
      manager.setEnabled(true);
      expect(manager.enabled).toBe(true);
    });

    it('should disable sounds', () => {
      manager.setEnabled(false);
      expect(manager.enabled).toBe(false);
    });
  });

  describe('setVolume', () => {
    it('should set volume', () => {
      manager.setVolume(0.7);
      expect(manager.volume).toBe(0.7);
    });

    it('should clamp volume to 0', () => {
      manager.setVolume(-0.5);
      expect(manager.volume).toBe(0);
    });

    it('should clamp volume to 1', () => {
      manager.setVolume(1.5);
      expect(manager.volume).toBe(1);
    });

    it('should update volume on registered sounds', () => {
      manager.register('flip', 'sounds/flip.mp3');
      manager.setVolume(0.8);
      expect(manager.sounds.get('flip').volume).toBe(0.8);
    });

    it('should update loaded audio elements', () => {
      manager.register('flip', 'sounds/flip.mp3');
      const sound = manager.sounds.get('flip');
      const mockAudio = { volume: 0.3, pause: vi.fn(), currentTime: 0, src: '' };
      sound.audioPool = [mockAudio];
      sound.loaded = true;

      manager.setVolume(0.9);
      expect(mockAudio.volume).toBe(0.9);
    });
  });

  describe('play', () => {
    it('should not play when disabled', async () => {
      manager.setEnabled(false);
      manager.register('flip', 'sounds/flip.mp3');
      await manager.play('flip');
      // No error, just returns
    });

    it('should warn for unregistered sound', async () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await manager.play('unknown');
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('unknown'));
      spy.mockRestore();
    });

    it('should play from pool and cycle index', async () => {
      manager.register('flip', 'sounds/flip.mp3');
      const sound = manager.sounds.get('flip');
      const mockAudio1 = { volume: 0.3, currentTime: 0, play: vi.fn(() => Promise.resolve()) };
      const mockAudio2 = { volume: 0.3, currentTime: 0, play: vi.fn(() => Promise.resolve()) };
      sound.audioPool = [mockAudio1, mockAudio2];
      sound.loaded = true;

      await manager.play('flip');
      expect(mockAudio1.play).toHaveBeenCalled();
      expect(sound.currentPoolIndex).toBe(1);

      await manager.play('flip');
      expect(mockAudio2.play).toHaveBeenCalled();
      expect(sound.currentPoolIndex).toBe(0); // wraps around
    });

    it('should apply custom volume option', async () => {
      manager.register('flip', 'sounds/flip.mp3');
      const sound = manager.sounds.get('flip');
      const mockAudio = { volume: 0.3, currentTime: 0, play: vi.fn(() => Promise.resolve()) };
      sound.audioPool = [mockAudio];
      sound.loaded = true;

      await manager.play('flip', { volume: 0.9 });
      expect(mockAudio.volume).toBe(0.9);
    });

    it('should apply custom playbackRate', async () => {
      manager.register('flip', 'sounds/flip.mp3');
      const sound = manager.sounds.get('flip');
      const mockAudio = { volume: 0.3, currentTime: 0, playbackRate: 1, play: vi.fn(() => Promise.resolve()) };
      sound.audioPool = [mockAudio];
      sound.loaded = true;

      await manager.play('flip', { playbackRate: 1.5 });
      expect(mockAudio.playbackRate).toBe(1.5);
    });

    it('should reset currentTime before playing', async () => {
      manager.register('flip', 'sounds/flip.mp3');
      const sound = manager.sounds.get('flip');
      const mockAudio = { volume: 0.3, currentTime: 5, play: vi.fn(() => Promise.resolve()) };
      sound.audioPool = [mockAudio];
      sound.loaded = true;

      await manager.play('flip');
      expect(mockAudio.currentTime).toBe(0);
    });
  });

  describe('stopAll', () => {
    it('should pause and reset all loaded sounds', () => {
      manager.register('flip', 'sounds/flip.mp3');
      const sound = manager.sounds.get('flip');
      const mockAudio = { pause: vi.fn(), currentTime: 5, volume: 0.3, src: '' };
      sound.audioPool = [mockAudio];
      sound.loaded = true;

      manager.stopAll();
      expect(mockAudio.pause).toHaveBeenCalled();
      expect(mockAudio.currentTime).toBe(0);
    });

    it('should not error on unloaded sounds', () => {
      manager.register('flip', 'sounds/flip.mp3');
      expect(() => manager.stopAll()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should clear all sounds', () => {
      manager.register('flip', 'sounds/flip.mp3');
      manager.destroy();
      expect(manager.sounds.size).toBe(0);
      expect(manager.preloadQueue).toEqual([]);
    });

    it('should clean up loaded audio elements', () => {
      manager.register('flip', 'sounds/flip.mp3');
      const sound = manager.sounds.get('flip');
      const mockAudio = { pause: vi.fn(), currentTime: 0, volume: 0.3, src: 'x', load: vi.fn() };
      sound.audioPool = [mockAudio];
      sound.loaded = true;

      manager.destroy();
      expect(mockAudio.src).toBe('');
      expect(mockAudio.load).toHaveBeenCalled();
    });
  });
});
