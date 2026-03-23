/**
 * MAIN ENTRY POINT
 *
 * Инициализация приложения после загрузки DOM.
 *
 * Роутинг (SPA, History API):
 *   /              → лендинг (гости) | redirect на /:username (авторизованные) | fallback (localStorage)
 *   /:username     → публичная полка автора (гость = витрина, хозяин = управление)
 *   /book/:bookId  → ридер (owner/guest режим)
 *   /embed/:bookId → встраиваемый ридер (минимальный UI)
 *   /account       → личный кабинет (книги, профиль, настройки, экспорт)
 *
 * Режимы ридера (Phase 6):
 *   owner  — авторизованный автор книги (полный доступ + кнопка «Редактировать»)
 *   guest  — все остальные (только чтение, имя автора + ссылка на полку)
 *   embed  — встраиваемый режим (минимальный UI, ссылка «Открыть на Flipbook»)
 *
 * Fallback: если сервер недоступен — работа через localStorage.
 *
 * Обработчики маршрутов вынесены в routes/handlers.js для уменьшения размера файла.
 */

import './sentry.js';
import { ApiClient } from './utils/ApiClient.js';
import { ErrorHandler } from './utils/ErrorHandler.js';
import { MigrationHelper } from './core/MigrationHelper.js';
import { Router } from './utils/Router.js';
import { registerSW } from 'virtual:pwa-register';
import { offlineIndicator } from './utils/OfflineIndicator.js';
import { installPrompt } from './utils/InstallPrompt.js';
import { initI18n, t, applyTranslations } from '@i18n';
import { StorageManager } from './utils/StorageManager.js';
import { initAnalytics, setAnalyticsApiClient } from './utils/Analytics.js';
import {
  initRouteHandlers,
  handleHome, handlePublicShelf, handleReader, handleEmbed, handleAccount, handleBookBySlug,
  cleanupReader, cleanupBookshelf, cleanupLanding,
} from './routes/handlers.js';

const languageStorage = new StorageManager('flipbook-language');

// Catch unhandled promise rejections globally so they don't vanish silently
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Глобальное состояние
const state = {
  app: null,
  bookshelf: null,
  landing: null,
  accountScreen: null,
  authModal: null,
};
let apiClient = null;
let router = null;
let currentUser = null;
let useAPI = false;

// Регистрация Service Worker для PWA
const updateSW = registerSW({
  onNeedRefresh() {
    const shouldUpdate = confirm(t('pwa.newVersion'));
    if (shouldUpdate) {
      updateSW(true);
    }
  },
  onOfflineReady() {},
  onRegisteredSW(_swUrl, _registration) {},
  onRegisterError(error) {
    console.error('Ошибка регистрации Service Worker:', error);
  },
});

// ═══════════════════════════════════════════════════
// Авторизация
// ═══════════════════════════════════════════════════

/**
 * Проверить аутентификацию (неблокирующая).
 * Возвращает user или null (гость).
 * @returns {Promise<Object|null>}
 */
async function checkAuth() {
  apiClient = new ApiClient({
    onUnauthorized: () => {
      // Сессия истекла — сбрасываем пользователя и переходим на лендинг
      currentUser = null;
      if (router) router.navigate('/', { replace: true });
    },
  });

  const user = await apiClient.getMe();

  if (user) {
    // Авторизован — проверить миграцию при первом логине
    const migration = new MigrationHelper(apiClient);
    await migration.checkAndMigrate();
  }

  return user;
}

// ═══════════════════════════════════════════════════
// Инициализация приложения
// ═══════════════════════════════════════════════════

/**
 * Миграция: если URL — корень, но в sessionStorage есть bookId от старого флоу —
 * редиректим на /book/:id для совместимости.
 */
function migrateSessionStorageToRouter() {
  const savedBookId = sessionStorage.getItem('flipbook-active-book-id');
  const isReadingSession = !!sessionStorage.getItem('flipbook-reading-session');

  if (savedBookId && isReadingSession) {
    // Очищаем старые флаги
    sessionStorage.removeItem('flipbook-active-book-id');
    sessionStorage.removeItem('flipbook-reading-session');
    return savedBookId;
  }
  return null;
}

async function init() {
  try {
    // Проверяем, доступен ли сервер
    try {
      const resp = await fetch('/api/health', { method: 'GET' });
      useAPI = resp.ok;
    } catch {
      console.debug('Health check failed — falling back to localStorage mode');
    }

    if (useAPI) {
      currentUser = await checkAuth();
    }

    // Инициализируем аналитику (Plausible + CWV + server sessions)
    initAnalytics();
    if (currentUser && apiClient) {
      setAnalyticsApiClient(apiClient);
    }

    // Инициализируем i18n: язык берём из localStorage (reader-settings) или 'auto'
    const savedLang = languageStorage.getRaw() || 'auto';
    await initI18n(savedLang);
    applyTranslations();

    // Инициализируем контекст для route handlers
    initRouteHandlers({
      state,
      apiClient,
      router: null, // будет установлен после создания роутера
      get currentUser() { return currentUser; },
      useAPI,
      setCurrentUser: (user) => { currentUser = user; },
    });

    // Создаём роутер (порядок важен: конкретные маршруты первыми, /:username — последний)
    router = new Router([
      { name: 'home', path: '/', handler: handleHome },
      { name: 'reader', path: '/book/:bookId', handler: handleReader },
      { name: 'embed', path: '/embed/:bookId', handler: handleEmbed },
      { name: 'account', path: '/account', handler: handleAccount },
      { name: 'bookBySlug', path: '/:username/:slug', handler: handleBookBySlug },
      { name: 'shelf', path: '/:username', handler: handlePublicShelf },
    ]);

    // Обновляем router в контексте handlers
    initRouteHandlers({
      state,
      apiClient,
      router,
      get currentUser() { return currentUser; },
      useAPI,
      setCurrentUser: (user) => { currentUser = user; },
    });

    // Миграция: старый sessionStorage-флоу → URL-based навигация
    const migratedBookId = migrateSessionStorageToRouter();
    if (migratedBookId && location.pathname === `/${(import.meta.env.BASE_URL || '').replace(/^\/|\/$/g, '')}`) {
      // Подменяем URL перед стартом роутера
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      history.replaceState(null, '', `${base}/book/${migratedBookId}`);
    }

    // Запуск роутера — резолвит текущий URL
    await router.start();
  } catch (error) {
    console.error('Failed to initialize Book Reader:', error);
    ErrorHandler.handle(error, t('error.initialization'));
  }
}

/**
 * Очистка при выгрузке страницы
 */
function cleanup() {
  if (router) {
    router.destroy();
    router = null;
  }
  if (state.authModal) {
    state.authModal.destroy();
    state.authModal = null;
  }
  cleanupLanding();
  cleanupBookshelf();
  cleanupReader();
  if (state.accountScreen) {
    state.accountScreen.destroy();
    state.accountScreen = null;
  }
  offlineIndicator.destroy();
  installPrompt.destroy();
}

// Запуск после загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Очистка при закрытии/переходе
window.addEventListener('beforeunload', cleanup);

// Реинициализация при восстановлении из bfcache
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    cleanup();
    init();
  }
});
