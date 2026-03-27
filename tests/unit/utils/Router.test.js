/**
 * Unit tests for Router
 * Lightweight SPA router using History API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { Router } from '../../../js/utils/Router.js';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const createTestRoutes = () => [
  { name: 'home', path: '/', handler: vi.fn() },
  { name: 'reader', path: '/book/:bookId', handler: vi.fn() },
  { name: 'embed', path: '/embed/:bookId', handler: vi.fn() },
  { name: 'account', path: '/account', handler: vi.fn() },
  { name: 'profile', path: '/:username', handler: vi.fn() },
];

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Router', () => {
  let router;
  let routes;

  beforeEach(() => {
    vi.clearAllMocks();
    routes = createTestRoutes();
    // Reset location to /
    history.replaceState(null, '', '/');
  });

  afterEach(() => {
    router?.destroy();
    vi.restoreAllMocks();
  });

  // ── Constructor ──

  describe('constructor', () => {
    it('should compile route paths into patterns', () => {
      router = new Router(routes);
      expect(router._routes).toHaveLength(5);
    });

    it('should store route names', () => {
      router = new Router(routes);
      const names = router._routes.map((r) => r.name);
      expect(names).toEqual(['home', 'reader', 'embed', 'account', 'profile']);
    });

    it('should extract parameter keys from path patterns', () => {
      router = new Router(routes);
      const readerRoute = router._routes.find((r) => r.name === 'reader');
      expect(readerRoute.paramKeys).toEqual(['bookId']);
    });

    it('should handle routes with no parameters', () => {
      router = new Router(routes);
      const homeRoute = router._routes.find((r) => r.name === 'home');
      expect(homeRoute.paramKeys).toEqual([]);
    });

    it('should initialize current route as null', () => {
      router = new Router(routes);
      expect(router.getCurrentRoute()).toBeNull();
    });

    it('should initialize _started as false', () => {
      router = new Router(routes);
      expect(router._started).toBe(false);
    });
  });

  // ── _compilePath ──

  describe('_compilePath', () => {
    beforeEach(() => {
      router = new Router([]);
    });

    it('should compile root path /', () => {
      const { pattern, paramKeys } = router._compilePath('/');
      expect(pattern.test('/')).toBe(true);
      expect(paramKeys).toEqual([]);
    });

    it('should compile static path /account', () => {
      const { pattern } = router._compilePath('/account');
      expect(pattern.test('/account')).toBe(true);
      expect(pattern.test('/other')).toBe(false);
    });

    it('should compile parameterized path /book/:bookId', () => {
      const { pattern, paramKeys } = router._compilePath('/book/:bookId');
      expect(pattern.test('/book/123')).toBe(true);
      expect(pattern.test('/book/abc-def')).toBe(true);
      expect(pattern.test('/book/')).toBe(false);
      expect(paramKeys).toEqual(['bookId']);
    });

    it('should compile single-segment parameter /:username', () => {
      const { pattern, paramKeys } = router._compilePath('/:username');
      expect(pattern.test('/johndoe')).toBe(true);
      expect(paramKeys).toEqual(['username']);
    });

    it('should not match nested paths for single-segment pattern', () => {
      const { pattern } = router._compilePath('/:username');
      expect(pattern.test('/john/doe')).toBe(false);
    });

    it('should escape regex special characters in static segments', () => {
      const { pattern } = router._compilePath('/path.with.dots');
      expect(pattern.test('/path.with.dots')).toBe(true);
      expect(pattern.test('/pathXwithXdots')).toBe(false);
    });

    it('should not match root for static path', () => {
      const { pattern } = router._compilePath('/account');
      expect(pattern.test('/')).toBe(false);
    });
  });

  // ── _match ──

  describe('_match', () => {
    beforeEach(() => {
      router = new Router(routes);
    });

    it('should match root path to home', () => {
      const match = router._match('/');
      expect(match.name).toBe('home');
      expect(match.params).toEqual({});
    });

    it('should match /book/:bookId and extract bookId', () => {
      const match = router._match('/book/my-book-123');
      expect(match.name).toBe('reader');
      expect(match.params).toEqual({ bookId: 'my-book-123' });
    });

    it('should match /embed/:bookId and extract bookId', () => {
      const match = router._match('/embed/embed-456');
      expect(match.name).toBe('embed');
      expect(match.params).toEqual({ bookId: 'embed-456' });
    });

    it('should match /account to account route', () => {
      const match = router._match('/account');
      expect(match.name).toBe('account');
      expect(match.params).toEqual({});
    });

    it('should match /:username as catch-all for top-level paths', () => {
      const match = router._match('/johndoe');
      // /account is matched first because it appears before /:username
      // /johndoe doesn't match /account, /book/*, /embed/*, so falls through to /:username
      expect(match.name).toBe('profile');
      expect(match.params).toEqual({ username: 'johndoe' });
    });

    it('should return null for unmatched multi-level paths', () => {
      const match = router._match('/some/deep/path');
      expect(match).toBeNull();
    });

    it('should decode URI components in parameters', () => {
      const match = router._match('/book/%D0%BA%D0%BD%D0%B8%D0%B3%D0%B0');
      expect(match.params.bookId).toBe('книга');
    });

    it('should include path in match result', () => {
      const match = router._match('/book/test');
      expect(match.path).toBe('/book/test');
    });

    it('should respect first-match-wins priority', () => {
      // /account should match 'account' not 'profile' (/:username)
      const match = router._match('/account');
      expect(match.name).toBe('account');
    });
  });

  // ── start ──

  describe('start', () => {
    it('should resolve the current location', async () => {
      history.replaceState(null, '', '/');
      router = new Router(routes);
      await router.start();

      expect(router.getCurrentRoute().name).toBe('home');
    });

    it('should call the matching handler', async () => {
      history.replaceState(null, '', '/');
      router = new Router(routes);
      await router.start();

      expect(routes[0].handler).toHaveBeenCalledWith({}, {});
    });

    it('should pass context to handlers', async () => {
      history.replaceState(null, '', '/');
      router = new Router(routes);
      const context = { app: 'test' };
      await router.start(context);

      expect(routes[0].handler).toHaveBeenCalledWith({}, context);
    });

    it('should set _started to true', async () => {
      router = new Router(routes);
      await router.start();
      expect(router._started).toBe(true);
    });

    it('should not start twice', async () => {
      router = new Router(routes);
      await router.start();
      routes[0].handler.mockClear();

      await router.start();
      expect(routes[0].handler).not.toHaveBeenCalled();
    });

    it('should add popstate event listener', async () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      router = new Router(routes);
      await router.start();

      expect(addSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
    });

    it('should add click event listener on document', async () => {
      const addSpy = vi.spyOn(document, 'addEventListener');
      router = new Router(routes);
      await router.start();

      expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  // ── navigate ──

  describe('navigate', () => {
    beforeEach(async () => {
      history.replaceState(null, '', '/');
      router = new Router(routes);
      await router.start();
      vi.clearAllMocks();
    });

    it('should push new state to history', async () => {
      const pushSpy = vi.spyOn(history, 'pushState');
      await router.navigate('/account');
      expect(pushSpy).toHaveBeenCalledWith(null, '', '/account');
    });

    it('should replace state when replace option is true', async () => {
      const replaceSpy = vi.spyOn(history, 'replaceState');
      await router.navigate('/account', { replace: true });
      expect(replaceSpy).toHaveBeenCalledWith(null, '', '/account');
    });

    it('should call handler for matched route', async () => {
      await router.navigate('/account');
      expect(routes[3].handler).toHaveBeenCalledWith({}, {});
    });

    it('should extract params and call handler', async () => {
      await router.navigate('/book/test-book');
      expect(routes[1].handler).toHaveBeenCalledWith(
        { bookId: 'test-book' },
        expect.anything()
      );
    });

    it('should update current route', async () => {
      await router.navigate('/book/nav-test');
      const current = router.getCurrentRoute();
      expect(current.name).toBe('reader');
      expect(current.params.bookId).toBe('nav-test');
    });

    it('should do nothing if not started', async () => {
      router.destroy();
      router = new Router(routes);
      // Not started
      const pushSpy = vi.spyOn(history, 'pushState');
      await router.navigate('/account');
      expect(pushSpy).not.toHaveBeenCalled();
    });

    it('should handle path with query string', async () => {
      await router.navigate('/account?tab=profile');
      const current = router.getCurrentRoute();
      expect(current.name).toBe('account');
      expect(current.query.get('tab')).toBe('profile');
    });

    it('should handle path without query string', async () => {
      await router.navigate('/account');
      const current = router.getCurrentRoute();
      expect(current.query.toString()).toBe('');
    });
  });

  // ── getCurrentRoute ──

  describe('getCurrentRoute', () => {
    it('should return null before start', () => {
      router = new Router(routes);
      expect(router.getCurrentRoute()).toBeNull();
    });

    it('should return RouteMatch after start', async () => {
      history.replaceState(null, '', '/');
      router = new Router(routes);
      await router.start();

      const current = router.getCurrentRoute();
      expect(current).toBeDefined();
      expect(current.name).toBe('home');
      expect(current.params).toEqual({});
    });

    it('should include query params', async () => {
      history.replaceState(null, '', '/?lang=ru');
      router = new Router(routes);
      await router.start();

      const current = router.getCurrentRoute();
      expect(current.query.get('lang')).toBe('ru');
    });
  });

  // ── _resolve ──

  describe('_resolve', () => {
    it('should handle handler errors gracefully', async () => {
      const errorRoutes = [
        { name: 'home', path: '/', handler: vi.fn() },
        {
          name: 'broken',
          path: '/broken',
          handler: vi.fn().mockRejectedValue(new Error('handler error')),
        },
      ];
      router = new Router(errorRoutes);
      await router.start();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // Should not throw
      await router.navigate('/broken');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('broken'),
        expect.any(Error)
      );
    });
  });

  // ── _onClick (link interception) ──

  describe('_onClick (link interception)', () => {
    beforeEach(async () => {
      history.replaceState(null, '', '/');
      router = new Router(routes);
      await router.start();
      vi.clearAllMocks();
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should intercept clicks on a[data-route] links', async () => {
      const link = document.createElement('a');
      link.setAttribute('data-route', '/account');
      document.body.appendChild(link);

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(event);

      // Wait for async navigate
      await new Promise((r) => setTimeout(r, 0));

      expect(router.getCurrentRoute().name).toBe('account');
    });

    it('should preventDefault on intercepted clicks', () => {
      const link = document.createElement('a');
      link.setAttribute('data-route', '/account');
      document.body.appendChild(link);

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      link.dispatchEvent(event);

      expect(preventSpy).toHaveBeenCalled();
    });

    it('should ignore clicks on elements without data-route', async () => {
      const button = document.createElement('button');
      document.body.appendChild(button);

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      button.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 0));

      // Route should remain unchanged (home from start)
      expect(routes[3].handler).not.toHaveBeenCalled();
    });

    it('should handle clicks on child elements of a[data-route]', async () => {
      const link = document.createElement('a');
      link.setAttribute('data-route', '/book/child-test');
      const span = document.createElement('span');
      span.textContent = 'Click me';
      link.appendChild(span);
      document.body.appendChild(link);

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      span.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 0));

      expect(router.getCurrentRoute().name).toBe('reader');
      expect(router.getCurrentRoute().params.bookId).toBe('child-test');
    });

    it('should not navigate if data-route is empty', async () => {
      const link = document.createElement('a');
      link.setAttribute('data-route', '');
      document.body.appendChild(link);

      const navigateSpy = vi.spyOn(router, 'navigate');
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 0));
      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });

  // ── _onPopState ──

  describe('_onPopState (browser back/forward)', () => {
    it('should resolve new location on popstate', async () => {
      router = new Router(routes);
      await router.start();

      // Manually navigate to create history entries
      await router.navigate('/account');
      expect(router.getCurrentRoute().name).toBe('account');

      // Simulate browser back — pushState to / then trigger popstate
      history.replaceState(null, '', '/');
      const popEvent = new PopStateEvent('popstate');
      window.dispatchEvent(popEvent);

      await new Promise((r) => setTimeout(r, 0));
      expect(router.getCurrentRoute().name).toBe('home');
    });
  });

  // ── destroy ──

  describe('destroy', () => {
    it('should set _started to false', async () => {
      router = new Router(routes);
      await router.start();
      router.destroy();
      expect(router._started).toBe(false);
    });

    it('should set _current to null', async () => {
      router = new Router(routes);
      await router.start();
      router.destroy();
      expect(router.getCurrentRoute()).toBeNull();
    });

    it('should remove popstate listener', async () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      router = new Router(routes);
      await router.start();
      router.destroy();

      expect(removeSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
    });

    it('should remove click listener from document', async () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener');
      router = new Router(routes);
      await router.start();
      router.destroy();

      expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should prevent navigate after destroy', async () => {
      router = new Router(routes);
      await router.start();
      router.destroy();

      const pushSpy = vi.spyOn(history, 'pushState');
      await router.navigate('/account');
      expect(pushSpy).not.toHaveBeenCalled();
    });
  });

  // ── _stripBase / _addBase ──

  describe('_stripBase and _addBase', () => {
    it('_stripBase should return path as-is when base is empty', () => {
      router = new Router([]);
      // BASE_URL is '/' stripped to '' — so no stripping needed
      expect(router._stripBase('/book/123')).toBe('/book/123');
    });

    it('_addBase should prepend base to path', () => {
      router = new Router([]);
      // BASE_URL is '' so path stays unchanged
      const result = router._addBase('/book/123');
      expect(result).toBe('/book/123');
    });

    it('_stripBase should ensure result starts with /', () => {
      router = new Router([]);
      const result = router._stripBase('/');
      expect(result.startsWith('/')).toBe(true);
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('should handle route with no handler gracefully', async () => {
      const noHandlerRoutes = [
        { name: 'home', path: '/', handler: undefined },
      ];
      router = new Router(noHandlerRoutes);

      // Should not throw
      await router.start();
      expect(router.getCurrentRoute().name).toBe('home');
    });

    it('should handle empty routes array', () => {
      router = new Router([]);
      expect(router._routes).toHaveLength(0);
    });

    it('should handle multiple parameters in path', () => {
      const multiParamRoutes = [
        { name: 'chapter', path: '/book/:bookId/chapter/:chapterId', handler: vi.fn() },
      ];
      router = new Router(multiParamRoutes);

      const match = router._match('/book/abc/chapter/42');
      expect(match.name).toBe('chapter');
      expect(match.params).toEqual({ bookId: 'abc', chapterId: '42' });
    });

  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Path normalization (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('path normalization', () => {
    beforeEach(async () => {
      history.replaceState(null, '', '/');
      router = new Router(routes);
      await router.start();
      vi.clearAllMocks();
    });

    it('should strip trailing slash from non-root paths', async () => {
      await router.navigate('/account/');
      expect(router.getCurrentRoute().name).toBe('account');
    });

    it('should keep root path as /', async () => {
      await router.navigate('/');
      expect(router.getCurrentRoute().name).toBe('home');
    });

    it('should match /book/123/ same as /book/123', async () => {
      await router.navigate('/book/test-book/');
      expect(router.getCurrentRoute().name).toBe('reader');
      expect(router.getCurrentRoute().params.bookId).toBe('test-book');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Duplicate navigation prevention (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('duplicate navigation prevention', () => {
    beforeEach(async () => {
      history.replaceState(null, '', '/');
      router = new Router(routes);
      await router.start();
      vi.clearAllMocks();
    });

    it('should allow re-navigation to same path (handler called again)', async () => {
      await router.navigate('/account');
      vi.clearAllMocks();
      await router.navigate('/account');
      expect(routes[3].handler).toHaveBeenCalled();
    });

    it('should navigate if path is same but query is different', async () => {
      await router.navigate('/account?tab=profile');
      vi.clearAllMocks();
      const pushSpy = vi.spyOn(history, 'pushState');
      await router.navigate('/account?tab=fonts');
      expect(pushSpy).toHaveBeenCalled();
    });

    it('should navigate if query is same but path is different', async () => {
      await router.navigate('/account');
      vi.clearAllMocks();
      const pushSpy = vi.spyOn(history, 'pushState');
      await router.navigate('/book/123');
      expect(pushSpy).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Query string edge cases (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('query string edge cases', () => {
    beforeEach(async () => {
      history.replaceState(null, '', '/');
      router = new Router(routes);
      await router.start();
      vi.clearAllMocks();
    });

    it('should handle query-only path ?param=value on root', async () => {
      await router.navigate('/?param=value');
      const current = router.getCurrentRoute();
      expect(current.name).toBe('home');
      expect(current.query.get('param')).toBe('value');
    });

    it('should handle multiple query parameters', async () => {
      await router.navigate('/account?tab=profile&lang=ru&debug=1');
      const current = router.getCurrentRoute();
      expect(current.query.get('tab')).toBe('profile');
      expect(current.query.get('lang')).toBe('ru');
      expect(current.query.get('debug')).toBe('1');
    });

    it('should handle empty query string', async () => {
      await router.navigate('/account?');
      const current = router.getCurrentRoute();
      expect(current.name).toBe('account');
      expect(current.query.toString()).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Fallback behavior (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('fallback behavior', () => {
    it('should use replaceState (not pushState) when falling back to /', async () => {
      const limitedRoutes = [
        { name: 'home', path: '/', handler: vi.fn() },
      ];
      history.replaceState(null, '', '/');
      router = new Router(limitedRoutes);
      await router.start();
      vi.clearAllMocks();

      const replaceSpy = vi.spyOn(history, 'replaceState');
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      await router.navigate('/nonexistent/path');

      expect(replaceSpy).toHaveBeenCalled();
      expect(router.getCurrentRoute().name).toBe('home');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Popstate with path normalization (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('popstate with different paths', () => {
    it('should correctly resolve non-root path on popstate', async () => {
      router = new Router(routes);
      await router.start();
      await router.navigate('/account');

      // Simulate back to /book/abc
      history.replaceState(null, '', '/book/abc');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await new Promise((r) => setTimeout(r, 0));

      expect(router.getCurrentRoute().name).toBe('reader');
      expect(router.getCurrentRoute().params.bookId).toBe('abc');
    });
  });
});
