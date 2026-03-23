/**
 * INTEGRATION TEST: SPA Router
 * Переходы между маршрутами, History API, параметры URL,
 * перехват кликов по data-route ссылкам, fallback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupIntegrationDOM } from '../../helpers/integrationUtils.js';
import { flushPromises } from '../../helpers/testUtils.js';
import { Router } from '../../../js/utils/Router.js';

describe('SPA Router Integration', () => {
  let router;
  let handlers;

  const createRoutes = () => {
    handlers = {
      home: vi.fn(),
      book: vi.fn(),
      embed: vi.fn(),
      account: vi.fn(),
      profile: vi.fn(),
    };

    return [
      { name: 'home', path: '/', handler: handlers.home },
      { name: 'book', path: '/book/:bookId', handler: handlers.book },
      { name: 'embed', path: '/embed/:bookId', handler: handlers.embed },
      { name: 'account', path: '/account', handler: handlers.account },
      { name: 'profile', path: '/:username', handler: handlers.profile },
    ];
  };

  beforeEach(() => {
    // Reset location to root
    history.replaceState(null, '', '/');
  });

  afterEach(() => {
    if (router) {
      router.destroy();
      router = null;
    }
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
    history.replaceState(null, '', '/');
  });

  describe('Route matching', () => {
    it('should match root route on start', async () => {
      router = new Router(createRoutes());
      await router.start();

      expect(handlers.home).toHaveBeenCalledWith({}, expect.anything());
      expect(router.getCurrentRoute().name).toBe('home');
    });

    it('should match parameterized book route', async () => {
      history.replaceState(null, '', '/book/abc-123');
      router = new Router(createRoutes());
      await router.start();

      expect(handlers.book).toHaveBeenCalledWith(
        { bookId: 'abc-123' },
        expect.anything(),
      );
      expect(router.getCurrentRoute().params.bookId).toBe('abc-123');
    });

    it('should match embed route', async () => {
      history.replaceState(null, '', '/embed/book-456');
      router = new Router(createRoutes());
      await router.start();

      expect(handlers.embed).toHaveBeenCalledWith(
        { bookId: 'book-456' },
        expect.anything(),
      );
    });

    it('should match account route', async () => {
      history.replaceState(null, '', '/account');
      router = new Router(createRoutes());
      await router.start();

      expect(handlers.account).toHaveBeenCalledWith({}, expect.anything());
    });

    it('should match catch-all username route', async () => {
      history.replaceState(null, '', '/johndoe');
      router = new Router(createRoutes());
      await router.start();

      expect(handlers.profile).toHaveBeenCalledWith(
        { username: 'johndoe' },
        expect.anything(),
      );
    });

    it('should prioritize specific routes over catch-all', async () => {
      history.replaceState(null, '', '/account');
      router = new Router(createRoutes());
      await router.start();

      // Should match account, NOT profile with username='account'
      expect(handlers.account).toHaveBeenCalled();
      expect(handlers.profile).not.toHaveBeenCalled();
    });

    it('should decode URI-encoded parameters', async () => {
      history.replaceState(null, '', '/book/%D0%BA%D0%BD%D0%B8%D0%B3%D0%B0');
      router = new Router(createRoutes());
      await router.start();

      expect(handlers.book).toHaveBeenCalledWith(
        { bookId: 'книга' },
        expect.anything(),
      );
    });
  });

  describe('Navigation', () => {
    it('should navigate to a new route using pushState', async () => {
      router = new Router(createRoutes());
      await router.start();
      handlers.home.mockClear();

      await router.navigate('/book/my-book');

      expect(handlers.book).toHaveBeenCalledWith(
        { bookId: 'my-book' },
        expect.anything(),
      );
      expect(location.pathname).toBe('/book/my-book');
    });

    it('should support replace navigation (replaceState)', async () => {
      router = new Router(createRoutes());
      await router.start();

      const initialHistoryLength = history.length;
      await router.navigate('/account', { replace: true });

      expect(handlers.account).toHaveBeenCalled();
      // Replace should not add a history entry
      expect(history.length).toBe(initialHistoryLength);
    });

    it('should update current route on navigate', async () => {
      router = new Router(createRoutes());
      await router.start();

      await router.navigate('/book/abc');

      const current = router.getCurrentRoute();
      expect(current.name).toBe('book');
      expect(current.params.bookId).toBe('abc');
      expect(current.path).toBe('/book/abc');
    });

    it('should handle consecutive navigations', async () => {
      router = new Router(createRoutes());
      await router.start();

      await router.navigate('/account');
      expect(router.getCurrentRoute().name).toBe('account');

      await router.navigate('/book/123');
      expect(router.getCurrentRoute().name).toBe('book');

      await router.navigate('/');
      expect(router.getCurrentRoute().name).toBe('home');
    });

    it('should not navigate when router is not started', async () => {
      router = new Router(createRoutes());

      await router.navigate('/account');

      expect(handlers.account).not.toHaveBeenCalled();
    });
  });

  describe('Query parameters', () => {
    it('should parse query parameters from navigate', async () => {
      router = new Router(createRoutes());
      await router.start();

      await router.navigate('/account?tab=profile&edit=true');

      const current = router.getCurrentRoute();
      expect(current.name).toBe('account');
      expect(current.query.get('tab')).toBe('profile');
      expect(current.query.get('edit')).toBe('true');
    });

    it('should handle URL without query parameters', async () => {
      router = new Router(createRoutes());
      await router.start();

      await router.navigate('/book/abc');

      const current = router.getCurrentRoute();
      expect(current.query.toString()).toBe('');
    });
  });

  describe('Popstate (back/forward)', () => {
    it('should handle popstate events', async () => {
      router = new Router(createRoutes());
      await router.start();

      await router.navigate('/account');
      handlers.account.mockClear();
      handlers.home.mockClear();

      // Simulate browser back: set URL to / and fire popstate
      // (history.back() doesn't reliably fire popstate in jsdom)
      history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await flushPromises();

      expect(handlers.home).toHaveBeenCalled();
    });
  });

  describe('Click interception (data-route)', () => {
    it('should intercept clicks on a[data-route] links', async () => {
      router = new Router(createRoutes());
      await router.start();
      handlers.home.mockClear();

      const link = document.createElement('a');
      link.setAttribute('data-route', '/book/click-test');
      link.href = '/book/click-test';
      document.body.appendChild(link);

      link.click();
      await flushPromises();

      expect(handlers.book).toHaveBeenCalledWith(
        { bookId: 'click-test' },
        expect.anything(),
      );
    });

    it('should not intercept regular links without data-route', async () => {
      router = new Router(createRoutes());
      await router.start();

      const link = document.createElement('a');
      link.href = '/external';
      document.body.appendChild(link);

      // Should not trigger router
      link.click();
      await flushPromises();

      // Only initial home handler call, no extra
      expect(handlers.home).toHaveBeenCalledTimes(1);
    });

    it('should handle nested element clicks (event bubbling)', async () => {
      router = new Router(createRoutes());
      await router.start();

      const link = document.createElement('a');
      link.setAttribute('data-route', '/account');
      const span = document.createElement('span');
      span.textContent = 'My Account';
      link.appendChild(span);
      document.body.appendChild(link);

      span.click();
      await flushPromises();

      expect(handlers.account).toHaveBeenCalled();
    });
  });

  describe('Trailing slash normalization', () => {
    it('should strip trailing slash from paths', async () => {
      history.replaceState(null, '', '/account/');
      router = new Router(createRoutes());
      await router.start();

      expect(handlers.account).toHaveBeenCalled();
    });

    it('should not strip slash from root path', async () => {
      history.replaceState(null, '', '/');
      router = new Router(createRoutes());
      await router.start();

      expect(handlers.home).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should not throw if handler throws an error', async () => {
      handlers = { home: vi.fn(), broken: vi.fn().mockRejectedValue(new Error('boom')) };
      router = new Router([
        { name: 'home', path: '/', handler: handlers.home },
        { name: 'broken', path: '/broken', handler: handlers.broken },
      ]);
      await router.start();

      // Should not throw
      await expect(router.navigate('/broken')).resolves.not.toThrow();
    });
  });

  describe('Context passing', () => {
    it('should pass context to route handlers', async () => {
      router = new Router(createRoutes());
      const context = { apiClient: {}, currentUser: { id: '1' } };
      await router.start(context);

      expect(handlers.home).toHaveBeenCalledWith({}, context);
    });
  });

  describe('Destroy', () => {
    it('should stop responding to events after destroy', async () => {
      router = new Router(createRoutes());
      await router.start();
      handlers.home.mockClear();

      router.destroy();

      // Navigate should be no-op
      await router.navigate('/account');
      expect(handlers.account).not.toHaveBeenCalled();

      // Popstate should be no-op
      window.dispatchEvent(new PopStateEvent('popstate'));
      await flushPromises();
      expect(handlers.home).not.toHaveBeenCalled();

      // getCurrentRoute should be null
      expect(router.getCurrentRoute()).toBeNull();
    });
  });

  describe('Full SPA navigation flow', () => {
    it('should support: landing → book → account → profile → home', async () => {
      router = new Router(createRoutes());
      await router.start();

      // 1. Navigate to book
      await router.navigate('/book/tolkien-hobbit');
      expect(router.getCurrentRoute().name).toBe('book');
      expect(router.getCurrentRoute().params.bookId).toBe('tolkien-hobbit');

      // 2. Navigate to account
      await router.navigate('/account');
      expect(router.getCurrentRoute().name).toBe('account');

      // 3. Navigate to public profile
      await router.navigate('/tolkien');
      expect(router.getCurrentRoute().name).toBe('profile');
      expect(router.getCurrentRoute().params.username).toBe('tolkien');

      // 4. Navigate home
      await router.navigate('/');
      expect(router.getCurrentRoute().name).toBe('home');
    });
  });
});
