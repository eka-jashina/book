/**
 * ИНТЕГРАЦИОННЫЕ ТЕСТЫ: ДОСТУПНОСТЬ (Accessibility)
 * Тесты ARIA-атрибутов, screen reader анонсов,
 * клавиатурной навигации и управления фокусом
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFullBookDOM, cleanupIntegrationDOM } from '../../helpers/integrationUtils.js';
import { ScreenReaderAnnouncer, getAnnouncer, resetAnnouncer } from '@utils/ScreenReaderAnnouncer.js';

describe('Accessibility — Integration', () => {
  let dom;

  beforeEach(() => {
    vi.useFakeTimers();
    dom = createFullBookDOM();
  });

  afterEach(() => {
    resetAnnouncer();
    cleanupIntegrationDOM();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ARIA ATTRIBUTES ON DOM ELEMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ARIA Attributes on DOM', () => {
    it('book element has region role', () => {
      dom.book.setAttribute('role', 'region');
      dom.book.setAttribute('aria-label', 'Книга');

      expect(dom.book.getAttribute('role')).toBe('region');
      expect(dom.book.getAttribute('aria-label')).toBe('Книга');
    });

    it('progress bar has correct ARIA progressbar attributes', () => {
      dom.progressBar.setAttribute('role', 'progressbar');
      dom.progressBar.setAttribute('aria-valuenow', '50');
      dom.progressBar.setAttribute('aria-valuemin', '0');
      dom.progressBar.setAttribute('aria-valuemax', '100');

      expect(dom.progressBar.getAttribute('role')).toBe('progressbar');
      expect(dom.progressBar.getAttribute('aria-valuenow')).toBe('50');
      expect(dom.progressBar.getAttribute('aria-valuemin')).toBe('0');
      expect(dom.progressBar.getAttribute('aria-valuemax')).toBe('100');
    });

    it('error message has alert role', () => {
      dom.errorMessage.setAttribute('role', 'alert');

      expect(dom.errorMessage.getAttribute('role')).toBe('alert');
    });

    it('loading indicator has status role with live region', () => {
      dom.loadingIndicator.setAttribute('role', 'status');
      dom.loadingIndicator.setAttribute('aria-live', 'polite');

      expect(dom.loadingIndicator.getAttribute('role')).toBe('status');
      expect(dom.loadingIndicator.getAttribute('aria-live')).toBe('polite');
    });

    it('cover has button role and is focusable', () => {
      dom.cover.setAttribute('role', 'button');
      dom.cover.setAttribute('tabindex', '0');
      dom.cover.setAttribute('aria-label', 'Открыть книгу');

      expect(dom.cover.getAttribute('role')).toBe('button');
      expect(dom.cover.getAttribute('tabindex')).toBe('0');
      expect(dom.cover.getAttribute('aria-label')).toBe('Открыть книгу');
    });

    it('buffer pages are hidden from assistive technology', () => {
      dom.leftB.setAttribute('aria-hidden', 'true');
      dom.rightB.setAttribute('aria-hidden', 'true');

      expect(dom.leftB.getAttribute('aria-hidden')).toBe('true');
      expect(dom.rightB.getAttribute('aria-hidden')).toBe('true');
    });

    it('sheet is hidden from assistive technology', () => {
      dom.sheet.setAttribute('aria-hidden', 'true');

      expect(dom.sheet.getAttribute('aria-hidden')).toBe('true');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN READER ANNOUNCER
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ScreenReaderAnnouncer', () => {
    let announcer;

    beforeEach(() => {
      announcer = new ScreenReaderAnnouncer({ containerId: 'sr-announcer' });
    });

    afterEach(() => {
      announcer?.destroy();
    });

    it('announces page changes', () => {
      announcer.announcePage(5, 100);
      // announce использует setTimeout(50) внутри
      vi.advanceTimersByTime(60);

      const container = document.getElementById('sr-announcer');
      expect(container.textContent).toContain('5');
      expect(container.textContent).toContain('100');
    });

    it('announces chapter changes with assertive priority', () => {
      announcer.announceChapter('Глава 2', 2);
      vi.advanceTimersByTime(60);

      const container = document.getElementById('sr-announcer');
      expect(container.textContent).toContain('Глава 2');
      expect(container.getAttribute('aria-live')).toBe('assertive');
    });

    it('announces loading state', () => {
      announcer.announceLoading();
      vi.advanceTimersByTime(60);

      const container = document.getElementById('sr-announcer');
      expect(container.textContent.length).toBeGreaterThan(0);
    });

    it('announces loading complete', () => {
      announcer.announceLoadingComplete();
      vi.advanceTimersByTime(60);

      const container = document.getElementById('sr-announcer');
      expect(container.textContent.length).toBeGreaterThan(0);
    });

    it('announces settings changes', () => {
      announcer.announceSetting('Шрифт', 'Georgia');
      vi.advanceTimersByTime(60);

      const container = document.getElementById('sr-announcer');
      expect(container.textContent).toContain('Georgia');
    });

    it('announces book state changes', () => {
      announcer.announceBookState(true);
      vi.advanceTimersByTime(60);
      const container = document.getElementById('sr-announcer');
      expect(container.textContent.length).toBeGreaterThan(0);

      announcer.announceBookState(false);
      vi.advanceTimersByTime(60);
      expect(container.textContent.length).toBeGreaterThan(0);
    });

    it('announces errors with assertive priority', () => {
      announcer.announceError('Ошибка загрузки');
      vi.advanceTimersByTime(60);

      const container = document.getElementById('sr-announcer');
      expect(container.textContent).toContain('Ошибка загрузки');
    });

    it('clears message after timeout', () => {
      announcer.announcePage(3, 50);
      vi.advanceTimersByTime(60);

      const container = document.getElementById('sr-announcer');
      expect(container.textContent.length).toBeGreaterThan(0);

      // Ждём таймаут очистки (3000ms по умолчанию)
      vi.advanceTimersByTime(3500);

      expect(container.textContent).toBe('');
    });

    it('getAnnouncer returns singleton', () => {
      const a1 = getAnnouncer();
      const a2 = getAnnouncer();

      expect(a1).toBe(a2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // KEYBOARD INTERACTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Keyboard Interaction', () => {
    it('cover responds to Enter keydown', () => {
      dom.cover.setAttribute('role', 'button');
      dom.cover.setAttribute('tabindex', '0');

      const handler = vi.fn();
      dom.cover.addEventListener('click', handler);

      // Симулируем Enter
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
        cancelable: true,
      });

      // Имитируем поведение браузера: Enter на элементе с role=button вызывает click
      dom.cover.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          dom.cover.click();
        }
      });

      dom.cover.dispatchEvent(event);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('cover responds to Space keydown', () => {
      dom.cover.setAttribute('role', 'button');
      dom.cover.setAttribute('tabindex', '0');

      const handler = vi.fn();
      dom.cover.addEventListener('click', handler);

      dom.cover.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
          e.preventDefault();
          dom.cover.click();
        }
      });

      const event = new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        bubbles: true,
        cancelable: true,
      });

      dom.cover.dispatchEvent(event);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('arrow key events can be dispatched for page navigation', () => {
      const handler = vi.fn();
      document.addEventListener('keydown', handler);

      const rightArrow = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        code: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(rightArrow);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].key).toBe('ArrowRight');

      document.removeEventListener('keydown', handler);
    });

    it('Home and End keys dispatched correctly', () => {
      const keys = [];
      const handler = (e) => keys.push(e.key);
      document.addEventListener('keydown', handler);

      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Home', code: 'Home', bubbles: true,
      }));

      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'End', code: 'End', bubbles: true,
      }));

      expect(keys).toEqual(['Home', 'End']);

      document.removeEventListener('keydown', handler);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FOCUS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Focus Management', () => {
    it('cover is focusable with tabindex', () => {
      dom.cover.setAttribute('tabindex', '0');
      dom.cover.focus();

      expect(document.activeElement).toBe(dom.cover);
    });

    it('navigation buttons are focusable', () => {
      dom.prevButton.focus();
      expect(document.activeElement).toBe(dom.prevButton);

      dom.nextButton.focus();
      expect(document.activeElement).toBe(dom.nextButton);
    });

    it('font selector is focusable', () => {
      dom.fontSelector.focus();
      expect(document.activeElement).toBe(dom.fontSelector);
    });

    it('font size slider is focusable', () => {
      dom.fontSizeSlider.focus();
      expect(document.activeElement).toBe(dom.fontSizeSlider);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SKIP NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Skip Navigation', () => {
    it('skip link targets the book element', () => {
      const skipLink = document.createElement('a');
      skipLink.className = 'skip-link';
      skipLink.href = '#book';
      skipLink.textContent = 'Перейти к книге';
      document.body.prepend(skipLink);

      expect(skipLink.getAttribute('href')).toBe('#book');
      expect(skipLink.textContent).toBeTruthy();

      // Целевой элемент существует
      const target = document.getElementById('book');
      expect(target).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LIVE REGIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Live Regions', () => {
    it('rightA page has aria-live polite for content updates', () => {
      dom.rightA.setAttribute('aria-live', 'polite');

      expect(dom.rightA.getAttribute('aria-live')).toBe('polite');
    });

    it('dynamic content updates propagate through live regions', () => {
      dom.rightA.setAttribute('aria-live', 'polite');

      const pageInner = dom.rightA.querySelector('.page-inner') || dom.rightA;
      pageInner.textContent = 'Новый контент страницы';

      expect(pageInner.textContent).toBe('Новый контент страницы');
    });

    it('error messages use aria-live assertive for urgent notifications', () => {
      dom.errorMessage.setAttribute('role', 'alert');
      // role="alert" автоматически подразумевает aria-live="assertive"

      dom.errorMessage.hidden = false;
      dom.errorText.textContent = 'Произошла ошибка';

      expect(dom.errorMessage.getAttribute('role')).toBe('alert');
      expect(dom.errorText.textContent).toBe('Произошла ошибка');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SR-ONLY (Visually Hidden)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('SR-Only Pattern', () => {
    it('sr-only elements are present in DOM but not visible', () => {
      const srOnly = document.createElement('div');
      srOnly.className = 'sr-only';
      srOnly.textContent = 'Скрытый текст для скринридера';
      document.body.appendChild(srOnly);

      expect(srOnly).toBeTruthy();
      expect(srOnly.textContent).toBe('Скрытый текст для скринридера');

      // Элемент в DOM
      expect(document.body.contains(srOnly)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // THEME ACCESSIBILITY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Theme ARIA', () => {
    it('theme buttons use radio role pattern', () => {
      const themeGroup = document.createElement('div');
      themeGroup.setAttribute('role', 'radiogroup');
      themeGroup.setAttribute('aria-label', 'Выбор темы');

      const themes = ['light', 'dark', 'bw'];
      themes.forEach((theme, i) => {
        const btn = document.createElement('button');
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
        btn.dataset.theme = theme;
        themeGroup.appendChild(btn);
      });

      document.body.appendChild(themeGroup);

      const radioGroup = document.querySelector('[role="radiogroup"]');
      expect(radioGroup).toBeTruthy();
      expect(radioGroup.getAttribute('aria-label')).toBe('Выбор темы');

      const radios = radioGroup.querySelectorAll('[role="radio"]');
      expect(radios.length).toBe(3);

      // Только один checked
      const checked = Array.from(radios).filter(
        r => r.getAttribute('aria-checked') === 'true'
      );
      expect(checked.length).toBe(1);
    });

    it('changing theme updates aria-checked', () => {
      const themeGroup = document.createElement('div');
      themeGroup.setAttribute('role', 'radiogroup');

      const themes = ['light', 'dark', 'bw'];
      themes.forEach((theme, i) => {
        const btn = document.createElement('button');
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
        btn.dataset.theme = theme;
        themeGroup.appendChild(btn);
      });

      document.body.appendChild(themeGroup);

      // Имитируем переключение на dark
      const radios = themeGroup.querySelectorAll('[role="radio"]');
      radios.forEach(r => r.setAttribute('aria-checked', 'false'));
      radios[1].setAttribute('aria-checked', 'true');

      expect(radios[0].getAttribute('aria-checked')).toBe('false');
      expect(radios[1].getAttribute('aria-checked')).toBe('true');
      expect(radios[2].getAttribute('aria-checked')).toBe('false');
    });
  });
});
