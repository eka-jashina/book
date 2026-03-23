/**
 * INTEGRATION TEST: Account Screen
 * Управление книгами, профилем, настройками, экспортом.
 * Переключение табов, навигация по вью, lifecycle создания книги.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupIntegrationDOM } from '../../helpers/integrationUtils.js';
import { flushPromises } from '../../helpers/testUtils.js';

// Mock тяжёлых зависимостей (CSS import, Quill, etc.)
vi.mock('../../../css/admin/index.css', () => ({}));

// vi.hoisted — доступно внутри vi.mock() factories (hoisted вместе с ними)
const { createModuleMock } = vi.hoisted(() => {
  const createModuleMock = () => ({
    cacheDOM: vi.fn(),
    bindEvents: vi.fn(),
    render: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  });
  return { createModuleMock };
});

// Mock-классы для admin-модулей (используем function, чтобы поддержать new)
vi.mock('../../../js/admin/modules/ChaptersModule.js', () => ({
  ChaptersModule: vi.fn(function () {
    Object.assign(this, createModuleMock());
    this._album = { cacheDOM: vi.fn(), bindEvents: vi.fn(), _addAlbumPage: vi.fn(), _bulkUpload: vi.fn(), albumPagesEl: null };
  }),
}));
vi.mock('../../../js/admin/modules/SettingsModule.js', () => ({
  SettingsModule: vi.fn(function () { Object.assign(this, createModuleMock()); }),
}));
vi.mock('../../../js/admin/modules/SoundsModule.js', () => ({
  SoundsModule: vi.fn(function () { Object.assign(this, createModuleMock()); }),
}));
vi.mock('../../../js/admin/modules/AmbientsModule.js', () => ({
  AmbientsModule: vi.fn(function () { Object.assign(this, createModuleMock()); }),
}));
vi.mock('../../../js/admin/modules/AppearanceModule.js', () => ({
  AppearanceModule: vi.fn(function () { Object.assign(this, createModuleMock()); }),
}));
vi.mock('../../../js/admin/modules/FontsModule.js', () => ({
  FontsModule: vi.fn(function () { Object.assign(this, createModuleMock()); }),
}));
vi.mock('../../../js/admin/modules/ExportModule.js', () => ({
  ExportModule: vi.fn(function () {
    Object.assign(this, createModuleMock());
    this.renderJsonPreview = vi.fn();
  }),
}));
vi.mock('../../../js/admin/modules/ProfileModule.js', () => ({
  ProfileModule: vi.fn(function () { Object.assign(this, createModuleMock()); }),
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
    toastIconPath: { setAttribute: vi.fn() },
    saveIndicator: document.createElement('div'),
    saveIndicatorText: document.createElement('span'),
    confirmDialog: { showModal: vi.fn(), close: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() },
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

// Mock ServerAdminConfigStore and AdminConfigStore
// Note: vi.mock is hoisted, so we cannot reference createStoreMock inside vi.mock.
// Instead, define inline factory inside each mock.
vi.mock('../../../js/admin/ServerAdminConfigStore.js', () => ({
  ServerAdminConfigStore: {
    create: vi.fn().mockResolvedValue({
      setActiveBook: vi.fn(),
      getCover: vi.fn().mockResolvedValue({ title: 'Test Book', author: 'Author' }),
      getChapters: vi.fn().mockResolvedValue([]),
      addBook: vi.fn().mockResolvedValue({ id: 'new-book-1' }),
      removeBook: vi.fn().mockResolvedValue(),
      setPendingBook: vi.fn(),
      isPendingBook: vi.fn().mockReturnValue(false),
      discardPendingBook: vi.fn(),
      onSave: null,
      onError: undefined,
    }),
  },
}));

vi.mock('../../../js/admin/AdminConfigStore.js', () => ({
  AdminConfigStore: {
    create: vi.fn().mockResolvedValue({
      setActiveBook: vi.fn(),
      getCover: vi.fn().mockResolvedValue({ title: 'Test Book', author: 'Author' }),
      getChapters: vi.fn().mockResolvedValue([]),
      addBook: vi.fn().mockResolvedValue({ id: 'new-book-1' }),
      removeBook: vi.fn().mockResolvedValue(),
      setPendingBook: vi.fn(),
      isPendingBook: vi.fn().mockReturnValue(false),
      discardPendingBook: vi.fn(),
      onSave: null,
      onError: undefined,
    }),
  },
}));

const createStoreMock = () => ({
  setActiveBook: vi.fn(),
  getCover: vi.fn().mockResolvedValue({ title: 'Test Book', author: 'Author' }),
  getChapters: vi.fn().mockResolvedValue([]),
  addBook: vi.fn().mockResolvedValue({ id: 'new-book-1' }),
  removeBook: vi.fn().mockResolvedValue(),
  setPendingBook: vi.fn(),
  isPendingBook: vi.fn().mockReturnValue(false),
  discardPendingBook: vi.fn(),
  onSave: null,
  onError: undefined,
});

import { AccountScreen } from '../../../js/core/AccountScreen.js';
import { ServerAdminConfigStore } from '../../../js/admin/ServerAdminConfigStore.js';
import { AdminConfigStore } from '../../../js/admin/AdminConfigStore.js';

describe('Account Screen Integration', () => {
  let screen;
  let mockApi;
  let mockRouter;

  const createAccountDOM = () => {
    const container = document.createElement('div');
    container.id = 'account-screen';
    container.hidden = true;

    // Top-level tabs
    ['books', 'profile', 'settings', 'export'].forEach(tabName => {
      const tab = document.createElement('button');
      tab.className = 'admin-tab';
      tab.dataset.tab = tabName;
      tab.setAttribute('aria-selected', 'false');
      container.appendChild(tab);

      const panel = document.createElement('div');
      panel.className = 'admin-panel';
      panel.dataset.panel = tabName;
      panel.hidden = true;
      container.appendChild(panel);
    });

    // Screen views inside books tab
    ['bookshelf', 'type-selector', 'create-book', 'editor'].forEach(view => {
      const v = document.createElement('div');
      v.className = 'screen-view';
      v.dataset.view = view;
      v.hidden = true;
      container.appendChild(v);
    });

    // Editor tabs wrapper
    const editorTabsWrapper = document.createElement('div');
    editorTabsWrapper.id = 'editorTabsWrapper';
    container.appendChild(editorTabsWrapper);

    const editorTabsContainer = document.createElement('div');
    editorTabsContainer.id = 'editorTabs';
    Object.defineProperty(editorTabsContainer, 'scrollWidth', { value: 100, configurable: true });
    Object.defineProperty(editorTabsContainer, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(editorTabsContainer, 'scrollLeft', { value: 0, configurable: true });
    editorTabsWrapper.appendChild(editorTabsContainer);

    // Editor tabs
    ['cover', 'chapters', 'sounds', 'appearance', 'publish'].forEach(edTab => {
      const t = document.createElement('button');
      t.className = 'editor-tab';
      t.dataset.editorTab = edTab;
      t.setAttribute('aria-selected', 'false');
      editorTabsContainer.appendChild(t);
      container.appendChild(t.cloneNode(true)); // Ensure querySelectorAll finds them

      const p = document.createElement('div');
      p.className = 'editor-panel';
      p.dataset.editorPanel = edTab;
      p.hidden = true;
      container.appendChild(p);
    });

    // Buttons
    const addBookBtn = document.createElement('button');
    addBookBtn.id = 'addBookBtn';
    container.appendChild(addBookBtn);

    const typeSelectorBack = document.createElement('button');
    typeSelectorBack.id = 'typeSelectorBack';
    container.appendChild(typeSelectorBack);

    const createBookBack = document.createElement('button');
    createBookBack.id = 'createBookBack';
    container.appendChild(createBookBack);

    const editorBack = document.createElement('button');
    editorBack.id = 'editorBack';
    container.appendChild(editorBack);

    const createEmptyBookBtn = document.createElement('button');
    createEmptyBookBtn.id = 'createEmptyBookBtn';
    container.appendChild(createEmptyBookBtn);

    // Mode cards container
    const modeCards = document.createElement('div');
    modeCards.id = 'modeCards';
    container.appendChild(modeCards);

    // Editor title
    const editorTitle = document.createElement('h2');
    editorTitle.id = 'editorTitle';
    container.appendChild(editorTitle);

    // Back to shelf link
    const toShelfLink = document.createElement('a');
    toShelfLink.id = 'accountToShelf';
    toShelfLink.href = '/';
    container.appendChild(toShelfLink);

    document.body.appendChild(container);
    return container;
  };

  beforeEach(() => {
    createAccountDOM();

    mockApi = {
      getBooks: vi.fn().mockResolvedValue({ books: [] }),
      deleteBook: vi.fn().mockResolvedValue(),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    // Reset store mocks
    ServerAdminConfigStore.create.mockResolvedValue(createStoreMock());
  });

  afterEach(() => {
    if (screen) {
      screen.destroy();
      screen = null;
    }
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should create store from server API when apiClient is provided', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();

      expect(ServerAdminConfigStore.create).toHaveBeenCalledWith(mockApi);
      expect(screen._initialized).toBe(true);
    });

    it('should fall back to local AdminConfigStore when server fails', async () => {
      ServerAdminConfigStore.create.mockRejectedValue(new Error('Network error'));

      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();

      expect(AdminConfigStore.create).toHaveBeenCalled();
      expect(screen._initialized).toBe(true);
    });

    it('should use local store when no apiClient', async () => {
      screen = new AccountScreen({ apiClient: null, router: mockRouter, currentUser: null });
      await screen.init();

      expect(AdminConfigStore.create).toHaveBeenCalled();
    });

    it('should not re-initialize if already initialized', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();
      await screen.init(); // second call

      expect(ServerAdminConfigStore.create).toHaveBeenCalledTimes(1);
    });

    it('should initialize all modules', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();

      expect(screen.chapters).toBeTruthy();
      expect(screen.settings).toBeTruthy();
      expect(screen.sounds).toBeTruthy();
      expect(screen.ambients).toBeTruthy();
      expect(screen.appearance).toBeTruthy();
      expect(screen.fonts).toBeTruthy();
      expect(screen.export).toBeTruthy();
      expect(screen._profile).toBeTruthy();
    });
  });

  describe('Show / Hide', () => {
    it('should show account screen with default books tab', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();

      await screen.show();

      expect(screen.container.hidden).toBe(false);
      expect(document.body.dataset.screen).toBe('account');
    });

    it('should show with specific tab', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();

      await screen.show('profile');

      const profileTab = screen.container.querySelector('[data-tab="profile"]');
      expect(profileTab.classList.contains('active')).toBe(true);
    });

    it('should open editor when editBookId is provided', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();

      await screen.show('books', { editBookId: 'book-123' });

      expect(screen.store.setActiveBook).toHaveBeenCalledWith('book-123');
      const editorTitle = screen.container.querySelector('#editorTitle');
      expect(editorTitle.textContent).toBe('Test Book');
    });

    it('should hide account screen', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();
      await screen.show();

      screen.hide();

      expect(screen.container.hidden).toBe(true);
    });
  });

  describe('Tab switching', () => {
    it('should switch between top-level tabs', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();
      await screen.show();

      // Click profile tab
      const profileTab = screen.container.querySelector('[data-tab="profile"]');
      profileTab.click();

      expect(profileTab.classList.contains('active')).toBe(true);
      expect(profileTab.getAttribute('aria-selected')).toBe('true');

      const profilePanel = screen.container.querySelector('[data-panel="profile"]');
      expect(profilePanel.hidden).toBe(false);

      // Books panel should be hidden
      const booksPanel = screen.container.querySelector('[data-panel="books"]');
      expect(booksPanel.hidden).toBe(true);
    });

    it('should render export preview when switching to export tab', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();
      await screen.show();

      const exportTab = screen.container.querySelector('[data-tab="export"]');
      exportTab.click();

      expect(screen.export.renderJsonPreview).toHaveBeenCalled();
    });

    it('should render profile when switching to profile tab', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();
      await screen.show();

      const profileTab = screen.container.querySelector('[data-tab="profile"]');
      profileTab.click();

      expect(screen._profile.render).toHaveBeenCalled();
    });
  });

  describe('View navigation (books tab)', () => {
    it('should navigate to type-selector when add book button clicked', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();
      await screen.show();

      const addBtn = screen.container.querySelector('#addBookBtn');
      addBtn.click();

      const typeView = screen.container.querySelector('[data-view="type-selector"]');
      expect(typeView.hidden).toBe(false);
    });

    it('should navigate back to bookshelf from type-selector', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();
      await screen.show();

      // Go to type-selector
      screen.container.querySelector('#addBookBtn').click();

      // Go back
      screen.container.querySelector('#typeSelectorBack').click();

      const bookshelfView = screen.container.querySelector('[data-view="bookshelf"]');
      expect(bookshelfView.hidden).toBe(false);
    });

    it('should navigate back to type-selector from create-book', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();
      await screen.show();

      // Simulate going to create-book view
      screen._showView('create-book');

      // Go back
      screen.container.querySelector('#createBookBack').click();

      const typeView = screen.container.querySelector('[data-view="type-selector"]');
      expect(typeView.hidden).toBe(false);
    });
  });

  describe('Mode selection', () => {
    it('should handle book mode selection — show create-book view', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();
      await screen.show();

      // Create mode card inside modeCards container
      const bookCard = document.createElement('button');
      bookCard.className = 'mode-card';
      bookCard.dataset.mode = 'book';
      screen.modeCardsContainer.appendChild(bookCard);

      bookCard.click();

      const createBookView = screen.container.querySelector('[data-view="create-book"]');
      expect(createBookView.hidden).toBe(false);
    });

    it('should create empty book and open editor', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();
      await screen.show();

      await screen._createEmptyBook();

      expect(screen.store.setPendingBook).toHaveBeenCalled();
      expect(screen._pendingBookId).toBe(true);
    });
  });

  describe('Pending book cleanup', () => {
    it('should discard pending book if user never saved any tab', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();
      await screen.show();

      screen._pendingBookId = true;
      screen.store.isPendingBook.mockReturnValue(true);

      await screen._cleanupPendingBook();

      expect(screen.store.discardPendingBook).toHaveBeenCalled();
      expect(screen._pendingBookId).toBeNull();
    });

    it('should NOT discard book if user already saved a tab (book created on server)', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();
      await screen.show();

      screen._pendingBookId = true;
      screen.store.isPendingBook.mockReturnValue(false); // already created on server

      await screen._cleanupPendingBook();

      expect(screen.store.discardPendingBook).not.toHaveBeenCalled();
    });
  });

  describe('Back to shelf navigation', () => {
    it('should navigate to / when "back to shelf" is clicked', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();
      await screen.show();

      const toShelfLink = screen.container.querySelector('#accountToShelf');
      toShelfLink.click();
      await flushPromises();

      expect(mockRouter.navigate).toHaveBeenCalledWith('/');
    });
  });

  describe('Destroy', () => {
    it('should clean up on destroy', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();

      screen.destroy();

      expect(screen._initialized).toBe(false);
      expect(screen._store).toBeNull();
      expect(screen._modules.length).toBe(0);
    });

    it('should destroy profile module', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });
      await screen.init();

      const profileDestroy = screen._profile.destroy;
      screen.destroy();

      expect(profileDestroy).toHaveBeenCalled();
    });
  });

  describe('Full lifecycle', () => {
    it('should support: init → show → switch tabs → create book → editor → back → destroy', async () => {
      screen = new AccountScreen({ apiClient: mockApi, router: mockRouter, currentUser: { id: '1' } });

      // 1. Init
      await screen.init();
      expect(screen._initialized).toBe(true);

      // 2. Show
      await screen.show();
      expect(screen.container.hidden).toBe(false);

      // 3. Switch to profile tab
      screen.container.querySelector('[data-tab="profile"]').click();
      expect(screen._profile.render).toHaveBeenCalled();

      // 4. Switch back to books
      screen.container.querySelector('[data-tab="books"]').click();

      // 5. Create an empty book (deferred — not yet on server)
      await screen._createEmptyBook();
      expect(screen._pendingBookId).toBe(true);
      expect(screen.store.setPendingBook).toHaveBeenCalled();

      // 6. Editor is open
      expect(screen.editorTitle.textContent).toBe('Test Book');

      // 7. Destroy
      screen.destroy();
      expect(screen._initialized).toBe(false);
    });
  });
});
