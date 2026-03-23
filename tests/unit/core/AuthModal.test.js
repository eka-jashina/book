/**
 * TESTS: AuthModal
 * Тесты для модального окна аутентификации
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthModal } from '@core/AuthModal.js';

describe('AuthModal', () => {
  let modal;
  let mockApi;
  let onAuth;

  beforeEach(() => {
    // Шаблон модалки аутентификации
    const tmpl = document.createElement('template');
    tmpl.id = 'tmpl-auth-modal';
    tmpl.innerHTML = `
      <div class="auth-modal" role="dialog" aria-modal="true" aria-label="Вход">
        <button type="button" class="auth-close-btn" aria-label="Закрыть" data-action="close">&times;</button>
        <div class="auth-modal-header">
          <h2 class="auth-modal-title">Вход</h2>
          <p class="auth-modal-subtitle">Войдите в свой аккаунт</p>
        </div>
        <form class="auth-form" novalidate>
          <div class="auth-field" data-register-only hidden>
            <label for="auth-username" class="auth-label">Имя пользователя</label>
            <input type="text" id="auth-username" class="auth-input" placeholder="my-name" autocomplete="username" required
              pattern="^[a-z0-9][a-z0-9-]{2,39}$" minlength="3" maxlength="40">
            <span class="auth-hint">Латиница, цифры, дефис. От 3 до 40 символов.</span>
            <span class="auth-username-validation" id="auth-username-validation" hidden></span>
          </div>
          <div class="auth-field" data-register-only hidden>
            <label for="auth-name" class="auth-label">Отображаемое имя</label>
            <input type="text" id="auth-name" class="auth-input" placeholder="Ваше имя" autocomplete="name">
          </div>
          <div class="auth-field">
            <label for="auth-email" class="auth-label">Email</label>
            <input type="email" id="auth-email" class="auth-input" placeholder="email@example.com" autocomplete="email" required>
          </div>
          <div class="auth-field">
            <label for="auth-password" class="auth-label">Пароль</label>
            <input type="password" id="auth-password" class="auth-input" placeholder="Ваш пароль" autocomplete="current-password" required minlength="8">
          </div>
          <div class="auth-error" id="auth-error" hidden></div>
          <button type="submit" class="auth-submit">Войти</button>
        </form>
        <div class="auth-divider"><span>или</span></div>
        <a href="/api/auth/google" class="auth-google-btn">
          <svg class="auth-google-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Войти через Google
        </a>
        <div class="auth-switch">
          <span class="auth-switch-text">Нет аккаунта?</span>
          <button type="button" class="auth-switch-btn" data-action="switch">Зарегистрироваться</button>
        </div>
      </div>
    `;
    document.body.appendChild(tmpl);

    mockApi = {
      login: vi.fn().mockResolvedValue({ id: 1, email: 'test@test.com' }),
      register: vi.fn().mockResolvedValue({ id: 2, email: 'new@test.com' }),
      checkUsernamePublic: vi.fn().mockResolvedValue({ available: true }),
    };
    onAuth = vi.fn();
    modal = new AuthModal({ apiClient: mockApi, onAuth });
  });

  afterEach(() => {
    modal.destroy();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should initialize with login mode', () => {
      expect(modal._mode).toBe('login');
    });

    it('should not render overlay on creation', () => {
      expect(modal._el).toBeNull();
    });

    it('should store api and onAuth references', () => {
      expect(modal._api).toBe(mockApi);
      expect(modal._onAuth).toBe(onAuth);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // show / hide
  // ═══════════════════════════════════════════════════════════════════════════

  describe('show', () => {
    it('should create overlay in DOM', () => {
      modal.show();

      expect(modal._el).not.toBeNull();
      expect(document.querySelector('.auth-overlay')).toBeTruthy();
    });

    it('should render login form', () => {
      modal.show();

      expect(modal._el.querySelector('.auth-form')).toBeTruthy();
      expect(modal._el.querySelector('#auth-email')).toBeTruthy();
      expect(modal._el.querySelector('#auth-password')).toBeTruthy();
    });

    it('should hide register-only fields in login mode', () => {
      modal.show();
      const nameField = modal._el.querySelector('#auth-name');
      expect(nameField).toBeTruthy();
      expect(nameField.closest('[data-register-only]').hidden).toBe(true);
    });

    it('should be no-op if already shown', () => {
      modal.show();
      const el = modal._el;

      modal.show();
      expect(modal._el).toBe(el);
    });

    it('should add keydown listener', () => {
      const spy = vi.spyOn(document, 'addEventListener');
      modal.show();

      expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('hide', () => {
    it('should remove overlay from DOM', () => {
      modal.show();
      modal.hide();

      expect(modal._el).toBeNull();
      expect(document.querySelector('.auth-overlay')).toBeNull();
    });

    it('should be no-op if not shown', () => {
      modal.hide(); // should not throw
      expect(modal._el).toBeNull();
    });

    it('should remove keydown listener', () => {
      const spy = vi.spyOn(document, 'removeEventListener');
      modal.show();
      modal.hide();

      expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('destroy', () => {
    it('should call hide', () => {
      modal.show();
      modal.destroy();

      expect(modal._el).toBeNull();
      expect(document.querySelector('.auth-overlay')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Mode switching
  // ═══════════════════════════════════════════════════════════════════════════

  describe('mode switching', () => {
    it('should switch to register mode', () => {
      modal.show();

      const switchBtn = modal._el.querySelector('[data-action="switch"]');
      switchBtn.click();

      expect(modal._mode).toBe('register');
      expect(modal._el.querySelector('#auth-name').closest('[data-register-only]').hidden).toBe(false);
    });

    it('should switch back to login mode', () => {
      modal.show();

      // switch to register
      modal._el.querySelector('[data-action="switch"]').click();
      // switch back to login
      modal._el.querySelector('[data-action="switch"]').click();

      expect(modal._mode).toBe('login');
      expect(modal._el.querySelector('#auth-name').closest('[data-register-only]').hidden).toBe(true);
    });

    it('should render correct title for register mode', () => {
      modal.show();
      modal._el.querySelector('[data-action="switch"]').click();

      const title = modal._el.querySelector('.auth-modal-title');
      expect(title.textContent).toBe('Регистрация');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Form submission
  // ═══════════════════════════════════════════════════════════════════════════

  describe('form submission', () => {
    it('should show error for empty email', async () => {
      modal.show();

      modal._el.querySelector('#auth-email').value = '';
      modal._el.querySelector('#auth-password').value = 'password123';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      const errorEl = modal._el.querySelector('#auth-error');
      expect(errorEl.hidden).toBe(false);
      expect(errorEl.textContent).toContain('email');
    });

    it('should show error for short password', async () => {
      modal.show();

      modal._el.querySelector('#auth-email').value = 'test@test.com';
      modal._el.querySelector('#auth-password').value = '1234567';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      const errorEl = modal._el.querySelector('#auth-error');
      expect(errorEl.hidden).toBe(false);
      expect(errorEl.textContent).toContain('8');
    });

    it('should call login on valid form in login mode', async () => {
      modal.show();

      modal._el.querySelector('#auth-email').value = 'test@test.com';
      modal._el.querySelector('#auth-password').value = 'password123';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      // Ждём async _handleSubmit
      await vi.waitFor(() => {
        expect(mockApi.login).toHaveBeenCalledWith('test@test.com', 'password123');
      });
    });

    it('should call onAuth after successful login', async () => {
      modal.show();

      modal._el.querySelector('#auth-email').value = 'test@test.com';
      modal._el.querySelector('#auth-password').value = 'password123';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      await vi.waitFor(() => {
        expect(onAuth).toHaveBeenCalledWith({ id: 1, email: 'test@test.com' });
      });
    });

    it('should hide modal after successful login', async () => {
      modal.show();

      modal._el.querySelector('#auth-email').value = 'test@test.com';
      modal._el.querySelector('#auth-password').value = 'password123';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      await vi.waitFor(() => {
        expect(document.querySelector('.auth-overlay')).toBeNull();
      });
    });

    it('should call register in register mode', async () => {
      modal.show();
      modal._el.querySelector('[data-action="switch"]').click();

      const usernameInput = modal._el.querySelector('#auth-username');
      usernameInput.value = 'testuser';
      usernameInput.dispatchEvent(new Event('input'));

      // Ждём проверки username (debounce + async check)
      await vi.waitFor(() => {
        expect(mockApi.checkUsernamePublic).toHaveBeenCalledWith('testuser');
      });
      await vi.waitFor(() => {
        expect(modal._usernameAvailable).toBe(true);
      });

      modal._el.querySelector('#auth-name').value = 'Test User';
      modal._el.querySelector('#auth-email').value = 'new@test.com';
      modal._el.querySelector('#auth-password').value = 'password123';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      await vi.waitFor(() => {
        expect(mockApi.register).toHaveBeenCalledWith('new@test.com', 'password123', 'Test User', 'testuser');
      });
    });

    it('should show error on API failure', async () => {
      mockApi.login.mockRejectedValue(new Error('Invalid credentials'));
      modal.show();

      modal._el.querySelector('#auth-email').value = 'test@test.com';
      modal._el.querySelector('#auth-password').value = 'password123';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      await vi.waitFor(() => {
        const errorEl = modal._el.querySelector('#auth-error');
        expect(errorEl.hidden).toBe(false);
        expect(errorEl.textContent).toContain('Invalid credentials');
      });
    });

    it('should disable and re-enable submit button on error', async () => {
      mockApi.login.mockRejectedValue(new Error('Error'));
      modal.show();

      modal._el.querySelector('#auth-email').value = 'test@test.com';
      modal._el.querySelector('#auth-password').value = 'password123';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      await vi.waitFor(() => {
        const submitBtn = modal._el.querySelector('.auth-submit');
        expect(submitBtn.disabled).toBe(false);
      });
    });

    it('should pass null name if name field empty in register', async () => {
      modal.show();
      modal._el.querySelector('[data-action="switch"]').click();

      const usernameInput = modal._el.querySelector('#auth-username');
      usernameInput.value = 'testuser';
      usernameInput.dispatchEvent(new Event('input'));

      // Ждём проверки username
      await vi.waitFor(() => {
        expect(modal._usernameAvailable).toBe(true);
      });

      modal._el.querySelector('#auth-name').value = '';
      modal._el.querySelector('#auth-email').value = 'new@test.com';
      modal._el.querySelector('#auth-password').value = 'password123';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      await vi.waitFor(() => {
        expect(mockApi.register).toHaveBeenCalledWith('new@test.com', 'password123', null, 'testuser');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Keyboard
  // ═══════════════════════════════════════════════════════════════════════════

  describe('keyboard', () => {
    it('should close on Escape', () => {
      modal.show();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(modal._el).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _render edge case
  // ═══════════════════════════════════════════════════════════════════════════

  describe('mode switch in-place', () => {
    it('should update DOM in-place without recreating overlay', () => {
      modal.show();
      const el = modal._el;

      // Switch обновляет DOM без пересоздания
      modal._el.querySelector('[data-action="switch"]').click();

      expect(modal._el).toBe(el);
      expect(document.body.contains(el)).toBe(true);
    });
  });
});
