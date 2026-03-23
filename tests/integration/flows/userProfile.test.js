/**
 * INTEGRATION TEST: User Profile
 * Редактирование профиля (ProfileModule), компонент ProfileHeader,
 * валидация username, загрузка аватара, публичные полки авторов.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupIntegrationDOM } from '../../helpers/integrationUtils.js';
import { flushPromises } from '../../helpers/testUtils.js';

// ── ProfileModule ─────────────────────────────────────────────────────────────

describe('User Profile Integration', () => {
  describe('ProfileModule', () => {
    let mod;
    let mockApi;
    let mockApp;

    const createProfileDOM = () => {
      const c = document.createElement('div');
      c.id = 'profile-panel';

      c.innerHTML = `
        <input id="profileUsername" />
        <input id="profileDisplayName" />
        <textarea id="profileBio"></textarea>
        <span id="bioCharCount">0</span>
        <span id="usernameHint"></span>
        <span id="usernameValidation" hidden></span>
        <div id="profileAvatarPreview"></div>
        <input type="file" id="profileAvatarInput" />
        <button id="profileAvatarRemove" hidden></button>
        <button id="saveProfile"></button>
        <div id="profilePreview"></div>
      `;
      document.body.appendChild(c);
      return c;
    };

    beforeEach(() => {
      const container = createProfileDOM();

      mockApi = {
        getProfile: vi.fn().mockResolvedValue({
          username: 'johndoe',
          displayName: 'John Doe',
          bio: 'Hello world',
          avatarUrl: 'https://example.com/avatar.jpg',
        }),
        checkUsername: vi.fn().mockResolvedValue({ available: true }),
        uploadImage: vi.fn().mockResolvedValue({ fileUrl: 'https://example.com/new-avatar.jpg' }),
        updateProfile: vi.fn().mockImplementation(data => Promise.resolve({
          username: data.username || 'johndoe',
          displayName: data.displayName ?? 'John Doe',
          bio: data.bio ?? null,
          avatarUrl: data.avatarUrl ?? null,
        })),
      };

      const toastFn = vi.fn();
      mockApp = {
        container,
        _api: mockApi,
        _currentUser: { id: '1', username: 'johndoe', displayName: 'John Doe', bio: 'Hello world', avatarUrl: 'https://example.com/avatar.jpg' },
        _showToast: toastFn,
        _escapeHtml: (s) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
        _renderJsonPreview: vi.fn(),
        _confirm: vi.fn().mockResolvedValue(true),
        store: {},
      };
    });

    afterEach(() => {
      if (mod) {
        mod.destroy();
        mod = null;
      }
      cleanupIntegrationDOM();
      vi.restoreAllMocks();
    });

    async function createModule() {
      const { ProfileModule } = await import('../../../js/admin/modules/ProfileModule.js');
      mod = new ProfileModule(mockApp);
      mod.cacheDOM();
      mod.bindEvents();
      await mod.render();
      return mod;
    }

    it('should render profile fields from server data', async () => {
      await createModule();

      expect(mockApi.getProfile).toHaveBeenCalled();
      expect(mod._usernameInput.value).toBe('johndoe');
      expect(mod._displayNameInput.value).toBe('John Doe');
      expect(mod._bioInput.value).toBe('Hello world');
      expect(mod._bioCharCount.textContent).toBe('11');
    });

    it('should render avatar image when avatarUrl exists', async () => {
      await createModule();

      const img = mod._avatarPreview.querySelector('img');
      expect(img).toBeTruthy();
      expect(img.src).toContain('avatar.jpg');
      expect(mod._avatarRemoveBtn.hidden).toBe(false);
    });

    it('should render initial placeholder when no avatarUrl', async () => {
      mockApp._currentUser.avatarUrl = null;
      mockApi.getProfile.mockResolvedValue({
        username: 'johndoe', displayName: 'John Doe', bio: null, avatarUrl: null,
      });

      await createModule();

      const placeholder = mod._avatarPreview.querySelector('.profile-avatar-placeholder');
      expect(placeholder).toBeTruthy();
      expect(placeholder.textContent.trim()).toBe('J');
      expect(mod._avatarRemoveBtn.hidden).toBe(true);
    });

    it('should use local data when server getProfile fails', async () => {
      mockApi.getProfile.mockRejectedValue(new Error('offline'));

      await createModule();

      expect(mod._usernameInput.value).toBe('johndoe');
      expect(mod._displayNameInput.value).toBe('John Doe');
    });

    it('should not render if no currentUser', async () => {
      mockApp._currentUser = null;

      await createModule();

      expect(mockApi.getProfile).not.toHaveBeenCalled();
    });

    // ── Username (read-only after registration) ──────────────────

    describe('Username (read-only)', () => {
      it('should disable username input', async () => {
        await createModule();

        expect(mod._usernameInput.disabled).toBe(true);
      });

      it('should show read-only hint when username is set', async () => {
        await createModule();

        expect(mod._usernameHint.textContent).toContain('нельзя изменить');
      });
    });

    // ── Bio character counter ────────────────────────────────────

    describe('Bio', () => {
      it('should update character count on input', async () => {
        await createModule();

        mod._bioInput.value = 'Test bio text';
        mod._bioInput.dispatchEvent(new Event('input'));

        expect(mod._bioCharCount.textContent).toBe('13');
      });
    });

    // ── Avatar ───────────────────────────────────────────────────

    describe('Avatar', () => {
      it('should upload avatar via API and update preview', async () => {
        await createModule();

        const file = new File(['img'], 'avatar.png', { type: 'image/png' });
        Object.defineProperty(mod._avatarInput, 'files', { value: [file], configurable: true });
        await mod._onAvatarChange({ target: mod._avatarInput });

        expect(mockApi.uploadImage).toHaveBeenCalledWith(file);
        expect(mod._pendingAvatarUrl).toBe('https://example.com/new-avatar.jpg');
        const img = mod._avatarPreview.querySelector('img');
        expect(img.src).toContain('new-avatar.jpg');
      });

      it('should reject files over 2 MB', async () => {
        await createModule();

        const bigFile = new File([new ArrayBuffer(3 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });
        Object.defineProperty(mod._avatarInput, 'files', { value: [bigFile], configurable: true });
        await mod._onAvatarChange({ target: mod._avatarInput });

        expect(mockApi.uploadImage).not.toHaveBeenCalled();
        expect(mockApp._showToast).toHaveBeenCalled();
      });

      it('should reject non-image files', async () => {
        await createModule();

        const txtFile = new File(['text'], 'doc.txt', { type: 'text/plain' });
        Object.defineProperty(mod._avatarInput, 'files', { value: [txtFile], configurable: true });
        await mod._onAvatarChange({ target: mod._avatarInput });

        expect(mockApi.uploadImage).not.toHaveBeenCalled();
      });

      it('should mark avatar for removal', async () => {
        await createModule();

        mod._removeAvatar();

        expect(mod._pendingAvatarUrl).toBeNull();
        expect(mod._avatarRemoveBtn.hidden).toBe(true);
        const placeholder = mod._avatarPreview.querySelector('.profile-avatar-placeholder');
        expect(placeholder).toBeTruthy();
      });

      it('should show toast on upload error', async () => {
        mockApi.uploadImage.mockRejectedValue(new Error('upload fail'));
        await createModule();

        const file = new File(['x'], 'a.png', { type: 'image/png' });
        Object.defineProperty(mod._avatarInput, 'files', { value: [file], configurable: true });
        await mod._onAvatarChange({ target: mod._avatarInput });

        expect(mockApp._showToast).toHaveBeenCalledWith('Ошибка загрузки аватара', 'error');
      });
    });

    // ── Save profile ─────────────────────────────────────────────

    describe('Save', () => {
      it('should save profile changes to API', async () => {
        await createModule();

        mod._displayNameInput.value = 'New Name';
        mod._bioInput.value = 'New bio';

        await mod._save();

        expect(mockApi.updateProfile).toHaveBeenCalledWith(expect.objectContaining({
          displayName: 'New Name',
          bio: 'New bio',
        }));
        // Username should not be sent
        expect(mockApi.updateProfile).toHaveBeenCalledWith(expect.not.objectContaining({
          username: expect.anything(),
        }));
        expect(mockApp._showToast).toHaveBeenCalledWith('Профиль сохранён', 'success');
      });

      it('should update local currentUser after successful save', async () => {
        await createModule();

        mod._displayNameInput.value = 'Updated Name';

        await mod._save();

        // Username should remain unchanged (read-only)
        expect(mockApp._currentUser.username).toBe('johndoe');
        expect(mockApp._currentUser.displayName).toBe('Updated Name');
      });

      it('should reset pending avatar after save', async () => {
        await createModule();
        mod._pendingAvatarUrl = 'https://example.com/new.jpg';

        await mod._save();

        expect(mod._pendingAvatarUrl).toBeUndefined();
      });

      it('should send null avatarUrl when avatar was removed', async () => {
        await createModule();
        mod._pendingAvatarUrl = null;

        await mod._save();

        expect(mockApi.updateProfile).toHaveBeenCalledWith(expect.objectContaining({
          avatarUrl: null,
        }));
      });

      it('should show error toast when save fails', async () => {
        mockApi.updateProfile.mockRejectedValue(new Error('server error'));
        await createModule();

        await mod._save();

        expect(mockApp._showToast).toHaveBeenCalledWith('server error', 'error');
      });
    });

    // ── Profile preview ──────────────────────────────────────────

    describe('Profile preview', () => {
      it('should render preview with current form values', async () => {
        await createModule();

        mod._usernameInput.value = 'testuser';
        mod._displayNameInput.value = 'Test User';
        mod._bioInput.value = 'My bio';
        mod._renderProfilePreview();

        const preview = mod._previewContainer;
        expect(preview.innerHTML).toContain('Test User');
        expect(preview.innerHTML).toContain('@testuser');
        expect(preview.innerHTML).toContain('My bio');
      });

      it('should show current username in preview', async () => {
        await createModule();

        mod._renderProfilePreview();

        expect(mod._previewContainer.innerHTML).toContain('@johndoe');
      });

      it('should show avatar image in preview when pending', async () => {
        await createModule();
        mod._pendingAvatarUrl = 'https://example.com/pending.jpg';

        mod._renderProfilePreview();

        const img = mod._previewContainer.querySelector('img');
        expect(img).toBeTruthy();
        expect(img.src).toContain('pending.jpg');
      });

      it('should show initial when no avatar', async () => {
        await createModule();
        mod._pendingAvatarUrl = null;

        mod._renderProfilePreview();

        const initial = mod._previewContainer.querySelector('.profile-header-initial');
        expect(initial).toBeTruthy();
      });
    });

    // ── Destroy ──────────────────────────────────────────────────

    describe('Destroy', () => {
      it('should not throw on destroy', async () => {
        await createModule();
        expect(() => mod.destroy()).not.toThrow();
      });
    });
  });

  // ── ProfileHeader ────────────────────────────────────────────────────────────

  describe('ProfileHeader', () => {
    beforeEach(() => {
      // Create template required by ProfileHeader — must match actual DOM structure
      const tmpl = document.createElement('template');
      tmpl.id = 'tmpl-profile-header';
      tmpl.innerHTML = `
        <div class="profile-header-avatar">
          <span class="profile-header-initial"></span>
        </div>
        <div class="profile-header-info">
          <h2 class="profile-header-name"></h2>
          <span class="profile-header-username"></span>
          <p class="profile-header-bio"></p>
        </div>
        <div class="profile-header-actions">
          <button class="profile-header-edit" hidden>Редактировать</button>
          <button class="profile-header-logout" hidden>Выйти</button>
        </div>
      `;
      document.body.appendChild(tmpl);
    });

    afterEach(() => {
      cleanupIntegrationDOM();
    });

    async function createHeader(opts) {
      const { ProfileHeader } = await import('../../../js/core/ProfileHeader.js');
      return new ProfileHeader(opts);
    }

    it('should render user info into container', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const header = await createHeader({
        user: { username: 'alice', displayName: 'Alice', bio: 'Dev', avatarUrl: null },
        isOwner: false,
      });
      header.render(container);

      expect(container.querySelector('.profile-header-name').textContent).toBe('Alice');
      expect(container.querySelector('.profile-header-username').textContent).toContain('alice');
    });

    it('should show edit/logout buttons for owner', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const onEdit = vi.fn();
      const onLogout = vi.fn();

      const header = await createHeader({
        user: { username: 'me', displayName: 'Me', bio: 'A bio', avatarUrl: null },
        isOwner: true,
        onEditProfile: onEdit,
        onLogout,
      });
      header.render(container);

      const editBtn = container.querySelector('.profile-header-edit');
      const logoutBtn = container.querySelector('.profile-header-logout');

      expect(editBtn).toBeTruthy();
      expect(logoutBtn).toBeTruthy();
      expect(editBtn.hidden).toBe(false);
      expect(logoutBtn.hidden).toBe(false);

      editBtn.click();
      expect(onEdit).toHaveBeenCalled();

      logoutBtn.click();
      expect(onLogout).toHaveBeenCalled();
    });

    it('should remove edit/logout buttons for non-owner', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const header = await createHeader({
        user: { username: 'other', displayName: 'Other', bio: 'Bio', avatarUrl: null },
        isOwner: false,
      });
      header.render(container);

      // Non-owner: buttons are removed from DOM entirely
      expect(container.querySelector('.profile-header-edit')).toBeNull();
      expect(container.querySelector('.profile-header-logout')).toBeNull();
    });

    it('should generate deterministic avatar color from username', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const header = await createHeader({
        user: { username: 'colortest', displayName: 'C', bio: 'Bio', avatarUrl: null },
        isOwner: false,
      });
      header.render(container);

      const avatar = container.querySelector('.profile-header-avatar');
      // jsdom converts hsl() to rgb() internally
      expect(avatar.style.background).toMatch(/rgb|hsl/);
    });

    it('should clean up on destroy', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const header = await createHeader({
        user: { username: 'x', displayName: 'X', bio: 'Bio', avatarUrl: null },
        isOwner: false,
      });
      header.render(container);

      expect(container.querySelector('.profile-header')).toBeTruthy();

      header.destroy();

      expect(container.querySelector('.profile-header')).toBeNull();
    });
  });
});
