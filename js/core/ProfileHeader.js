/**
 * PROFILE HEADER
 *
 * Компонент шапки профиля — аватар (инициалы), имя, bio.
 * Используется на публичном шкафу (/:username) и в личном кабинете (/account).
 *
 * В режиме хозяина показывает кнопку «Редактировать профиль».
 */

export class ProfileHeader {
  /**
   * @param {Object} options
   * @param {Object} options.user - Данные пользователя { username, displayName, bio }
   * @param {boolean} options.isOwner - Это хозяин профиля?
   * @param {number} [options.booksCount] - Количество книг на полке
   * @param {Function} [options.onEditProfile] - Колбэк при клике «Редактировать профиль»
   * @param {Function} [options.onLogout] - Колбэк при клике «Выйти»
   */
  constructor({ user, isOwner, booksCount, onEditProfile, onLogout }) {
    this._user = user;
    this._isOwner = isOwner;
    this._booksCount = booksCount ?? null;
    this._onEditProfile = onEditProfile;
    this._onLogout = onLogout;
    this._el = null;
  }

  /**
   * Отрендерить шапку в контейнер
   * @param {HTMLElement} container
   */
  render(container) {
    this.destroy();

    const el = document.createElement('div');
    el.className = 'profile-header';
    el.appendChild(this._buildDOM());
    container.prepend(el);
    this._el = el;

    if (this._isOwner) {
      const editBtn = el.querySelector('.profile-header-edit');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          if (this._onEditProfile) this._onEditProfile();
        });
      }
      const logoutBtn = el.querySelector('.profile-header-logout');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          if (this._onLogout) this._onLogout();
        });
      }
    }
  }

  /**
   * Очистка
   */
  destroy() {
    if (this._el) {
      this._el.remove();
      this._el = null;
    }
  }

  // ═══════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════

  _buildDOM() {
    const tmpl = document.getElementById('tmpl-profile-header');
    const frag = tmpl.content.cloneNode(true);

    const { username, displayName, bio } = this._user;
    const name = displayName || username || '?';
    const initial = name.charAt(0).toUpperCase();
    const hue = this._hashToHue(username || name);

    // Аватар
    const avatar = frag.querySelector('.profile-header-avatar');
    const initialEl = frag.querySelector('.profile-header-initial');

    initialEl.textContent = initial;

    if (this._user.avatarUrl) {
      const img = document.createElement('img');
      img.src = this._user.avatarUrl;
      img.alt = name;
      img.className = 'profile-header-avatar-img';
      img.addEventListener('error', () => {
        img.remove();
        avatar.style.background = `hsl(${hue}, 45%, 45%)`;
        initialEl.hidden = false;
      });
      avatar.style.background = 'transparent';
      initialEl.hidden = true;
      avatar.prepend(img);
    } else {
      avatar.style.background = `hsl(${hue}, 45%, 45%)`;
    }

    // Имя, username, bio
    frag.querySelector('.profile-header-name').textContent = name;

    const usernameEl = frag.querySelector('.profile-header-username');
    if (username) {
      usernameEl.textContent = `@${username}`;
    } else {
      usernameEl.remove();
    }

    const bioEl = frag.querySelector('.profile-header-bio');
    if (bio) {
      bioEl.textContent = bio;
    } else {
      bioEl.remove();
    }

    // Кнопки владельца
    const actionsEl = frag.querySelector('.profile-header-actions');
    const editBtn = frag.querySelector('.profile-header-edit');
    const logoutBtn = frag.querySelector('.profile-header-logout');
    if (this._isOwner) {
      editBtn.hidden = false;
      if (this._onLogout) logoutBtn.hidden = false;
      else logoutBtn.remove();
    } else {
      actionsEl.remove();
    }

    // Плашка с количеством книг
    const plaqueEl = frag.querySelector('.profile-header-plaque');
    if (plaqueEl) {
      if (this._booksCount !== null && this._booksCount >= 0) {
        plaqueEl.hidden = false;
        plaqueEl.querySelector('.profile-header-plaque-count').textContent = this._booksCount;
      } else {
        plaqueEl.remove();
      }
    }

    return frag;
  }

  /**
   * Детерминированный hue из строки (для цвета аватара)
   * @param {string} str
   * @returns {number} 0-360
   */
  _hashToHue(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
  }

}
