/**
 * INTEGRATION TEST: Auth + Migration Flow
 * Тестирование полного потока: показ AuthModal → логин/регистрация →
 * MigrationHelper проверяет локальные данные → импорт или очистка →
 * загрузка книг через API → отображение на bookshelf.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthModal } from '../../../js/core/AuthModal.js';
import { MigrationHelper } from '../../../js/core/MigrationHelper.js';
import {
  BookshelfScreen,
  loadBooksFromAPI,
} from '../../../js/core/BookshelfScreen.js';

// Mock admin mode cards data
vi.mock('../../../js/admin/modeCardsData.js', () => ({
  renderModeCards: vi.fn(),
}));

describe('Auth + Migration Integration', () => {
  /** @type {Object} */
  let mockApi;
  /** @type {Object} */
  let localData;

  const ADMIN_CONFIG_KEY = 'flipbook-admin-config';
  const IDB_NAME = 'flipbook-admin';

  const mockUser = { id: 'u1', email: 'test@test.com', displayName: 'Test' };

  const createMockApi = (overrides = {}) => ({
    getMe: vi.fn().mockResolvedValue(null), // 401 by default
    login: vi.fn().mockResolvedValue(mockUser),
    register: vi.fn().mockResolvedValue(mockUser),
    checkUsernamePublic: vi.fn().mockResolvedValue({ available: true }),
    getBooks: vi.fn().mockResolvedValue({ books: [] }),
    getBook: vi.fn(),
    createBook: vi.fn(),
    deleteBook: vi.fn(),
    importConfig: vi.fn().mockResolvedValue({ success: true }),
    exportConfig: vi.fn(),
    getSettings: vi.fn().mockResolvedValue(null),
    getFonts: vi.fn().mockResolvedValue({ fonts: [] }),
    ...overrides,
  });

  /**
   * Полный конфиг с одной книгой и главами (не дефолтная)
   */
  const createLocalConfig = () => ({
    schemaVersion: 2,
    books: [{
      id: 'book-local-1',
      cover: { title: 'Мой роман', author: 'Автор' },
      chapters: [
        { id: 'ch1', title: 'Глава 1', file: '', htmlContent: '<p>Текст</p>', bg: '', bgMobile: '' },
        { id: 'ch2', title: 'Глава 2', file: '', htmlContent: '<p>Продолжение</p>', bg: '', bgMobile: '' },
      ],
      sounds: { pageFlip: '', bookOpen: '', bookClose: '' },
      ambients: [
        { id: 'rain', label: 'Дождь', shortLabel: 'Дождь', icon: '🌧️', file: null, visible: true, builtin: true },
      ],
      appearance: {
        light: { coverBgStart: '#333', coverBgEnd: '#111', coverText: '#fff' },
        dark: { coverBgStart: '#000', coverBgEnd: '#111', coverText: '#eee' },
      },
      defaultSettings: { font: 'inter', fontSize: 20 },
      decorativeFont: null,
    }],
    activeBookId: 'book-local-1',
    readingFonts: [
      { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true },
    ],
    settingsVisibility: { fontSize: true, theme: true, font: true, fullscreen: true, sound: true, ambient: true },
    fontMin: 14,
    fontMax: 24,
  });

  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    sessionStorage.clear();
    localData = null;
    mockApi = createMockApi();

    // Шаблон модалки аутентификации
    const authTmpl = document.createElement('template');
    authTmpl.id = 'tmpl-auth-modal';
    authTmpl.innerHTML = `
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
        <a href="/api/auth/google" class="auth-google-btn">Войти через Google</a>
        <div class="auth-switch">
          <span class="auth-switch-text">Нет аккаунта?</span>
          <button type="button" class="auth-switch-btn" data-action="switch">Зарегистрироваться</button>
        </div>
      </div>
    `;
    document.body.appendChild(authTmpl);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // AuthModal показ и логин
  // ═══════════════════════════════════════════

  describe('AuthModal show and login', () => {
    it('should show login modal and submit login successfully', async () => {
      const onAuth = vi.fn();
      const authModal = new AuthModal({ apiClient: mockApi, onAuth });

      authModal.show();

      // Modal rendered
      const overlay = document.querySelector('.auth-overlay');
      expect(overlay).not.toBeNull();
      expect(document.querySelector('.auth-modal-title').textContent).toBe('Вход');

      // Fill form
      document.querySelector('#auth-email').value = 'test@test.com';
      document.querySelector('#auth-password').value = 'password123';

      // Submit
      const form = document.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { bubbles: true }));

      await vi.waitFor(() => {
        expect(mockApi.login).toHaveBeenCalledWith('test@test.com', 'password123');
      });

      await vi.waitFor(() => {
        expect(onAuth).toHaveBeenCalledWith(mockUser);
      });

      // Modal hidden after auth
      expect(document.querySelector('.auth-overlay')).toBeNull();

      authModal.destroy();
    });

    it('should switch to register mode and submit registration', async () => {
      const onAuth = vi.fn();
      const authModal = new AuthModal({ apiClient: mockApi, onAuth });

      authModal.show();

      // Switch to register
      const switchBtn = document.querySelector('[data-action="switch"]');
      switchBtn.click();

      await vi.waitFor(() => {
        expect(document.querySelector('.auth-modal-title').textContent).toBe('Регистрация');
      });

      // Fill register form — trigger input event for username availability check
      const usernameInput = document.querySelector('#auth-username');
      usernameInput.value = 'testuser';
      usernameInput.dispatchEvent(new Event('input'));

      // Wait for username availability check to complete
      await vi.waitFor(() => {
        expect(mockApi.checkUsernamePublic).toHaveBeenCalledWith('testuser');
      });
      await vi.waitFor(() => {
        expect(authModal._usernameAvailable).toBe(true);
      });

      document.querySelector('#auth-name').value = 'Test User';
      document.querySelector('#auth-email').value = 'new@test.com';
      document.querySelector('#auth-password').value = 'newpass123';

      // Submit
      document.querySelector('.auth-form').dispatchEvent(new Event('submit', { bubbles: true }));

      await vi.waitFor(() => {
        expect(mockApi.register).toHaveBeenCalledWith('new@test.com', 'newpass123', 'Test User', 'testuser');
      });

      await vi.waitFor(() => {
        expect(onAuth).toHaveBeenCalledWith(mockUser);
      });

      authModal.destroy();
    });

    it('should show validation error for empty email', async () => {
      const onAuth = vi.fn();
      const authModal = new AuthModal({ apiClient: mockApi, onAuth });
      authModal.show();

      document.querySelector('#auth-email').value = '';
      document.querySelector('#auth-password').value = 'password123';
      document.querySelector('.auth-form').dispatchEvent(new Event('submit', { bubbles: true }));

      await vi.waitFor(() => {
        const errorEl = document.querySelector('#auth-error');
        expect(errorEl.hidden).toBe(false);
        expect(errorEl.textContent).toBe('Введите email');
      });

      expect(mockApi.login).not.toHaveBeenCalled();
      authModal.destroy();
    });

    it('should show validation error for short password', async () => {
      const onAuth = vi.fn();
      const authModal = new AuthModal({ apiClient: mockApi, onAuth });
      authModal.show();

      document.querySelector('#auth-email').value = 'test@test.com';
      document.querySelector('#auth-password').value = 'short';
      document.querySelector('.auth-form').dispatchEvent(new Event('submit', { bubbles: true }));

      await vi.waitFor(() => {
        const errorEl = document.querySelector('#auth-error');
        expect(errorEl.hidden).toBe(false);
        expect(errorEl.textContent).toBe('Пароль должен содержать минимум 8 символов');
      });

      expect(mockApi.login).not.toHaveBeenCalled();
      authModal.destroy();
    });

    it('should show API error on failed login', async () => {
      mockApi.login.mockRejectedValue(new Error('Invalid credentials'));

      const onAuth = vi.fn();
      const authModal = new AuthModal({ apiClient: mockApi, onAuth });
      authModal.show();

      document.querySelector('#auth-email').value = 'test@test.com';
      document.querySelector('#auth-password').value = 'wrongpass1';
      document.querySelector('.auth-form').dispatchEvent(new Event('submit', { bubbles: true }));

      await vi.waitFor(() => {
        const errorEl = document.querySelector('#auth-error');
        expect(errorEl.hidden).toBe(false);
        expect(errorEl.textContent).toBe('Invalid credentials');
      });

      expect(onAuth).not.toHaveBeenCalled();
      // Submit button re-enabled
      expect(document.querySelector('.auth-submit').disabled).toBe(false);
      authModal.destroy();
    });
  });

  // ═══════════════════════════════════════════
  // MigrationHelper: миграция локальных данных
  // ═══════════════════════════════════════════

  describe('MigrationHelper: local data migration', () => {
    it('should skip migration when server has books', async () => {
      mockApi.getBooks.mockResolvedValue({ books: [{ id: 'server-book-1', title: 'Existing' }] });
      localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(createLocalConfig()));

      const migration = new MigrationHelper(mockApi);
      const result = await migration.checkAndMigrate();

      expect(result).toBe(false);
      expect(mockApi.importConfig).not.toHaveBeenCalled();
      // Local data should be cleared
      expect(localStorage.getItem(ADMIN_CONFIG_KEY)).toBeNull();
    });

    it('should skip migration when no local data exists', async () => {
      mockApi.getBooks.mockResolvedValue({ books: [] });

      const migration = new MigrationHelper(mockApi);
      const result = await migration.checkAndMigrate();

      expect(result).toBe(false);
      expect(mockApi.importConfig).not.toHaveBeenCalled();
    });

    it('should skip migration for default book without chapters', async () => {
      mockApi.getBooks.mockResolvedValue({ books: [] });
      localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify({
        books: [{ id: 'default', chapters: [] }],
      }));

      const migration = new MigrationHelper(mockApi);
      const result = await migration.checkAndMigrate();

      expect(result).toBe(false);
      expect(mockApi.importConfig).not.toHaveBeenCalled();
      // Local default data cleared
      expect(localStorage.getItem(ADMIN_CONFIG_KEY)).toBeNull();
    });

    it('should import local data to server when user confirms', async () => {
      mockApi.getBooks.mockResolvedValue({ books: [] });
      const config = createLocalConfig();
      localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(config));
      localStorage.setItem('reader-settings:book-local-1', JSON.stringify({ page: 5 }));

      // User clicks "yes" on confirm dialog
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const migration = new MigrationHelper(mockApi);
      const result = await migration.checkAndMigrate();

      expect(result).toBe(true);
      expect(mockApi.importConfig).toHaveBeenCalledTimes(1);

      // Verify import data structure
      const importData = mockApi.importConfig.mock.calls[0][0];
      expect(importData.books).toHaveLength(1);
      expect(importData.books[0].title).toBe('Мой роман');
      expect(importData.books[0].author).toBe('Автор');
      expect(importData.books[0].chapters).toHaveLength(2);
      expect(importData.readingFonts).toHaveLength(1);
      expect(importData.globalSettings.fontMin).toBe(14);
      expect(importData.globalSettings.fontMax).toBe(24);

      // Admin config should be cleared, but reader-settings preserved (reading progress cache)
      expect(localStorage.getItem(ADMIN_CONFIG_KEY)).toBeNull();
      expect(localStorage.getItem('reader-settings:book-local-1')).not.toBeNull();
    });

    it('should clear local data when user declines migration', async () => {
      mockApi.getBooks.mockResolvedValue({ books: [] });
      localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(createLocalConfig()));
      localStorage.setItem('reader-settings:book-local-1', JSON.stringify({ page: 5 }));

      // User clicks "no"
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      const migration = new MigrationHelper(mockApi);
      const result = await migration.checkAndMigrate();

      expect(result).toBe(false);
      expect(mockApi.importConfig).not.toHaveBeenCalled();
      // Admin config cleared, reader-settings preserved
      expect(localStorage.getItem(ADMIN_CONFIG_KEY)).toBeNull();
      expect(localStorage.getItem('reader-settings:book-local-1')).not.toBeNull();
    });

    it('should preserve local data when import fails', async () => {
      mockApi.getBooks.mockResolvedValue({ books: [] });
      localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(createLocalConfig()));

      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockApi.importConfig.mockRejectedValue(new Error('Server error'));

      const migration = new MigrationHelper(mockApi);
      const result = await migration.checkAndMigrate();

      expect(result).toBe(false);
      // Local data NOT cleared on error — safe fallback
      expect(localStorage.getItem(ADMIN_CONFIG_KEY)).not.toBeNull();
    });

    it('should convert local config to correct import format', async () => {
      mockApi.getBooks.mockResolvedValue({ books: [] });
      const config = createLocalConfig();
      localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(config));

      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const migration = new MigrationHelper(mockApi);
      await migration.checkAndMigrate();

      const importData = mockApi.importConfig.mock.calls[0][0];
      const book = importData.books[0];

      // Cover fields
      expect(book.cover.bgMode).toBe('default');

      // Chapters format
      expect(book.chapters[0].title).toBe('Глава 1');
      expect(book.chapters[0].hasHtmlContent).toBe(true);

      // Appearance
      expect(book.appearance.fontMin).toBe(14);
      expect(book.appearance.light.coverBgStart).toBe('#333');
      expect(book.appearance.dark.coverBgStart).toBe('#000');

      // Ambients
      expect(book.ambients).toHaveLength(1);
      expect(book.ambients[0].ambientKey).toBe('rain');
      expect(book.ambients[0].builtin).toBe(true);

      // Settings
      expect(book.defaultSettings.font).toBe('inter');

      // Reading fonts
      expect(importData.readingFonts[0].fontKey).toBe('georgia');
      expect(importData.readingFonts[0].builtin).toBe(true);

      // Global settings
      expect(importData.globalSettings.settingsVisibility.fontSize).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // Полный поток: Auth → Migration → Bookshelf
  // ═══════════════════════════════════════════

  describe('Full flow: Auth → Migration → Bookshelf', () => {
    const createBookshelfDOM = () => {
      const container = document.createElement('div');
      container.id = 'bookshelf';

      const header = document.createElement('div');
      header.className = 'bookshelf-header';
      container.appendChild(header);

      const subtitle = document.createElement('span');
      subtitle.id = 'bookshelf-subtitle';
      container.appendChild(subtitle);

      const shelves = document.createElement('div');
      shelves.id = 'bookshelf-shelves';
      container.appendChild(shelves);

      const actions = document.createElement('div');
      actions.id = 'bookshelf-actions';
      container.appendChild(actions);

      const empty = document.createElement('div');
      empty.id = 'bookshelf-empty';
      empty.hidden = true;
      container.appendChild(empty);

      const modeSelector = document.createElement('div');
      modeSelector.id = 'bookshelf-mode-selector';
      modeSelector.hidden = true;
      container.appendChild(modeSelector);

      // Templates
      const shelfTmpl = document.createElement('template');
      shelfTmpl.id = 'tmpl-bookshelf-shelf';
      shelfTmpl.innerHTML = '<div class="bookshelf-shelf"><div class="bookshelf-books"></div></div>';
      document.body.appendChild(shelfTmpl);

      const bookTmpl = document.createElement('template');
      bookTmpl.id = 'tmpl-bookshelf-book';
      bookTmpl.innerHTML = `
        <div class="bookshelf-book-wrapper">
          <button class="bookshelf-book">
            <div class="bookshelf-book-cover">
              <span class="bookshelf-book-title"></span>
              <span class="bookshelf-book-author"></span>
            </div>
          </button>
          <div class="bookshelf-book-menu" hidden>
            <button data-book-action="read">Читать</button>
            <button data-book-action="edit">Редактировать</button>
            <button data-book-action="delete">Удалить</button>
          </div>
        </div>
      `;
      document.body.appendChild(bookTmpl);

      document.body.appendChild(container);
      return container;
    };

    it('should complete full login → migration → bookshelf flow', async () => {
      // Setup: local data exists, server empty
      const config = createLocalConfig();
      localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(config));

      // After import, server returns migrated books
      const serverBooks = [
        { id: 'srv-1', title: 'Мой роман', author: 'Автор', chaptersCount: 2 },
      ];
      mockApi.getBooks
        .mockResolvedValueOnce({ books: [] })  // First call: migration check (empty)
        .mockResolvedValueOnce({ books: serverBooks }); // Second call: load bookshelf

      vi.spyOn(window, 'confirm').mockReturnValue(true);

      // Step 1: Show AuthModal
      let authUser = null;
      const authModal = new AuthModal({
        apiClient: mockApi,
        onAuth: (user) => { authUser = user; },
      });
      authModal.show();
      expect(document.querySelector('.auth-overlay')).not.toBeNull();

      // Step 2: Login
      document.querySelector('#auth-email').value = 'test@test.com';
      document.querySelector('#auth-password').value = 'password123';
      document.querySelector('.auth-form').dispatchEvent(new Event('submit', { bubbles: true }));

      await vi.waitFor(() => expect(authUser).not.toBeNull());
      expect(authUser).toEqual(mockUser);

      // Step 3: Migration
      const migration = new MigrationHelper(mockApi);
      const migrated = await migration.checkAndMigrate();
      expect(migrated).toBe(true);
      expect(mockApi.importConfig).toHaveBeenCalledTimes(1);

      // Step 4: Load books from API
      const books = await loadBooksFromAPI(mockApi);
      expect(books).toEqual(serverBooks);

      // Step 5: Render bookshelf
      const container = createBookshelfDOM();
      const onBookSelect = vi.fn();
      const bookshelf = new BookshelfScreen({
        container,
        books,
        onBookSelect,
        apiClient: mockApi,
      });
      bookshelf.render();

      // Verify bookshelf shows migrated book
      const bookCards = container.querySelectorAll('.bookshelf-book-wrapper');
      expect(bookCards).toHaveLength(1);
      expect(container.querySelector('.bookshelf-book-title').textContent).toBe('Мой роман');

      bookshelf.destroy();
      authModal.destroy();
    });

    it('should handle new user: login → no migration → empty bookshelf', async () => {
      // No local data, server empty
      mockApi.getBooks.mockResolvedValue({ books: [] });

      // Auth
      let authUser = null;
      const authModal = new AuthModal({
        apiClient: mockApi,
        onAuth: (user) => { authUser = user; },
      });
      authModal.show();
      document.querySelector('#auth-email').value = 'new@test.com';
      document.querySelector('#auth-password').value = 'newpass123';
      document.querySelector('.auth-form').dispatchEvent(new Event('submit', { bubbles: true }));

      await vi.waitFor(() => expect(authUser).not.toBeNull());

      // Migration: no local data → skip
      const migration = new MigrationHelper(mockApi);
      const migrated = await migration.checkAndMigrate();
      expect(migrated).toBe(false);

      // Load empty bookshelf
      const books = await loadBooksFromAPI(mockApi);
      expect(books).toEqual([]);

      const container = createBookshelfDOM();
      const bookshelf = new BookshelfScreen({
        container,
        books,
        onBookSelect: vi.fn(),
        apiClient: mockApi,
      });
      bookshelf.render();

      // Empty state visible
      expect(container.querySelector('#bookshelf-empty').hidden).toBe(false);
      expect(container.querySelector('#bookshelf-shelves').hidden).toBe(true);

      bookshelf.destroy();
      authModal.destroy();
    });

    it('should handle returning user: login → server has books → show bookshelf', async () => {
      const serverBooks = [
        { id: 'b1', title: 'Book 1', author: 'Author 1', chaptersCount: 3 },
        { id: 'b2', title: 'Book 2', author: 'Author 2', chaptersCount: 5 },
      ];
      mockApi.getBooks.mockResolvedValue({ books: serverBooks });

      // Auth
      let authUser = null;
      const authModal = new AuthModal({
        apiClient: mockApi,
        onAuth: (user) => { authUser = user; },
      });
      authModal.show();
      document.querySelector('#auth-email').value = 'existing@test.com';
      document.querySelector('#auth-password').value = 'password123';
      document.querySelector('.auth-form').dispatchEvent(new Event('submit', { bubbles: true }));

      await vi.waitFor(() => expect(authUser).not.toBeNull());

      // Migration: server has data → skip, clear local
      localStorage.setItem(ADMIN_CONFIG_KEY, 'old-data');
      const migration = new MigrationHelper(mockApi);
      const migrated = await migration.checkAndMigrate();
      expect(migrated).toBe(false);
      // Local data cleared
      expect(localStorage.getItem(ADMIN_CONFIG_KEY)).toBeNull();

      // Bookshelf shows server books
      const books = await loadBooksFromAPI(mockApi);
      const container = createBookshelfDOM();
      const bookshelf = new BookshelfScreen({
        container,
        books,
        onBookSelect: vi.fn(),
        apiClient: mockApi,
      });
      bookshelf.render();

      const bookCards = container.querySelectorAll('.bookshelf-book-wrapper');
      expect(bookCards).toHaveLength(2);

      const titles = [...container.querySelectorAll('.bookshelf-book-title')].map(el => el.textContent);
      expect(titles).toContain('Book 1');
      expect(titles).toContain('Book 2');

      bookshelf.destroy();
      authModal.destroy();
    });
  });

  // ═══════════════════════════════════════════
  // Edge cases
  // ═══════════════════════════════════════════

  describe('Edge cases', () => {
    it('should handle corrupted localStorage during migration', async () => {
      mockApi.getBooks.mockResolvedValue({ books: [] });
      localStorage.setItem(ADMIN_CONFIG_KEY, '{corrupted-json');

      const migration = new MigrationHelper(mockApi);
      const result = await migration.checkAndMigrate();

      // Corrupted data treated as no data
      expect(result).toBe(false);
      expect(mockApi.importConfig).not.toHaveBeenCalled();
    });

    it('should clear sessionStorage keys during migration cleanup', async () => {
      mockApi.getBooks.mockResolvedValue({ books: [{ id: 'b1' }] });
      sessionStorage.setItem('flipbook-reading-session', '1');
      sessionStorage.setItem('flipbook-admin-mode', 'edit');
      sessionStorage.setItem('flipbook-admin-edit-book', 'book-1');

      const migration = new MigrationHelper(mockApi);
      await migration.checkAndMigrate();

      expect(sessionStorage.getItem('flipbook-reading-session')).toBeNull();
      expect(sessionStorage.getItem('flipbook-admin-mode')).toBeNull();
      expect(sessionStorage.getItem('flipbook-admin-edit-book')).toBeNull();
    });

    it('should preserve reader-settings keys (reading progress cache)', async () => {
      mockApi.getBooks.mockResolvedValue({ books: [{ id: 'b1' }] });
      localStorage.setItem('reader-settings', JSON.stringify({ page: 0 }));
      localStorage.setItem('reader-settings:book-1', JSON.stringify({ page: 5 }));
      localStorage.setItem('reader-settings:book-2', JSON.stringify({ page: 10 }));
      localStorage.setItem('other-key', 'preserved');

      const migration = new MigrationHelper(mockApi);
      await migration.checkAndMigrate();

      // reader-settings preserved — they serve as a local cache for reading progress
      expect(localStorage.getItem('reader-settings')).not.toBeNull();
      expect(localStorage.getItem('reader-settings:book-1')).not.toBeNull();
      expect(localStorage.getItem('reader-settings:book-2')).not.toBeNull();
      expect(localStorage.getItem('other-key')).toBe('preserved');
    });

    it('should handle multi-book local config with appearance themes', async () => {
      mockApi.getBooks.mockResolvedValue({ books: [] });
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const config = createLocalConfig();
      config.books.push({
        id: 'book-2',
        cover: { title: 'Second Book', author: '' },
        chapters: [{ id: 'ch1', title: 'Ch', file: 'f.html', htmlContent: null, bg: '', bgMobile: '' }],
        sounds: null,
        ambients: [],
        appearance: null,
        defaultSettings: null,
        decorativeFont: { name: 'Fancy', dataUrl: 'data:font/woff2;base64,...' },
      });
      localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(config));

      const migration = new MigrationHelper(mockApi);
      await migration.checkAndMigrate();

      const importData = mockApi.importConfig.mock.calls[0][0];
      expect(importData.books).toHaveLength(2);
      expect(importData.books[1].title).toBe('Second Book');
      expect(importData.books[1].decorativeFont.name).toBe('Fancy');
      expect(importData.books[1].appearance).toBeNull();
    });

    it('should close AuthModal on Escape key', async () => {
      const authModal = new AuthModal({ apiClient: mockApi, onAuth: vi.fn() });
      authModal.show();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(document.querySelector('.auth-overlay')).toBeNull();
    });

    it('should re-render AuthModal on mode switch without duplicating', () => {
      const authModal = new AuthModal({ apiClient: mockApi, onAuth: vi.fn() });
      authModal.show();

      // Switch to register
      document.querySelector('[data-action="switch"]').click();
      expect(document.querySelectorAll('.auth-overlay')).toHaveLength(1);
      expect(document.querySelector('.auth-modal-title').textContent).toBe('Регистрация');

      // Switch back
      document.querySelector('[data-action="switch"]').click();
      expect(document.querySelectorAll('.auth-overlay')).toHaveLength(1);
      expect(document.querySelector('.auth-modal-title').textContent).toBe('Вход');

      authModal.destroy();
    });
  });
});
