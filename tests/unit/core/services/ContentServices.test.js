/**
 * TESTS: ContentServices
 * Тесты для группы сервисов контента (загрузка + фоновые изображения)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { MockContentLoader, MockBackgroundManager } = vi.hoisted(() => {
  const MockContentLoader = vi.fn(function () {
    this.loadAll = vi.fn();
    this.loadInlineContent = vi.fn();
    this.cache = new Map();
    this.controller = null;
    this.destroy = vi.fn();
  });
  const MockBackgroundManager = vi.fn(function () {
    this.setBackground = vi.fn();
    this.preload = vi.fn();
    this.backgrounds = [];
    this.currentBg = null;
    this.destroy = vi.fn();
  });
  return { MockContentLoader, MockBackgroundManager };
});

vi.mock('@managers/index.js', () => ({
  ContentLoader: MockContentLoader,
  BackgroundManager: MockBackgroundManager,
}));

import { ContentServices } from '@core/services/ContentServices.js';

describe('ContentServices', () => {
  let services;

  beforeEach(() => {
    vi.clearAllMocks();
    services = new ContentServices();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should create ContentLoader instance', () => {
      expect(MockContentLoader).toHaveBeenCalledOnce();
      expect(services.contentLoader).toBeDefined();
    });

    it('should create BackgroundManager instance', () => {
      expect(MockBackgroundManager).toHaveBeenCalledOnce();
      expect(services.backgroundManager).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVICE ACCESS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('service access', () => {
    it('should expose contentLoader with loadAll method', () => {
      expect(services.contentLoader.loadAll).toBeInstanceOf(Function);
    });

    it('should expose contentLoader with cache', () => {
      expect(services.contentLoader.cache).toBeInstanceOf(Map);
    });

    it('should expose backgroundManager with setBackground method', () => {
      expect(services.backgroundManager.setBackground).toBeInstanceOf(Function);
    });

    it('should expose backgroundManager with preload method', () => {
      expect(services.backgroundManager.preload).toBeInstanceOf(Function);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DESTROY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('destroy()', () => {
    it('should destroy contentLoader', () => {
      const destroySpy = services.contentLoader.destroy;
      services.destroy();
      expect(destroySpy).toHaveBeenCalledOnce();
    });

    it('should destroy backgroundManager', () => {
      const destroySpy = services.backgroundManager.destroy;
      services.destroy();
      expect(destroySpy).toHaveBeenCalledOnce();
    });

    it('should nullify all references', () => {
      services.destroy();
      expect(services.contentLoader).toBeNull();
      expect(services.backgroundManager).toBeNull();
    });

    it('should handle already nullified services', () => {
      services.contentLoader = null;
      services.backgroundManager = null;
      expect(() => services.destroy()).not.toThrow();
    });
  });
});
