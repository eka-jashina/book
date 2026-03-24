/**
 * DELEGATE MEDIATOR
 * Координация между делегатами: маршрутизация событий,
 * обновление состояния, UI навигации и debug-панели.
 *
 * Выделен из BookController для разделения ответственности:
 * - BookController: DI-контейнер, жизненный цикл
 * - DelegateMediator: координация событий между делегатами
 */

import { getConfig } from '../config.js';
import { DelegateEvents } from './delegates/index.js';

export class DelegateMediator {
  /**
   * @param {Object} deps - Зависимости медиатора
   * @param {Object} deps.state - Централизованное состояние приложения
   * @param {Object} deps.delegates - Объект делегатов
   * @param {Object} deps.delegates.navigation - NavigationDelegate
   * @param {Object} deps.delegates.lifecycle - LifecycleDelegate
   * @param {Object} deps.delegates.settings - SettingsDelegate
   * @param {Object} deps.delegates.chapter - ChapterDelegate
   * @param {Object} deps.delegates.drag - DragDelegate
   * @param {Object} deps.services - Сервисы
   * @param {Object} deps.services.settings - SettingsManager
   * @param {Object} deps.services.renderer - BookRenderer
   * @param {Object} deps.services.dom - DOMManager
   * @param {Object} deps.services.eventManager - EventListenerManager
   * @param {Object} deps.services.stateMachine - BookStateMachine
   * @param {Object} deps.services.debugPanel - DebugPanel
   * @param {Object} deps.services.announcer - ScreenReaderAnnouncer
   * @param {Function} deps.isMobileFn - Функция проверки мобильного режима
   */
  constructor(deps) {
    this._state = deps.state;
    this._delegates = deps.delegates;
    this._settings = deps.services.settings;
    this._renderer = deps.services.renderer;
    this._dom = deps.services.dom;
    this._eventManager = deps.services.eventManager;
    this._stateMachine = deps.services.stateMachine;
    this._debugPanel = deps.services.debugPanel;
    this._announcer = deps.services.announcer;
    this._isMobileFn = deps.isMobileFn;

    this._subscribe();
  }

  // ═══════════════════════════════════════════
  // ПОДПИСКИ НА СОБЫТИЯ ДЕЛЕГАТОВ
  // ═══════════════════════════════════════════

  /**
   * Подписаться на события всех делегатов
   * @private
   */
  _subscribe() {
    const { navigation, lifecycle, settings, drag } = this._delegates;

    // События делегата навигации
    navigation.on(DelegateEvents.INDEX_CHANGE, (newIndex) => {
      this.handleIndexChange(newIndex);
    });
    navigation.on(DelegateEvents.BOOK_OPEN, () => {
      this.handleBookOpen();
    });
    navigation.on(DelegateEvents.BOOK_CLOSE, () => {
      this.handleBookClose();
    });

    // События делегата жизненного цикла
    lifecycle.on(DelegateEvents.PAGINATION_COMPLETE, ({ pageData, chapterStarts }) => {
      this.handlePaginationComplete(pageData, chapterStarts);
    });
    lifecycle.on(DelegateEvents.INDEX_CHANGE, (newIndex) => {
      this.handleIndexChange(newIndex);
    });
    lifecycle.on(DelegateEvents.CHAPTER_UPDATE, () => {
      this.updateChapterBackground();
    });

    // События делегата настроек
    settings.on(DelegateEvents.SETTINGS_UPDATE, () => {
      this.updateDebug();
    });
    settings.on(DelegateEvents.REPAGINATE, (keepIndex) => {
      this.repaginate(keepIndex);
    });

    // События делегата перетаскивания
    drag.on(DelegateEvents.INDEX_CHANGE, (newIndex) => {
      this.handleIndexChange(newIndex);
    });
    drag.on(DelegateEvents.CHAPTER_UPDATE, () => {
      this.updateChapterBackground();
    });
  }

  // ═══════════════════════════════════════════
  // ОБРАБОТЧИКИ СОБЫТИЙ
  // ═══════════════════════════════════════════

  /**
   * Обработать изменение индекса.
   *
   * state.index — единственный источник истины для текущей позиции в runtime.
   * settings.page — персистентная копия (localStorage / сервер) для восстановления
   * позиции при следующем открытии книги. Обновляются атомарно здесь.
   *
   * @param {number} newIndex
   */
  handleIndexChange(newIndex) {
    const oldChapter = this._delegates.chapter.getCurrentChapter(this._state.index);

    // Runtime source of truth
    this._state.index = newIndex;
    // Персистентная копия для «Продолжить чтение»
    this._settings.set("page", newIndex);
    this.updateChapterBackground();
    this.updateDebug();
    this.updateNavigationUI();

    // Объявление для screen reader
    const totalPages = this._renderer.totalPages;
    const newChapter = this._delegates.chapter.getCurrentChapter(newIndex);

    if (oldChapter !== newChapter && getConfig().CHAPTERS[newChapter]) {
      const chapterInfo = getConfig().CHAPTERS[newChapter];
      this._announcer.announceChapter(chapterInfo.title || `Глава ${newChapter + 1}`, newChapter + 1);
    } else {
      this._announcer.announcePage(newIndex + 1, totalPages);
    }
  }

  /**
   * Обработать результаты пагинации
   * @param {Object|null} pageData - Данные для ленивой материализации
   * @param {number[]} chapterStarts
   */
  handlePaginationComplete(pageData, chapterStarts) {
    this._renderer.setPaginationData(pageData);
    this._state.chapterStarts = chapterStarts;
    this.updateNavigationUI();

    // Скрыть кнопку содержания если только одна глава
    const tocBtn = this._dom.get('tocBtn');
    if (tocBtn) {
      tocBtn.hidden = chapterStarts.length <= 1;
    }
  }

  /**
   * Обработать открытие книги
   * @param {boolean} continueReading
   */
  async handleBookOpen(continueReading = false) {
    this._announcer.announceLoading('книги');
    const startIndex = continueReading ? this._settings.get("page") : 0;
    await this._delegates.lifecycle.open(startIndex);
    this._announcer.announceBookState(true);
  }

  /**
   * Обработать закрытие книги.
   * Сбрасывает runtime-индекс без персистенции page,
   * чтобы сохранённая позиция осталась для «Продолжить чтение».
   */
  async handleBookClose() {
    await this._delegates.lifecycle.close();
    // Runtime reset (делегаты имеют read-only state, поэтому пишем здесь)
    this._state.index = 0;

    // Восстановить фон обложки (при закрытии книги глава могла оставить другой фон или null)
    this._delegates.chapter.restoreCoverBackground(this._isMobileFn());

    this._announcer.announceBookState(false);
  }

  /**
   * Репагинация контента
   * @param {boolean} keepIndex
   */
  async repaginate(keepIndex) {
    await this._delegates.lifecycle.repaginate(keepIndex);
  }

  /**
   * Обновить фон главы
   */
  updateChapterBackground() {
    this._delegates.chapter.updateBackground(this._state.index, this._isMobileFn());
  }

  /**
   * Обновить панель отладки
   */
  updateDebug() {
    this._debugPanel.update({
      state: this._stateMachine.state,
      totalPages: this._renderer.totalPages,
      currentPage: this._state.index,
      listenerCount: this._eventManager.count,
    });
  }

  /**
   * Обновить навигационный UI (счётчик страниц и прогресс-бар)
   */
  updateNavigationUI() {
    const totalPages = this._renderer.totalPages;
    const currentPage = this._state.index + 1; // 1-based для отображения

    // Обновить счётчик страниц
    const currentPageEl = this._dom.get('currentPage');
    const totalPagesEl = this._dom.get('totalPages');

    if (currentPageEl) currentPageEl.textContent = currentPage;
    if (totalPagesEl) totalPagesEl.textContent = totalPages;

    // Обновить прогресс-бар
    const progressBar = this._dom.get('readingProgress');
    if (progressBar && totalPages > 0) {
      const progress = Math.round((currentPage / totalPages) * 100);
      progressBar.style.setProperty("--progress-width", `${progress}%`);
      progressBar.setAttribute("aria-valuenow", progress);
    }

    // Обновить aria-label счётчика страниц
    const pageCounter = currentPageEl?.closest('.page-counter');
    if (pageCounter) {
      pageCounter.setAttribute('aria-label', `Страница ${currentPage} из ${totalPages}`);
    }
  }
}
