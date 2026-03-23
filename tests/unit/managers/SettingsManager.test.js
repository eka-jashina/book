/**
 * Тесты для SettingsManager
 * Управление настройками с персистентностью
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsManager } from '../../../js/managers/SettingsManager.js';

describe('SettingsManager', () => {
  let manager;
  let mockStorage;
  const defaults = {
    font: 'georgia',
    fontSize: 18,
    theme: 'light',
    soundEnabled: true,
    soundVolume: 0.3,
    ambientVolume: 0.5,
    page: 0,
    ambientType: 'none',
  };

  beforeEach(() => {
    mockStorage = {
      load: vi.fn().mockReturnValue({}),
      save: vi.fn(),
    };
    manager = new SettingsManager(mockStorage, defaults);
  });

  describe('constructor', () => {
    it('should merge defaults with stored settings', () => {
      expect(manager.settings).toEqual(defaults);
    });

    it('should override defaults with stored values', () => {
      mockStorage.load.mockReturnValue({ font: 'inter', fontSize: 20 });
      const mgr = new SettingsManager(mockStorage, defaults);

      expect(mgr.settings.font).toBe('inter');
      expect(mgr.settings.fontSize).toBe(20);
      expect(mgr.settings.theme).toBe('light'); // from defaults
    });

    it('should load from storage', () => {
      expect(mockStorage.load).toHaveBeenCalled();
    });

    it('should store reference to storage', () => {
      expect(manager.storage).toBe(mockStorage);
    });

    it('should sanitize corrupted values from storage', () => {
      mockStorage.load.mockReturnValue({
        fontSize: NaN,
        theme: 'hacked',
        soundVolume: 999,
        page: -5,
      });
      const mgr = new SettingsManager(mockStorage, defaults);

      expect(mgr.settings.fontSize).toBe(18); // fallback to default
      expect(mgr.settings.theme).toBe('light');
      expect(mgr.settings.soundVolume).toBe(1); // clamped to max
      expect(mgr.settings.page).toBe(0);
    });

    it('should sanitize string fontSize from storage', () => {
      mockStorage.load.mockReturnValue({ fontSize: '20' });
      const mgr = new SettingsManager(mockStorage, defaults);

      expect(mgr.settings.fontSize).toBe(20);
    });

    it('should sanitize extreme font sizes from storage', () => {
      mockStorage.load.mockReturnValue({ fontSize: 1000 });
      const mgr = new SettingsManager(mockStorage, defaults);

      expect(mgr.settings.fontSize).toBe(72); // clamped to absolute max
    });
  });

  describe('get', () => {
    it('should return setting value', () => {
      expect(manager.get('font')).toBe('georgia');
    });

    it('should return undefined for unknown key', () => {
      expect(manager.get('unknown')).toBeUndefined();
    });

    it('should return stored value after override', () => {
      mockStorage.load.mockReturnValue({ theme: 'dark' });
      const mgr = new SettingsManager(mockStorage, defaults);
      expect(mgr.get('theme')).toBe('dark');
    });
  });

  describe('set', () => {
    it('should update setting value', () => {
      manager.set('font', 'inter');
      expect(manager.settings.font).toBe('inter');
    });

    it('should save to storage', () => {
      manager.set('fontSize', 20);
      expect(mockStorage.save).toHaveBeenCalledWith({ fontSize: 20 });
    });

    it('should not save if value unchanged', () => {
      manager.set('font', 'georgia'); // same as default
      expect(mockStorage.save).not.toHaveBeenCalled();
    });

    it('should save when value changes from stored', () => {
      manager.set('font', 'inter');
      expect(mockStorage.save).toHaveBeenCalledWith({ font: 'inter' });
    });

    it('should handle new keys', () => {
      manager.set('newKey', 'newValue');
      expect(manager.settings.newKey).toBe('newValue');
      expect(mockStorage.save).toHaveBeenCalledWith({ newKey: 'newValue' });
    });

    it('should handle falsy values', () => {
      manager.set('soundEnabled', false);
      expect(manager.settings.soundEnabled).toBe(false);
      expect(mockStorage.save).toHaveBeenCalledWith({ soundEnabled: false });
    });

    it('should sanitize invalid fontSize on set', () => {
      manager.set('fontSize', NaN);
      // NaN sanitized to default (18) — same as current, so no save
      expect(manager.settings.fontSize).toBe(18);
      expect(mockStorage.save).not.toHaveBeenCalled();
    });

    it('should clamp extreme fontSize on set', () => {
      manager.set('fontSize', 1000);
      expect(manager.settings.fontSize).toBe(72);
      expect(mockStorage.save).toHaveBeenCalledWith({ fontSize: 72 });
    });

    it('should sanitize invalid theme on set', () => {
      manager.set('theme', 'hacked');
      // Falls back to default 'light' — same as current
      expect(manager.settings.theme).toBe('light');
      expect(mockStorage.save).not.toHaveBeenCalled();
    });

    it('should clamp volume on set', () => {
      manager.set('soundVolume', 1.5);
      expect(manager.settings.soundVolume).toBe(1);
      expect(mockStorage.save).toHaveBeenCalledWith({ soundVolume: 1 });
    });

    it('should handle zero value for fontSize (clamps to min)', () => {
      manager.set('fontSize', 0);
      expect(manager.settings.fontSize).toBe(8); // absolute min
    });

    it('should handle null font value (falls back to default)', () => {
      manager.set('font', null);
      // null is sanitized to default 'georgia' — same as current
      expect(manager.settings.font).toBe('georgia');
      expect(mockStorage.save).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should null out storage reference', () => {
      manager.destroy();
      expect(manager.storage).toBeNull();
    });

    it('should null out settings', () => {
      manager.destroy();
      expect(manager.settings).toBeNull();
    });

    it('should null out defaults', () => {
      manager.destroy();
      expect(manager._defaults).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // applyServerProgress
  // ═══════════════════════════════════════════════════════════════════════════

  describe('applyServerProgress', () => {
    it('should merge server progress with defaults', () => {
      manager.applyServerProgress({ page: 42, theme: 'dark' });

      expect(manager.settings.page).toBe(42);
      expect(manager.settings.theme).toBe('dark');
      expect(manager.settings.font).toBe('georgia'); // from defaults
    });

    it('should save merged settings to localStorage', () => {
      manager.applyServerProgress({ page: 10 });

      expect(mockStorage.save).toHaveBeenCalledWith(expect.objectContaining({ page: 10 }));
    });

    it('should be no-op for null progress', () => {
      const settingsBefore = { ...manager.settings };
      manager.applyServerProgress(null);

      expect(manager.settings).toEqual(settingsBefore);
    });

    it('should sanitize server progress values', () => {
      manager.applyServerProgress({ fontSize: 1000, soundVolume: -5 });

      expect(manager.settings.fontSize).toBe(72); // clamped to max
      expect(manager.settings.soundVolume).toBe(0); // clamped to min
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Server sync (Фаза 3)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('server sync', () => {
    let mockApi;
    let syncManager;

    beforeEach(() => {
      vi.useFakeTimers();
      mockApi = {
        saveProgress: vi.fn().mockResolvedValue({}),
      };
      syncManager = new SettingsManager(mockStorage, defaults, {
        apiClient: mockApi,
        bookId: 'book-1',
      });
    });

    afterEach(() => {
      syncManager.destroy();
      vi.useRealTimers();
    });

    it('should schedule sync on set when api is configured', () => {
      syncManager.set('page', 5);

      expect(syncManager._dirty).toBe(true);
    });

    it('should call saveProgress after debounce delay', async () => {
      syncManager.set('page', 5);

      // Advance past SYNC_DEBOUNCE (5000ms)
      vi.advanceTimersByTime(5000);
      await vi.waitFor(() => {
        expect(mockApi.saveProgress).toHaveBeenCalledWith('book-1', expect.objectContaining({
          page: 5,
        }));
      });
    });

    it('should clear dirty flag after successful sync', async () => {
      syncManager.set('page', 5);

      vi.advanceTimersByTime(5000);
      await vi.waitFor(() => {
        expect(syncManager._dirty).toBe(false);
      });
    });

    it('should debounce multiple rapid changes', async () => {
      syncManager.set('page', 1);
      syncManager.set('page', 2);
      syncManager.set('page', 3);

      vi.advanceTimersByTime(5000);
      await vi.waitFor(() => {
        expect(mockApi.saveProgress).toHaveBeenCalledTimes(1);
        expect(mockApi.saveProgress).toHaveBeenCalledWith('book-1', expect.objectContaining({
          page: 3,
        }));
      });
    });

    it('should notify sync state changes', async () => {
      const stateChanges = [];
      syncManager.onSyncStateChange = (state) => stateChanges.push(state);

      syncManager.set('page', 5);
      expect(stateChanges).toContain('syncing');

      vi.advanceTimersByTime(5000);
      await vi.waitFor(() => {
        expect(stateChanges).toContain('synced');
      });
    });

    it('should notify error state on sync failure', async () => {
      mockApi.saveProgress.mockRejectedValue(new Error('Network'));
      const stateChanges = [];
      syncManager.onSyncStateChange = (state) => stateChanges.push(state);

      syncManager.set('page', 5);

      vi.advanceTimersByTime(5000);
      await vi.waitFor(() => {
        expect(stateChanges).toContain('error');
      });
    });

    it('should keep dirty flag on sync failure', async () => {
      mockApi.saveProgress.mockRejectedValue(new Error('Network'));

      syncManager.set('page', 5);

      vi.advanceTimersByTime(5000);
      await vi.waitFor(() => {
        expect(syncManager._dirty).toBe(true);
      });
    });

    it('should not sync if not dirty', async () => {
      await syncManager._syncToServer();

      expect(mockApi.saveProgress).not.toHaveBeenCalled();
    });

    it('should not sync without api', async () => {
      const noApiManager = new SettingsManager(mockStorage, defaults);
      noApiManager.set('page', 5);

      // Should not have _dirty since no api
      expect(noApiManager._dirty).toBe(false);
      noApiManager.destroy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // beforeunload (sendBeacon)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('beforeunload sync', () => {
    let mockApi;
    let syncManager;

    beforeEach(() => {
      vi.useFakeTimers();
      mockApi = {
        saveProgress: vi.fn().mockResolvedValue({}),
      };
      // Мок navigator.sendBeacon
      navigator.sendBeacon = vi.fn().mockReturnValue(true);
      syncManager = new SettingsManager(mockStorage, defaults, {
        apiClient: mockApi,
        bookId: 'book-1',
      });
    });

    afterEach(() => {
      syncManager.destroy();
      vi.useRealTimers();
    });

    it('should add beforeunload listener when api configured', () => {
      const spy = vi.spyOn(window, 'addEventListener');
      const mgr = new SettingsManager(mockStorage, defaults, {
        apiClient: mockApi,
        bookId: 'book-2',
      });

      expect(spy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      mgr.destroy();
    });

    it('should send beacon on beforeunload if dirty', () => {
      syncManager._dirty = true;

      syncManager._onBeforeUnload();

      expect(navigator.sendBeacon).toHaveBeenCalledWith(
        '/api/v1/books/book-1/progress',
        expect.any(Blob)
      );
    });

    it('should not send beacon if not dirty', () => {
      syncManager._dirty = false;

      syncManager._onBeforeUnload();

      expect(navigator.sendBeacon).not.toHaveBeenCalled();
    });

    it('should clear dirty flag after sendBeacon', () => {
      syncManager._dirty = true;

      syncManager._onBeforeUnload();

      expect(syncManager._dirty).toBe(false);
    });

    it('should handle sendBeacon failure gracefully', () => {
      syncManager._dirty = true;
      navigator.sendBeacon = vi.fn(() => { throw new Error('Not supported'); });

      expect(() => syncManager._onBeforeUnload()).not.toThrow();
    });

    it('should remove beforeunload listener on destroy', () => {
      const spy = vi.spyOn(window, 'removeEventListener');
      syncManager.destroy();

      expect(spy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // destroy with server sync
  // ═══════════════════════════════════════════════════════════════════════════

  describe('destroy with sync', () => {
    it('should send beacon when dirty on destroy', () => {
      const mgr = new SettingsManager(mockStorage, defaults, {
        apiClient: { saveProgress: vi.fn() },
        bookId: 'book-1',
      });
      mgr._dirty = true;

      mgr.destroy();

      expect(navigator.sendBeacon).toHaveBeenCalledWith(
        '/api/v1/books/book-1/progress',
        expect.any(Blob)
      );
    });

    it('should clear sync timer on destroy', () => {
      vi.useFakeTimers();
      const mockApi = { saveProgress: vi.fn().mockResolvedValue({}) };
      const mgr = new SettingsManager(mockStorage, defaults, {
        apiClient: mockApi,
        bookId: 'book-1',
      });
      mgr.set('page', 5); // creates timer

      mgr.destroy();

      expect(mgr._syncTimer).toBeNull();
      vi.useRealTimers();
    });
  });

  describe('integration', () => {
    it('should persist and retrieve values correctly', () => {
      manager.set('theme', 'dark');
      manager.set('fontSize', 22);

      // Simulate creating new manager with same storage
      const savedData = {};
      mockStorage.save.mockImplementation((data) => {
        Object.assign(savedData, data);
      });
      mockStorage.load.mockReturnValue(savedData);

      manager.set('font', 'roboto');

      const newManager = new SettingsManager(mockStorage, defaults);
      expect(newManager.get('font')).toBe('roboto');
    });
  });
});
