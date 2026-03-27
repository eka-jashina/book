/**
 * Тесты для LandingScreen
 * Экран-лендинг для неавторизованных пользователей
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../js/i18n/index.js', () => ({
  t: vi.fn((key) => key),
  setLanguage: vi.fn(() => Promise.resolve()),
  getLanguage: vi.fn(() => 'ru'),
  applyTranslations: vi.fn(),
}));

vi.mock('../../../js/utils/StorageManager.js', () => ({
  StorageManager: class {
    constructor() { this.setRaw = vi.fn(); this.getRaw = vi.fn(() => 'ru'); }
  },
}));

import { LandingScreen } from '../../../js/core/LandingScreen.js';
import { applyTranslations, setLanguage } from '../../../js/i18n/index.js';

describe('LandingScreen', () => {
  let screen;
  let container;
  let onAuth;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    container = document.createElement('div');
    container.id = 'landing-screen';
    container.hidden = true;
    container.innerHTML = `
      <button class="landing-tab landing-tab--active" data-tab="books">Books</button>
      <button class="landing-tab" data-tab="albums">Albums</button>
      <div class="landing-tab-panel landing-tab-panel--active" data-panel="books"></div>
      <div class="landing-tab-panel" data-panel="albums"></div>
      <button class="landing-cta">Sign Up</button>
      <select id="landing-lang-select">
        <option value="ru">Русский</option>
        <option value="en">English</option>
      </select>
      <div id="landing-showcase" hidden>
        <div id="landing-showcase-grid"></div>
      </div>
    `;
    document.body.innerHTML = '';
    document.body.appendChild(container);

    // Mock fetch for showcase
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false,
    }));

    onAuth = vi.fn();
    screen = new LandingScreen({ container, onAuth });
  });

  afterEach(() => {
    screen.destroy();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should store container and callback', () => {
      expect(screen.container).toBe(container);
      expect(screen._onAuth).toBe(onAuth);
    });

    it('should initialize with default active tab', () => {
      expect(screen._activeTab).toBe('books');
    });
  });

  describe('show', () => {
    it('should unhide the container', async () => {
      await screen.show();
      expect(container.hidden).toBe(false);
    });

    it('should set body dataset.screen to landing', async () => {
      await screen.show();
      expect(document.body.dataset.screen).toBe('landing');
    });

    it('should cache tabs and panels', async () => {
      await screen.show();
      expect(screen._tabs.length).toBe(2);
      expect(screen._panels.length).toBe(2);
    });

    it('should apply translations', async () => {
      await screen.show();
      expect(applyTranslations).toHaveBeenCalledWith(container);
    });

    it('should set language selector value', async () => {
      await screen.show();
      const select = container.querySelector('#landing-lang-select');
      expect(select.value).toBe('ru');
    });
  });

  describe('hide', () => {
    it('should hide the container', async () => {
      await screen.show();
      screen.hide();
      expect(container.hidden).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should stop auto-slide', async () => {
      await screen.show();
      screen.destroy();
      expect(screen._autoSlideTimer).toBeNull();
    });

    it('should clear language select reference', async () => {
      await screen.show();
      screen.destroy();
      expect(screen._langSelect).toBeNull();
    });
  });

  describe('CTA click', () => {
    it('should call onAuth when CTA button is clicked', async () => {
      await screen.show();

      const cta = container.querySelector('.landing-cta');
      cta.click();

      expect(onAuth).toHaveBeenCalledOnce();
    });
  });

  describe('tab switching', () => {
    it('should switch active tab on tab click', async () => {
      await screen.show();

      const albumsTab = container.querySelector('[data-tab="albums"]');
      albumsTab.click();

      expect(screen._activeTab).toBe('albums');
      expect(albumsTab.classList.contains('landing-tab--active')).toBe(true);
    });

    it('should auto-slide tabs', async () => {
      await screen.show();
      expect(screen._activeTab).toBe('books');

      vi.advanceTimersByTime(6000);
      expect(screen._activeTab).toBe('albums');

      vi.advanceTimersByTime(6000);
      expect(screen._activeTab).toBe('books');
    });

    it('should not switch if same tab clicked', async () => {
      await screen.show();
      const booksTab = container.querySelector('[data-tab="books"]');
      booksTab.click();
      // should stay books
      expect(screen._activeTab).toBe('books');
    });
  });

  describe('language change', () => {
    it('should call setLanguage on language select change', async () => {
      await screen.show();
      const select = container.querySelector('#landing-lang-select');
      select.value = 'en';
      select.dispatchEvent(new Event('change'));

      // _handleLanguageChange — async: await setLanguage + applyTranslations
      await Promise.resolve();
      await Promise.resolve();

      expect(setLanguage).toHaveBeenCalledWith('en');
    });
  });

  describe('showcase loading', () => {
    it('should call fetch for discover endpoint', async () => {
      await screen.show();
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/public/discover?limit=6');
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network')));
      await expect(screen.show()).resolves.toBeUndefined();
    });
  });
});
