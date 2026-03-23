/**
 * INTEGRATION TEST: Public Discovery API
 * /api/public/discover, /api/public/shelves/:username — через ApiClient и LandingScreen.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupIntegrationDOM } from '../../helpers/integrationUtils.js';
import { flushPromises } from '../../helpers/testUtils.js';

// Mock i18n to avoid i18next initialization hanging in tests
vi.mock('../../../js/i18n/index.js', () => ({
  t: (key) => key,
  setLanguage: vi.fn(),
  getLanguage: () => 'ru',
  applyTranslations: vi.fn(),
}));

// ── ApiClient public methods ────────────────────────────────────────────────

describe('Public Discovery API Integration', () => {
  describe('ApiClient public endpoints', () => {
    let api;
    let fetchMock;

    beforeEach(async () => {
      fetchMock = vi.fn();
      globalThis.fetch = fetchMock;

      const { ApiClient } = await import('../../../js/utils/ApiClient.js');
      api = new ApiClient();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe('getPublicDiscover', () => {
      it('should fetch discover endpoint with default limit', async () => {
        fetchMock.mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({
            data: [
              { id: 'b1', title: 'Book One', author: 'Author A', coverBg: '#333', visibility: 'published' },
              { id: 'b2', title: 'Book Two', author: 'Author B', coverBg: '#444', visibility: 'published' },
            ],
          }),
        });

        const result = await api.getPublicDiscover();

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/public/discover'),
          expect.any(Object),
        );
        expect(result).toHaveLength(2);
        expect(result[0].title).toBe('Book One');
      });

      it('should pass custom limit parameter', async () => {
        fetchMock.mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: [] }),
        });

        await api.getPublicDiscover(10);

        const url = fetchMock.mock.calls[0][0];
        expect(url).toContain('limit=10');
      });

      it('should handle server error gracefully', async () => {
        fetchMock.mockResolvedValue({
          ok: false,
          status: 500,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ error: 'Server error' }),
        });

        await expect(api.getPublicDiscover()).rejects.toThrow();
      });
    });

    describe('getPublicShelf', () => {
      it('should fetch shelf by username', async () => {
        fetchMock.mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({
            data: {
              user: { username: 'alice', displayName: 'Alice', bio: 'Writer' },
              books: [
                { id: 'b1', title: 'Alice Book', author: 'Alice' },
              ],
            },
          }),
        });

        const result = await api.getPublicShelf('alice');

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/public/shelves/alice'),
          expect.any(Object),
        );
        expect(result.user.username).toBe('alice');
        expect(result.books).toHaveLength(1);
      });

      it('should handle 404 for non-existent user', async () => {
        fetchMock.mockResolvedValue({
          ok: false,
          status: 404,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ error: 'User not found' }),
        });

        await expect(api.getPublicShelf('nonexistent')).rejects.toThrow();
      });
    });

    describe('getPublicBook', () => {
      it('should fetch public book details', async () => {
        fetchMock.mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({
            data: {
              id: 'b1', title: 'Public Book', author: 'Author',
              chapters: [{ id: 'c1', title: 'Chapter 1' }],
            },
          }),
        });

        const result = await api.getPublicBook('b1');

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/public/books/b1'),
          expect.any(Object),
        );
        expect(result.title).toBe('Public Book');
      });
    });

    describe('getPublicChapterContent', () => {
      it('should fetch chapter content for public book', async () => {
        fetchMock.mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({
            data: { id: 'c1', title: 'Ch 1', htmlContent: '<p>Content</p>' },
          }),
        });

        const result = await api.getPublicChapterContent('b1', 'c1');

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/public/books/b1/chapters/c1'),
          expect.any(Object),
        );
        expect(result.htmlContent).toContain('<p>Content</p>');
      });
    });
  });

  // ── LandingScreen showcase ────────────────────────────────────────────────

  describe('LandingScreen showcase loading', () => {
    let landing;
    let fetchMock;

    beforeEach(() => {
      fetchMock = vi.fn();
      globalThis.fetch = fetchMock;

      // IntersectionObserver mock for jsdom
      if (!globalThis.IntersectionObserver) {
        globalThis.IntersectionObserver = class {
          constructor() { this._els = []; }
          observe(el) { this._els.push(el); }
          unobserve() {}
          disconnect() {}
        };
      }

      // Create landing DOM matching actual selectors used by LandingScreen
      const container = document.createElement('div');
      container.id = 'landing-screen';
      container.hidden = true;
      container.innerHTML = `
        <button class="landing-tab landing-tab--active" data-tab="books">Books</button>
        <button class="landing-tab" data-tab="albums">Albums</button>
        <div class="landing-tab-panel landing-tab-panel--active" data-panel="books"></div>
        <div class="landing-tab-panel" data-panel="albums"></div>
        <div id="landing-showcase" hidden>
          <div id="landing-showcase-grid"></div>
        </div>
      `;
      document.body.appendChild(container);

      // Template for book cards (used by _createBookCard)
      const tmpl = document.createElement('template');
      tmpl.id = 'tmpl-landing-book-card';
      tmpl.innerHTML = `
        <div class="landing-book-cover">
          <span class="landing-book-title"></span>
          <span class="landing-book-author"></span>
        </div>
      `;
      document.body.appendChild(tmpl);
    });

    afterEach(() => {
      if (landing) {
        landing.destroy();
        landing = null;
      }
      cleanupIntegrationDOM();
      vi.restoreAllMocks();
    });

    async function createLanding(opts = {}) {
      const { LandingScreen } = await import('../../../js/core/LandingScreen.js');
      const container = document.getElementById('landing-screen');
      landing = new LandingScreen({
        container,
        onAuth: opts.onAuth || vi.fn(),
      });
      return landing;
    }

    it('should show landing screen and set body dataset', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const screen = await createLanding();
      await screen.show();
      await flushPromises();

      expect(screen.container.hidden).toBe(false);
      expect(document.body.dataset.screen).toBe('landing');
    });

    it('should call discover API on show', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { id: 'b1', title: 'Showcase Book', author: 'Author' },
          ],
        }),
      });

      const screen = await createLanding();
      await screen.show();
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/public/discover'));
    });

    it('should render book cards into showcase grid', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { id: 'b1', title: 'Book One', author: 'Author A' },
            { id: 'b2', title: 'Book Two', author: '' },
          ],
        }),
      });

      const screen = await createLanding();
      await screen.show();
      await flushPromises();

      const grid = screen.container.querySelector('#landing-showcase-grid');
      const cards = grid.querySelectorAll('.landing-book-card');
      expect(cards.length).toBe(2);
    });

    it('should handle showcase fetch error gracefully', async () => {
      fetchMock.mockRejectedValue(new Error('Network failure'));

      const screen = await createLanding();
      await screen.show();
      await flushPromises();

      // Should not crash
      expect(screen.container.hidden).toBe(false);
    });

    it('should handle non-ok response gracefully', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      const screen = await createLanding();
      await screen.show();
      await flushPromises();

      expect(screen.container.hidden).toBe(false);
    });

    it('should hide landing screen', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const screen = await createLanding();
      await screen.show();
      screen.hide();

      expect(screen.container.hidden).toBe(true);
    });

    it('should switch tabs via click', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const screen = await createLanding();
      await screen.show();
      await flushPromises();

      const albumTab = screen.container.querySelector('[data-tab="albums"]');
      albumTab.click();

      expect(screen._activeTab).toBe('albums');
      expect(albumTab.classList.contains('landing-tab--active')).toBe(true);
    });

    it('should destroy without errors', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const screen = await createLanding();
      await screen.show();
      await flushPromises();

      // Should not throw
      screen.destroy();
      expect(screen._autoSlideTimer).toBeNull();
    });
  });
});
