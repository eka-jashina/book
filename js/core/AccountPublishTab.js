/**
 * ACCOUNT PUBLISH TAB
 *
 * Логика вкладки «Публикация» в AccountScreen.
 * Управляет видимостью книги (draft/published), описанием, slug и ссылкой для шаринга.
 */

import { trackBookPublished } from '../utils/Analytics.js';
import { t } from '../i18n/index.js';

/** Regex для валидации slug: латиница, цифры, дефисы, 3-100 символов */
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{2,99}$/;

export class AccountPublishTab {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - Контейнер AccountScreen
   * @param {import('../utils/ApiClient.js').ApiClient} options.apiClient
   * @param {Object} options.store - AdminConfigStore или ServerAdminConfigStore
   * @param {(message: string, type?: string) => void} options.showToast
   * @param {Object|null} [options.currentUser] - Текущий пользователь (для формирования ссылки)
   */
  constructor({ container, apiClient, store, showToast, currentUser }) {
    this._api = apiClient;
    this._store = store;
    this._showToast = showToast;
    this._currentUser = currentUser || null;

    this._publishVisibility = container.querySelector('#publishVisibility');
    this._bookDescription = container.querySelector('#bookDescription');
    this._descCharCount = container.querySelector('#descCharCount');
    this._shareSection = container.querySelector('#shareSection');
    this._shareLink = container.querySelector('#shareLink');
    this._copyShareLinkBtn = container.querySelector('#copyShareLink');
    this._savePublishBtn = container.querySelector('#savePublish');

    // Slug elements
    this._slugSection = container.querySelector('#slugSection');
    this._slugInput = container.querySelector('#bookSlug');
    this._slugStatus = container.querySelector('#slugStatus');
    this._slugPreview = container.querySelector('#slugPreview');

    /** @type {number|null} */
    this._slugCheckTimer = null;
    /** @type {string|null} Текущий валидный slug (для сохранения) */
    this._currentSlug = null;
  }

  bindEvents() {
    this._bookDescription.addEventListener('input', () => {
      this._descCharCount.textContent = this._bookDescription.value.length;
    });

    this._copyShareLinkBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(this._shareLink.value).then(() => {
        this._showToast(t('admin.publication.linkCopied', 'Ссылка скопирована'), 'success');
      }).catch(() => {
        this._shareLink.select();
        document.execCommand('copy');
        this._showToast(t('admin.publication.linkCopied', 'Ссылка скопирована'), 'success');
      });
    });

    if (this._slugInput) {
      this._slugInput.addEventListener('input', () => this._onSlugInput());
    }

    this._savePublishBtn.addEventListener('click', () => this._save());
  }

  /** Заполнить вкладку данными текущей книги */
  async render() {
    const activeBookId = this._store.getActiveBookId?.() ?? null;
    if (!activeBookId || !this._api) return;

    try {
      const book = await this._api.getBook(activeBookId);
      const visibility = book.visibility || 'draft';
      const description = book.description || '';

      const radio = this._publishVisibility.querySelector(`input[value="${visibility}"]`);
      if (radio) radio.checked = true;

      this._bookDescription.value = description;
      this._descCharCount.textContent = description.length;

      // Slug
      this._currentSlug = book.slug || null;
      if (this._slugInput) {
        this._slugInput.value = book.slug || '';
        this._updateSlugPreview(book.slug || '');
        this._clearSlugStatus();
      }

      this._updateShareLink(visibility, activeBookId, book.slug);
    } catch (err) {
      console.debug('AccountPublishTab: не удалось загрузить данные книги', err);
    }
  }

  /** @private Обработка ввода slug */
  _onSlugInput() {
    const raw = this._slugInput.value;
    // Автоматическая нормализация: lowercase, замена пробелов на дефисы, удаление недопустимых символов
    const normalized = raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (normalized !== raw) {
      this._slugInput.value = normalized;
    }

    this._updateSlugPreview(normalized);

    // Debounce проверки на сервере
    if (this._slugCheckTimer) clearTimeout(this._slugCheckTimer);

    if (!normalized) {
      this._clearSlugStatus();
      return;
    }

    if (!SLUG_REGEX.test(normalized)) {
      this._setSlugStatus('error', t('admin.publication.slugInvalid', 'Мин. 3 символа: латиница, цифры, дефисы'));
      return;
    }

    this._setSlugStatus('checking', t('admin.publication.slugChecking', 'Проверяем...'));
    this._slugCheckTimer = setTimeout(() => this._checkSlug(normalized), 400);
  }

  /** @private Проверить slug на сервере */
  async _checkSlug(slug) {
    const activeBookId = this._store.getActiveBookId?.() ?? null;
    try {
      const result = await this._api.checkBookSlug(slug, activeBookId);
      // Проверяем, что slug не изменился пока шёл запрос
      if (this._slugInput.value !== slug) return;
      if (result.available) {
        this._setSlugStatus('ok', t('admin.publication.slugAvailable', 'Адрес свободен'));
      } else {
        this._setSlugStatus('error', t('admin.publication.slugTaken', 'Этот адрес уже занят'));
      }
    } catch {
      this._setSlugStatus('error', t('admin.publication.slugCheckError', 'Ошибка проверки'));
    }
  }

  /** @private */
  _setSlugStatus(type, text) {
    if (!this._slugStatus) return;
    this._slugStatus.textContent = text;
    this._slugStatus.className = `slug-status slug-status--${type}`;
  }

  /** @private */
  _clearSlugStatus() {
    if (!this._slugStatus) return;
    this._slugStatus.textContent = '';
    this._slugStatus.className = 'slug-status';
  }

  /** @private */
  _updateSlugPreview(slug) {
    if (!this._slugPreview) return;
    const username = this._currentUser?.username || '...';
    if (slug) {
      this._slugPreview.textContent = `${location.origin}/${username}/${slug}`;
    } else {
      this._slugPreview.textContent = '';
    }
  }

  async _save() {
    const activeBookId = this._store.getActiveBookId?.() ?? null;
    if (!activeBookId || !this._api) return;

    const selected = this._publishVisibility.querySelector('input[name="bookVisibility"]:checked');
    const visibility = selected?.value || 'draft';
    const description = this._bookDescription.value.trim();
    const slugValue = this._slugInput?.value.trim() || null;

    // Валидация slug перед отправкой
    if (slugValue && !SLUG_REGEX.test(slugValue)) {
      this._showToast(t('admin.publication.slugInvalid', 'Некорректный адрес книги'), 'error');
      return;
    }

    try {
      await this._api.updateBook(activeBookId, { visibility, description, slug: slugValue });
      this._currentSlug = slugValue;
      if (visibility === 'published') {
        trackBookPublished(activeBookId);
      }
      this._showToast(t('admin.publication.saved', 'Настройки публикации сохранены'), 'success');
      this._updateShareLink(visibility, activeBookId, slugValue);
    } catch (err) {
      this._showToast(err.message || t('common.error', 'Ошибка сохранения'), 'error');
    }
  }

  /** @private Обновить ссылку для шаринга */
  _updateShareLink(visibility, bookId, slug) {
    if (visibility !== 'draft') {
      this._shareSection.hidden = false;
      const base = location.origin + (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      const username = this._currentUser?.username;
      if (slug && username) {
        this._shareLink.value = `${base}/${username}/${slug}`;
      } else {
        this._shareLink.value = `${base}/book/${bookId}`;
      }
    } else {
      this._shareSection.hidden = true;
    }
  }
}
