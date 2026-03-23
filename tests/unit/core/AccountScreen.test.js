/**
 * Тесты для AccountScreen
 * Экран личного кабинета
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { MockModule, MockExportModule, MockProfileModule } = vi.hoisted(() => {
  const fn = () => vi.fn();
  const fnAsync = () => vi.fn(() => Promise.resolve());
  const makeMethods = () => ({ cacheDOM: fn(), bindEvents: fn(), render: fnAsync(), destroy: fn() });
  return {
    MockModule: class { constructor() { Object.assign(this, makeMethods()); } },
    MockExportModule: class { constructor() { Object.assign(this, makeMethods()); this.renderJsonPreview = fn(); } },
    MockProfileModule: class { constructor() { Object.assign(this, makeMethods()); } },
  };
});

vi.mock('../../../js/i18n/index.js', () => ({
  t: vi.fn((key) => key),
}));

vi.mock('../../../js/admin/ServerAdminConfigStore.js', () => ({
  ServerAdminConfigStore: {
    create: vi.fn(() => Promise.resolve({
      onSave: null,
      onError: undefined,
      getActiveBookId: vi.fn(() => 'book-1'),
      setActiveBook: vi.fn(),
      addBook: vi.fn(() => Promise.resolve({ id: 'new-book-1' })),
      removeBook: vi.fn(() => Promise.resolve()),
      getChapters: vi.fn(() => Promise.resolve([])),
      getCover: vi.fn(() => Promise.resolve({ title: 'admin.newBook', author: '' })),
    })),
  },
}));

vi.mock('../../../js/admin/AdminConfigStore.js', () => ({
  AdminConfigStore: {
    create: vi.fn(() => Promise.resolve({
      onSave: null,
      getActiveBookId: vi.fn(() => 'book-1'),
      setActiveBook: vi.fn(),
      addBook: vi.fn(() => Promise.resolve({ id: 'new-book-1' })),
      removeBook: vi.fn(() => Promise.resolve()),
      getChapters: vi.fn(() => Promise.resolve([])),
      getCover: vi.fn(() => Promise.resolve({ title: 'admin.newBook' })),
    })),
  },
}));

vi.mock('../../../js/admin/modules/ChaptersModule.js', () => ({
  ChaptersModule: MockModule,
}));
vi.mock('../../../js/admin/modules/SettingsModule.js', () => ({
  SettingsModule: MockModule,
}));
vi.mock('../../../js/admin/modules/SoundsModule.js', () => ({
  SoundsModule: MockModule,
}));
vi.mock('../../../js/admin/modules/AmbientsModule.js', () => ({
  AmbientsModule: MockModule,
}));
vi.mock('../../../js/admin/modules/AppearanceModule.js', () => ({
  AppearanceModule: MockModule,
}));
vi.mock('../../../js/admin/modules/FontsModule.js', () => ({
  FontsModule: MockModule,
}));
vi.mock('../../../js/admin/modules/ExportModule.js', () => ({
  ExportModule: MockExportModule,
}));
vi.mock('../../../js/admin/modules/ProfileModule.js', () => ({
  ProfileModule: MockProfileModule,
}));

vi.mock('../../../js/admin/modeCardsData.js', () => ({
  renderModeCards: vi.fn(),
}));

vi.mock('../../../js/core/AccountPublishTab.js', () => ({
  AccountPublishTab: class {
    constructor() {
      this.bindEvents = vi.fn();
      this.render = vi.fn(() => Promise.resolve());
    }
  },
}));

vi.mock('../../../js/core/AccountScreenUI.js', () => ({
  cacheUIElements: vi.fn(() => ({})),
  showToast: vi.fn(),
  showSaveIndicator: vi.fn(),
  showSaveError: vi.fn(),
  confirm: vi.fn(() => Promise.resolve(true)),
}));

// Mock dynamic CSS import
vi.mock('../../css/admin/index.css', () => ({}));

import { AccountScreen } from '../../../js/core/AccountScreen.js';

describe('AccountScreen', () => {
  let screen;
  let mockApi;
  let mockRouter;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up DOM
    const container = document.createElement('div');
    container.id = 'account-screen';
    container.innerHTML = `
      <button class="admin-tab" data-tab="books" aria-selected="false">Books</button>
      <button class="admin-tab" data-tab="profile" aria-selected="false">Profile</button>
      <button class="admin-tab" data-tab="settings" aria-selected="false">Settings</button>
      <button class="admin-tab" data-tab="export" aria-selected="false">Export</button>
      <div class="admin-panel" data-panel="books" hidden></div>
      <div class="admin-panel" data-panel="profile" hidden></div>
      <div class="admin-panel" data-panel="settings" hidden></div>
      <div class="admin-panel" data-panel="export" hidden></div>
      <div class="screen-view" data-view="bookshelf" hidden></div>
      <div class="screen-view" data-view="type-selector" hidden></div>
      <div class="screen-view" data-view="create-book" hidden></div>
      <div class="screen-view active" data-view="editor" hidden></div>
      <div id="editorTabsWrapper"><div id="editorTabs" style="overflow:auto;">
        <button class="editor-tab" data-editor-tab="cover">Cover</button>
        <button class="editor-tab" data-editor-tab="chapters">Chapters</button>
        <button class="editor-tab" data-editor-tab="publish">Publish</button>
      </div></div>
      <div class="editor-panel" data-editor-panel="cover" hidden></div>
      <div class="editor-panel" data-editor-panel="chapters" hidden></div>
      <div class="editor-panel" data-editor-panel="publish" hidden></div>
      <span id="editorTitle"></span>
      <button id="addBookBtn"></button>
      <button id="typeSelectorBack"></button>
      <button id="createBookBack"></button>
      <button id="editorBack"></button>
      <button id="createEmptyBookBtn"></button>
      <div id="modeCards"></div>
      <a id="accountToShelf" href="/"></a>
    `;
    document.body.innerHTML = '';
    document.body.appendChild(container);

    mockApi = {
      getBooks: vi.fn(() => Promise.resolve({ books: [] })),
      deleteBook: vi.fn(() => Promise.resolve()),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    screen = new AccountScreen({
      apiClient: mockApi,
      router: mockRouter,
      currentUser: { id: 'user-1' },
    });
  });

  describe('constructor', () => {
    it('should store dependencies', () => {
      expect(screen._api).toBe(mockApi);
      expect(screen._router).toBe(mockRouter);
      expect(screen._initialized).toBe(false);
    });

    it('should find container', () => {
      expect(screen.container).not.toBeNull();
    });
  });

  describe('init', () => {
    it('should create store and modules', async () => {
      await screen.init();
      expect(screen._initialized).toBe(true);
      expect(screen.store).not.toBeNull();
      expect(screen.chapters).not.toBeNull();
      expect(screen.settings).not.toBeNull();
    });

    it('should not re-initialize if already initialized', async () => {
      await screen.init();
      const store = screen.store;
      await screen.init();
      expect(screen.store).toBe(store);
    });
  });

  describe('show', () => {
    it('should make container visible', async () => {
      await screen.init();
      await screen.show();
      expect(screen.container.hidden).toBe(false);
    });

    it('should set body dataset.screen to account', async () => {
      await screen.init();
      await screen.show();
      expect(document.body.dataset.screen).toBe('account');
    });

    it('should switch to specified tab', async () => {
      await screen.init();
      await screen.show('profile');

      const profileTab = screen.container.querySelector('[data-tab="profile"]');
      expect(profileTab.classList.contains('active')).toBe(true);
    });
  });

  describe('hide', () => {
    it('should hide container', async () => {
      await screen.init();
      await screen.show();
      screen.hide();
      expect(screen.container.hidden).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should clean up', async () => {
      await screen.init();
      screen.destroy();
      expect(screen._initialized).toBe(false);
      expect(screen._store).toBeNull();
      expect(screen.store).toBeNull();
      expect(screen._modules).toEqual([]);
    });
  });

  describe('_escapeHtml', () => {
    it('should escape HTML special characters', async () => {
      await screen.init();
      expect(screen._escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert("xss")&lt;/script&gt;'
      );
    });
  });
});
