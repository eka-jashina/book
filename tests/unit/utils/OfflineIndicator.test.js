/**
 * UNIT TEST: OfflineIndicator
 * Тестирование индикатора офлайн-режима
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OfflineIndicator } from '../../../js/utils/OfflineIndicator.js';

describe('OfflineIndicator', () => {
  let indicator;

  /**
   * Добавить статическую разметку индикатора в DOM
   * (в production она определена в index.html)
   */
  function insertStaticMarkup() {
    if (!document.getElementById('offline-indicator')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="offline-indicator" id="offline-indicator" role="status" aria-live="polite" hidden>
          <span class="offline-indicator__icon" aria-hidden="true">📖</span>
          <span class="offline-indicator__text">Режим офлайн</span>
        </div>
      `);
    }
  }

  beforeEach(() => {
    // По умолчанию — онлайн
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
    insertStaticMarkup();
  });

  afterEach(() => {
    indicator?.destroy();
    // Вернуть hidden-состояние статической разметки
    const el = document.getElementById('offline-indicator');
    if (el) el.hidden = true;
  });

  describe('constructor', () => {
    it('should initialize without showing indicator when online', () => {
      indicator = new OfflineIndicator();
      expect(indicator.isVisible).toBe(false);
    });

    it('should show indicator immediately when offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      indicator = new OfflineIndicator();
      expect(indicator.isVisible).toBe(true);
    });

    it('should use static HTML from DOM', () => {
      indicator = new OfflineIndicator();

      indicator.show();
      const text = document.querySelector('.offline-indicator__text');
      expect(text.textContent).toBe('Режим офлайн');
    });
  });

  describe('show', () => {
    beforeEach(() => {
      indicator = new OfflineIndicator();
    });

    it('should create indicator element in DOM', () => {
      indicator.show();

      const el = document.querySelector('.offline-indicator');
      expect(el).not.toBeNull();
    });

    it('should set role=status for accessibility', () => {
      indicator.show();

      const el = document.querySelector('.offline-indicator');
      expect(el.getAttribute('role')).toBe('status');
    });

    it('should set aria-live=polite', () => {
      indicator.show();

      const el = document.querySelector('.offline-indicator');
      expect(el.getAttribute('aria-live')).toBe('polite');
    });

    it('should contain icon and text', () => {
      indicator.show();

      expect(document.querySelector('.offline-indicator__icon')).not.toBeNull();
      expect(document.querySelector('.offline-indicator__text')).not.toBeNull();
    });

    it('should show default message', () => {
      indicator.show();

      const text = document.querySelector('.offline-indicator__text');
      expect(text.textContent).toBe('Режим офлайн');
    });

    it('should mark icon as aria-hidden', () => {
      indicator.show();

      const icon = document.querySelector('.offline-indicator__icon');
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    });

    it('should not create duplicate indicators (second show is no-op)', () => {
      indicator.show();
      indicator.show();

      expect(document.querySelectorAll('.offline-indicator').length).toBe(1);
    });
  });

  describe('hide', () => {
    beforeEach(() => {
      indicator = new OfflineIndicator();
    });

    it('should hide indicator in DOM', () => {
      indicator.show();
      indicator.hide();

      const el = document.getElementById('offline-indicator');
      expect(el.hidden).toBe(true);
    });

    it('should set isVisible to false', () => {
      indicator.show();
      expect(indicator.isVisible).toBe(true);

      indicator.hide();
      expect(indicator.isVisible).toBe(false);
    });

    it('should be safe to call when not visible', () => {
      expect(() => indicator.hide()).not.toThrow();
    });
  });

  describe('isOnline', () => {
    it('should return true when navigator.onLine is true', () => {
      indicator = new OfflineIndicator();
      expect(indicator.isOnline).toBe(true);
    });

    it('should return false when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      indicator = new OfflineIndicator();
      expect(indicator.isOnline).toBe(false);
    });
  });

  describe('isVisible', () => {
    it('should return false initially when online', () => {
      indicator = new OfflineIndicator();
      expect(indicator.isVisible).toBe(false);
    });

    it('should return true after show()', () => {
      indicator = new OfflineIndicator();
      indicator.show();
      expect(indicator.isVisible).toBe(true);
    });
  });

  describe('online/offline events', () => {
    it('should show indicator on offline event', () => {
      indicator = new OfflineIndicator();

      window.dispatchEvent(new Event('offline'));
      expect(indicator.isVisible).toBe(true);
    });

    it('should hide indicator on online event', () => {
      indicator = new OfflineIndicator();
      indicator.show();

      window.dispatchEvent(new Event('online'));
      expect(indicator.isVisible).toBe(false);
    });

    it('should handle offline then online cycle', () => {
      indicator = new OfflineIndicator();

      window.dispatchEvent(new Event('offline'));
      expect(indicator.isVisible).toBe(true);

      window.dispatchEvent(new Event('online'));
      expect(indicator.isVisible).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should hide indicator in DOM', () => {
      indicator = new OfflineIndicator();
      indicator.show();

      indicator.destroy();
      const el = document.getElementById('offline-indicator');
      expect(el.hidden).toBe(true);
    });

    it('should stop listening to online/offline events', () => {
      indicator = new OfflineIndicator();
      indicator.destroy();

      // After destroy, offline event should not show indicator
      window.dispatchEvent(new Event('offline'));
      expect(indicator.isVisible).toBe(false);
    });

    it('should be safe to call multiple times', () => {
      indicator = new OfflineIndicator();
      indicator.destroy();
      expect(() => indicator.destroy()).not.toThrow();
    });
  });
});
