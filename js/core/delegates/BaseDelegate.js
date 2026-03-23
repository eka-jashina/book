import { cssVars } from '../../utils/CSSVariables.js';
import { EventEmitter } from '../../utils/EventEmitter.js';

/**
 * Типы событий делегатов для коммуникации с контроллером
 */
export const DelegateEvents = Object.freeze({
  INDEX_CHANGE: 'indexChange',
  CHAPTER_UPDATE: 'chapterUpdate',
  BOOK_OPEN: 'bookOpen',
  BOOK_CLOSE: 'bookClose',
  PAGINATION_COMPLETE: 'paginationComplete',
  SETTINGS_UPDATE: 'settingsUpdate',
  REPAGINATE: 'repaginate',
});

/**
 * BASE DELEGATE
 * Базовый класс для всех делегатов с общими зависимостями.
 * Наследует EventEmitter для event-based коммуникации с контроллером.
 *
 * @abstract
 * @extends EventEmitter
 */
export class BaseDelegate extends EventEmitter {
  /**
   * @param {Object} deps - Объект зависимостей
   */
  constructor(deps) {
    super();
    this._validateRequiredDependencies(deps);
    this._deps = deps;
    /** @type {boolean} Флаг уничтожения компонента */
    this._isDestroyed = false;
  }

  /**
   * Валидация обязательных зависимостей
   * Переопределяется в дочерних классах
   * @protected
   * @param {Object} deps
   */
  _validateRequiredDependencies(_deps) {
    // Базовая валидация - переопределяется в наследниках
  }

  /**
   * Валидация списка зависимостей
   * @protected
   * @param {Object} deps - Объект зависимостей
   * @param {string[]} required - Список обязательных ключей
   * @param {string} className - Имя класса для сообщения об ошибке
   */
  _validateDependencies(deps, required, className) {
    const missing = required.filter(key => !deps[key]);
    
    if (missing.length > 0) {
      throw new Error(
        `${className}: Missing required dependencies: ${missing.join(', ')}`
      );
    }
  }

  /**
   * Проверить, что делегат не уничтожен (use-after-free guard).
   * Вызывается в начале публичных методов для раннего обнаружения ошибок.
   *
   * @protected
   * @throws {Error} Если делегат уже уничтожен
   */
  _assertAlive() {
    if (this._isDestroyed) {
      throw new Error(
        `${this.constructor.name}: вызов после уничтожения (use-after-free)`
      );
    }
  }

  // ═══════════════════════════════════════════
  // ОБЩИЕ ГЕТТЕРЫ ДЛЯ ВСЕХ ДЕЛЕГАТОВ
  // ═══════════════════════════════════════════

  /** @returns {BookStateMachine|undefined} */
  get stateMachine() {
    return this._deps.stateMachine;
  }

  /** @returns {BookRenderer|undefined} */
  get renderer() {
    return this._deps.renderer;
  }

  /** @returns {BookAnimator|undefined} */
  get animator() {
    return this._deps.animator;
  }

  /** @returns {SettingsManager|undefined} */
  get settings() {
    return this._deps.settings;
  }

  /** @returns {SoundManager|undefined} */
  get soundManager() {
    return this._deps.soundManager;
  }

  /** @returns {AmbientManager|undefined} */
  get ambientManager() {
    return this._deps.ambientManager;
  }

  /** @returns {MediaQueryManager|undefined} */
  get mediaQueries() {
    return this._deps.mediaQueries;
  }

  /** @returns {DOMManager|undefined} */
  get dom() {
    return this._deps.dom;
  }

  /** @returns {BackgroundManager|undefined} */
  get backgroundManager() {
    return this._deps.backgroundManager;
  }

  /** @returns {Object|undefined} Общее состояние контроллера */
  get state() {
    return this._deps.state;
  }

  // ═══════════════════════════════════════════
  // ВЫЧИСЛЯЕМЫЕ СВОЙСТВА
  // ═══════════════════════════════════════════

  /** @returns {boolean} Мобильный ли режим */
  get isMobile() {
    return this.mediaQueries?.isMobile ?? false;
  }

  /** @returns {number} Текущий индекс страницы */
  get currentIndex() {
    return this.state?.index ?? 0;
  }

  /** @returns {number[]} Индексы начала глав */
  get chapterStarts() {
    return this.state?.chapterStarts ?? [];
  }

  /** @returns {boolean} Открыта ли книга */
  get isOpened() {
    return this.stateMachine?.isOpened ?? false;
  }

  /** @returns {boolean} Занят ли state machine */
  get isBusy() {
    return this.stateMachine?.isBusy ?? false;
  }

  /** @returns {boolean} Уничтожен ли делегат */
  get isDestroyed() {
    return this._isDestroyed;
  }

  /**
   * Количество страниц на переворот (зависит от режима desktop/mobile)
   * @returns {number}
   */
  get pagesPerFlip() {
    return cssVars.getNumber("--pages-per-flip", this.isMobile ? 1 : 2);
  }

  /**
   * Воспроизвести звук перелистывания с небольшой вариацией скорости
   * @protected
   */
  _playFlipSound() {
    if (this.soundManager) {
      const playbackRate = 0.9 + Math.random() * 0.2;
      this.soundManager.play('pageFlip', { playbackRate });
    }
  }

  // ═══════════════════════════════════════════
  // ЖИЗНЕННЫЙ ЦИКЛ
  // ═══════════════════════════════════════════

  /**
   * Очистка ресурсов
   * Переопределяется в дочерних классах при необходимости
   */
  destroy() {
    this._isDestroyed = true;
    this._deps = null;
    this.removeAllListeners();
  }
}
