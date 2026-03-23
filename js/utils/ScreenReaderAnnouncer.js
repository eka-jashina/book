/**
 * SCREEN READER ANNOUNCER
 * Управление объявлениями для assistive technology.
 *
 * Использует aria-live регионы для объявления важных событий:
 * - Смена страницы
 * - Смена главы
 * - Загрузка контента
 * - Ошибки
 * - Изменение настроек
 */

export class ScreenReaderAnnouncer {
  /**
   * @param {Object} options
   * @param {string} options.containerId - ID контейнера для объявлений
   * @param {number} options.clearDelay - Задержка перед очисткой (мс)
   */
  constructor(options = {}) {
    this.containerId = options.containerId || 'sr-announcer';
    this.clearDelay = options.clearDelay || 3000;
    this._clearTimer = null;
    this._announceTimer = null;
    this._container = null;

    this._init();
  }

  /**
   * Инициализация контейнера
   * @private
   */
  _init() {
    // Проверяем, существует ли уже контейнер
    this._container = document.getElementById(this.containerId);

    if (!this._container) {
      this._container = document.createElement('div');
      this._container.id = this.containerId;
      this._container.className = 'sr-only';
      this._container.setAttribute('aria-live', 'polite');
      this._container.setAttribute('aria-atomic', 'true');
      this._container.setAttribute('role', 'status');
      document.body.appendChild(this._container);
    }
  }

  /**
   * Объявить сообщение для screen reader
   * @param {string} message - Текст объявления
   * @param {Object} options
   * @param {'polite'|'assertive'} options.priority - Приоритет объявления
   * @param {boolean} options.clear - Очистить после задержки
   */
  announce(message, options = {}) {
    if (!message || !this._container) return;

    const { priority = 'polite', clear = true } = options;

    // Обновляем aria-live в зависимости от приоритета
    this._container.setAttribute('aria-live', priority);

    // Очищаем предыдущий таймер
    if (this._clearTimer) {
      clearTimeout(this._clearTimer);
      this._clearTimer = null;
    }

    // Очищаем предыдущий таймер объявления
    if (this._announceTimer) {
      clearTimeout(this._announceTimer);
      this._announceTimer = null;
    }

    // Устанавливаем новое сообщение
    // Используем setTimeout(0) для гарантии, что screen reader заметит изменение
    this._container.textContent = '';
    this._announceTimer = setTimeout(() => {
      if (this._container) {
        this._container.textContent = message;
      }
    }, 50);

    // Очищаем после задержки
    if (clear) {
      this._clearTimer = setTimeout(() => {
        this._container.textContent = '';
      }, this.clearDelay);
    }
  }

  /**
   * Объявить смену страницы
   * @param {number} current - Текущая страница
   * @param {number} total - Всего страниц
   */
  announcePage(current, total) {
    this.announce(`Страница ${current} из ${total}`);
  }

  /**
   * Объявить смену главы
   * @param {string} chapterName - Название главы
   * @param {number} chapterNumber - Номер главы
   */
  announceChapter(chapterName, chapterNumber) {
    this.announce(`Глава ${chapterNumber}: ${chapterName}`, { priority: 'assertive' });
  }

  /**
   * Объявить начало загрузки
   * @param {string} context - Контекст загрузки
   */
  announceLoading(context = 'контента') {
    this.announce(`Загрузка ${context}...`, { clear: false });
  }

  /**
   * Объявить завершение загрузки
   */
  announceLoadingComplete() {
    this.announce('Загрузка завершена');
  }

  /**
   * Объявить ошибку
   * @param {string} errorMessage - Сообщение об ошибке
   */
  announceError(errorMessage) {
    this.announce(`Ошибка: ${errorMessage}`, { priority: 'assertive' });
  }

  /**
   * Объявить изменение настройки
   * @param {string} settingName - Название настройки
   * @param {string} value - Новое значение
   */
  announceSetting(settingName, value) {
    this.announce(`${settingName}: ${value}`);
  }

  /**
   * Объявить открытие/закрытие книги
   * @param {boolean} isOpen - Книга открыта
   */
  announceBookState(isOpen) {
    this.announce(isOpen ? 'Книга открыта' : 'Книга закрыта');
  }

  /**
   * Очистить текущее объявление
   */
  clear() {
    if (this._announceTimer) {
      clearTimeout(this._announceTimer);
      this._announceTimer = null;
    }
    if (this._clearTimer) {
      clearTimeout(this._clearTimer);
      this._clearTimer = null;
    }
    if (this._container) {
      this._container.textContent = '';
    }
  }

  /**
   * Уничтожить компонент
   */
  destroy() {
    this.clear();
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._container = null;
  }
}

/** @type {ScreenReaderAnnouncer|null} Singleton экземпляр */
let instance = null;

/**
 * Получить singleton экземпляр ScreenReaderAnnouncer
 * @returns {ScreenReaderAnnouncer}
 */
export function getAnnouncer() {
  if (!instance) {
    instance = new ScreenReaderAnnouncer();
  }
  return instance;
}

/**
 * Сбросить singleton (для тестов)
 */
export function resetAnnouncer() {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}

/**
 * Быстрый доступ к методу announce
 * @param {string} message
 * @param {Object} options
 */
export function announce(message, options) {
  getAnnouncer().announce(message, options);
}
