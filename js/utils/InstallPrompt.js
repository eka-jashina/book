/**
 * PWA INSTALL PROMPT
 *
 * Показывает баннер с предложением установить приложение.
 * Автоматически обрабатывает событие beforeinstallprompt.
 *
 * Особенности:
 * - Не показывается если приложение уже установлено (standalone)
 * - Не показывается если пользователь уже отклонил предложение
 * - Показывается через 30 секунд после первого посещения
 * - Можно повторно вызвать из настроек
 */

import { StorageManager } from './StorageManager.js';

const storage = new StorageManager('flipbook_install_dismissed');
const DELAY_MS = 30000; // 30 секунд перед показом

export class InstallPrompt {
  constructor() {
    /** @type {BeforeInstallPromptEvent|null} */
    this._deferredPrompt = null;
    /** @type {HTMLElement|null} */
    this._banner = null;
    /** @type {number|null} */
    this._showTimeout = null;
    /** @type {Function[]} */
    this._listeners = [];

    this._boundOnBeforeInstall = this._onBeforeInstall.bind(this);
    this._boundOnAppInstalled = this._onAppInstalled.bind(this);

    this._init();
  }

  /**
   * Инициализация
   * @private
   */
  _init() {
    // Не показываем если уже в standalone режиме (установлено как PWA)
    if (this._isStandalone()) {
      return;
    }

    // Слушаем события браузера
    window.addEventListener('beforeinstallprompt', this._boundOnBeforeInstall);
    window.addEventListener('appinstalled', this._boundOnAppInstalled);
  }

  /**
   * Проверка standalone режима
   * @private
   * @returns {boolean}
   */
  _isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  /**
   * Проверка, отклонял ли пользователь установку
   * @private
   * @returns {boolean}
   */
  _isDismissed() {
    return storage.getRaw() === 'true';
  }

  /**
   * Сохранить отклонение
   * @private
   */
  _setDismissed() {
    storage.setRaw('true');
  }

  /**
   * Обработчик события beforeinstallprompt
   * @private
   * @param {BeforeInstallPromptEvent} e
   */
  _onBeforeInstall(e) {
    // Отменяем стандартный промпт браузера
    e.preventDefault();

    // Сохраняем событие для последующего использования
    this._deferredPrompt = e;

    // Уведомляем слушателей о доступности установки
    this._notifyListeners('available');

    // Если пользователь не отклонял - показываем баннер через таймаут
    if (!this._isDismissed()) {
      this._scheduleShow();
    }
  }

  /**
   * Обработчик успешной установки
   * @private
   */
  _onAppInstalled() {
    this._deferredPrompt = null;
    this.hide();
    this._notifyListeners('installed');
  }

  /**
   * Запланировать показ баннера
   * @private
   */
  _scheduleShow() {
    if (this._showTimeout) {
      clearTimeout(this._showTimeout);
    }

    this._showTimeout = setTimeout(() => {
      this.show();
    }, DELAY_MS);
  }

  /**
   * Уведомить слушателей
   * @private
   * @param {'available'|'installed'|'dismissed'} event
   */
  _notifyListeners(event) {
    this._listeners.forEach(fn => {
      try {
        fn(event);
      } catch (e) {
        console.error('InstallPrompt listener error:', e);
      }
    });
  }

  /**
   * Привязать обработчики к статическому баннеру
   * @private
   */
  _bindBannerEvents() {
    const banner = document.getElementById('install-prompt');
    if (!banner || banner._promptEventsBound) return;

    banner._promptEventsBound = true;

    const installBtn = banner.querySelector('.install-prompt__btn--install');
    const dismissBtn = banner.querySelector('.install-prompt__btn--dismiss');
    const closeBtn = banner.querySelector('.install-prompt__close');

    if (installBtn) installBtn.addEventListener('click', () => this.install());
    if (dismissBtn) dismissBtn.addEventListener('click', () => this.dismiss());
    if (closeBtn) closeBtn.addEventListener('click', () => this.dismiss());
  }

  /**
   * Показать баннер
   */
  show() {
    // Не показываем если нет промпта или уже показан
    if (!this._deferredPrompt || this._banner) {
      return;
    }

    this._banner = document.getElementById('install-prompt');
    if (!this._banner) return;

    this._bindBannerEvents();
    this._banner.hidden = false;

    // Анимация появления
    requestAnimationFrame(() => {
      this._banner?.classList.add('install-prompt--visible');
    });
  }

  /**
   * Скрыть баннер
   */
  hide() {
    if (!this._banner) return;

    this._banner.classList.remove('install-prompt--visible');

    // Скрываем после анимации
    setTimeout(() => {
      if (this._banner) {
        this._banner.hidden = true;
      }
      this._banner = null;
    }, 300);
  }

  /**
   * Отклонить предложение
   */
  dismiss() {
    this._setDismissed();
    this.hide();
    this._notifyListeners('dismissed');
  }

  /**
   * Запустить установку
   */
  async install() {
    if (!this._deferredPrompt) {
      return false;
    }

    // Показываем нативный промпт
    this._deferredPrompt.prompt();

    // Ждём ответа пользователя
    const { outcome } = await this._deferredPrompt.userChoice;

    // Очищаем промпт (его можно использовать только один раз)
    this._deferredPrompt = null;
    this.hide();

    return outcome === 'accepted';
  }

  /**
   * Доступна ли установка
   * @returns {boolean}
   */
  get canInstall() {
    return this._deferredPrompt !== null && !this._isStandalone();
  }

  /**
   * Подписка на события
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  onStateChange(callback) {
    this._listeners.push(callback);

    // Сразу уведомляем если установка уже доступна
    if (this._deferredPrompt) {
      callback('available');
    }

    return () => {
      const idx = this._listeners.indexOf(callback);
      if (idx !== -1) {
        this._listeners.splice(idx, 1);
      }
    };
  }

  /**
   * Сбросить отклонение (для повторного показа из настроек)
   */
  resetDismissed() {
    storage.clear();
  }

  /**
   * Очистка ресурсов
   */
  destroy() {
    if (this._showTimeout) {
      clearTimeout(this._showTimeout);
    }

    window.removeEventListener('beforeinstallprompt', this._boundOnBeforeInstall);
    window.removeEventListener('appinstalled', this._boundOnAppInstalled);

    this.hide();
    this._listeners = [];
  }
}

// Экспорт синглтона для удобства
export const installPrompt = new InstallPrompt();
