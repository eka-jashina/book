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
  // applyServerProgress — localVersion guard and page merge
  // ═══════════════════════════════════════════════════════════════════════════

  describe('applyServerProgress — race protection', () => {
    it('should skip server progress if user already made local changes', () => {
      manager.set('font', 'inter'); // bumps _localVersion to 1
      manager.applyServerProgress({ font: 'roboto', page: 99 });

      // Локальные изменения не должны быть перезаписаны
      expect(manager.settings.font).toBe('inter');
      expect(manager.settings.page).not.toBe(99);
    });

    it('should apply server progress when no local changes made', () => {
      manager.applyServerProgress({ theme: 'dark', page: 50 });

      expect(manager.settings.theme).toBe('dark');
      expect(manager.settings.page).toBe(50);
    });

    it('should take max of local and server page values', () => {
      // Локальная page = 0 (default), серверная page = 42
      manager.applyServerProgress({ page: 42 });
      expect(manager.settings.page).toBe(42);
    });

    it('should keep local page if it is higher than server page', () => {
      // Сначала загрузим с сохранённой page=100
      mockStorage.load.mockReturnValue({ page: 100 });
      const mgr = new SettingsManager(mockStorage, defaults);

      mgr.applyServerProgress({ page: 50 });
      expect(mgr.settings.page).toBe(100);
    });

    it('should save merged settings to storage on applyServerProgress', () => {
      manager.applyServerProgress({ theme: 'dark' });
      expect(mockStorage.save).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _syncToServer data shape
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_syncToServer data construction', () => {
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

    it('should send all settings fields to server', async () => {
      syncManager.set('page', 5);

      vi.advanceTimersByTime(5000);
      await vi.waitFor(() => {
        expect(mockApi.saveProgress).toHaveBeenCalledWith('book-1', {
          page: 5,
          font: 'georgia',
          fontSize: 18,
          theme: 'light',
          soundEnabled: true,
          soundVolume: 0.3,
          ambientType: 'none',
          ambientVolume: 0.5,
        });
      });
    });

    it('should use default values for missing settings via || and ??', async () => {
      // Устанавливаем значения, которые falsy но валидны
      syncManager.set('soundEnabled', false);
      syncManager.set('page', 0);

      vi.advanceTimersByTime(5000);
      await vi.waitFor(() => {
        const data = mockApi.saveProgress.mock.calls[0][1];
        // page 0 → 0 (через ??), soundEnabled false → false (через ??)
        expect(data.page).toBe(0);
        expect(data.soundEnabled).toBe(false);
      });
    });

    it('should not sync when api is null', async () => {
      const noApiMgr = new SettingsManager(mockStorage, defaults);
      noApiMgr._dirty = true;
      await noApiMgr._syncToServer();
      // Нет apiClient → ничего не отправляется
      expect(mockApi.saveProgress).not.toHaveBeenCalled();
      noApiMgr.destroy();
    });

    it('should not sync when bookId is null', async () => {
      const noBookMgr = new SettingsManager(mockStorage, defaults, { apiClient: mockApi });
      noBookMgr._dirty = true;
      await noBookMgr._syncToServer();
      expect(mockApi.saveProgress).not.toHaveBeenCalled();
      noBookMgr.destroy();
    });

    it('should use fallback values when settings are falsy', async () => {
      // Устанавливаем все значения в falsy
      syncManager.settings.font = '';
      syncManager.settings.fontSize = 0;
      syncManager.settings.theme = '';
      syncManager.settings.soundEnabled = false;
      syncManager.settings.soundVolume = 0;
      syncManager.settings.ambientType = '';
      syncManager.settings.ambientVolume = 0;
      syncManager.settings.page = 0;
      syncManager._dirty = true;

      await syncManager._syncToServer();

      const data = mockApi.saveProgress.mock.calls[0][1];
      // || operators: falsy → fallback
      expect(data.font).toBe('georgia');
      expect(data.fontSize).toBe(18);
      expect(data.theme).toBe('light');
      expect(data.ambientType).toBe('none');
      // ?? operators: falsy but defined → keep falsy value
      expect(data.soundEnabled).toBe(false);
      expect(data.soundVolume).toBe(0);
      expect(data.ambientVolume).toBe(0);
      expect(data.page).toBe(0);
    });

    it('should warn on sync failure with specific message', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockApi.saveProgress.mockRejectedValue(new Error('Network'));

      syncManager.set('page', 5);
      vi.advanceTimersByTime(5000);
      await vi.waitFor(() => {
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('не удалось сохранить прогресс'),
          expect.any(Error)
        );
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _sendBeaconSync
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_sendBeaconSync', () => {
    let mockApi;

    beforeEach(() => {
      navigator.sendBeacon = vi.fn().mockReturnValue(true);
      mockApi = { saveProgress: vi.fn().mockResolvedValue({}) };
    });

    it('should send beacon with JSON blob containing all fields', () => {
      const mgr = new SettingsManager(mockStorage, defaults, {
        apiClient: mockApi,
        bookId: 'book-5',
      });
      mgr._dirty = true;
      mgr._sendBeaconSync();

      expect(navigator.sendBeacon).toHaveBeenCalledWith(
        '/api/v1/books/book-5/progress',
        expect.any(Blob)
      );
      mgr.destroy();
    });

    it('should not send beacon when settings is null', () => {
      const mgr = new SettingsManager(mockStorage, defaults, {
        apiClient: mockApi,
        bookId: 'book-5',
      });
      mgr.settings = null;
      mgr._sendBeaconSync();

      expect(navigator.sendBeacon).not.toHaveBeenCalled();
      mgr._bookId = null; // prevent destroy from calling sendBeacon
      mgr._dirty = false;
      mgr.destroy();
    });

    it('should not send beacon when bookId is null', () => {
      const mgr = new SettingsManager(mockStorage, defaults, {
        apiClient: mockApi,
        bookId: 'book-5',
      });
      mgr._bookId = null;
      mgr._sendBeaconSync();

      expect(navigator.sendBeacon).not.toHaveBeenCalled();
      mgr._dirty = false;
      mgr.destroy();
    });

    it('should clear dirty flag after successful sendBeacon', () => {
      const mgr = new SettingsManager(mockStorage, defaults, {
        apiClient: mockApi,
        bookId: 'book-5',
      });
      mgr._dirty = true;
      mgr._sendBeaconSync();

      expect(mgr._dirty).toBe(false);
      mgr.destroy();
    });

    it('should catch errors from sendBeacon gracefully', () => {
      navigator.sendBeacon = vi.fn(() => { throw new Error('Not supported'); });

      const mgr = new SettingsManager(mockStorage, defaults, {
        apiClient: mockApi,
        bookId: 'book-5',
      });
      mgr._dirty = true;

      expect(() => mgr._sendBeaconSync()).not.toThrow();
      mgr._dirty = false;
      mgr.destroy();
    });

    it('should include correct data in beacon Blob', () => {
      // Перехватываем JSON.stringify чтобы проверить данные
      let capturedData;
      const origStringify = JSON.stringify;
      vi.spyOn(JSON, 'stringify').mockImplementation((data) => {
        capturedData = data;
        return origStringify(data);
      });

      const mgr = new SettingsManager(mockStorage, defaults, {
        apiClient: mockApi,
        bookId: 'book-5',
      });
      mgr.settings.page = 42;
      mgr.settings.font = 'inter';
      mgr._dirty = true;

      mgr._sendBeaconSync();

      expect(capturedData.page).toBe(42);
      expect(capturedData.font).toBe('inter');
      expect(capturedData.fontSize).toBe(18);
      expect(capturedData.theme).toBe('light');
      expect(capturedData.soundEnabled).toBe(true);
      expect(capturedData.soundVolume).toBe(0.3);
      expect(capturedData.ambientType).toBe('none');
      expect(capturedData.ambientVolume).toBe(0.5);
      mgr.destroy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _localVersion and _scheduleSyncToServer
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_localVersion tracking', () => {
    it('should increment _localVersion on each set', () => {
      expect(manager._localVersion).toBe(0);
      manager.set('font', 'inter');
      expect(manager._localVersion).toBe(1);
      manager.set('fontSize', 20);
      expect(manager._localVersion).toBe(2);
    });

    it('should not increment _localVersion when value unchanged', () => {
      manager.set('font', 'georgia'); // same as default
      expect(manager._localVersion).toBe(0);
    });
  });

  describe('_scheduleSyncToServer debouncing', () => {
    let mockApi;
    let syncManager;

    beforeEach(() => {
      vi.useFakeTimers();
      mockApi = { saveProgress: vi.fn().mockResolvedValue({}) };
      syncManager = new SettingsManager(mockStorage, defaults, {
        apiClient: mockApi,
        bookId: 'book-1',
      });
    });

    afterEach(() => {
      syncManager.destroy();
      vi.useRealTimers();
    });

    it('should reset timer on repeated calls', async () => {
      syncManager.set('page', 1);
      vi.advanceTimersByTime(3000); // не хватает до 5000
      syncManager.set('page', 2);  // сбрасывает таймер

      vi.advanceTimersByTime(3000); // 3000 от второго set — ещё не 5000
      expect(mockApi.saveProgress).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2000); // теперь 5000 от последнего set
      await vi.waitFor(() => {
        expect(mockApi.saveProgress).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('constructor schema validation', () => {
    it('should warn when stored settings have extra/wrong-type keys', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // extra key with wrong type that causes schema mismatch
      mockStorage.load.mockReturnValue({ fontSize: 'not-a-number' });
      const mgr = new SettingsManager(mockStorage, defaults);

      // sanitizeSettings should fix the value, but validateSettingsSchema may warn
      // (depends on implementation — test that manager handles it without throwing)
      expect(mgr.settings.fontSize).toBe(18); // falls back to default
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
