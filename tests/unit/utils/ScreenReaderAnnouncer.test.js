import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScreenReaderAnnouncer, getAnnouncer, announce, resetAnnouncer } from '../../../js/utils/ScreenReaderAnnouncer.js';

describe('ScreenReaderAnnouncer', () => {
  let announcer;

  beforeEach(() => {
    // Сбрасываем singleton перед каждым тестом
    resetAnnouncer();
    // Очищаем DOM
    document.body.innerHTML = '';
    announcer = new ScreenReaderAnnouncer({ containerId: 'test-announcer' });
  });

  afterEach(() => {
    announcer?.destroy();
  });

  describe('initialization', () => {
    it('should create container element', () => {
      const container = document.getElementById('test-announcer');
      expect(container).not.toBeNull();
    });

    it('should set correct ARIA attributes', () => {
      const container = document.getElementById('test-announcer');
      expect(container.getAttribute('aria-live')).toBe('polite');
      expect(container.getAttribute('aria-atomic')).toBe('true');
      expect(container.getAttribute('role')).toBe('status');
    });

    it('should add sr-only class', () => {
      const container = document.getElementById('test-announcer');
      expect(container.classList.contains('sr-only')).toBe(true);
    });

    it('should reuse existing container', () => {
      const existing = document.createElement('div');
      existing.id = 'reuse-test';
      document.body.appendChild(existing);

      const announcer2 = new ScreenReaderAnnouncer({ containerId: 'reuse-test' });
      const containers = document.querySelectorAll('#reuse-test');
      expect(containers.length).toBe(1);

      announcer2.destroy();
    });
  });

  describe('announce', () => {
    it('should set message text', async () => {
      announcer.announce('Test message');

      // Wait for setTimeout
      await new Promise(resolve => setTimeout(resolve, 60));

      const container = document.getElementById('test-announcer');
      expect(container.textContent).toBe('Test message');
    });

    it('should clear message after delay', async () => {
      const fastAnnouncer = new ScreenReaderAnnouncer({
        containerId: 'fast-announcer',
        clearDelay: 100,
      });

      fastAnnouncer.announce('Quick message');

      await new Promise(resolve => setTimeout(resolve, 60));
      expect(document.getElementById('fast-announcer').textContent).toBe('Quick message');

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(document.getElementById('fast-announcer').textContent).toBe('');

      fastAnnouncer.destroy();
    });

    it('should not clear when clear option is false', async () => {
      announcer.announce('Persistent message', { clear: false });

      await new Promise(resolve => setTimeout(resolve, 60));
      expect(document.getElementById('test-announcer').textContent).toBe('Persistent message');

      // Still there after default clear delay
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(document.getElementById('test-announcer').textContent).toBe('Persistent message');
    });

    it('should set assertive priority', async () => {
      announcer.announce('Urgent!', { priority: 'assertive' });

      const container = document.getElementById('test-announcer');
      expect(container.getAttribute('aria-live')).toBe('assertive');
    });

    it('should handle empty message', () => {
      announcer.announce('');
      announcer.announce(null);
      announcer.announce(undefined);
      // Should not throw
    });
  });

  describe('specialized announce methods', () => {
    it('announcePage should format page message', async () => {
      announcer.announcePage(5, 100);

      await new Promise(resolve => setTimeout(resolve, 60));

      const container = document.getElementById('test-announcer');
      expect(container.textContent).toBe('Страница 5 из 100');
    });

    it('announceChapter should use assertive priority', async () => {
      announcer.announceChapter('Неожиданная вечеринка', 1);

      await new Promise(resolve => setTimeout(resolve, 60));

      const container = document.getElementById('test-announcer');
      expect(container.textContent).toBe('Глава 1: Неожиданная вечеринка');
      expect(container.getAttribute('aria-live')).toBe('assertive');
    });

    it('announceLoading should not auto-clear', async () => {
      announcer.announceLoading('контента');

      await new Promise(resolve => setTimeout(resolve, 60));

      const container = document.getElementById('test-announcer');
      expect(container.textContent).toBe('Загрузка контента...');
    });

    it('announceLoadingComplete should announce completion', async () => {
      announcer.announceLoadingComplete();

      await new Promise(resolve => setTimeout(resolve, 60));

      const container = document.getElementById('test-announcer');
      expect(container.textContent).toBe('Загрузка завершена');
    });

    it('announceError should use assertive priority', async () => {
      announcer.announceError('Не удалось загрузить главу');

      await new Promise(resolve => setTimeout(resolve, 60));

      const container = document.getElementById('test-announcer');
      expect(container.textContent).toBe('Ошибка: Не удалось загрузить главу');
      expect(container.getAttribute('aria-live')).toBe('assertive');
    });

    it('announceSetting should format setting message', async () => {
      announcer.announceSetting('Размер шрифта', '18px');

      await new Promise(resolve => setTimeout(resolve, 60));

      const container = document.getElementById('test-announcer');
      expect(container.textContent).toBe('Размер шрифта: 18px');
    });

    it('announceBookState should announce open/close', async () => {
      announcer.announceBookState(true);
      await new Promise(resolve => setTimeout(resolve, 60));
      expect(document.getElementById('test-announcer').textContent).toBe('Книга открыта');

      announcer.announceBookState(false);
      await new Promise(resolve => setTimeout(resolve, 60));
      expect(document.getElementById('test-announcer').textContent).toBe('Книга закрыта');
    });
  });

  describe('clear', () => {
    it('should clear current message', async () => {
      announcer.announce('Message to clear', { clear: false });
      await new Promise(resolve => setTimeout(resolve, 60));

      announcer.clear();

      const container = document.getElementById('test-announcer');
      expect(container.textContent).toBe('');
    });

    it('should cancel pending clear timer', async () => {
      const fastAnnouncer = new ScreenReaderAnnouncer({
        containerId: 'timer-test',
        clearDelay: 1000,
      });

      fastAnnouncer.announce('Message');
      fastAnnouncer.clear();

      // Timer should be cancelled, not throw
      await new Promise(resolve => setTimeout(resolve, 50));

      fastAnnouncer.destroy();
    });
  });

  describe('destroy', () => {
    it('should remove container from DOM', () => {
      announcer.destroy();

      const container = document.getElementById('test-announcer');
      expect(container).toBeNull();
    });

    it('should handle multiple destroy calls', () => {
      announcer.destroy();
      announcer.destroy();
      // Should not throw
    });
  });

  describe('singleton helpers', () => {
    it('getAnnouncer should return singleton', () => {
      const a1 = getAnnouncer();
      const a2 = getAnnouncer();
      expect(a1).toBe(a2);
    });

    it('announce helper should work', async () => {
      announce('Helper test');
      await new Promise(resolve => setTimeout(resolve, 60));

      // Should have created sr-announcer
      const container = document.getElementById('sr-announcer');
      expect(container).not.toBeNull();
      expect(container.textContent).toBe('Helper test');
    });
  });
});
