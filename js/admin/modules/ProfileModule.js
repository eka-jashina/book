/**
 * PROFILE MODULE
 *
 * Вкладка «Профиль» в личном кабинете (/account?tab=profile).
 * Редактирование: username, displayName, bio, аватар.
 *
 * - Живая валидация username через GET /api/profile/check-username/:username
 * - Загрузка аватара через POST /api/upload/image → PUT /api/profile { avatarUrl }
 * - Превью профиля (как будет выглядеть шапка на полке)
 */

import { BaseModule } from './BaseModule.js';
import { t } from '@i18n';

export class ProfileModule extends BaseModule {
  constructor(app) {
    super(app);
    this._api = app._api;
    this._currentUser = app._currentUser;
    /** Pending avatar URL (не сохранённый на сервер). null = удалить, undefined = без изменений */
    this._pendingAvatarUrl = undefined;
  }

  cacheDOM() {
    const c = this.app.container;
    this._usernameInput = c.querySelector('#profileUsername');
    this._displayNameInput = c.querySelector('#profileDisplayName');
    this._bioInput = c.querySelector('#profileBio');
    this._bioCharCount = c.querySelector('#bioCharCount');
    this._usernameHint = c.querySelector('#usernameHint');
    this._usernameValidation = c.querySelector('#usernameValidation');
    this._avatarPreview = c.querySelector('#profileAvatarPreview');
    this._avatarInput = c.querySelector('#profileAvatarInput');
    this._avatarRemoveBtn = c.querySelector('#profileAvatarRemove');
    this._saveBtn = c.querySelector('#saveProfile');
    this._previewContainer = c.querySelector('#profilePreview');
  }

  bindEvents() {
    // Username — read-only (устанавливается при регистрации)
    this._usernameInput.disabled = true;

    // Bio — счётчик символов
    this._bioInput.addEventListener('input', () => {
      this._bioCharCount.textContent = this._bioInput.value.length;
    });

    // Аватар — загрузка
    this._avatarInput.addEventListener('change', (e) => this._onAvatarChange(e));
    this._avatarRemoveBtn.addEventListener('click', () => this._removeAvatar());

    // Сохранить
    this._saveBtn.addEventListener('click', () => this._save());
  }

  async render() {
    if (!this._currentUser) return;
    this._pendingAvatarUrl = undefined;

    // Загрузить актуальные данные профиля с сервера
    try {
      const profile = await this._api.getProfile();
      if (profile) {
        Object.assign(this._currentUser, {
          username: profile.username ?? this._currentUser.username,
          displayName: profile.displayName ?? null,
          bio: profile.bio ?? null,
          avatarUrl: profile.avatarUrl ?? null,
        });
      }
    } catch {
      // Если запрос не удался — используем локальные данные
    }

    const { username, displayName, bio, avatarUrl } = this._currentUser;

    // Заполнить поля
    this._usernameInput.value = username || '';
    this._displayNameInput.value = displayName || '';
    this._bioInput.value = bio || '';
    this._bioCharCount.textContent = (bio || '').length;

    // Аватар
    this._renderAvatarPreview(avatarUrl);

    // Превью профиля
    this._renderProfilePreview();

    // Показать подсказку что username нельзя менять
    this._usernameValidation.hidden = true;
    if (username) {
      this._usernameHint.textContent = t('admin.profile.usernameReadonly');
    }
  }

  destroy() {
    // no-op
  }

  // ═══════════════════════════════════════════
  // Аватар
  // ═══════════════════════════════════════════

  async _onAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!this._validateFile(file, {
      maxSize: 2 * 1024 * 1024,
      mimePrefix: 'image/',
      inputEl: this._avatarInput,
    })) return;

    try {
      const result = await this._api.uploadImage(file);
      this._pendingAvatarUrl = result.fileUrl;
      this._renderAvatarPreview(result.fileUrl);
      this._renderProfilePreview();
    } catch {
      this._showToast(t('admin.profile.avatarError'), 'error');
    }

    this._avatarInput.value = '';
  }

  _removeAvatar() {
    this._pendingAvatarUrl = null;
    this._renderAvatarPreview(null);
    this._renderProfilePreview();
  }

  _renderAvatarPreview(avatarUrl) {
    this._avatarPreview.innerHTML = '';
    if (avatarUrl) {
      const img = document.createElement('img');
      img.src = avatarUrl;
      img.alt = t('admin.profile.avatarAlt');
      img.className = 'profile-avatar-img';
      this._avatarPreview.appendChild(img);
      this._avatarRemoveBtn.hidden = false;
    } else {
      const name = this._displayNameInput?.value || this._currentUser?.displayName || this._currentUser?.username || '?';
      const initial = name.charAt(0).toUpperCase();
      const hue = this._hashToHue(this._currentUser?.username || name);
      const placeholder = document.createElement('div');
      placeholder.className = 'profile-avatar-placeholder';
      placeholder.style.background = `hsl(${hue}, 45%, 45%)`;
      const span = document.createElement('span');
      span.textContent = initial;
      placeholder.appendChild(span);
      this._avatarPreview.appendChild(placeholder);
      this._avatarRemoveBtn.hidden = true;
    }
  }

  // ═══════════════════════════════════════════
  // Превью профиля
  // ═══════════════════════════════════════════

  _renderProfilePreview() {
    if (!this._previewContainer) return;

    const username = this._usernameInput?.value || this._currentUser?.username || '';
    const displayName = this._displayNameInput?.value || this._currentUser?.displayName || username;
    const bio = this._bioInput?.value || '';
    const avatarUrl = this._pendingAvatarUrl !== undefined ? this._pendingAvatarUrl : this._currentUser?.avatarUrl;
    const name = displayName || username || '?';
    const initial = name.charAt(0).toUpperCase();
    const hue = this._hashToHue(username || name);

    const tmpl = document.getElementById('tmpl-profile-preview');
    const clone = tmpl.content.cloneNode(true);

    const avatarEl = clone.querySelector('.profile-header-avatar');
    avatarEl.style.background = avatarUrl ? 'transparent' : `hsl(${hue}, 45%, 45%)`;

    if (avatarUrl) {
      const img = document.createElement('img');
      img.src = avatarUrl;
      img.alt = '';
      img.className = 'profile-header-avatar-img';
      avatarEl.innerHTML = '';
      avatarEl.appendChild(img);
    } else {
      clone.querySelector('.profile-header-initial').textContent = initial;
    }

    clone.querySelector('.profile-header-name').textContent = name;

    const usernameEl = clone.querySelector('.profile-header-username');
    if (username) {
      usernameEl.textContent = `@${username}`;
    } else {
      usernameEl.remove();
    }

    const bioEl = clone.querySelector('.profile-header-bio');
    if (bio) {
      bioEl.textContent = bio;
    } else {
      bioEl.remove();
    }

    this._previewContainer.innerHTML = '';
    this._previewContainer.appendChild(clone);
  }

  // ═══════════════════════════════════════════
  // Сохранение
  // ═══════════════════════════════════════════

  async _save() {
    const displayName = this._displayNameInput.value.trim() || null;
    const bio = this._bioInput.value.trim() || null;
    const avatarUrl = this._pendingAvatarUrl !== undefined
      ? this._pendingAvatarUrl
      : (this._currentUser.avatarUrl || null);

    const data = {};
    if (displayName !== undefined) data.displayName = displayName;
    if (bio !== undefined) data.bio = bio;
    data.avatarUrl = avatarUrl;

    try {
      const updated = await this._api.updateProfile(data);

      // Обновить локальное состояние только после успешного сохранения
      Object.assign(this._currentUser, {
        username: updated.username ?? this._currentUser.username,
        displayName: updated.displayName ?? null,
        bio: updated.bio ?? null,
        avatarUrl: updated.avatarUrl ?? null,
      });

      // Сбросить pending — теперь _currentUser актуален
      this._pendingAvatarUrl = undefined;

      this._showToast(t('admin.profile.saved'), 'success');
      this._renderProfilePreview();
    } catch (err) {
      const message = err.message || t('admin.profile.saveError');
      this._showToast(message, 'error');
    }
  }

  // ═══════════════════════════════════════════
  // Утилиты
  // ═══════════════════════════════════════════

  _hashToHue(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
  }
}
