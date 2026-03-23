/**
 * INTEGRATION TEST: Landing Screen
 * Публичная витрина книг, CTA, переход гостя в авторизованного пользователя,
 * табы hero-секции, авто-слайд, переключатель языка.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupIntegrationDOM } from '../../helpers/integrationUtils.js';
import { flushPromises } from '../../helpers/testUtils.js';
import { LandingScreen } from '../../../js/core/LandingScreen.js';

describe('Landing Screen Integration', () => {
  let container;
  let onAuth;

  const createLandingDOM = () => {
    container = document.createElement('div');
    container.id = 'landing-screen';
    container.hidden = true;

    // Hero tabs
    const tabBooks = document.createElement('button');
    tabBooks.className = 'landing-tab landing-tab--active';
    tabBooks.dataset.tab = 'books';
    container.appendChild(tabBooks);

    const tabAlbums = document.createElement('button');
    tabAlbums.className = 'landing-tab';
    tabAlbums.dataset.tab = 'albums';
    container.appendChild(tabAlbums);

    // Tab panels
    const panelBooks = document.createElement('div');
    panelBooks.className = 'landing-tab-panel landing-tab-panel--active';
    panelBooks.dataset.panel = 'books';
    container.appendChild(panelBooks);

    const panelAlbums = document.createElement('div');
    panelAlbums.className = 'landing-tab-panel';
    panelAlbums.dataset.panel = 'albums';
    container.appendChild(panelAlbums);

    // CTA buttons
    const cta1 = document.createElement('button');
    cta1.className = 'landing-cta';
    cta1.textContent = 'Начать бесплатно';
    container.appendChild(cta1);

    const cta2 = document.createElement('a');
    cta2.className = 'landing-cta';
    cta2.href = '#';
    cta2.textContent = 'Попробовать';
    container.appendChild(cta2);

    // Showcase
    const showcase = document.createElement('div');
    showcase.id = 'landing-showcase';
    showcase.hidden = true;
    const grid = document.createElement('div');
    grid.id = 'landing-showcase-grid';
    showcase.appendChild(grid);
    container.appendChild(showcase);

    // Language selector
    const langSelect = document.createElement('select');
    langSelect.id = 'landing-lang-select';
    ['ru', 'en', 'es', 'fr', 'de'].forEach(code => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = code;
      langSelect.appendChild(opt);
    });
    container.appendChild(langSelect);

    // i18n elements
    const translatable = document.createElement('span');
    translatable.setAttribute('data-i18n', 'common.save');
    container.appendChild(translatable);

    // Book card template
    const tmpl = document.createElement('template');
    tmpl.id = 'tmpl-landing-book-card';
    const cardContent = document.createElement('div');
    const cover = document.createElement('div');
    cover.className = 'landing-book-cover';
    const title = document.createElement('div');
    title.className = 'landing-book-title';
    const author = document.createElement('div');
    author.className = 'landing-book-author';
    cardContent.appendChild(cover);
    cardContent.appendChild(title);
    cardContent.appendChild(author);
    tmpl.content.appendChild(cardContent);
    document.body.appendChild(tmpl);

    // Scroll animation sections
    const sections = ['landing-audience', 'landing-steps', 'landing-features'];
    sections.forEach(cls => {
      const sec = document.createElement('div');
      sec.className = cls;
      container.appendChild(sec);
    });

    document.body.appendChild(container);
    return container;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    onAuth = vi.fn();

    // IntersectionObserver needs to be a real constructor (setup.js mock is arrow fn)
    global.IntersectionObserver = vi.fn().mockImplementation(function (callback) {
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
        root: null,
        rootMargin: '',
        thresholds: [],
      };
    });

    createLandingDOM();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
    document.querySelectorAll('template').forEach(t => t.remove());
  });

  describe('Show / Hide', () => {
    it('should show landing and set body screen attribute', async () => {
      const screen = new LandingScreen({ container, onAuth });

      await screen.show();

      expect(container.hidden).toBe(false);
      expect(document.body.dataset.screen).toBe('landing');

      screen.destroy();
    });

    it('should hide landing', async () => {
      const screen = new LandingScreen({ container, onAuth });
      await screen.show();

      screen.hide();

      expect(container.hidden).toBe(true);

      screen.destroy();
    });
  });

  describe('CTA buttons', () => {
    it('should call onAuth when CTA button is clicked', async () => {
      const screen = new LandingScreen({ container, onAuth });
      await screen.show();

      const cta = container.querySelector('.landing-cta');
      cta.click();

      expect(onAuth).toHaveBeenCalledTimes(1);

      screen.destroy();
    });

    it('should call onAuth for any CTA (multiple buttons)', async () => {
      const screen = new LandingScreen({ container, onAuth });
      await screen.show();

      const ctas = container.querySelectorAll('.landing-cta');
      ctas[0].click();
      ctas[1].click();

      expect(onAuth).toHaveBeenCalledTimes(2);

      screen.destroy();
    });

    it('should not throw if onAuth is not provided', async () => {
      const screen = new LandingScreen({ container, onAuth: null });
      await screen.show();

      const cta = container.querySelector('.landing-cta');
      expect(() => cta.click()).not.toThrow();

      screen.destroy();
    });
  });

  describe('Tabs', () => {
    it('should switch tabs on click', async () => {
      const screen = new LandingScreen({ container, onAuth });
      await screen.show();

      const albumsTab = container.querySelector('[data-tab="albums"]');
      albumsTab.click();

      expect(albumsTab.classList.contains('landing-tab--active')).toBe(true);

      const booksTab = container.querySelector('[data-tab="books"]');
      expect(booksTab.classList.contains('landing-tab--active')).toBe(false);

      const albumsPanel = container.querySelector('[data-panel="albums"]');
      expect(albumsPanel.classList.contains('landing-tab-panel--active')).toBe(true);

      screen.destroy();
    });

    it('should not switch if clicking the already active tab', async () => {
      const screen = new LandingScreen({ container, onAuth });
      await screen.show();

      const booksTab = container.querySelector('[data-tab="books"]');
      booksTab.click();

      // Still active, no error
      expect(booksTab.classList.contains('landing-tab--active')).toBe(true);

      screen.destroy();
    });
  });

  describe('Auto-slide', () => {
    it('should auto-switch tabs every 6 seconds', async () => {
      const screen = new LandingScreen({ container, onAuth });
      await screen.show();

      // Initially books is active
      expect(screen._activeTab).toBe('books');

      // After 6s, should switch to albums
      vi.advanceTimersByTime(6000);
      expect(screen._activeTab).toBe('albums');

      // After another 6s, should switch back to books
      vi.advanceTimersByTime(6000);
      expect(screen._activeTab).toBe('books');

      screen.destroy();
    });

    it('should reset auto-slide on manual tab switch', async () => {
      const screen = new LandingScreen({ container, onAuth });
      await screen.show();

      // Wait 5 seconds (not enough for auto-switch)
      vi.advanceTimersByTime(5000);
      expect(screen._activeTab).toBe('books');

      // Manually switch
      const albumsTab = container.querySelector('[data-tab="albums"]');
      albumsTab.click();
      expect(screen._activeTab).toBe('albums');

      // Wait 5 seconds again (timer was reset)
      vi.advanceTimersByTime(5000);
      expect(screen._activeTab).toBe('albums'); // No auto-switch yet

      // After full 6 seconds from reset, should auto-switch
      vi.advanceTimersByTime(1000);
      expect(screen._activeTab).toBe('books');

      screen.destroy();
    });

    it('should stop auto-slide on hide', async () => {
      const screen = new LandingScreen({ container, onAuth });
      await screen.show();

      screen.hide();
      expect(screen._autoSlideTimer).toBeNull();

      screen.destroy();
    });
  });

  describe('Showcase (public books)', () => {
    // Showcase tests need real timers because fetch promises don't resolve with fake timers
    beforeEach(() => {
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.useFakeTimers();
    });

    it('should load and render public books from API', async () => {
      const books = [
        { id: 'b1', title: 'Book 1', author: 'Author 1', appearance: { light: { coverBgStart: '#333', coverBgEnd: '#111', coverText: '#fff' } } },
        { id: 'b2', title: 'Book 2', author: '', appearance: null },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: books }),
      });

      const screen = new LandingScreen({ container, onAuth });
      await screen.show();
      await flushPromises();

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/public/discover?limit=6');

      const showcase = container.querySelector('#landing-showcase');
      expect(showcase.hidden).toBe(false);

      const cards = container.querySelectorAll('.landing-book-card');
      expect(cards.length).toBe(2);

      // First card has title and author
      expect(cards[0].querySelector('.landing-book-title').textContent).toBe('Book 1');
      expect(cards[0].querySelector('.landing-book-author').textContent).toBe('Author 1');

      // Second card has no author element
      expect(cards[1].querySelector('.landing-book-author')).toBeNull();

      screen.destroy();
    });

    it('should keep showcase hidden if no books returned', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const screen = new LandingScreen({ container, onAuth });
      await screen.show();
      await flushPromises();

      const showcase = container.querySelector('#landing-showcase');
      expect(showcase.hidden).toBe(true);

      screen.destroy();
    });

    it('should handle API error gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

      const screen = new LandingScreen({ container, onAuth });
      await screen.show();
      await flushPromises();

      const showcase = container.querySelector('#landing-showcase');
      expect(showcase.hidden).toBe(true);

      screen.destroy();
    });

    it('should handle network error gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      const screen = new LandingScreen({ container, onAuth });
      // Should not throw
      await screen.show();
      await flushPromises();

      screen.destroy();
    });

    it('should set cover background from appearance data', async () => {
      const books = [{
        id: 'b1',
        title: 'Styled Book',
        author: 'Me',
        appearance: {
          light: { coverBgStart: '#ff0000', coverBgEnd: '#00ff00', coverText: '#0000ff', coverBgImage: null },
        },
      }];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: books }),
      });

      const screen = new LandingScreen({ container, onAuth });
      await screen.show();
      await flushPromises();

      const cover = container.querySelector('.landing-book-cover');
      expect(cover.style.background).toContain('linear-gradient');
      expect(cover.style.color).toBe('rgb(0, 0, 255)');

      screen.destroy();
    });
  });

  describe('Language selector', () => {
    it('should initialize language select with current language', async () => {
      const screen = new LandingScreen({ container, onAuth });
      await screen.show();

      const langSelect = container.querySelector('#landing-lang-select');
      expect(langSelect.value).toBe('ru');

      screen.destroy();
    });

    it('should apply translations on show', async () => {
      const screen = new LandingScreen({ container, onAuth });
      await screen.show();

      const translatable = container.querySelector('[data-i18n="common.save"]');
      expect(translatable.textContent).toBe('Сохранить');

      screen.destroy();
    });
  });

  describe('Scroll animations', () => {
    it('should set up intersection observer for sections', async () => {
      const screen = new LandingScreen({ container, onAuth });
      await screen.show();

      expect(IntersectionObserver).toHaveBeenCalled();

      screen.destroy();
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners and stop timers on destroy', async () => {
      const screen = new LandingScreen({ container, onAuth });
      await screen.show();

      screen.destroy();

      // CTA should not trigger onAuth after destroy
      const cta = container.querySelector('.landing-cta');
      cta.click();
      expect(onAuth).not.toHaveBeenCalled();

      // Timer should be cleared
      expect(screen._autoSlideTimer).toBeNull();
    });

    it('should disconnect intersection observer on destroy', async () => {
      const screen = new LandingScreen({ container, onAuth });
      await screen.show();

      const observer = screen._observer;
      screen.destroy();

      expect(screen._observer).toBeNull();
    });

    it('should clean up language selector listener on destroy', async () => {
      const screen = new LandingScreen({ container, onAuth });
      await screen.show();

      screen.destroy();

      expect(screen._langSelect).toBeNull();
    });
  });

  describe('Guest-to-auth transition', () => {
    it('should support full flow: view landing → click CTA → auth callback', async () => {
      let authCalled = false;
      const screen = new LandingScreen({
        container,
        onAuth: () => { authCalled = true; },
      });

      // 1. Show landing
      await screen.show();
      expect(container.hidden).toBe(false);

      // 2. Browse tabs
      const albumsTab = container.querySelector('[data-tab="albums"]');
      albumsTab.click();
      expect(screen._activeTab).toBe('albums');

      // 3. Click CTA to register/login
      const cta = container.querySelector('.landing-cta');
      cta.click();
      expect(authCalled).toBe(true);

      // 4. After auth, landing is hidden
      screen.hide();
      expect(container.hidden).toBe(true);

      screen.destroy();
    });
  });
});
