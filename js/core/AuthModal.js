/**
 * AUTH MODAL
 *
 * Модальное окно аутентификации — логин/регистрация (email + password + Google OAuth).
 * Показывается поверх bookshelf, когда сервер отвечает 401.
 *
 * Поток: GET /api/auth/me → 401 → модалка → 200 → bookshelf с книгами.
 */

import { t, applyTranslations } from '@i18n';
import { trackGuestRegistered } from '../utils/Analytics.js';

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;
const CHECK_DEBOUNCE = 400;

export class AuthModal {
  /**
   * @param {Object} options
   * @param {import('../utils/ApiClient.js').ApiClient} options.apiClient
   * @param {Function} options.onAuth - Колбэк после успешной авторизации (user)
   * @param {Function} [options.onClose] - Колбэк при закрытии модалки без авторизации
   */
  constructor({ apiClient, onAuth, onClose }) {
    this._api = apiClient;
    this._onAuth = onAuth;
    this._onClose = onClose || null;
    this._mode = 'login'; // 'login' | 'register'
    this._el = null;
    this._boundKeydown = this._onKeydown.bind(this);
    this._checkTimer = null;
    this._lastCheckedUsername = null;
    this._usernameAvailable = false;
  }

  /**
   * Показать модалку аутентификации
   */
  show() {
    if (this._el) return;
    this._mode = 'login';
    this._render();
    document.addEventListener('keydown', this._boundKeydown);
  }

  /**
   * Скрыть модалку
   */
  hide() {
    if (!this._el) return;
    clearTimeout(this._checkTimer);
    document.removeEventListener('keydown', this._boundKeydown);
    this._el.remove();
    this._el = null;
  }

  /**
   * Полная очистка
   */
  destroy() {
    this.hide();
  }

  // ═══════════════════════════════════════════
  // Рендеринг
  // ═══════════════════════════════════════════

  _render() {
    if (this._el) this._el.remove();

    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.appendChild(this._buildDOM());
    document.body.appendChild(overlay);
    this._el = overlay;

    this._bindFormEvents();
    this._focusFirst();
  }

  _buildDOM() {
    const tmpl = document.getElementById('tmpl-auth-modal');
    const frag = tmpl.content.cloneNode(true);
    this._applyMode(frag);
    return frag;
  }

  /**
   * Обновить содержимое модалки в соответствии с текущим режимом (login/register)
   * @param {DocumentFragment|HTMLElement} root
   */
  _applyMode(root) {
    const isLogin = this._mode === 'login';

    // Обновить data-i18n атрибуты для режимо-зависимых элементов
    const modal = root.querySelector('.auth-modal');
    modal.setAttribute('data-i18n-aria-label', isLogin ? 'auth.loginTitle' : 'auth.registerTitle');

    const title = root.querySelector('.auth-modal-title');
    title.setAttribute('data-i18n', isLogin ? 'auth.loginTitle' : 'auth.registerTitle');

    const subtitle = root.querySelector('.auth-modal-subtitle');
    subtitle.setAttribute('data-i18n', isLogin ? 'auth.loginSubtitle' : 'auth.registerSubtitle');

    // Поля только для регистрации
    for (const field of root.querySelectorAll('[data-register-only]')) {
      field.hidden = isLogin;
    }

    // Пароль: разный placeholder и autocomplete
    const pwd = root.querySelector('#auth-password');
    pwd.setAttribute('data-i18n-placeholder', isLogin ? 'auth.passwordLoginPlaceholder' : 'auth.passwordRegisterPlaceholder');
    pwd.autocomplete = isLogin ? 'current-password' : 'new-password';

    const submit = root.querySelector('.auth-submit');
    submit.setAttribute('data-i18n', isLogin ? 'auth.loginButton' : 'auth.registerButton');

    // Текст переключения режима
    const switchText = root.querySelector('.auth-switch-text');
    switchText.setAttribute('data-i18n', isLogin ? 'auth.noAccountQuestion' : 'auth.hasAccountQuestion');

    const switchBtn = root.querySelector('.auth-switch-btn');
    switchBtn.setAttribute('data-i18n', isLogin ? 'auth.switchToRegister' : 'auth.switchToLogin');

    // Применить переводы к обновлённым data-i18n атрибутам
    applyTranslations(modal);
  }

  // ═══════════════════════════════════════════
  // Обработка событий
  // ═══════════════════════════════════════════

  _bindFormEvents() {
    const form = this._el.querySelector('.auth-form');
    const switchBtn = this._el.querySelector('[data-action="switch"]');
    const closeBtn = this._el.querySelector('[data-action="close"]');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this._handleSubmit();
    });

    switchBtn.addEventListener('click', () => {
      this._mode = this._mode === 'login' ? 'register' : 'login';
      this._applyMode(this._el);
      this._focusFirst();
    });

    closeBtn.addEventListener('click', () => this._close());

    // Клик по оверлею (вне модалки) — закрыть
    this._el.addEventListener('click', (e) => {
      if (e.target === this._el) this._close();
    });

    // Живая валидация username
    const usernameInput = this._el.querySelector('#auth-username');
    if (usernameInput) {
      usernameInput.addEventListener('input', () => this._onUsernameInput());
    }
  }

  _close() {
    this.hide();
    if (this._onClose) this._onClose();
  }

  async _handleSubmit() {
    const email = this._el.querySelector('#auth-email').value.trim();
    const password = this._el.querySelector('#auth-password').value;
    const errorEl = this._el.querySelector('#auth-error');
    const submitBtn = this._el.querySelector('.auth-submit');

    // Клиентская валидация
    if (!email) {
      this._showError(errorEl, t('auth.emailRequired'));
      return;
    }
    if (password.length < 8) {
      this._showError(errorEl, t('auth.passwordLength'));
      return;
    }
    if (this._mode === 'register') {
      const username = this._el.querySelector('#auth-username')?.value.trim();
      if (!username || !USERNAME_RE.test(username)) {
        this._showError(errorEl, t('auth.usernameInvalid'));
        return;
      }
      if (!this._usernameAvailable) {
        this._showError(errorEl, t('auth.usernameUnavailable'));
        return;
      }
    }

    // Блокируем кнопку
    submitBtn.disabled = true;
    submitBtn.textContent = this._mode === 'login' ? t('auth.loginLoading') : t('auth.registerLoading');
    errorEl.hidden = true;

    try {
      let user;
      if (this._mode === 'login') {
        user = await this._api.login(email, password);
      } else {
        const name = this._el.querySelector('#auth-name')?.value.trim() || null;
        const username = this._el.querySelector('#auth-username')?.value.trim();
        user = await this._api.register(email, password, name, username);
        trackGuestRegistered('email');
      }
      this.hide();
      if (this._onAuth) this._onAuth(user);
    } catch (err) {
      this._showError(errorEl, err.message || t('auth.genericError'));
      submitBtn.disabled = false;
      submitBtn.textContent = this._mode === 'login' ? t('auth.loginButton') : t('auth.registerButton');
    }
  }

  // ═══════════════════════════════════════════
  // Валидация username
  // ═══════════════════════════════════════════

  _onUsernameInput() {
    const input = this._el.querySelector('#auth-username');
    const value = input.value.trim().toLowerCase();
    input.value = value;
    this._usernameAvailable = false;

    const validationEl = this._el.querySelector('#auth-username-validation');
    if (!validationEl) return;

    if (!value) {
      this._showUsernameStatus(validationEl, '', 'neutral');
      return;
    }

    if (!USERNAME_RE.test(value)) {
      this._showUsernameStatus(validationEl, t('auth.usernameInvalidFormat'), 'error');
      return;
    }

    this._showUsernameStatus(validationEl, t('auth.usernameChecking'), 'neutral');
    clearTimeout(this._checkTimer);
    this._checkTimer = setTimeout(() => this._checkUsername(value), CHECK_DEBOUNCE);
  }

  async _checkUsername(username) {
    if (this._lastCheckedUsername === username) return;
    this._lastCheckedUsername = username;

    const validationEl = this._el?.querySelector('#auth-username-validation');
    if (!validationEl) return;

    try {
      const result = await this._api.checkUsernamePublic(username);
      const input = this._el?.querySelector('#auth-username');
      if (!input || input.value.trim().toLowerCase() !== username) return;

      if (result.available) {
        this._usernameAvailable = true;
        this._showUsernameStatus(validationEl, t('auth.usernameAvailable'), 'success');
      } else {
        this._usernameAvailable = false;
        this._showUsernameStatus(validationEl, t('auth.usernameUnavailable'), 'error');
      }
    } catch {
      this._showUsernameStatus(validationEl, t('auth.usernameCheckError'), 'error');
    }
  }

  _showUsernameStatus(el, text, type) {
    if (!text) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.className = `auth-username-validation auth-username-validation--${type}`;
  }

  _showError(el, message) {
    el.textContent = message;
    el.hidden = false;
  }

  _focusFirst() {
    const firstInput = this._el.querySelector('.auth-input');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
  }

  _onKeydown(e) {
    if (e.key === 'Escape') {
      this._close();
    }
  }
}
