/**
 * Тесты для ProfileHeader
 * Компонент шапки профиля — аватар, имя, bio
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProfileHeader } from '../../../js/core/ProfileHeader.js';

describe('ProfileHeader', () => {
  let container;

  // Шаблон, который ProfileHeader ожидает в DOM (соответствует templates.html)
  function setupTemplate() {
    const tmpl = document.createElement('template');
    tmpl.id = 'tmpl-profile-header';
    tmpl.innerHTML = `
      <div class="profile-header-avatar">
        <span class="profile-header-initial"></span>
      </div>
      <div class="profile-header-info">
        <h2 class="profile-header-name"></h2>
        <span class="profile-header-username"></span>
        <p class="profile-header-bio"></p>
        <div class="profile-header-actions">
          <button type="button" class="profile-header-edit" hidden></button>
          <button type="button" class="profile-header-logout" hidden></button>
        </div>
      </div>
      <div class="profile-header-plaque" hidden>
        <span class="profile-header-plaque-count"></span>
      </div>
    `;
    document.body.appendChild(tmpl);
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    setupTemplate();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  describe('constructor', () => {
    it('should store user data and options', () => {
      const user = { username: 'john', displayName: 'John' };
      const header = new ProfileHeader({ user, isOwner: true });
      expect(header._user).toBe(user);
      expect(header._isOwner).toBe(true);
    });
  });

  describe('render', () => {
    it('should create profile-header element in container', () => {
      const header = new ProfileHeader({
        user: { username: 'john', displayName: 'John Doe', bio: 'Hello' },
        isOwner: false,
      });
      header.render(container);

      const el = container.querySelector('.profile-header');
      expect(el).not.toBeNull();
    });

    it('should display user name and username', () => {
      const header = new ProfileHeader({
        user: { username: 'alice', displayName: 'Alice W', bio: '' },
        isOwner: false,
      });
      header.render(container);

      expect(container.querySelector('.profile-header-name').textContent).toBe('Alice W');
      expect(container.querySelector('.profile-header-username').textContent).toBe('@alice');
    });

    it('should fallback to username when displayName is not set', () => {
      const header = new ProfileHeader({
        user: { username: 'bob' },
        isOwner: false,
      });
      header.render(container);

      expect(container.querySelector('.profile-header-name').textContent).toBe('bob');
    });

    it('should fallback to ? when no name at all', () => {
      const header = new ProfileHeader({
        user: {},
        isOwner: false,
      });
      header.render(container);

      expect(container.querySelector('.profile-header-name').textContent).toBe('?');
    });

    it('should display bio when provided', () => {
      const header = new ProfileHeader({
        user: { username: 'x', bio: 'My bio text' },
        isOwner: false,
      });
      header.render(container);

      expect(container.querySelector('.profile-header-bio').textContent).toBe('My bio text');
    });

    it('should remove bio element when not provided', () => {
      const header = new ProfileHeader({
        user: { username: 'x' },
        isOwner: false,
      });
      header.render(container);

      expect(container.querySelector('.profile-header-bio')).toBeNull();
    });

    it('should remove username element when not provided', () => {
      const header = new ProfileHeader({
        user: { displayName: 'Test' },
        isOwner: false,
      });
      header.render(container);

      expect(container.querySelector('.profile-header-username')).toBeNull();
    });

    it('should show edit button for owner', () => {
      const header = new ProfileHeader({
        user: { username: 'me' },
        isOwner: true,
        onEditProfile: vi.fn(),
      });
      header.render(container);

      const editBtn = container.querySelector('.profile-header-edit');
      expect(editBtn).not.toBeNull();
      expect(editBtn.hidden).toBe(false);
    });

    it('should remove edit button for guest', () => {
      const header = new ProfileHeader({
        user: { username: 'other' },
        isOwner: false,
      });
      header.render(container);

      expect(container.querySelector('.profile-header-edit')).toBeNull();
    });

    it('should show logout button for owner with onLogout', () => {
      const header = new ProfileHeader({
        user: { username: 'me' },
        isOwner: true,
        onLogout: vi.fn(),
      });
      header.render(container);

      const logoutBtn = container.querySelector('.profile-header-logout');
      expect(logoutBtn).not.toBeNull();
      expect(logoutBtn.hidden).toBe(false);
    });

    it('should remove logout button for owner without onLogout', () => {
      const header = new ProfileHeader({
        user: { username: 'me' },
        isOwner: true,
      });
      header.render(container);

      expect(container.querySelector('.profile-header-logout')).toBeNull();
    });

    it('should call onEditProfile when edit button clicked', () => {
      const onEdit = vi.fn();
      const header = new ProfileHeader({
        user: { username: 'me' },
        isOwner: true,
        onEditProfile: onEdit,
      });
      header.render(container);

      container.querySelector('.profile-header-edit').click();
      expect(onEdit).toHaveBeenCalledOnce();
    });

    it('should call onLogout when logout button clicked', () => {
      const onLogout = vi.fn();
      const header = new ProfileHeader({
        user: { username: 'me' },
        isOwner: true,
        onLogout,
      });
      header.render(container);

      container.querySelector('.profile-header-logout').click();
      expect(onLogout).toHaveBeenCalledOnce();
    });

    it('should set avatar color based on username hash', () => {
      const header = new ProfileHeader({
        user: { username: 'testuser' },
        isOwner: false,
      });
      header.render(container);

      const avatar = container.querySelector('.profile-header-avatar');
      // jsdom converts hsl() to rgb(), so check for either format
      expect(avatar.style.background).toMatch(/hsl\(\d+, 45%, 45%\)|rgb\(\d+, \d+, \d+\)/);
    });

    it('should display initial letter in avatar', () => {
      const header = new ProfileHeader({
        user: { username: 'alice', displayName: 'Alice' },
        isOwner: false,
      });
      header.render(container);

      const initial = container.querySelector('.profile-header-initial');
      expect(initial.textContent).toBe('A');
    });

    it('should set up avatar image when avatarUrl provided', () => {
      const header = new ProfileHeader({
        user: { username: 'me', avatarUrl: '/avatar.png' },
        isOwner: false,
      });
      header.render(container);

      const img = container.querySelector('.profile-header-avatar-img');
      expect(img).not.toBeNull();
      expect(img.src).toContain('/avatar.png');
    });

    it('should destroy previous element on re-render', () => {
      const header = new ProfileHeader({
        user: { username: 'x' },
        isOwner: false,
      });
      header.render(container);
      header.render(container);

      const headers = container.querySelectorAll('.profile-header');
      expect(headers.length).toBe(1);
    });
  });

  describe('destroy', () => {
    it('should remove element from DOM', () => {
      const header = new ProfileHeader({
        user: { username: 'x' },
        isOwner: false,
      });
      header.render(container);
      expect(container.querySelector('.profile-header')).not.toBeNull();

      header.destroy();
      expect(container.querySelector('.profile-header')).toBeNull();
      expect(header._el).toBeNull();
    });

    it('should handle double destroy safely', () => {
      const header = new ProfileHeader({
        user: { username: 'x' },
        isOwner: false,
      });
      header.render(container);
      header.destroy();
      expect(() => header.destroy()).not.toThrow();
    });
  });

  describe('_hashToHue', () => {
    it('should return a number between 0 and 360', () => {
      const header = new ProfileHeader({ user: {}, isOwner: false });
      const hue = header._hashToHue('teststring');
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    });

    it('should be deterministic', () => {
      const header = new ProfileHeader({ user: {}, isOwner: false });
      expect(header._hashToHue('same')).toBe(header._hashToHue('same'));
    });

    it('should produce different hues for different strings', () => {
      const header = new ProfileHeader({ user: {}, isOwner: false });
      expect(header._hashToHue('alice')).not.toBe(header._hashToHue('bob'));
    });
  });
});
