/**
 * TESTS: CoreServices
 * Тесты для группы базовых инфраструктурных сервисов
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Мокаем все импортируемые зависимости (используем function, не arrow, чтобы были constructible)
const { MockDOMManager, MockEventListenerManager, MockTimerManager, MockStorageManager } = vi.hoisted(() => {
  const MockDOMManager = vi.fn(function () {
    this.get = vi.fn();
    this.getMultiple = vi.fn();
    this.clearPages = vi.fn();
    this.elements = {};
  });
  const MockEventListenerManager = vi.fn(function () {
    this.add = vi.fn();
    this.remove = vi.fn();
    this.clear = vi.fn();
    this.count = 0;
  });
  const MockTimerManager = vi.fn(function () {
    this.setTimeout = vi.fn();
    this.clearTimeout = vi.fn();
    this.requestAnimationFrame = vi.fn();
    this.cancelAnimationFrame = vi.fn();
    this.clear = vi.fn();
  });
  const MockStorageManager = vi.fn(function () {
    this.load = vi.fn(() => ({}));
    this.save = vi.fn();
    this.clear = vi.fn();
  });
  return { MockDOMManager, MockEventListenerManager, MockTimerManager, MockStorageManager };
});

vi.mock('@core/DOMManager.js', () => ({ DOMManager: MockDOMManager }));
vi.mock('@utils/index.js', () => ({
  EventListenerManager: MockEventListenerManager,
  TimerManager: MockTimerManager,
  StorageManager: MockStorageManager,
}));
vi.mock('@/config.js', () => {
  const CONFIG = Object.freeze({ STORAGE_KEY: 'reader-settings' });
  return { CONFIG, getConfig: () => CONFIG };
});

import { CoreServices } from '@core/services/CoreServices.js';

describe('CoreServices', () => {
  let services;

  beforeEach(() => {
    vi.clearAllMocks();
    services = new CoreServices();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should create DOMManager instance', () => {
      expect(MockDOMManager).toHaveBeenCalledOnce();
      expect(services.dom).toBeDefined();
    });

    it('should create EventListenerManager instance', () => {
      expect(MockEventListenerManager).toHaveBeenCalledOnce();
      expect(services.eventManager).toBeDefined();
    });

    it('should create TimerManager instance', () => {
      expect(MockTimerManager).toHaveBeenCalledOnce();
      expect(services.timerManager).toBeDefined();
    });

    it('should create StorageManager with CONFIG.STORAGE_KEY', () => {
      expect(MockStorageManager).toHaveBeenCalledWith('reader-settings');
      expect(services.storage).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DESTROY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('destroy()', () => {
    it('should clear eventManager', () => {
      const clearSpy = services.eventManager.clear;
      services.destroy();
      expect(clearSpy).toHaveBeenCalledOnce();
    });

    it('should clear timerManager', () => {
      const clearSpy = services.timerManager.clear;
      services.destroy();
      expect(clearSpy).toHaveBeenCalledOnce();
    });

    it('should clear DOM pages', () => {
      const clearPagesSpy = services.dom.clearPages;
      services.destroy();
      expect(clearPagesSpy).toHaveBeenCalledOnce();
    });

    it('should nullify all references', () => {
      services.destroy();
      expect(services.dom).toBeNull();
      expect(services.eventManager).toBeNull();
      expect(services.timerManager).toBeNull();
      expect(services.storage).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // QUOTA EXCEEDED
  // ═══════════════════════════════════════════════════════════════════════════

  describe('onQuotaExceeded', () => {
    it('should set onQuotaExceeded callback on storage', () => {
      expect(services.storage.onQuotaExceeded).toBeDefined();
    });

    it('should show storage warning when quota exceeded', () => {
      vi.useFakeTimers();

      services.storage.onQuotaExceeded('test-key');

      const warning = document.getElementById('storage-quota-warning');
      expect(warning).toBeTruthy();
      expect(warning.getAttribute('role')).toBe('alert');
      expect(warning.textContent).toContain('переполнено');

      vi.advanceTimersByTime(8000);
      vi.useRealTimers();
    });

    it('should not duplicate warning if already shown', () => {
      const existingEl = document.createElement('div');
      existingEl.id = 'storage-quota-warning';
      document.body.appendChild(existingEl);

      services.storage.onQuotaExceeded('test-key');

      const warnings = document.querySelectorAll('#storage-quota-warning');
      expect(warnings).toHaveLength(1);
    });

    it('should auto-remove warning after 8 seconds', () => {
      vi.useFakeTimers();

      services.storage.onQuotaExceeded('test-key');
      expect(document.getElementById('storage-quota-warning')).toBeTruthy();

      vi.advanceTimersByTime(8000);
      expect(document.getElementById('storage-quota-warning')).toBeNull();

      vi.useRealTimers();
    });
  });
});
