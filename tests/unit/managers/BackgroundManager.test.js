/**
 * Тесты для BackgroundManager
 * Управление фоновыми изображениями с кроссфейдом
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BackgroundManager } from '../../../js/managers/BackgroundManager.js';
import { CONFIG } from '../../../js/config.js';

describe('BackgroundManager', () => {
  let manager;
  let mockBgElements;
  let originalImage;
  let mockImages;

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock DOM elements
    mockBgElements = [
      { style: { backgroundImage: '' }, dataset: {} },
      { style: { backgroundImage: '' }, dataset: {} },
    ];

    vi.spyOn(document, 'querySelectorAll').mockReturnValue(mockBgElements);

    // Mock Image constructor
    mockImages = [];
    originalImage = global.Image;
    global.Image = function MockImage() {
      const img = {
        src: '',
        onload: null,
        onerror: null,
      };
      mockImages.push(img);
      return img;
    };

    // Mock document.createElement for link preload
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'link') {
        return {
          rel: '',
          as: '',
          href: '',
          fetchPriority: '',
          onload: null,
          onerror: null,
        };
      }
      return document.createElement.call(document, tag);
    });

    // Mock document.head
    vi.spyOn(document.head, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.head, 'removeChild').mockImplementation(() => {});

    manager = new BackgroundManager();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.Image = originalImage;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should query for background elements', () => {
      expect(document.querySelectorAll).toHaveBeenCalledWith('.chapter-bg .bg');
    });

    it('should initialize with unset currentBg', () => {
      expect(typeof manager.currentBg).toBe('symbol');
    });

    it('should initialize activeIndex to 0', () => {
      expect(manager.activeIndex).toBe(0);
    });

    it('should initialize empty preloadedUrls set', () => {
      expect(manager.preloadedUrls.size).toBe(0);
    });

    it('should initialize empty preloadQueue', () => {
      expect(manager.preloadQueue.length).toBe(0);
    });
  });

  describe('setBackground', () => {
    it('should not change if same URL', () => {
      manager.currentBg = 'test.jpg';
      manager.setBackground('test.jpg');
      expect(mockBgElements[0].style.backgroundImage).toBe('');
    });

    it('should set background on next element', () => {
      manager.setBackground('new-bg.jpg');
      expect(mockBgElements[1].style.backgroundImage).toBe('url(new-bg.jpg)');
    });

    it('should toggle activeIndex', () => {
      expect(manager.activeIndex).toBe(0);
      manager.setBackground('bg1.jpg');
      expect(manager.activeIndex).toBe(1);
      manager.setBackground('bg2.jpg');
      expect(manager.activeIndex).toBe(0);
    });

    it('should set data-active on new element', () => {
      manager.setBackground('bg.jpg');
      expect(mockBgElements[1].dataset.active).toBe('true');
      expect(mockBgElements[0].dataset.active).toBe('false');
    });

    it('should set data-loading to true for non-preloaded images', () => {
      manager.setBackground('bg.jpg');
      expect(mockBgElements[1].dataset.loading).toBe('true');
    });

    it('should set data-loading to false for preloaded images', () => {
      manager.preloadedUrls.add('preloaded.jpg');
      manager.setBackground('preloaded.jpg');
      expect(mockBgElements[1].dataset.loading).toBe('false');
    });

    it('should update currentBg', () => {
      manager.setBackground('new.jpg');
      expect(manager.currentBg).toBe('new.jpg');
    });

    it('should load and reveal non-preloaded images', () => {
      manager.setBackground('bg.jpg');
      expect(mockImages.length).toBe(1);
      expect(mockImages[0].src).toBe('bg.jpg');
    });

    it('should not create Image for preloaded images', () => {
      manager.preloadedUrls.add('cached.jpg');
      manager.setBackground('cached.jpg');
      expect(mockImages.length).toBe(0);
    });
  });

  describe('_loadAndReveal', () => {
    it('should add URL to preloadedUrls on load', () => {
      const element = { style: { backgroundImage: 'url(test.jpg)' }, dataset: {} };
      manager._loadAndReveal('test.jpg', element);

      mockImages[0].onload();

      expect(manager.preloadedUrls.has('test.jpg')).toBe(true);
    });

    it('should set data-loading to false on load', () => {
      const element = { style: { backgroundImage: 'url(test.jpg)' }, dataset: { loading: 'true' } };
      manager._loadAndReveal('test.jpg', element);

      mockImages[0].onload();

      expect(element.dataset.loading).toBe('false');
    });

    it('should not update element if background changed', () => {
      const element = { style: { backgroundImage: 'url(other.jpg)' }, dataset: { loading: 'true' } };
      manager._loadAndReveal('test.jpg', element);

      mockImages[0].onload();

      expect(element.dataset.loading).toBe('true');
    });

    it('should handle error by removing blur', () => {
      const element = { style: { backgroundImage: 'url(test.jpg)' }, dataset: { loading: 'true' } };
      manager._loadAndReveal('test.jpg', element);

      mockImages[0].onerror();

      expect(element.dataset.loading).toBe('false');
    });

    it('should not update on error if background changed', () => {
      const element = { style: { backgroundImage: 'url(other.jpg)' }, dataset: { loading: 'true' } };
      manager._loadAndReveal('test.jpg', element);

      mockImages[0].onerror();

      expect(element.dataset.loading).toBe('true');
    });

    it('should remove blur on timeout', () => {
      const element = { style: { backgroundImage: 'url(test.jpg)' }, dataset: { loading: 'true' } };
      manager._loadAndReveal('test.jpg', element);

      vi.advanceTimersByTime(CONFIG.NETWORK.FETCH_TIMEOUT);

      expect(element.dataset.loading).toBe('false');
    });

    it('should cancel image loading on timeout', () => {
      const element = { style: { backgroundImage: 'url(test.jpg)' }, dataset: { loading: 'true' } };
      manager._loadAndReveal('test.jpg', element);

      vi.advanceTimersByTime(CONFIG.NETWORK.FETCH_TIMEOUT);

      expect(mockImages[0].src).toBe('');
    });

    it('should not timeout if image loads before timeout', () => {
      const element = { style: { backgroundImage: 'url(test.jpg)' }, dataset: { loading: 'true' } };
      manager._loadAndReveal('test.jpg', element);

      mockImages[0].onload();
      expect(element.dataset.loading).toBe('false');
      expect(manager.preloadedUrls.has('test.jpg')).toBe(true);

      // Timeout fires but has no effect (already resolved)
      vi.advanceTimersByTime(CONFIG.NETWORK.FETCH_TIMEOUT);
      expect(manager.preloadedUrls.has('test.jpg')).toBe(true);
    });
  });

  describe('preload', () => {
    let mockLink;

    beforeEach(() => {
      mockLink = {
        rel: '',
        as: '',
        href: '',
        fetchPriority: '',
        onload: null,
        onerror: null,
      };
      document.createElement.mockReturnValue(mockLink);
    });

    it('should resolve immediately for empty URL', async () => {
      await expect(manager.preload('')).resolves.toBeUndefined();
    });

    it('should resolve immediately for already preloaded URL', async () => {
      manager.preloadedUrls.add('cached.jpg');
      await expect(manager.preload('cached.jpg')).resolves.toBeUndefined();
    });

    it('should not add duplicate to queue', async () => {
      manager.preloadQueue.push({ url: 'loading.jpg', promise: Promise.resolve() });
      await manager.preload('loading.jpg');
      expect(manager.preloadQueue.length).toBe(1);
    });

    it('should create preload link element', async () => {
      const promise = manager.preload('new.jpg');
      expect(document.createElement).toHaveBeenCalledWith('link');
      expect(mockLink.rel).toBe('preload');
      expect(mockLink.as).toBe('image');
      expect(mockLink.href).toBe('new.jpg');

      // Resolve the promise
      mockLink.onload();
      await promise;
    });

    it('should set fetchPriority when highPriority is true', async () => {
      const promise = manager.preload('high.jpg', true);
      expect(mockLink.fetchPriority).toBe('high');
      mockLink.onload();
      await promise;
    });

    it('should append link to document head', async () => {
      const promise = manager.preload('test.jpg');
      expect(document.head.appendChild).toHaveBeenCalled();
      mockLink.onload();
      await promise;
    });

    it('should add URL to preloadedUrls on success', async () => {
      const promise = manager.preload('success.jpg');
      mockLink.onload();
      await promise;
      expect(manager.preloadedUrls.has('success.jpg')).toBe(true);
    });

    it('should remove link from head on success', async () => {
      const promise = manager.preload('test.jpg');
      mockLink.onload();
      await promise;
      expect(document.head.removeChild).toHaveBeenCalled();
    });

    it('should remove from queue on success', async () => {
      const promise = manager.preload('test.jpg');
      expect(manager.preloadQueue.length).toBe(1);
      mockLink.onload();
      await promise;
      expect(manager.preloadQueue.length).toBe(0);
    });

    it('should handle error gracefully', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const promise = manager.preload('error.jpg');
      mockLink.onerror();
      // Should not throw
      await expect(promise).resolves.toBeUndefined();
    });

    it('should remove from queue on error', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const promise = manager.preload('error.jpg');
      expect(manager.preloadQueue.length).toBe(1);
      mockLink.onerror();
      await promise;
      expect(manager.preloadQueue.length).toBe(0);
    });

    it('should remove link from head on error', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const promise = manager.preload('error.jpg');
      mockLink.onerror();
      await promise;
      expect(document.head.removeChild).toHaveBeenCalled();
    });

    it('should reject on timeout', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const promise = manager.preload('slow.jpg');
      expect(manager.preloadQueue.length).toBe(1);

      vi.advanceTimersByTime(CONFIG.NETWORK.FETCH_TIMEOUT);

      // Ошибки подавляются в catch
      await expect(promise).resolves.toBeUndefined();
      expect(manager.preloadQueue.length).toBe(0);
      expect(document.head.removeChild).toHaveBeenCalled();
    });

    it('should not timeout if loaded before timeout', async () => {
      const promise = manager.preload('fast.jpg');
      mockLink.onload();
      await promise;

      expect(manager.preloadedUrls.has('fast.jpg')).toBe(true);

      // Timeout fires but settled flag prevents double action
      vi.advanceTimersByTime(CONFIG.NETWORK.FETCH_TIMEOUT);
      expect(manager.preloadedUrls.has('fast.jpg')).toBe(true);
    });
  });

  describe('_removeFromQueue', () => {
    it('should remove item from queue', () => {
      manager.preloadQueue = [
        { url: 'a.jpg', promise: null },
        { url: 'b.jpg', promise: null },
        { url: 'c.jpg', promise: null },
      ];

      manager._removeFromQueue('b.jpg');

      expect(manager.preloadQueue.length).toBe(2);
      expect(manager.preloadQueue.find(i => i.url === 'b.jpg')).toBeUndefined();
    });

    it('should not fail if URL not in queue', () => {
      manager.preloadQueue = [{ url: 'a.jpg', promise: null }];
      expect(() => manager._removeFromQueue('notfound.jpg')).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should null backgrounds reference', () => {
      manager.destroy();
      expect(manager.backgrounds).toBeNull();
    });

    it('should null currentBg', () => {
      manager.currentBg = 'test.jpg';
      manager.destroy();
      expect(manager.currentBg).toBeNull();
    });

    it('should clear preloadedUrls', () => {
      manager.preloadedUrls.add('test.jpg');
      manager.destroy();
      expect(manager.preloadedUrls.size).toBe(0);
    });

    it('should clear preloadQueue', () => {
      manager.preloadQueue.push({ url: 'test.jpg', promise: null });
      manager.destroy();
      expect(manager.preloadQueue.length).toBe(0);
    });
  });
});
