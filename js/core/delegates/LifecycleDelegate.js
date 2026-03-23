/**
 * LIFECYCLE DELEGATE
 * Управление жизненным циклом книги: открытие, закрытие, репагинация.
 *
 * Основные операции:
 * - open()       → Открыть книгу с анимацией и загрузкой контента
 * - close()      → Закрыть книгу с анимацией
 * - repaginate() → Пересчитать страницы (при смене шрифта/размера)
 */

import { getConfig, BookState } from '../../config.js';
import { ErrorHandler } from '../../utils/ErrorHandler.js';
import { AmbientManager } from '../../managers/AmbientManager.js';
import { BaseDelegate, DelegateEvents } from './BaseDelegate.js';
import { trackReadingSessionStart, trackReadingSessionEnd } from '../../utils/Analytics.js';

export class LifecycleDelegate extends BaseDelegate {
  /**
   * @param {Object} deps
   * @param {BookStateMachine} deps.stateMachine
   * @param {BackgroundManager} deps.backgroundManager
   * @param {ContentLoader} deps.contentLoader
   * @param {AsyncPaginator} deps.paginator
   * @param {BookRenderer} deps.renderer
   * @param {BookAnimator} deps.animator
   * @param {LoadingIndicator} deps.loadingIndicator
   * @param {SoundManager} deps.soundManager
   * @param {MediaQueryManager} deps.mediaQueries
   * @param {DOMManager} deps.dom
   * @param {Object} deps.state
   */
  constructor(deps) {
    super(deps);
    this.contentLoader = deps.contentLoader;
    this.paginator = deps.paginator;
    this.loadingIndicator = deps.loadingIndicator;
  }

  /**
   * Валидация зависимостей
   * @protected
   */
  _validateRequiredDependencies(deps) {
    this._validateDependencies(
      deps,
      [
        'stateMachine',
        'backgroundManager',
        'contentLoader',
        'paginator',
        'renderer',
        'animator',
        'loadingIndicator',
        'dom',
        'mediaQueries',
        'state'
      ],
      'LifecycleDelegate'
    );
  }

  /**
   * Инициализация - предзагрузка обложки и звуков
   */
  async init() {
    const coverBg = this.isMobile ? getConfig().COVER_BG_MOBILE : getConfig().COVER_BG;
    await Promise.all([
      this.backgroundManager.preload(coverBg, true),
      this.soundManager ? this.soundManager.preload() : Promise.resolve(),
    ]);
  }

  /**
   * Открыть книгу
   * @param {number} startIndex - Индекс начальной страницы
   */
  async open(startIndex = 0) {
    this._assertAlive();

    // ─── Этап 1: Проверка состояния ───
    if (this.isBusy || !this.stateMachine.isClosed) {
      return;
    }

    if (!this.stateMachine.transitionTo(BookState.OPENING)) {
      return;
    }

    // ─── Этап 2: Звук открытия ───
    if (this.soundManager) {
      this.soundManager.play('bookOpen');
    }

    try {
      this.loadingIndicator.show();

      // ─── Этап 3: Параллельная загрузка (анимация + контент) ───
      // Связываем операции: если одна упадёт — отменяем вторую,
      // чтобы избежать рассогласования состояния.
      const chapters = getConfig().CHAPTERS.map(c => ({
        file: c.file, id: c.id, title: c.title, htmlContent: c.htmlContent,
        _idb: c._idb, _hasHtmlContent: c._hasHtmlContent,
      }));

      const animationPromise = this.animator.runOpenAnimation()
        .catch((err) => { this.contentLoader.abort(); throw err; });

      const contentPromise = this.contentLoader.load(chapters)
        .catch((err) => { this.animator.abort(); throw err; });

      const [signal, html] = await Promise.all([
        animationPromise,
        contentPromise,
      ]);

      // Проверка после await: делегат мог быть уничтожен
      if (this.isDestroyed) return;

      if (!signal || !html) {
        // Анимация была отменена — восстанавливаем состояние
        this._recoverToSafeState();
        return;
      }

      // ─── Этап 4: Ожидание стабилизации layout ───
      await this._waitForLayout();

      if (this.isDestroyed) return;

      const rightA = this.dom.get('rightA');
      if (!rightA) {
        throw new Error('LifecycleDelegate: rightA element not found');
      }

      // ─── Этап 5: Пагинация контента ───
      const chapterTitles = getConfig().CHAPTERS.map(c => c.title || '');
      const { pageData, chapterStarts } = await this.paginator.paginate(html, rightA, { chapterTitles });

      if (this.isDestroyed) return;

      this.emit(DelegateEvents.PAGINATION_COMPLETE, { pageData, chapterStarts });

      // ─── Этап 6: Рендеринг начального разворота ───
      const maxIndex = this.renderer.getMaxIndex(this.isMobile);
      const safeStartIndex = Math.max(0, Math.min(startIndex, maxIndex));

      this.renderer.renderSpread(safeStartIndex, this.isMobile);

      this.emit(DelegateEvents.INDEX_CHANGE, safeStartIndex);
      this.emit(DelegateEvents.CHAPTER_UPDATE);

      // ─── Этап 7: Завершение анимации и переход в OPENED ───
      await this.animator.finishOpenAnimation(signal);

      if (this.isDestroyed) return;

      this.stateMachine.transitionTo(BookState.OPENED);

      // ─── Этап 8: Аналитика — начало сессии чтения ───
      trackReadingSessionStart(getConfig().BOOK_ID || 'default', safeStartIndex);

      // ─── Этап 9: Запуск ambient звука ───
      // (требует user gesture, поэтому здесь, а не при инициализации)
      this._startAmbientIfNeeded();

    } catch (error) {
      // Не обрабатываем ошибки, если делегат был уничтожен
      if (this.isDestroyed) return;

      if (error.name !== "AbortError") {
        ErrorHandler.handle(error, "Ошибка при открытии книги");
      }
      this._recoverToSafeState();
    } finally {
      if (!this.isDestroyed) {
        this.loadingIndicator.hide();
      }
    }
  }

  /**
   * Закрыть книгу
   */
  async close() {
    this._assertAlive();

    // ─── Этап 1: Проверка состояния ───
    if (this.isBusy || !this.isOpened) {
      return;
    }

    if (!this.stateMachine.transitionTo(BookState.CLOSING)) {
      return;
    }

    // ─── Этап 2: Звук закрытия ───
    if (this.soundManager) {
      this.soundManager.play('bookClose');
    }

    // ─── Этап 3: Скрытие страниц перед анимацией ───
    const leftA = this.dom.get('leftA');
    const rightA = this.dom.get('rightA');

    if (leftA) {
      leftA.classList.add("closing-hidden");
      leftA.innerHTML = "";
    }

    if (rightA) {
      rightA.classList.add("closing-hidden");
      rightA.innerHTML = "";
    }

    try {
      // ─── Этап 4: Анимация закрытия ───
      await this.animator.runCloseAnimation();

      // Проверка после await: делегат мог быть уничтожен
      if (this.isDestroyed) return;

      // ─── Этап 5: Восстановление и очистка ───
      if (leftA) leftA.classList.remove("closing-hidden");
      if (rightA) rightA.classList.remove("closing-hidden");

      this.renderer.clearCache();

      // ─── Этап 6: Аналитика — конец сессии чтения ───
      trackReadingSessionEnd();

      // ─── Этап 7: Переход в CLOSED ───
      this.stateMachine.transitionTo(BookState.CLOSED);

    } catch (error) {
      // Не обрабатываем ошибки, если делегат был уничтожен
      if (this.isDestroyed) return;

      if (error.name !== "AbortError") {
        ErrorHandler.handle(error, "Ошибка при закрытии книги");
      }

      // Восстанавливаем DOM: убираем классы скрытия
      if (leftA) leftA.classList.remove("closing-hidden");
      if (rightA) rightA.classList.remove("closing-hidden");

      this._recoverToSafeState();
    }
  }

  /**
   * Репагинация при изменении шрифта/размера/ориентации
   * @param {boolean} keepIndex - Сохранить текущую позицию
   */
  async repaginate(keepIndex = false) {
    // Сохраняем состояние для возможного recovery
    const stateBeforeRepaginate = this.stateMachine.state;


    try {
      // ─── Этап 1: Подготовка ───
      this.loadingIndicator.show();
      this.renderer.clearCache();

      const prevIndex = keepIndex ? this.currentIndex : 0;

      const rightA = this.dom.get('rightA');
      if (!rightA) {
        throw new Error('LifecycleDelegate: rightA element not found during repagination');
      }

      // ─── Этап 2: Загрузка контента ───
      const chapters = getConfig().CHAPTERS.map(c => ({
        file: c.file, id: c.id, title: c.title, htmlContent: c.htmlContent,
        _idb: c._idb, _hasHtmlContent: c._hasHtmlContent,
      }));
      const html = await this.contentLoader.load(chapters);

      // Проверка после await: делегат мог быть уничтожен
      if (this.isDestroyed) return;

      if (!html) {
        throw new Error('LifecycleDelegate: Failed to load content during repagination');
      }

      // ─── Этап 3: Пагинация ───
      const chapterTitles = getConfig().CHAPTERS.map(c => c.title || '');
      const { pageData, chapterStarts } = await this.paginator.paginate(html, rightA, { chapterTitles });

      if (this.isDestroyed) return;

      this.emit(DelegateEvents.PAGINATION_COMPLETE, { pageData, chapterStarts });

      // ─── Этап 4: Рендеринг с сохранением позиции ───
      const maxIndex = this.renderer.getMaxIndex(this.isMobile);
      const newIndex = keepIndex ? Math.min(prevIndex, maxIndex) : 0;

      this.renderer.renderSpread(newIndex, this.isMobile);

      this.emit(DelegateEvents.INDEX_CHANGE, newIndex);
      this.emit(DelegateEvents.CHAPTER_UPDATE);

    } catch (error) {
      // Не обрабатываем ошибки, если делегат был уничтожен
      if (this.isDestroyed) return;

      ErrorHandler.handle(error, "Ошибка при репагинации");

      // Восстанавливаем состояние, которое было до репагинации
      this._recoverToSafeState(stateBeforeRepaginate);
    } finally {
      if (!this.isDestroyed) {
        this.loadingIndicator.hide();
      }
    }
  }

  /**
   * Восстановить state machine в безопасное состояние после ошибки
   *
   * Определяет целевое состояние на основе текущего:
   * - OPENING → CLOSED (откат открытия)
   * - CLOSING → OPENED (откат закрытия)
   * - Иначе → переданное состояние или без изменений
   *
   * @private
   * @param {string} [fallbackState] - Состояние по умолчанию, если не удалось определить
   */
  _recoverToSafeState(fallbackState) {
    const currentState = this.stateMachine.state;

    // Определяем безопасное состояние на основе текущего
    const recoveryMap = {
      [BookState.OPENING]: BookState.CLOSED,
      [BookState.CLOSING]: BookState.OPENED,
    };

    const targetState = recoveryMap[currentState] || fallbackState;

    if (targetState && currentState !== targetState) {
      console.warn(
        `LifecycleDelegate: recovering state machine from ${currentState} to ${targetState}`
      );
      this.stateMachine.reset(targetState);
    }
  }

  /**
   * Запустить ambient звук, если он выбран в настройках
   * @private
   */
  _startAmbientIfNeeded() {
    if (!this.ambientManager || !this.settings) return;

    const ambientType = this.settings.get("ambientType");
    if (ambientType && ambientType !== AmbientManager.TYPE_NONE) {
      // Запускаем с fade-in для плавного появления
      this.ambientManager.setType(ambientType, true);
    }
  }

  /**
   * Ожидание стабилизации layout
   * @private
   */
  async _waitForLayout() {
    const book = this.dom.get('book');
    const rightA = this.dom.get('rightA');

    if (!book || !rightA) return;

    const bookWidth = book.offsetWidth;
    const minPageWidth = bookWidth * getConfig().LAYOUT.MIN_PAGE_WIDTH_RATIO;
    const settleDelay = getConfig().LAYOUT.SETTLE_DELAY;
    /** Max time to wait for layout to stabilize before proceeding anyway */
    const LAYOUT_TIMEOUT = 3000;

    return new Promise((resolve) => {
      let settled = false;
      const deadline = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve();
        }
      }, LAYOUT_TIMEOUT);

      const checkLayout = () => {
        const pageWidth = rightA.offsetWidth;

        if (pageWidth >= minPageWidth && !settled) {
          settled = true;
          clearTimeout(deadline);
          setTimeout(resolve, settleDelay);
        } else if (!settled) {
          requestAnimationFrame(checkLayout);
        }
      };

      checkLayout();
    });
  }

  /**
   * Очистка
   */
  destroy() {
    this.contentLoader = null;
    this.paginator = null;
    this.loadingIndicator = null;
    super.destroy();
  }
}
