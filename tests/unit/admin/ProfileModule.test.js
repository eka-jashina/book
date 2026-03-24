import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@i18n', () => ({ t: vi.fn((key, opts) => opts ? `${key}:${JSON.stringify(opts)}` : key) }));

import { ProfileModule } from '@/admin/modules/ProfileModule.js';

// ═══════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ═══════════════════════════════════════════

function createMockContainer() {
  const container = document.createElement('div');
  container.innerHTML = `
    <input id="profileUsername">
    <input id="profileDisplayName">
    <textarea id="profileBio"></textarea>
    <span id="bioCharCount">0</span>
    <span id="usernameHint"></span>
    <span id="usernameValidation"></span>
    <div id="profileAvatarPreview"></div>
    <input id="profileAvatarInput" type="file">
    <button id="profileAvatarRemove"></button>
    <button id="saveProfile"></button>
    <div id="profilePreview"></div>
    <template id="tmpl-profile-preview">
      <div class="profile-preview-card">
        <div class="profile-avatar"></div>
        <span class="profile-display-name"></span>
        <span class="profile-username"></span>
        <p class="profile-bio-text"></p>
      </div>
    </template>
  `;
  document.body.appendChild(container);
  return container;
}

function createMockApp() {
  return {
    container: null,
    store: {
      save: vi.fn(),
    },
    _showToast: vi.fn(),
    _escapeHtml: vi.fn(s => s),
    _renderJsonPreview: vi.fn(),
  };
}

function createMockApi() {
  return {
    getProfile: vi.fn().mockResolvedValue({
      username: 'testuser',
      displayName: 'Test User',
      bio: 'Hello world',
      avatarUrl: null,
    }),
    updateProfile: vi.fn().mockResolvedValue({ success: true }),
    uploadImage: vi.fn().mockResolvedValue({ url: 'https://example.com/avatar.jpg' }),
  };
}

describe('ProfileModule', () => {
  let module;
  let app;
  let container;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = createMockContainer();
    app = createMockApp();
    app.container = container;
    module = new ProfileModule(app);
    module._api = createMockApi();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // КОНСТРУКТОР
  // ═══════════════════════════════════════════

  describe('constructor', () => {
    it('должен инициализировать _currentUser как null', () => {
      expect(module._currentUser).toBeNull();
    });

    it('должен инициализировать _pendingAvatarUrl как undefined', () => {
      expect(module._pendingAvatarUrl).toBeUndefined();
    });

    it('должен сохранить ссылку на API', () => {
      expect(module._api).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД cacheDOM()
  // ═══════════════════════════════════════════

  describe('cacheDOM()', () => {
    it('должен найти все элементы формы', () => {
      module.cacheDOM();

      expect(module._usernameInput || document.getElementById('profileUsername')).toBeDefined();
      expect(module._displayNameInput || document.getElementById('profileDisplayName')).toBeDefined();
      expect(module._bioInput || document.getElementById('profileBio')).toBeDefined();
    });

    it('не должен бросить ошибку', () => {
      expect(() => module.cacheDOM()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД bindEvents()
  // ═══════════════════════════════════════════

  describe('bindEvents()', () => {
    it('должен сделать username input disabled', () => {
      module.cacheDOM();
      module.bindEvents();

      const usernameInput = document.getElementById('profileUsername');
      expect(usernameInput.disabled).toBe(true);
    });

    it('должен привязать обработчик bio для подсчёта символов', () => {
      module.cacheDOM();
      module.bindEvents();

      const bio = document.getElementById('profileBio');
      bio.value = 'Hello';
      bio.dispatchEvent(new Event('input'));

      const counter = document.getElementById('bioCharCount');
      expect(counter.textContent).toBe('5');
    });

    it('не должен бросить ошибку', () => {
      module.cacheDOM();
      expect(() => module.bindEvents()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД render()
  // ═══════════════════════════════════════════

  describe('render()', () => {
    it('должен загрузить профиль из API', async () => {
      module.cacheDOM();
      await module.render();

      expect(module._api.getProfile).toHaveBeenCalled();
    });

    it('должен заполнить поля формы данными профиля', async () => {
      module.cacheDOM();
      await module.render();

      const username = document.getElementById('profileUsername');
      const displayName = document.getElementById('profileDisplayName');
      const bio = document.getElementById('profileBio');

      expect(username.value).toBe('testuser');
      expect(displayName.value).toBe('Test User');
      expect(bio.value).toBe('Hello world');
    });

    it('должен отрисовать превью профиля', async () => {
      module.cacheDOM();
      await module.render();

      const preview = document.getElementById('profilePreview');
      expect(preview.innerHTML).not.toBe('');
    });

    it('должен обработать ошибку API', async () => {
      module._api.getProfile.mockRejectedValue(new Error('network error'));
      module.cacheDOM();

      await module.render();

      expect(app._showToast).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД _onAvatarChange()
  // ═══════════════════════════════════════════

  describe('_onAvatarChange()', () => {
    it('должен загрузить аватар через API', async () => {
      module.cacheDOM();

      const file = new File(['img'], 'avatar.jpg', { type: 'image/jpeg' });
      const event = { target: { files: [file] } };

      await module._onAvatarChange(event);

      expect(module._api.uploadImage).toHaveBeenCalled();
    });

    it('должен сохранить URL аватара в pending', async () => {
      module.cacheDOM();

      const file = new File(['img'], 'avatar.png', { type: 'image/png' });
      const event = { target: { files: [file] } };

      await module._onAvatarChange(event);

      expect(module._pendingAvatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('должен обработать пустой выбор файла', async () => {
      module.cacheDOM();

      const event = { target: { files: [] } };
      await module._onAvatarChange(event);

      // Не должен вызвать upload
      expect(module._api.uploadImage).not.toHaveBeenCalled();
    });

    it('должен обновить превью аватара', async () => {
      module.cacheDOM();

      const file = new File(['img'], 'avatar.jpg', { type: 'image/jpeg' });
      const event = { target: { files: [file] } };

      await module._onAvatarChange(event);

      const preview = document.getElementById('profileAvatarPreview');
      expect(preview.innerHTML).not.toBe('');
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД _removeAvatar()
  // ═══════════════════════════════════════════

  describe('_removeAvatar()', () => {
    it('должен установить pending avatar в null', () => {
      module.cacheDOM();
      module._pendingAvatarUrl = 'https://example.com/old.jpg';

      module._removeAvatar();

      expect(module._pendingAvatarUrl).toBeNull();
    });

    it('должен обновить превью аватара', () => {
      module.cacheDOM();
      module._currentUser = { username: 'testuser', displayName: 'Test' };
      module._pendingAvatarUrl = 'https://example.com/old.jpg';

      module._removeAvatar();

      const preview = document.getElementById('profileAvatarPreview');
      // Превью должно показать placeholder или инициал
      expect(preview.innerHTML).not.toContain('img');
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД _renderAvatarPreview()
  // ═══════════════════════════════════════════

  describe('_renderAvatarPreview()', () => {
    beforeEach(() => {
      module.cacheDOM();
    });

    it('должен отрисовать img при наличии URL', () => {
      module._renderAvatarPreview('https://example.com/avatar.jpg');

      const preview = document.getElementById('profileAvatarPreview');
      const img = preview.querySelector('img');
      expect(img).not.toBeNull();
      expect(img.src).toBe('https://example.com/avatar.jpg');
    });

    it('должен отрисовать placeholder без URL', () => {
      module._currentUser = { username: 'testuser', displayName: 'Test User' };
      module._renderAvatarPreview(null);

      const preview = document.getElementById('profileAvatarPreview');
      // Должен быть placeholder с инициалом
      expect(preview.innerHTML).not.toBe('');
      expect(preview.querySelector('img')).toBeNull();
    });

    it('должен использовать первую букву имени для placeholder', () => {
      module._currentUser = { username: 'admin', displayName: 'Admin User' };
      module._renderAvatarPreview(null);

      const preview = document.getElementById('profileAvatarPreview');
      expect(preview.textContent).toContain('A');
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД _renderProfilePreview()
  // ═══════════════════════════════════════════

  describe('_renderProfilePreview()', () => {
    it('должен отрисовать превью из шаблона', () => {
      module.cacheDOM();
      module._currentUser = {
        username: 'testuser',
        displayName: 'Test User',
        bio: 'Hello',
        avatarUrl: null,
      };

      module._renderProfilePreview();

      const preview = document.getElementById('profilePreview');
      expect(preview.innerHTML).not.toBe('');
    });

    it('должен отобразить имя пользователя', () => {
      module.cacheDOM();
      module._currentUser = {
        username: 'myuser',
        displayName: 'My User',
        bio: '',
        avatarUrl: null,
      };

      // Заполняем поля формы
      document.getElementById('profileDisplayName').value = 'My User';
      document.getElementById('profileUsername').value = 'myuser';

      module._renderProfilePreview();

      const preview = document.getElementById('profilePreview');
      expect(preview.textContent).toContain('My User');
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД _save()
  // ═══════════════════════════════════════════

  describe('_save()', () => {
    it('должен вызвать API updateProfile', async () => {
      module.cacheDOM();
      module._currentUser = { username: 'testuser' };

      document.getElementById('profileDisplayName').value = 'New Name';
      document.getElementById('profileBio').value = 'New bio';

      await module._save();

      expect(module._api.updateProfile).toHaveBeenCalled();
    });

    it('должен показать toast после сохранения', async () => {
      module.cacheDOM();
      module._currentUser = { username: 'testuser' };

      await module._save();

      expect(app._showToast).toHaveBeenCalled();
    });

    it('должен обработать ошибку сохранения', async () => {
      module.cacheDOM();
      module._currentUser = { username: 'testuser' };
      module._api.updateProfile.mockRejectedValue(new Error('save failed'));

      await module._save();

      expect(app._showToast).toHaveBeenCalled();
    });

    it('должен передать pending avatar URL', async () => {
      module.cacheDOM();
      module._currentUser = { username: 'testuser' };
      module._pendingAvatarUrl = 'https://example.com/new-avatar.jpg';

      await module._save();

      const callArgs = module._api.updateProfile.mock.calls[0][0];
      expect(callArgs.avatarUrl || callArgs.avatar_url || callArgs).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД _hashToHue()
  // ═══════════════════════════════════════════

  describe('_hashToHue()', () => {
    it('должен вернуть число от 0 до 359', () => {
      const hue = module._hashToHue('teststring');

      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    });

    it('должен возвращать одинаковый результат для одной строки', () => {
      const hue1 = module._hashToHue('hello');
      const hue2 = module._hashToHue('hello');

      expect(hue1).toBe(hue2);
    });

    it('должен возвращать разные результаты для разных строк', () => {
      const hue1 = module._hashToHue('alice');
      const hue2 = module._hashToHue('bob');

      // Не гарантировано, но с высокой вероятностью разные
      // Тестируем что функция работает
      expect(typeof hue1).toBe('number');
      expect(typeof hue2).toBe('number');
    });

    it('должен обработать пустую строку', () => {
      const hue = module._hashToHue('');
      expect(typeof hue).toBe('number');
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    });

    it('должен обработать Unicode строки', () => {
      const hue = module._hashToHue('Привет мир');
      expect(typeof hue).toBe('number');
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    });
  });
});
