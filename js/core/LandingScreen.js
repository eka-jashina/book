/**
 * LANDING SCREEN — FOLIANT
 *
 * Экран-лендинг для неавторизованных пользователей.
 * Hero с табами (книги / фотоальбомы), витрина публичных книг,
 * секции «Для кого», «Как это работает», «Возможности», финальный CTA, footer.
 *
 * Табы переключаются вручную + авто-слайд каждые 6 секунд.
 * Данные витрины загружаются из GET /api/public/discover.
 * CTA-кнопки открывают AuthModal.
 *
 * Переключатель языка позволяет гостям менять язык интерфейса.
 */

import { t, setLanguage, getLanguage, applyTranslations } from '@i18n';
import { StorageManager } from '../utils/StorageManager.js';
import { ThemeToggle } from '../utils/ThemeToggle.js';

const AUTO_SLIDE_INTERVAL = 6000;
const languageStorage = new StorageManager('flipbook-language');

export class LandingScreen {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - DOM-контейнер (#landing-screen)
   * @param {Function} options.onAuth - Колбэк при нажатии CTA (показать AuthModal)
   */
  constructor({ container, onAuth }) {
    this.container = container;
    this._onAuth = onAuth;
    this._boundClick = this._handleClick.bind(this);
    this._boundLangChange = this._handleLanguageChange.bind(this);
    this._observer = null;
    this._autoSlideTimer = null;
    this._tabs = [];
    this._panels = [];
    this._activeTab = 'books';
    this._langSelect = null;
    this._themeToggle = null;
  }

  /**
   * Показать лендинг и загрузить витрину
   */
  async show() {
    this.container.hidden = false;
    document.body.dataset.screen = 'landing';

    this._tabs = [...this.container.querySelectorAll('.landing-tab')];
    this._panels = [...this.container.querySelectorAll('.landing-tab-panel')];

    this.container.addEventListener('click', this._boundClick);

    // Переключатель темы
    const themeSlot = this.container.querySelector('#landing-theme-toggle');
    if (themeSlot && !this._themeToggle) {
      this._themeToggle = new ThemeToggle({ className: 'theme-toggle--landing' });
      themeSlot.appendChild(this._themeToggle.element);
    }

    // Переключатель языка
    this._langSelect = this.container.querySelector('#landing-lang-select');
    if (this._langSelect) {
      this._langSelect.value = getLanguage();
      this._langSelect.addEventListener('change', this._boundLangChange);
    }

    // Применить переводы к лендингу
    applyTranslations(this.container);

    this._setupScrollAnimations();
    this._startAutoSlide();

    // Загрузить витрину публичных книг (не блокируем показ)
    this._loadShowcase();
  }

  /**
   * Скрыть лендинг
   */
  hide() {
    this.container.hidden = true;
    this._stopAutoSlide();
  }

  /**
   * Очистка
   */
  destroy() {
    this.container.removeEventListener('click', this._boundClick);
    if (this._langSelect) {
      this._langSelect.removeEventListener('change', this._boundLangChange);
      this._langSelect = null;
    }
    if (this._themeToggle) {
      this._themeToggle.destroy();
      this._themeToggle = null;
    }
    this._stopAutoSlide();
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
  }

  // ═══════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════

  /**
   * Смена языка из селектора на лендинге
   * @param {Event} e
   */
  async _handleLanguageChange(e) {
    const code = e.target.value;
    await setLanguage(code);
    languageStorage.setRaw(code);
    applyTranslations(this.container);
  }

  _handleClick(e) {
    // CTA-кнопки
    const cta = e.target.closest('.landing-cta');
    if (cta) {
      e.preventDefault();
      if (this._onAuth) this._onAuth();
      return;
    }

    // Переключение табов
    const tab = e.target.closest('.landing-tab');
    if (tab) {
      e.preventDefault();
      const tabName = tab.dataset.tab;
      if (tabName && tabName !== this._activeTab) {
        this._switchTab(tabName);
        // Сброс авто-слайда при ручном переключении
        this._resetAutoSlide();
      }
      return;
    }

    // Клик по карточке книги в витрине
    const card = e.target.closest('[data-book-id]');
    if (card) {
      // Пока ничего — в будущем можно переходить к /book/:id
    }
  }

  /**
   * Переключить активный таб
   * @param {string} tabName - 'books' | 'albums'
   */
  _switchTab(tabName) {
    this._activeTab = tabName;

    for (const tab of this._tabs) {
      tab.classList.toggle('landing-tab--active', tab.dataset.tab === tabName);
    }

    for (const panel of this._panels) {
      panel.classList.toggle('landing-tab-panel--active', panel.dataset.panel === tabName);
    }
  }

  /**
   * Авто-переключение табов
   */
  _startAutoSlide() {
    this._stopAutoSlide();
    this._autoSlideTimer = setInterval(() => {
      const next = this._activeTab === 'books' ? 'albums' : 'books';
      this._switchTab(next);
    }, AUTO_SLIDE_INTERVAL);
  }

  _stopAutoSlide() {
    if (this._autoSlideTimer) {
      clearInterval(this._autoSlideTimer);
      this._autoSlideTimer = null;
    }
  }

  _resetAutoSlide() {
    this._startAutoSlide();
  }

  /**
   * Загрузить публичные книги для витрины
   */
  async _loadShowcase() {
    const showcase = this.container.querySelector('#landing-showcase');
    const grid = this.container.querySelector('#landing-showcase-grid');
    if (!showcase || !grid) return;

    try {
      const resp = await fetch('/api/v1/public/discover?limit=6');
      if (!resp.ok) return;

      const { data: books } = await resp.json();
      if (!books?.length) return;

      grid.innerHTML = '';
      for (const book of books) {
        grid.appendChild(this._createBookCard(book));
      }
      showcase.hidden = false;
    } catch (err) {
      console.debug('LandingScreen: ошибка загрузки витрины', err);
    }
  }

  /**
   * Создать карточку книги для витрины
   * @param {Object} book
   * @returns {HTMLElement}
   */
  _createBookCard(book) {
    const card = document.createElement('div');
    card.className = 'landing-book-card';
    card.dataset.bookId = book.id;

    const tmpl = document.getElementById('tmpl-landing-book-card');
    const frag = tmpl.content.cloneNode(true);

    const bgStart = book.appearance?.light?.coverBgStart || '#3a2d1f';
    const bgEnd = book.appearance?.light?.coverBgEnd || '#2a2016';
    const textColor = book.appearance?.light?.coverText || '#f2e9d8';
    const coverBgImage = book.appearance?.light?.coverBgImage;

    const cover = frag.querySelector('.landing-book-cover');
    cover.style.background = coverBgImage
      ? `linear-gradient(135deg, rgba(0,0,0,0.3), rgba(0,0,0,0.5)), url('${coverBgImage}') center/cover`
      : `linear-gradient(135deg, ${bgStart}, ${bgEnd})`;
    cover.style.color = textColor;

    frag.querySelector('.landing-book-title').textContent = book.title || t('landing.noTitle');

    const authorEl = frag.querySelector('.landing-book-author');
    if (book.author) {
      authorEl.textContent = book.author;
    } else {
      authorEl.remove();
    }

    card.appendChild(frag);
    return card;
  }

  /**
   * Анимация появления секций при скролле
   */
  _setupScrollAnimations() {
    const sections = this.container.querySelectorAll(
      '.landing-audience, .landing-steps, .landing-features, .landing-showcase, .landing-final-cta, .landing-footer',
    );
    if (!sections.length) return;

    this._observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('landing-visible');
            this._observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );

    for (const section of sections) {
      this._observer.observe(section);
    }
  }

}
