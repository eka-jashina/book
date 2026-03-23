/**
 * APP INITIALIZER
 * Управляет процессом инициализации приложения.
 *
 * Последовательность инициализации:
 * 1. Применение настроек к DOM
 * 2. Настройка UI (фон, кнопки, режим ридера)
 * 3. Привязка событий
 * 4. Ожидание загрузки шрифтов
 * 5. Предзагрузка обложки
 *
 * Режимы ридера (Phase 6):
 * - owner: полный доступ (текущее поведение + кнопка «Редактировать»)
 * - guest: только чтение (имя автора + ссылка на полку, скрыта кнопка редактирования)
 * - embed: минимальный UI (только книга + перелистывание, ссылка «Открыть на Flipbook»)
 */

import { getConfig } from '../config.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';
import { AmbientManager } from '../managers/AmbientManager.js';
import { t, getLanguage, applyTranslations } from '@i18n';

export class AppInitializer {
  /**
   * @param {Object} context
   * @param {'owner'|'guest'|'embed'} [context.readerMode='owner']
   * @param {Object} [context.bookOwner] - { username, displayName, avatarUrl, bio }
   * @param {string} [context.bookId]
   */
  constructor(context) {
    this.dom = context.dom;
    this.settings = context.settings;
    this.settingsDelegate = context.settingsDelegate;
    this.backgroundManager = context.backgroundManager;
    this.eventController = context.eventController;
    this.dragDelegate = context.dragDelegate;
    this.lifecycleDelegate = context.lifecycleDelegate;
    this.readerMode = context.readerMode || 'owner';
    this.bookOwner = context.bookOwner || null;
    this.bookId = context.bookId || null;
    this._editBtnHandler = null;
  }

  /**
   * Инициализировать приложение
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this._applySettings();
      this._setupUI();
      this._applyReaderMode();
      this._bindEvents();

      await document.fonts.ready;
      await this.lifecycleDelegate.init();
    } catch (error) {
      ErrorHandler.handle(error, t('error.initialization'));
      throw error;
    }
  }

  /**
   * Применить сохраненные настройки к DOM
   * @private
   */
  _applySettings() {
    this.settingsDelegate.apply();
  }

  /**
   * Настроить начальное состояние UI
   * @private
   */
  _setupUI() {
    // Установить фон обложки
    this.backgroundManager.setBackground(getConfig().COVER_BG);
    this.dom.get('body').dataset.chapter = "cover";

    // Показать/скрыть кнопку "Продолжить" в зависимости от сохраненной позиции.
    // Явный hidden = true нужен, т.к. DOM может содержать артефакты предыдущей сессии.
    const savedPage = this.settings.get("page");
    const continueBtn = this.dom.get('continueBtn');
    if (continueBtn) continueBtn.hidden = !(savedPage > 0);

    // Сбросить навигационный UI (счётчик страниц, прогресс-бар), чтобы не показывать
    // артефакты предыдущей книги. Актуальные значения появятся после пагинации.
    const currentPageEl = this.dom.get('currentPage');
    const totalPagesEl = this.dom.get('totalPages');
    const progressBar = this.dom.get('readingProgress');
    if (currentPageEl) currentPageEl.textContent = '1';
    if (totalPagesEl) totalPagesEl.textContent = '1';
    if (progressBar) {
      progressBar.style.setProperty('--progress-width', '0%');
      progressBar.setAttribute('aria-valuenow', '0');
    }

    // Синхронизировать настройки шрифта
    const fontSelect = this.dom.get('fontSelect');
    const fontSizeValue = this.dom.get('fontSizeValue');

    if (fontSelect) fontSelect.value = this.settings.get("font");
    if (fontSizeValue) fontSizeValue.textContent = this.settings.get("fontSize");

    // Синхронизировать theme segmented control
    const themeSegmented = this.dom.get('themeSegmented');
    const savedTheme = this.settings.get("theme");

    if (themeSegmented) {
      const segments = themeSegmented.querySelectorAll('.theme-segment');
      segments.forEach(segment => {
        const isActive = segment.dataset.theme === savedTheme;
        segment.dataset.active = isActive;
        segment.setAttribute('aria-checked', isActive);
      });
    }

    // Синхронизировать контролы звука
    const soundToggle = this.dom.get('soundToggle');
    const volumeSlider = this.dom.get('volumeSlider');

    if (soundToggle) {
      soundToggle.checked = this.settings.get("soundEnabled");
    }

    if (volumeSlider) {
      volumeSlider.value = this.settings.get("soundVolume") * 100;
    }

    // Синхронизировать контролы ambient (новые pill buttons)
    const ambientPills = this.dom.get('ambientPills');
    const ambientVolume = this.dom.get('ambientVolume');
    const ambientVolumeWrapper = this.dom.get('ambientVolumeWrapper');

    if (ambientPills) {
      // Заполнить pills из конфигурации
      this._populateAmbientPills(ambientPills);

      const savedType = this.settings.get("ambientType");
      this._updateAmbientPillsState(ambientPills, savedType);

      // Показать/скрыть слайдер громкости в зависимости от типа
      if (ambientVolumeWrapper && savedType !== AmbientManager.TYPE_NONE) {
        ambientVolumeWrapper.classList.add('visible');
      }
    }

    if (ambientVolume) {
      const savedVolume = this.settings.get("ambientVolume");
      ambientVolume.value = savedVolume * 100;
    }

    // Синхронизировать селектор языка
    const languageSelect = this.dom.get('languageSelect');
    if (languageSelect) {
      languageSelect.value = getLanguage();
    }

    // Обновить переводы в DOM
    applyTranslations();

    // Состояние volume control для перелистывания управляется через CSS :has()
  }

  /**
   * Применить режим ридера к UI (Phase 6)
   * @private
   */
  _applyReaderMode() {
    const body = document.body;
    body.dataset.readerMode = this.readerMode;

    if (this.readerMode === 'embed') {
      this._setupEmbedMode();
    } else if (this.readerMode === 'guest') {
      this._setupGuestMode();
    } else {
      this._setupOwnerMode();
    }
  }

  /**
   * Настроить embed-режим: минимальный UI
   * @private
   */
  _setupEmbedMode() {
    document.body.classList.add('embed-mode');

    // Скрыть панель управления (настройки, аудио, кнопки навигации к полке)
    const controls = document.querySelector('.controls');
    if (controls) controls.hidden = true;

    // Скрыть кнопку "назад к полке"
    const backBtn = document.getElementById('backToShelfBtn');
    if (backBtn) backBtn.hidden = true;

    // Показать ссылку «Открыть на Flipbook»
    const embedLink = document.getElementById('embed-open-link');
    if (embedLink && this.bookId) {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      embedLink.href = `${base}/book/${this.bookId}`;
      embedLink.hidden = false;
    }

    // Показать watermark «Powered by Flipbook»
    const watermark = document.getElementById('embed-watermark');
    if (watermark) {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      watermark.href = `${base}/`;
      watermark.hidden = false;
    }
  }

  /**
   * Настроить гостевой режим: чтение без редактирования
   * @private
   */
  _setupGuestMode() {
    // Кнопки «Редактировать» и «К полке» скрыты через CSS
    // (body[data-reader-mode="owner"] показывает их только для владельца)

    // Показать информацию об авторе
    this._showAuthorInfo();
  }

  /**
   * Настроить режим владельца: полный доступ
   * @private
   */
  _setupOwnerMode() {
    const editBtn = document.getElementById('reader-edit-btn');
    if (editBtn && this.bookId) {
      editBtn.hidden = false;
      this._editBtnHandler = () => {
        const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
        window.history.pushState(null, '', `${base}/account?edit=${this.bookId}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      };
      editBtn.addEventListener('click', this._editBtnHandler);
    }
  }

  /**
   * Показать имя автора и ссылку на полку (гостевой режим)
   * @private
   */
  _showAuthorInfo() {
    const authorEl = document.getElementById('reader-author-info');
    if (!authorEl || !this.bookOwner) return;

    const name = this.bookOwner.displayName || this.bookOwner.username || '';
    const username = this.bookOwner.username;

    const nameSpan = authorEl.querySelector('.reader-author-name');
    if (nameSpan) nameSpan.textContent = name;

    if (username) {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      authorEl.href = `${base}/${username}`;
      authorEl.dataset.route = `/${username}`;
    }

    authorEl.hidden = false;
  }

  /**
   * Заполнить pill buttons для выбора ambient из конфигурации
   * @private
   * @param {HTMLElement} container
   */
  _populateAmbientPills(container) {
    container.innerHTML = '';

    const tmpl = document.getElementById('tmpl-ambient-pill');
    for (const [type, config] of Object.entries(getConfig().AMBIENT)) {
      const frag = tmpl.content.cloneNode(true);
      const pill = frag.querySelector('.ambient-pill');
      pill.dataset.type = type;

      // Для встроенных амбиентов используем i18n ключи
      const i18nLabel = t(`ambient.${type}`, { defaultValue: '' });
      const i18nShort = t(`ambient.${type}Short`, { defaultValue: '' });
      const label = i18nLabel || config.label;
      const shortLabel = i18nShort || config.shortLabel || label;

      pill.setAttribute('aria-label', label);
      pill.querySelector('.ambient-pill-icon').textContent = config.icon || '🎵';
      pill.querySelector('.ambient-pill-label').textContent = shortLabel;
      container.appendChild(frag);
    }
  }

  /**
   * Обновить состояние активности pills
   * @private
   * @param {HTMLElement} container
   * @param {string} activeType
   */
  _updateAmbientPillsState(container, activeType) {
    const pills = container.querySelectorAll('.ambient-pill');
    pills.forEach(pill => {
      const isActive = pill.dataset.type === activeType;
      pill.dataset.active = isActive;
      pill.setAttribute('aria-checked', isActive);
    });
  }

  /**
   * Очистить ресурсы (event listeners) при уничтожении ридера.
   */
  destroy() {
    if (this._editBtnHandler) {
      const editBtn = document.getElementById('reader-edit-btn');
      if (editBtn) editBtn.removeEventListener('click', this._editBtnHandler);
      this._editBtnHandler = null;
    }
  }

  /**
   * Привязать все события
   * @private
   */
  _bindEvents() {
    const {
      nextBtn, prevBtn, tocBtn, continueBtn, cover,
      increaseBtn, decreaseBtn, fontSizeValue, fontSelect, languageSelect, themeSegmented, debugToggle,
      soundToggle, volumeSlider,
      ambientPills, ambientVolume, ambientVolumeWrapper,
      fullscreenBtn
    } = this.dom.elements;

    this.eventController.bind({
      nextBtn, prevBtn, tocBtn, continueBtn,
      coverEl: cover,
      increaseBtn, decreaseBtn, fontSizeValue, fontSelect, languageSelect, themeSegmented, debugToggle,
      soundToggle, volumeSlider,
      ambientPills, ambientVolume, ambientVolumeWrapper,
      fullscreenBtn
    });

    this.dragDelegate.bind();
  }
}
