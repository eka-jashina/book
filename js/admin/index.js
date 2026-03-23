/**
 * Точка входа админ-панели
 * Роутер экранов + инициализация модулей
 *
 * Фаза 3: при доступности сервера использует ServerAdminConfigStore (API),
 * иначе — AdminConfigStore (localStorage/IndexedDB).
 */
import { AdminConfigStore } from './AdminConfigStore.js';
import { ServerAdminConfigStore } from './ServerAdminConfigStore.js';
import { ApiClient } from '../utils/ApiClient.js';
import { AuthModal } from '../core/AuthModal.js';
import { ChaptersModule } from './modules/ChaptersModule.js';
import { SettingsModule } from './modules/SettingsModule.js';
import { SoundsModule } from './modules/SoundsModule.js';
import { AmbientsModule } from './modules/AmbientsModule.js';
import { AppearanceModule } from './modules/AppearanceModule.js';
import { FontsModule } from './modules/FontsModule.js';
import { ExportModule } from './modules/ExportModule.js';
import { renderModeCards } from './modeCardsData.js';

class AdminApp {
  constructor(store) {
    this.store = store;
    this._toastTimer = null;
    this._saveIndicatorTimer = null;
    /** ID книги, созданной через «Создать вручную» (ещё не подтверждённой) */
    this._pendingBookId = null;

    // Инициализация модулей
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

    this._cacheDOM();
    this._bindEvents();
    this._render();
    this._handleUrlMode();

    // Подписка на сохранения store для показа индикатора
    this.store.onSave = () => this._showSaveIndicator();

    // Подписка на ошибки store (Фаза 4)
    if (this.store.onError !== undefined) {
      this.store.onError = (message) => {
        this._showToast(message, 'error');
        this._showSaveError();
      };
    }
  }

  // --- DOM ---

  _cacheDOM() {
    // Табы верхнего уровня
    this.tabs = document.querySelectorAll('.admin-tab');
    this.panels = document.querySelectorAll('.admin-panel');

    // Экраны (вью) внутри таба «Мои книги»
    this.screenViews = document.querySelectorAll('.screen-view');

    // Табы редактора книги
    this.editorTabsWrapper = document.getElementById('editorTabsWrapper');
    this.editorTabsContainer = document.getElementById('editorTabs');
    this.editorTabs = document.querySelectorAll('.editor-tab');
    this.editorPanels = document.querySelectorAll('.editor-panel');
    this.editorTitle = document.getElementById('editorTitle');

    // Кнопки навигации между экранами
    this.addBookBtn = document.getElementById('addBookBtn');
    this.typeSelectorBack = document.getElementById('typeSelectorBack');
    this.createBookBack = document.getElementById('createBookBack');
    this.editorBack = document.getElementById('editorBack');
    this.createEmptyBookBtn = document.getElementById('createEmptyBookBtn');
    this.toShelfLink = document.getElementById('toShelfLink');

    // Контейнер карточек режимов (карточки генерируются динамически)
    this.modeCardsContainer = document.getElementById('modeCards');
    renderModeCards(this.modeCardsContainer);

    // Toast
    this.toast = document.getElementById('toast');
    this.toastMessage = document.getElementById('toastMessage');
    this.toastIconPath = document.getElementById('toastIconPath');

    // Save indicator
    this.saveIndicator = document.getElementById('saveIndicator');
    this.saveIndicatorText = document.getElementById('saveIndicatorText');

    // Confirm dialog
    this.confirmDialog = document.getElementById('confirmDialog');
    this.confirmTitle = document.getElementById('confirmTitle');
    this.confirmMessage = document.getElementById('confirmMessage');
    this.confirmOk = document.getElementById('confirmOk');
    this.confirmCancel = document.getElementById('confirmCancel');

    // DOM для модулей
    this._modules.forEach(m => m.cacheDOM());
  }

  // --- Привязка событий ---

  _bindEvents() {
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
    // «На книжную полку» — очистить незавершённую книгу перед уходом
    this.toShelfLink.addEventListener('click', async (e) => {
      e.preventDefault();
      await this._cleanupPendingBook();
      window.location.href = this.toShelfLink.href;
    });

    // Карточки выбора типа (делегирование событий)
    this.modeCardsContainer.addEventListener('click', (e) => {
      const card = e.target.closest('.mode-card');
      if (card) this._handleModeSelect(card.dataset.mode);
    });

    // Кнопка «Создать пустую книгу»
    if (this.createEmptyBookBtn) {
      this.createEmptyBookBtn.addEventListener('click', () => this._createEmptyBook());
    }

    // Табы редактора
    this.editorTabs.forEach(tab => {
      tab.addEventListener('click', () => this._switchEditorTab(tab.dataset.editorTab));
    });

    // Индикация горизонтального скролла для editor-tabs
    this._updateTabsScroll();
    this.editorTabsContainer.addEventListener('scroll', () => this._updateTabsScroll());
    window.addEventListener('resize', () => this._updateTabsScroll());

    // События модулей
    this._modules.forEach(m => m.bindEvents());
  }

  // --- Рендер ---

  _render() {
    this._modules.forEach(m => m.render());
  }

  _renderJsonPreview() {
    this.export.renderJsonPreview();
  }

  // --- Обработка URL-параметра ?mode= ---

  _handleUrlMode() {
    const mode = sessionStorage.getItem('flipbook-admin-mode');
    if (!mode) return;

    // Удаляем сразу, чтобы при обновлении не повторялось
    sessionStorage.removeItem('flipbook-admin-mode');

    // Переключаемся на вкладку «Мои книги» и запускаем выбранный режим
    this._switchTab('books');
    this._handleModeSelect(mode);
  }

  // --- Табы верхнего уровня ---

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
  }

  // --- Навигация по экранам (вью) ---

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
        // Открыть редактор для указанной книги
        const editBookId = sessionStorage.getItem('flipbook-admin-edit-book');
        sessionStorage.removeItem('flipbook-admin-edit-book');
        if (editBookId) this.store.setActiveBook(editBookId);
        this._render();
        await this.openEditor();
        break;
      }
      case 'album': {
        this.store.setPendingBook({
          type: 'album',
          cover: { title: 'Фотоальбом', author: '', bg: '', bgMobile: '' },
        });
        this._pendingBookId = true;
        this._render();
        await this.openEditor();
        this._switchEditorTab('chapters');
        break;
      }
    }
  }

  /** Создать пустую книгу и открыть редактор */
  async _createEmptyBook() {
    this.store.setPendingBook({
      cover: { title: 'Новая книга', author: '', bg: '', bgMobile: '' },
    });
    this._pendingBookId = true;
    this._render();
    await this.openEditor();
  }

  /** Открыть редактор для текущей активной книги */
  async openEditor() {
    const cover = await this.store.getCover();
    this.editorTitle.textContent = cover.title || 'Редактор книги';

    // Динамически переименовать таб «Главы» → «Разделы» для альбомов
    const isAlbum = this.store.getBookType?.() === 'album';
    const chaptersTab = document.querySelector('[data-editor-tab="chapters"]');
    if (chaptersTab) {
      chaptersTab.textContent = isAlbum ? 'Разделы' : 'Главы';
    }

    this._switchEditorTab('cover');
    this._showView('editor');
  }

  // --- Табы редактора ---

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
  }

  // --- Утилиты ---

  /** Обновить fade-маску скроллируемых editor-tabs */
  _updateTabsScroll() {
    const el = this.editorTabsContainer;
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
      this._render();
    }
  }

  /**
   * Стилизованный диалог подтверждения (замена native confirm()).
   * @param {string} message — текст вопроса
   * @param {Object} [opts]
   * @param {string} [opts.title='Подтверждение'] — заголовок
   * @param {string} [opts.okText='Удалить'] — текст кнопки подтверждения
   * @returns {Promise<boolean>}
   */
  _confirm(message, { title = 'Подтверждение', okText = 'Удалить' } = {}) {
    this.confirmTitle.textContent = title;
    this.confirmMessage.textContent = message;
    this.confirmOk.textContent = okText;

    return new Promise((resolve) => {
      const cleanup = () => {
        this.confirmOk.removeEventListener('click', onOk);
        this.confirmCancel.removeEventListener('click', onCancel);
        this.confirmDialog.removeEventListener('close', onClose);
      };
      const onOk = () => { cleanup(); this.confirmDialog.close(); resolve(true); };
      const onCancel = () => { cleanup(); this.confirmDialog.close(); resolve(false); };
      const onClose = () => { cleanup(); resolve(false); };

      this.confirmOk.addEventListener('click', onOk);
      this.confirmCancel.addEventListener('click', onCancel);
      this.confirmDialog.addEventListener('close', onClose);

      this.confirmDialog.showModal();
    });
  }

  /** Показать индикатор «Сохранено» в заголовке редактора */
  _showSaveIndicator() {
    // Показываем только если открыт редактор
    const editorView = document.querySelector('.screen-view[data-view="editor"]');
    if (!editorView || !editorView.classList.contains('active')) return;

    this.saveIndicator.classList.remove('fade-out', 'save-indicator--error');
    this.saveIndicator.classList.add('visible');
    this.saveIndicatorText.textContent = 'Сохранено';
    this.saveIndicator.classList.add('save-indicator--saved');
    this.saveIndicator.classList.remove('save-indicator--saving');

    clearTimeout(this._saveIndicatorTimer);
    this._saveIndicatorTimer = setTimeout(() => {
      this.saveIndicator.classList.add('fade-out');
      setTimeout(() => {
        this.saveIndicator.classList.remove('visible', 'fade-out', 'save-indicator--saved');
      }, 500);
    }, 2000);
  }

  /** Показать ошибку сохранения в индикаторе */
  _showSaveError() {
    this.saveIndicator.classList.remove('fade-out', 'save-indicator--saved', 'save-indicator--saving');
    this.saveIndicator.classList.add('visible', 'save-indicator--error');
    this.saveIndicatorText.textContent = 'Ошибка сохранения';

    clearTimeout(this._saveIndicatorTimer);
    this._saveIndicatorTimer = setTimeout(() => {
      this.saveIndicator.classList.add('fade-out');
      setTimeout(() => {
        this.saveIndicator.classList.remove('visible', 'fade-out', 'save-indicator--error');
      }, 500);
    }, 4000);
  }

  /** SVG-пути иконок для типов toast */
  static TOAST_ICONS = {
    success: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
    error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
    warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  };

  /**
   * @param {string} message — текст уведомления
   * @param {'success'|'error'|'warning'} [type] — тип (определяет цвет и иконку)
   */
  _showToast(message, type) {
    this.toastMessage.textContent = message;
    this.toast.hidden = false;

    // Тип уведомления
    if (type && AdminApp.TOAST_ICONS[type]) {
      this.toast.dataset.type = type;
      this.toastIconPath.setAttribute('d', AdminApp.TOAST_ICONS[type]);
    } else {
      delete this.toast.dataset.type;
    }

    requestAnimationFrame(() => {
      this.toast.classList.add('visible');
    });

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toast.classList.remove('visible');
      setTimeout(() => { this.toast.hidden = true; }, 300);
    }, 2500);
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

/**
 * Инициализация: проверить сервер → авторизация → ServerAdminConfigStore,
 * или fallback → AdminConfigStore (localStorage/IndexedDB).
 */
async function initAdmin() {
  let store;

  try {
    // Проверить доступность сервера
    const resp = await fetch('/api/health', { method: 'GET' });
    if (resp.ok) {
      // Сервер доступен — используем API
      const apiClient = new ApiClient({
        onUnauthorized: () => {
          // При 401 — показать модалку и перезапустить после авторизации
          const authModal = new AuthModal({
            apiClient,
            onAuth: () => location.reload(),
          });
          authModal.show();
        },
      });

      // Проверить авторизацию
      const user = await apiClient.getMe();
      if (!user) {
        // Не авторизован — показать модалку
        await new Promise((resolve) => {
          const authModal = new AuthModal({
            apiClient,
            onAuth: () => resolve(),
          });
          authModal.show();
        });
      }

      store = await ServerAdminConfigStore.create(apiClient);
    }
  } catch (err) {
    console.debug('AdminApp: сервер недоступен, fallback на localStorage', err);
  }

  // Fallback: localStorage/IndexedDB
  if (!store) {
    store = await AdminConfigStore.create();
  }

  new AdminApp(store);
}

initAdmin();
