/**
 * INTEGRATION TEST: AccountScreen Tabs
 * Переключение вкладок с несохранёнными изменениями:
 * - Переключение между верхними вкладками (books, profile, settings, export)
 * - Переключение editor-вкладок (cover, chapters, sounds, etc.)
 * - Pending book cleanup при навигации «Назад»
 * - Pending book discard при переходе на полку
 * - Сохранённая книга не удаляется при навигации
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupIntegrationDOM } from '../../helpers/integrationUtils.js';
import { flushPromises } from '../../helpers/testUtils.js';
import { AccountScreen } from '../../../js/core/AccountScreen.js';

// Mock i18n
vi.mock('@i18n', () => ({
  t: (key) => key,
}));

// Mock CSS import
vi.mock('../../../css/admin/index.css', () => ({}));

// Mock ThemeToggle
vi.mock('../../../js/utils/ThemeToggle.js', () => ({
  ThemeToggle: class {
    constructor() { this.element = document.createElement('div'); }
    destroy() {}
  },
}));

// Mock модули (все модули — заглушки, проверяем только координацию вкладок)
vi.mock('../../../js/admin/ServerAdminConfigStore.js', () => ({
  ServerAdminConfigStore: {
    create: vi.fn().mockResolvedValue({
      onSave: null,
      onError: undefined,
      getCover: vi.fn().mockResolvedValue({ title: 'Test Book' }),
      getBookType: vi.fn().mockReturnValue('book'),
      setActiveBook: vi.fn(),
      setPendingBook: vi.fn(),
      isPendingBook: vi.fn().mockReturnValue(false),
      discardPendingBook: vi.fn(),
    }),
  },
}));

vi.mock('../../../js/admin/AdminConfigStore.js', () => ({
  AdminConfigStore: { create: vi.fn() },
}));

function createModuleClass() {
  return class {
    constructor() {
      this.cacheDOM = vi.fn();
      this.bindEvents = vi.fn();
      this.render = vi.fn().mockResolvedValue();
    }
  };
}

vi.mock('../../../js/admin/modules/ChaptersModule.js', () => ({
  ChaptersModule: createModuleClass(),
}));
vi.mock('../../../js/admin/modules/SettingsModule.js', () => ({
  SettingsModule: createModuleClass(),
}));
vi.mock('../../../js/admin/modules/SoundsModule.js', () => ({
  SoundsModule: createModuleClass(),
}));
vi.mock('../../../js/admin/modules/AmbientsModule.js', () => ({
  AmbientsModule: createModuleClass(),
}));
vi.mock('../../../js/admin/modules/AppearanceModule.js', () => ({
  AppearanceModule: createModuleClass(),
}));
vi.mock('../../../js/admin/modules/FontsModule.js', () => ({
  FontsModule: createModuleClass(),
}));
vi.mock('../../../js/admin/modules/ExportModule.js', () => {
  const Cls = createModuleClass();
  const Original = Cls;
  return {
    ExportModule: class extends Original {
      constructor(...args) {
        super(...args);
        this.renderJsonPreview = vi.fn();
      }
    },
  };
});
vi.mock('../../../js/admin/modules/ProfileModule.js', () => ({
  ProfileModule: class {
    constructor() {
      this.cacheDOM = vi.fn();
      this.bindEvents = vi.fn();
      this.render = vi.fn().mockResolvedValue();
      this.destroy = vi.fn();
    }
  },
}));
vi.mock('../../../js/admin/modeCardsData.js', () => ({
  renderModeCards: vi.fn(),
}));
vi.mock('../../../js/core/AccountPublishTab.js', () => ({
  AccountPublishTab: vi.fn(function () {
    this.bindEvents = vi.fn();
    this.render = vi.fn();
  }),
}));
vi.mock('../../../js/core/AccountScreenUI.js', () => ({
  cacheUIElements: vi.fn(() => ({
    toast: document.createElement('div'),
    toastMessage: document.createElement('span'),
    toastIconPath: document.createElementNS('http://www.w3.org/2000/svg', 'path'),
    saveIndicator: document.createElement('div'),
    saveIndicatorText: document.createElement('span'),
    confirmDialog: Object.assign(document.createElement('dialog'), {
      showModal: vi.fn(), close: vi.fn(),
    }),
    confirmTitle: document.createElement('span'),
    confirmMessage: document.createElement('span'),
    confirmOk: document.createElement('button'),
    confirmCancel: document.createElement('button'),
  })),
  showToast: vi.fn(),
  showSaveIndicator: vi.fn(),
  showSaveError: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
}));

/**
 * Создать DOM-структуру экрана AccountScreen
 */
function createAccountDOM() {
  document.body.innerHTML = '';

  const container = document.createElement('div');
  container.id = 'account-screen';
  container.hidden = true;

  // Верхние вкладки
  const tabNames = ['books', 'profile', 'settings', 'export'];
  tabNames.forEach((name) => {
    const tab = document.createElement('button');
    tab.className = 'admin-tab';
    tab.dataset.tab = name;
    tab.setAttribute('aria-selected', 'false');
    container.appendChild(tab);
  });

  // Панели
  tabNames.forEach((name) => {
    const panel = document.createElement('div');
    panel.className = 'admin-panel';
    panel.dataset.panel = name;
    panel.hidden = true;
    container.appendChild(panel);
  });

  // Screen views (внутри вкладки books)
  ['bookshelf', 'type-selector', 'create-book', 'editor'].forEach((name) => {
    const view = document.createElement('div');
    view.className = 'screen-view';
    view.dataset.view = name;
    view.hidden = name !== 'bookshelf';
    if (name === 'bookshelf') view.classList.add('active');
    container.appendChild(view);
  });

  // Кнопки навигации
  const ids = ['addBookBtn', 'typeSelectorBack', 'createBookBack', 'editorBack', 'createEmptyBookBtn'];
  ids.forEach((id) => {
    const btn = document.createElement('button');
    btn.id = id;
    container.appendChild(btn);
  });

  // Карточки режимов
  const modeCards = document.createElement('div');
  modeCards.id = 'modeCards';
  container.appendChild(modeCards);

  // Editor tabs wrapper + container + tabs
  const editorTabsWrapper = document.createElement('div');
  editorTabsWrapper.id = 'editorTabsWrapper';
  const editorTabsContainer = document.createElement('div');
  editorTabsContainer.id = 'editorTabs';

  const editorTabNames = ['cover', 'chapters', 'appearance', 'sounds', 'ambients', 'fonts', 'defaults', 'publish'];
  editorTabNames.forEach((name) => {
    const tab = document.createElement('button');
    tab.className = 'editor-tab';
    tab.dataset.editorTab = name;
    tab.setAttribute('aria-selected', 'false');
    editorTabsContainer.appendChild(tab);
  });
  editorTabsWrapper.appendChild(editorTabsContainer);
  container.appendChild(editorTabsWrapper);

  // Editor panels
  editorTabNames.forEach((name) => {
    const panel = document.createElement('div');
    panel.className = 'editor-panel';
    panel.dataset.editorPanel = name;
    panel.hidden = true;
    container.appendChild(panel);
  });

  // Editor title
  const editorTitle = document.createElement('h2');
  editorTitle.id = 'editorTitle';
  container.appendChild(editorTitle);

  // To shelf link
  const toShelf = document.createElement('a');
  toShelf.id = 'accountToShelf';
  container.appendChild(toShelf);

  // Theme toggle slot
  const themeSlot = document.createElement('div');
  themeSlot.id = 'account-theme-toggle';
  container.appendChild(themeSlot);

  document.body.appendChild(container);
  return container;
}

describe('AccountScreen Tabs', () => {
  let screen;
  let mockRouter;
  let mockApiClient;

  beforeEach(async () => {
    createAccountDOM();

    mockRouter = { navigate: vi.fn() };
    mockApiClient = { getProfile: vi.fn().mockResolvedValue(null) };

    screen = new AccountScreen({
      apiClient: mockApiClient,
      router: mockRouter,
      currentUser: { id: '1', username: 'testuser' },
    });

    await screen.init();
  });

  afterEach(() => {
    screen?.destroy();
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // ПЕРЕКЛЮЧЕНИЕ ВЕРХНИХ ВКЛАДОК
  // ═══════════════════════════════════════════

  describe('Top-level tab switching', () => {
    it('should activate clicked tab and show corresponding panel', async () => {
      await screen.show('books');

      const profileTab = screen.container.querySelector('[data-tab="profile"]');
      profileTab.click();
      await flushPromises();

      expect(profileTab.classList.contains('active')).toBe(true);
      expect(profileTab.getAttribute('aria-selected')).toBe('true');

      const profilePanel = screen.container.querySelector('[data-panel="profile"]');
      expect(profilePanel.hidden).toBe(false);
      expect(profilePanel.classList.contains('active')).toBe(true);

      // Предыдущая вкладка деактивирована
      const booksTab = screen.container.querySelector('[data-tab="books"]');
      expect(booksTab.classList.contains('active')).toBe(false);
      expect(booksTab.getAttribute('aria-selected')).toBe('false');

      const booksPanel = screen.container.querySelector('[data-panel="books"]');
      expect(booksPanel.hidden).toBe(true);
    });

    it('should deactivate all other tabs when switching', async () => {
      await screen.show('books');

      // Переключаемся на каждую вкладку
      const tabNames = ['profile', 'settings', 'export', 'books'];

      for (const name of tabNames) {
        const tab = screen.container.querySelector(`[data-tab="${name}"]`);
        tab.click();
        await flushPromises();

        const activeTabs = screen.container.querySelectorAll('.admin-tab.active');
        expect(activeTabs).toHaveLength(1);
        expect(activeTabs[0].dataset.tab).toBe(name);

        const visiblePanels = screen.container.querySelectorAll('.admin-panel:not([hidden])');
        expect(visiblePanels).toHaveLength(1);
        expect(visiblePanels[0].dataset.panel).toBe(name);
      }
    });

    it('should render JSON preview when switching to export tab', async () => {
      await screen.show('books');

      const exportTab = screen.container.querySelector('[data-tab="export"]');
      exportTab.click();
      await flushPromises();

      expect(screen.export.renderJsonPreview).toHaveBeenCalled();
    });

    it('should re-render profile when switching to profile tab', async () => {
      await screen.show('books');

      screen._profile.render.mockClear();

      const profileTab = screen.container.querySelector('[data-tab="profile"]');
      profileTab.click();
      await flushPromises();

      expect(screen._profile.render).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // PENDING BOOK CLEANUP
  // ═══════════════════════════════════════════

  describe('Pending book cleanup on navigation', () => {
    it('should discard pending book when clicking editor back button', async () => {
      // Создать pending book
      screen._pendingBookId = true;
      screen.store.isPendingBook.mockReturnValue(true);

      const editorBack = screen.container.querySelector('#editorBack');
      editorBack.click();
      await flushPromises();

      expect(screen.store.discardPendingBook).toHaveBeenCalled();
      expect(screen._pendingBookId).toBeNull();
    });

    it('should NOT discard book that was already saved to server', async () => {
      // pending book создан, но isPendingBook → false (уже сохранён на сервер)
      screen._pendingBookId = true;
      screen.store.isPendingBook.mockReturnValue(false);

      const editorBack = screen.container.querySelector('#editorBack');
      editorBack.click();
      await flushPromises();

      expect(screen.store.discardPendingBook).not.toHaveBeenCalled();
    });

    it('should discard pending book when navigating to shelf', async () => {
      screen._pendingBookId = true;
      screen.store.isPendingBook.mockReturnValue(true);

      const toShelf = screen.container.querySelector('#accountToShelf');
      toShelf.click();
      await flushPromises();

      expect(screen.store.discardPendingBook).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith('/');
    });

    it('should NOT cleanup when no pending book exists', async () => {
      screen._pendingBookId = null;

      const editorBack = screen.container.querySelector('#editorBack');
      editorBack.click();
      await flushPromises();

      expect(screen.store.discardPendingBook).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // EDITOR TAB SWITCHING
  // ═══════════════════════════════════════════

  describe('Editor tab switching', () => {
    it('should switch editor tabs within the editor view', async () => {
      await screen.show('books');

      const chaptersTab = screen.container.querySelector('[data-editor-tab="chapters"]');
      chaptersTab.click();
      await flushPromises();

      expect(chaptersTab.classList.contains('active')).toBe(true);
      expect(chaptersTab.getAttribute('aria-selected')).toBe('true');

      const chaptersPanel = screen.container.querySelector('[data-editor-panel="chapters"]');
      expect(chaptersPanel.hidden).toBe(false);

      // Cover tab деактивирован
      const coverTab = screen.container.querySelector('[data-editor-tab="cover"]');
      expect(coverTab.classList.contains('active')).toBe(false);
    });

    it('should render publish tab data when switching to publish', async () => {
      await screen.show('books');

      const publishTab = screen.container.querySelector('[data-editor-tab="publish"]');
      publishTab.click();
      await flushPromises();

      expect(screen._publishTab.render).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // VIEW SWITCHING
  // ═══════════════════════════════════════════

  describe('View switching', () => {
    it('should show type-selector when clicking add book', async () => {
      await screen.show('books');

      const addBtn = screen.container.querySelector('#addBookBtn');
      addBtn.click();
      await flushPromises();

      const typeSelectorView = screen.container.querySelector('[data-view="type-selector"]');
      expect(typeSelectorView.hidden).toBe(false);
      expect(typeSelectorView.classList.contains('active')).toBe(true);

      const bookshelfView = screen.container.querySelector('[data-view="bookshelf"]');
      expect(bookshelfView.hidden).toBe(true);
    });

    it('should return to bookshelf from type-selector', async () => {
      await screen.show('books');

      // Перешли на type-selector
      screen.container.querySelector('#addBookBtn').click();
      await flushPromises();

      // Вернулись
      screen.container.querySelector('#typeSelectorBack').click();
      await flushPromises();

      const bookshelfView = screen.container.querySelector('[data-view="bookshelf"]');
      expect(bookshelfView.hidden).toBe(false);
      expect(bookshelfView.classList.contains('active')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // DESTROY
  // ═══════════════════════════════════════════

  describe('Destroy', () => {
    it('should cleanup all resources on destroy', () => {
      screen.destroy();

      // store — публичное свойство, должно стать null
      expect(screen.store).toBeNull();
      // Повторный destroy не должен бросать ошибку (проверяет корректность очистки)
      expect(() => screen.destroy()).not.toThrow();
    });

    it('should not throw on double destroy', () => {
      screen.destroy();
      expect(() => screen.destroy()).not.toThrow();
    });
  });
});
