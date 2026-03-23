/**
 * ACCOUNT SCREEN
 *
 * Личный кабинет (/account) — единый SPA-экран, заменяющий admin.html.
 * Оборачивает AdminApp-логику: 4 вкладки (Книги, Профиль, Настройки, Экспорт).
 *
 * Инициализация:
 *   const { AccountScreen } = await import('./core/AccountScreen.js');
 *   const screen = new AccountScreen({ apiClient, router, currentUser });
 *   await screen.init();
 *   screen.show(tab, { editBookId });
 *
 * Вкладки:
 *   1. Книги       — полный функционал из admin (BookUploadManager, editor tabs)
 *   2. Профиль     — username, displayName, bio, аватар
 *   3. Настройки   — Platform Settings (видимость, шрифты, лимиты)
 *   4. Экспорт     — Config export/import
 */

import { t } from '@i18n';
import { ThemeToggle } from '../utils/ThemeToggle.js';
import { ServerAdminConfigStore } from '../admin/ServerAdminConfigStore.js';
import { AdminConfigStore } from '../admin/AdminConfigStore.js';
import { ChaptersModule } from '../admin/modules/ChaptersModule.js';
import { SettingsModule } from '../admin/modules/SettingsModule.js';
import { SoundsModule } from '../admin/modules/SoundsModule.js';
import { AmbientsModule } from '../admin/modules/AmbientsModule.js';
import { AppearanceModule } from '../admin/modules/AppearanceModule.js';
import { FontsModule } from '../admin/modules/FontsModule.js';
import { ExportModule } from '../admin/modules/ExportModule.js';
import { renderModeCards } from '../admin/modeCardsData.js';
import { AccountPublishTab } from './AccountPublishTab.js';
import {
  cacheUIElements, showToast, showSaveIndicator, showSaveError, confirm,
} from './AccountScreenUI.js';

// Динамический импорт CSS админки
import('../../css/admin/index.css');

export class AccountScreen {
  /**
   * @param {Object} options
   * @param {import('../utils/ApiClient.js').ApiClient} options.apiClient
   * @param {import('../utils/Router.js').Router} options.router
   * @param {Object} options.currentUser - Текущий авторизованный пользователь
   */
  constructor({ apiClient, router, currentUser }) {
    this._api = apiClient;
    this._router = router;
    this._currentUser = currentUser;
    this._store = null;
    this._initialized = false;

    // Модули (инициализируются в init)
    this.chapters = null;
    this.settings = null;
    this.sounds = null;
    this.ambients = null;
    this.appearance = null;
    this.fonts = null;
    this.export = null;
    this._profile = null;
    this._modules = [];

    // Таймеры (мутируемые ref-объекты для AccountScreenUI)
    this._toastTimerRef = { timer: null };
    this._saveTimerRef = { timer: null };
    /** ID книги, созданной через «Создать вручную» (ещё не подтверждённой) */
    this._pendingBookId = null;

    // DOM-контейнер
    this.container = document.getElementById('account-screen');
    this._themeToggle = null;
  }

  /**
   * Инициализировать: создать store, модули, привязать события.
   */
  async init() {
    if (this._initialized) return;
    this._initialized = true;

    // Создать store
    if (this._api) {
      try {
        this._store = await ServerAdminConfigStore.create(this._api);
      } catch (err) {
        console.warn('[AccountScreen] Server store unavailable, falling back to local:', err);
      }
    }
    if (!this._store) {
      this._store = await AdminConfigStore.create();
    }

    // Expose store для модулей (совместимость с BaseModule через app.store)
    this.store = this._store;

    // Подписка на сохранения store
    this.store.onSave = () => showSaveIndicator(this.container, this._ui, this._saveTimerRef);
    if (this.store.onError !== undefined) {
      this.store.onError = (message) => {
        this._showToast(message, 'error');
        showSaveError(this._ui, this._saveTimerRef);
      };
    }

    // Инициализация модулей (порядок важен — модули ожидают app с store)
    this.chapters = new ChaptersModule(this);
    this.settings = new SettingsModule(this);
    this.sounds = new SoundsModule(this);
    this.ambients = new AmbientsModule(this);
    this.appearance = new AppearanceModule(this);
    this.fonts = new FontsModule(this);
    this.export = new ExportModule(this);

    this._modules = [
      this.chapters, this.settings, this.sounds,
      this.ambients, this.appearance, this.fonts, this.export,
    ];

    // Динамический импорт ProfileModule
    const { ProfileModule } = await import('../admin/modules/ProfileModule.js');
    this._profile = new ProfileModule(this);

    this._cacheDOM();
    this._bindEvents();

    // Переключатель темы
    const themeSlot = this.container.querySelector('#account-theme-toggle');
    if (themeSlot && !this._themeToggle) {
      this._themeToggle = new ThemeToggle({ className: 'theme-toggle--admin' });
      themeSlot.appendChild(this._themeToggle.element);
    }

    // Вкладка публикации (выделена в отдельный модуль)
    this._publishTab = new AccountPublishTab({
      container: this.container,
      apiClient: this._api,
      store: this._store,
      showToast: (msg, type) => this._showToast(msg, type),
      currentUser: this._currentUser,
    });
    this._publishTab.bindEvents();

    await this._render();
  }

  /**
   * Показать экран кабинета.
   * @param {string} [tab='books'] - Вкладка для открытия
   * @param {Object} [options]
   * @param {string} [options.editBookId] - Если задан, открыть редактор этой книги
   * @param {string} [options.mode] - Режим (book/album)
   * @param {boolean} [options.create] - Если true, открыть выбор типа
   */
  async show(tab = 'books', { editBookId, mode, create } = {}) {
    this.container.hidden = false;
    document.body.dataset.screen = 'account';

    this._switchTab(tab);

    if (editBookId) {
      this.store.setActiveBook(editBookId);
      await this._render();
      await this.openEditor();
    } else if (mode) {
      this._switchTab('books');
      this._handleModeSelect(mode);
    } else if (create) {
      this._switchTab('books');
      this._showView('type-selector');
    }
  }

  /**
   * Скрыть экран.
   */
  hide() {
    this.container.hidden = true;
  }

  /**
   * Очистка.
   */
  destroy() {
    if (this._profile) {
      this._profile.destroy();
      this._profile = null;
    }
    if (this._themeToggle) {
      this._themeToggle.destroy();
      this._themeToggle = null;
    }
    this._removeListeners();
    this._initialized = false;
    this._store = null;
    this.store = null;
    this._modules = [];
  }

  // ═══════════════════════════════════════════
  // DOM
  // ═══════════════════════════════════════════

  _cacheDOM() {
    const c = this.container;

    // Табы верхнего уровня
    this.tabs = c.querySelectorAll('.admin-tab');
    this.panels = c.querySelectorAll('.admin-panel');

    // Экраны (вью) внутри таба «Мои книги»
    this.screenViews = c.querySelectorAll('.screen-view');

    // Табы редактора книги
    this.editorTabsWrapper = c.querySelector('#editorTabsWrapper');
    this.editorTabsContainer = c.querySelector('#editorTabs');
    this.editorTabs = c.querySelectorAll('.editor-tab');
    this.editorPanels = c.querySelectorAll('.editor-panel');
    this.editorTitle = c.querySelector('#editorTitle');

    // Кнопки навигации
    this.addBookBtn = c.querySelector('#addBookBtn');
    this.typeSelectorBack = c.querySelector('#typeSelectorBack');
    this.createBookBack = c.querySelector('#createBookBack');
    this.editorBack = c.querySelector('#editorBack');
    this.createEmptyBookBtn = c.querySelector('#createEmptyBookBtn');

    // Карточки режимов
    this.modeCardsContainer = c.querySelector('#modeCards');
    renderModeCards(this.modeCardsContainer);

    // UI-элементы (toast, save indicator, confirm dialog)
    this._ui = cacheUIElements(c);

    // DOM для модулей
    this._modules.forEach(m => m.cacheDOM());

    // Profile module
    if (this._profile) this._profile.cacheDOM();
  }

  // ═══════════════════════════════════════════
  // Привязка событий
  // ═══════════════════════════════════════════

  _bindEvents() {
    // Сохраняем bound-функции для cleanup
    this._boundHandlers = {};

    // Табы верхнего уровня
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => this._switchTab(tab.dataset.tab));
    });

    // Навигация по экранам
    this.addBookBtn.addEventListener('click', () => this._showView('type-selector'));
    this.typeSelectorBack.addEventListener('click', () => this._showView('bookshelf'));
    this.createBookBack.addEventListener('click', () => this._showView('type-selector'));
    this.editorBack.addEventListener('click', async () => {
      await this._cleanupPendingBook();
      this._showView('bookshelf');
    });
    // Карточки выбора типа
    this.modeCardsContainer.addEventListener('click', (e) => {
      const card = e.target.closest('.mode-card');
      if (card) this._handleModeSelect(card.dataset.mode);
    });

    // Кнопка «Создать пустую книгу»
    this.createEmptyBookBtn.addEventListener('click', () => this._createEmptyBook());

    // Табы редактора
    this.editorTabs.forEach(tab => {
      tab.addEventListener('click', () => this._switchEditorTab(tab.dataset.editorTab));
    });

    // Индикация скролла для editor-tabs
    this._updateTabsScroll();
    this._boundHandlers.editorScroll = () => this._updateTabsScroll();
    this._boundHandlers.resize = () => this._updateTabsScroll();
    this.editorTabsContainer.addEventListener('scroll', this._boundHandlers.editorScroll);
    window.addEventListener('resize', this._boundHandlers.resize);

    // Кнопка «На полку» (data-route обрабатывается роутером)
    const toShelfLink = this.container.querySelector('#accountToShelf');
    if (toShelfLink) {
      toShelfLink.addEventListener('click', async (e) => {
        e.preventDefault();
        await this._cleanupPendingBook();
        if (this._router) {
          this._router.navigate('/');
        }
      });
    }

    // События модулей
    this._modules.forEach(m => m.bindEvents());

    // Profile module
    if (this._profile) this._profile.bindEvents();
  }

  _removeListeners() {
    if (this._boundHandlers) {
      if (this._boundHandlers.editorScroll && this.editorTabsContainer) {
        this.editorTabsContainer.removeEventListener('scroll', this._boundHandlers.editorScroll);
      }
      if (this._boundHandlers.resize) {
        window.removeEventListener('resize', this._boundHandlers.resize);
      }
    }
  }

  // ═══════════════════════════════════════════
  // Рендер
  // ═══════════════════════════════════════════

  async _render() {
    for (const m of this._modules) {
      await m.render();
    }
    if (this._profile) await this._profile.render();
  }

  _renderJsonPreview() {
    this.export.renderJsonPreview();
  }

  // ═══════════════════════════════════════════
  // Табы верхнего уровня
  // ═══════════════════════════════════════════

  _switchTab(tabName) {
    this.tabs.forEach(t => {
      const isActive = t.dataset.tab === tabName;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive);
    });

    this.panels.forEach(p => {
      const isActive = p.dataset.panel === tabName;
      p.classList.toggle('active', isActive);
      p.hidden = !isActive;
    });

    if (tabName === 'export') {
      this._renderJsonPreview();
    }

    if (tabName === 'profile' && this._profile) {
      this._profile.render();
    }
  }

  // ═══════════════════════════════════════════
  // Навигация по экранам (вью)
  // ═══════════════════════════════════════════

  _showView(viewName) {
    this.screenViews.forEach(v => {
      const isActive = v.dataset.view === viewName;
      v.classList.toggle('active', isActive);
      v.hidden = !isActive;
    });
  }

  async _handleModeSelect(mode) {
    switch (mode) {
      case 'book':
        this._showView('create-book');
        break;
      case 'edit': {
        await this._render();
        await this.openEditor();
        break;
      }
      case 'album': {
        this.store.setPendingBook({
          type: 'album',
          cover: { title: t('admin.albumBook'), author: '', bg: '', bgMobile: '' },
        });
        this._pendingBookId = true;
        await this._render();
        await this.openEditor();
        this._switchEditorTab('chapters');
        break;
      }
    }
  }

  /** Создать пустую книгу и открыть редактор */
  async _createEmptyBook() {
    this.store.setPendingBook({
      cover: { title: t('admin.newBook'), author: '', bg: '', bgMobile: '' },
    });
    this._pendingBookId = true;
    await this._render();
    await this.openEditor();
  }

  /** Открыть редактор для текущей активной книги */
  async openEditor() {
    const cover = await this.store.getCover();
    this.editorTitle.textContent = cover.title || t('admin.bookEditor');

    // Динамически переименовать таб «Главы» → «Разделы» для альбомов
    const isAlbum = this.store.getBookType?.() === 'album';
    const chaptersTab = this.container.querySelector('[data-editor-tab="chapters"]');
    if (chaptersTab) {
      chaptersTab.textContent = isAlbum ? t('admin.editor.sections') : t('admin.editor.chapters');
    }

    // Обновить UI кнопок для альбомного режима (скрыть «Фотоальбом», переименовать кнопки)
    if (this.chapters?._updateAlbumModeUI) {
      this.chapters._updateAlbumModeUI();
    }

    this._switchEditorTab('cover');
    this._showView('editor');
  }

  // ═══════════════════════════════════════════
  // Табы редактора
  // ═══════════════════════════════════════════

  _switchEditorTab(tabName) {
    this.editorTabs.forEach(t => {
      const isActive = t.dataset.editorTab === tabName;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive);
    });
    this.editorPanels.forEach(p => {
      const isActive = p.dataset.editorPanel === tabName;
      p.classList.toggle('active', isActive);
      p.hidden = !isActive;
    });

    // При переходе на вкладку публикации — подгрузить данные
    if (tabName === 'publish' && this._publishTab) {
      this._publishTab.render();
    }
  }

  // ═══════════════════════════════════════════
  // Утилиты
  // ═══════════════════════════════════════════

  /** Обновить fade-маску скроллируемых editor-tabs */
  _updateTabsScroll() {
    const el = this.editorTabsContainer;
    if (!el) return;
    const hasScroll = el.scrollWidth > el.clientWidth + 1;
    const scrolledEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    this.editorTabsWrapper.classList.toggle('has-scroll', hasScroll);
    this.editorTabsWrapper.classList.toggle('scrolled-end', scrolledEnd);
  }

  /**
   * Отменить создание книги, если пользователь не сохранил ни одной вкладки.
   * Если книга уже была создана на сервере (пользователь что-то сохранил) — оставляем.
   */
  async _cleanupPendingBook() {
    if (!this._pendingBookId) return;
    this._pendingBookId = null;

    if (this.store.isPendingBook?.()) {
      this.store.discardPendingBook();
      await this._render();
    }
  }

  /** @param {string} message @param {Object} [opts] @returns {Promise<boolean>} */
  _confirm(message, opts) {
    return confirm(this._ui, message, opts);
  }

  /** @param {string} message @param {'success'|'error'|'warning'} [type] */
  _showToast(message, type) {
    showToast(this._ui, message, type, this._toastTimerRef);
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
