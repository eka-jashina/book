/**
 * ROUTE HANDLERS
 *
 * Обработчики маршрутов SPA-роутера.
 * Выделены из index.js для уменьшения размера основного файла.
 *
 * Каждый обработчик отвечает за очистку предыдущего экрана
 * и инициализацию нового.
 */

import { BookshelfScreen, loadBooksFromAPI, getBookshelfData, clearActiveBook } from '../core/BookshelfScreen.js';
import { LandingScreen } from '../core/LandingScreen.js';
import { createConfig, enrichConfigFromIDB, loadConfigFromAPI, loadPublicConfigFromAPI, setConfig } from '../config.js';
import { BookController } from '../core/BookController.js';
import { AuthModal } from '../core/AuthModal.js';
import { MigrationHelper } from '../core/MigrationHelper.js';
import { adminConfigStorage, loadAdminConfig } from '../config/configHelpers.js';
import { installPrompt } from '../utils/InstallPrompt.js';
import { photoLightbox } from '../utils/PhotoLightbox.js';

/**
 * Контекст приложения, общий для всех обработчиков.
 * Инициализируется в index.js через initRouteHandlers().
 * @type {Object}
 */
let ctx = null;

/**
 * Инициализировать контекст для обработчиков маршрутов.
 * @param {Object} appContext
 * @param {Object} appContext.state - Мутируемое состояние (app, bookshelf, landing, accountScreen, authModal)
 * @param {import('../utils/ApiClient.js').ApiClient} appContext.apiClient
 * @param {import('../utils/Router.js').Router} appContext.router
 * @param {Object|null} appContext.currentUser
 * @param {boolean} appContext.useAPI
 * @param {(user: Object) => void} appContext.setCurrentUser
 */
export function initRouteHandlers(appContext) {
  ctx = appContext;
}

// ─── Переходы между экранами ─────────────────────────────────────────────────

/**
 * Выполнить смену экрана с плавным переходом (View Transitions API).
 * Fallback: мгновенная смена для неподдерживаемых браузеров.
 * @param {string} vtName - Имя перехода (to-landing, to-shelf, to-reader, to-account)
 * @param {Function} callback - DOM-мутации (cleanup + show)
 */
function screenTransition(vtName, callback) {
  if ('startViewTransition' in document) {
    document.documentElement.dataset.vt = vtName;
    const vt = document.startViewTransition(() => callback());
    vt.finished.finally(() => delete document.documentElement.dataset.vt);
    return vt.updateCallbackDone;
  }
  callback();
  return Promise.resolve();
}

// ─── Утилиты экранов ────────────────────────────────────────────────────────

function cleanupReader() {
  if (ctx.state.app) {
    ctx.state.app.destroy();
    ctx.state.app = null;
  }
  photoLightbox.destroy();
  document.body.classList.remove('embed-mode');
  delete document.body.dataset.readerMode;

  // Убираем inline-переопределения книжного оформления,
  // чтобы они не влияли на другие экраны (полка, аккаунт, лендинг)
  const html = document.documentElement;
  ['--cover-front-bg', '--cover-front-text', '--bg-page', '--bg-book',
   '--bg-app', '--bg-page-image', '--font-min', '--font-max',
   '--decorative-font'].forEach(
    prop => html.style.removeProperty(prop)
  );
  // Убираем inline backgroundColor с body (задаётся в ThemeController._applyAppearance)
  document.body.style.backgroundColor = '';
}

function cleanupBookshelf() {
  if (ctx.state.bookshelf) {
    ctx.state.bookshelf.destroy();
    ctx.state.bookshelf = null;
  }
  const el = document.getElementById('bookshelf-screen');
  if (el) el.hidden = true;
}

function cleanupLanding() {
  if (ctx.state.landing) {
    ctx.state.landing.destroy();
    ctx.state.landing = null;
  }
  const el = document.getElementById('landing-screen');
  if (el) el.hidden = true;
}

function hideAccount() {
  if (ctx.state.accountScreen) ctx.state.accountScreen.hide();
}

function hideBookWrap() {
  const el = document.getElementById('book-wrap');
  if (el) el.style.visibility = 'hidden';
}

function showBookWrap() {
  const el = document.getElementById('book-wrap');
  if (el) el.style.visibility = '';
}

function setupInstallButton() {
  const installSection = document.getElementById('install-section');
  const installBtn = document.getElementById('install-btn');
  if (!installSection || !installBtn) return;

  const updateVisibility = () => { installSection.hidden = !installPrompt.canInstall; };
  installPrompt.onStateChange((event) => {
    if (event === 'available' || event === 'installed' || event === 'dismissed') updateVisibility();
  });
  installBtn.addEventListener('click', async () => {
    installPrompt.resetDismissed();
    await installPrompt.install();
    updateVisibility();
  });
  updateVisibility();
}

function setupBackToShelfButton() {
  const btn = document.getElementById('backToShelfBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    clearActiveBook();
    if (ctx.router) ctx.router.navigate('/');
    else location.reload();
  });
}

async function handleLogout() {
  try {
    await ctx.apiClient.logout();
  } catch (err) {
    console.error('Ошибка при выходе:', err);
  }
  ctx.setCurrentUser(null);
  await screenTransition('to-landing', () => {
    cleanupReader(); cleanupBookshelf(); hideAccount();
  });
  ctx.router.navigate('/', { replace: true });
}

function showBookshelf(books, { mode = 'owner', profileUser } = {}) {
  const container = document.getElementById('bookshelf-screen');
  if (!container) return;
  document.body.dataset.hasBookshelf = 'true';

  ctx.state.bookshelf = new BookshelfScreen({
    container, books, apiClient: ctx.apiClient, mode, profileUser, router: ctx.router,
    onBookSelect: (bookId) => {
      if (ctx.router) ctx.router.navigate(`/book/${bookId}`);
      else location.reload();
    },
    onLogout: ctx.useAPI ? handleLogout : undefined,
  });
  ctx.state.bookshelf.render();
  // show() без View Transitions — переход управляется screenTransition()
  container.hidden = false;
  document.body.dataset.screen = 'bookshelf';
}

function showLanding() {
  const container = document.getElementById('landing-screen');
  if (!container) return;

  ctx.state.landing = new LandingScreen({
    container,
    onAuth: () => {
      if (!ctx.state.authModal) {
        ctx.state.authModal = new AuthModal({
          apiClient: ctx.apiClient,
          onAuth: async (user) => {
            ctx.setCurrentUser(user);
            const migration = new MigrationHelper(ctx.apiClient);
            await migration.checkAndMigrate();
            const target = user.username ? `/${user.username}` : '/';
            ctx.router.navigate(target, { replace: true });
          },
        });
      }
      ctx.state.authModal.show();
    },
  });
  ctx.state.landing.show();
}

// ─── Обработчики маршрутов ──────────────────────────────────────────────────

/** Маршрут: / → Лендинг (гости) или redirect на /:username (авторизованные) */
export async function handleHome() {
  if (ctx.useAPI && ctx.currentUser?.username) {
    cleanupReader(); cleanupLanding(); cleanupBookshelf(); hideAccount();
    ctx.router.navigate(`/${ctx.currentUser.username}`, { replace: true });
  } else if (ctx.useAPI && ctx.currentUser) {
    const books = await loadBooksFromAPI(ctx.apiClient);
    await screenTransition('to-shelf', () => {
      cleanupReader(); cleanupLanding(); cleanupBookshelf(); hideAccount();
      showBookshelf(books, { mode: 'owner', profileUser: ctx.currentUser });
    });
  } else if (ctx.useAPI && !ctx.currentUser) {
    await screenTransition('to-landing', () => {
      cleanupReader(); cleanupLanding(); cleanupBookshelf(); hideAccount();
      showLanding();
    });
  } else {
    const { books } = getBookshelfData();
    await screenTransition('to-shelf', () => {
      cleanupReader(); cleanupLanding(); cleanupBookshelf(); hideAccount();
      showBookshelf(books);
    });
  }
}

/** Маршрут: /:username → Публичная полка автора */
export async function handlePublicShelf({ username }) {
  const isOwner = ctx.currentUser?.username === username;

  if (isOwner) {
    const books = await loadBooksFromAPI(ctx.apiClient);
    await screenTransition('to-shelf', () => {
      cleanupReader(); cleanupLanding(); cleanupBookshelf(); hideAccount();
      showBookshelf(books, { mode: 'owner', profileUser: ctx.currentUser });
    });
  } else {
    try {
      const data = await ctx.apiClient.getPublicShelf(username);
      await screenTransition('to-shelf', () => {
        cleanupReader(); cleanupLanding(); cleanupBookshelf(); hideAccount();
        showBookshelf(data.books || [], { mode: 'guest', profileUser: data.author || { username } });
      });
    } catch (err) {
      if (err.status === 404) {
        ctx.router.navigate('/', { replace: true });
      } else {
        console.error('Ошибка загрузки публичной полки:', err);
        ctx.router.navigate('/', { replace: true });
      }
    }
  }
}

/** Маршрут: /:username/:slug → Показать книгу по slug автора */
export async function handleBookBySlug({ username, slug }) {
  // Резолвим slug → bookId через публичный API, затем открываем ридер
  try {
    const book = await ctx.apiClient.getPublicBookBySlug(username, slug);
    if (book?.id) {
      await handleReader({ bookId: book.id });
      return;
    }
  } catch (err) {
    console.error('Ошибка загрузки книги по slug:', err);
  }
  // Fallback: если книга не найдена, переходим на полку автора
  ctx.router.navigate(`/${username}`, { replace: true });
}

/** Маршрут: /book/:bookId → Показать ридер */
export async function handleReader({ bookId }) {
  await screenTransition('to-reader', () => {
    cleanupLanding(); cleanupBookshelf(); cleanupReader(); hideAccount();
    document.body.dataset.screen = 'reader';
    document.body.dataset.hasBookshelf = 'true';
    // Скрыть книгу до загрузки конфига, чтобы не мелькала предыдущая/дефолтная обложка
    hideBookWrap();
  });
  setupBackToShelfButton();

  try {
    if (ctx.useAPI) {
      await initReaderWithMode(bookId, 'reader');
    } else {
      const config = adminConfigStorage.load();
      config.activeBookId = bookId;
      if (!config.books) config.books = [];
      adminConfigStorage.setFull(config);
      await initReaderFallback();
    }
  } finally {
    showBookWrap();
  }
}

/** Маршрут: /embed/:bookId → Встраиваемый ридер */
export async function handleEmbed({ bookId }) {
  await screenTransition('to-reader', () => {
    cleanupLanding(); cleanupBookshelf(); cleanupReader(); hideAccount();
    document.body.dataset.screen = 'reader';
    hideBookWrap();
  });

  try {
    if (ctx.useAPI) {
      await initReaderWithMode(bookId, 'embed');
    } else {
      const config = adminConfigStorage.load();
      config.activeBookId = bookId;
      if (!config.books) config.books = [];
      adminConfigStorage.setFull(config);
      await initReaderFallback();
    }
  } finally {
    showBookWrap();
  }
}

/** Маршрут: /account → Личный кабинет */
export async function handleAccount() {
  if (!ctx.currentUser) {
    ctx.router.navigate('/', { replace: true });
    return;
  }

  const query = ctx.router.getCurrentRoute()?.query || new URLSearchParams(location.search);
  const tab = query.get('tab') || 'books';
  const editBookId = query.get('edit');
  const mode = query.get('mode');
  const create = query.get('create') === 'true';

  if (!ctx.state.accountScreen) {
    const { AccountScreen } = await import('../core/AccountScreen.js');
    ctx.state.accountScreen = new AccountScreen({ apiClient: ctx.apiClient, router: ctx.router, currentUser: ctx.currentUser });
    await ctx.state.accountScreen.init();
  }

  await screenTransition('to-account', () => {
    cleanupReader(); cleanupLanding(); cleanupBookshelf();
    ctx.state.accountScreen.show(tab, { editBookId, mode, create });
  });
}

// ─── Инициализация ридера ───────────────────────────────────────────────────

async function initReaderWithMode(bookId, route) {
  let readerMode = 'guest';
  let config;
  let bookOwner = null;
  let progress = null;

  if (route === 'embed') {
    readerMode = 'embed';
    try {
      const result = await loadPublicConfigFromAPI(ctx.apiClient, bookId);
      config = result.config;
      bookOwner = result.owner;
    } catch (err) {
      console.error('Ошибка загрузки книги (embed):', err);
      return;
    }
  } else if (ctx.currentUser) {
    try {
      config = await loadConfigFromAPI(ctx.apiClient, bookId);
      readerMode = 'owner';
      progress = await ctx.apiClient.getProgress(bookId).catch(() => null);
    } catch (err) {
      if (err.status === 403 || err.status === 404) {
        try {
          const result = await loadPublicConfigFromAPI(ctx.apiClient, bookId);
          config = result.config;
          bookOwner = result.owner;
          readerMode = 'guest';
          progress = await ctx.apiClient.getProgress(bookId).catch(() => null);
        } catch (pubErr) {
          console.error('Ошибка загрузки публичной книги:', pubErr);
          ctx.router.navigate('/', { replace: true });
          return;
        }
      } else {
        console.error('Ошибка загрузки книги:', err);
        ctx.router.navigate('/', { replace: true });
        return;
      }
    }
  } else {
    readerMode = 'guest';
    try {
      const result = await loadPublicConfigFromAPI(ctx.apiClient, bookId);
      config = result.config;
      bookOwner = result.owner;
    } catch (err) {
      console.error('Ошибка загрузки публичной книги:', err);
      ctx.router.navigate('/', { replace: true });
      return;
    }
  }

  if (readerMode === 'embed') {
    config = { ...config, DEFAULT_SETTINGS: { ...config.DEFAULT_SETTINGS, soundEnabled: false } };
  }

  setConfig(config);

  ctx.state.app = new BookController(config, {
    apiClient: readerMode === 'embed' ? null : ctx.apiClient,
    bookId, serverProgress: progress, readerMode, bookOwner,
  });
  await ctx.state.app.init();

  const bookEl = document.querySelector('.book');
  if (bookEl && readerMode !== 'embed') photoLightbox.attach(bookEl);
  if (readerMode !== 'embed') setupInstallButton();

  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    window.bookApp = ctx.state.app;
  }
}

async function initReaderFallback() {
  // Пересоздаём конфиг из localStorage, чтобы подхватить изменения из админки
  const freshConfig = createConfig(loadAdminConfig());
  setConfig(freshConfig);

  const enriched = await enrichConfigFromIDB(freshConfig);
  if (enriched !== freshConfig) setConfig(enriched);

  ctx.state.app = new BookController();
  await ctx.state.app.init();

  const bookEl = document.querySelector('.book');
  if (bookEl) photoLightbox.attach(bookEl);
  setupInstallButton();

  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    window.bookApp = ctx.state.app;
  }
}

/**
 * Экспортировать cleanup-функции для использования в index.js.
 */
export { cleanupReader, cleanupBookshelf, cleanupLanding, hideAccount };
