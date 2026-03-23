/**
 * BOOK CONTROLLER
 * DI-контейнер и жизненный цикл приложения.
 *
 * Ответственность:
 * - Оркестрация графа зависимостей (через BookControllerBuilder)
 * - Создание медиатора и менеджеров (фазы 4-5)
 * - Управление жизненным циклом (init / destroy)
 *
 * Координация событий между делегатами вынесена в DelegateMediator.
 * Чистая конструкция сервисов/компонентов/делегатов — в BookControllerBuilder.
 *
 * Граф зависимостей инициализации:
 *
 *   buildBookComponents()  — фазы 1-3, чистая конструкция (BookControllerBuilder)
 *        ↓
 *   _createMediator()      — фаза 4, зависит от delegates + services + components
 *        ↓
 *   _setupManagers()       — фаза 5, зависит от core + mediator + stateMachine
 */

import { mediaQueries, ErrorHandler, getAnnouncer } from '../utils/index.js';
import { AppInitializer } from './AppInitializer.js';
import { SubscriptionManager } from './SubscriptionManager.js';
import { ResizeHandler } from './ResizeHandler.js';
import { DelegateMediator } from './DelegateMediator.js';
import { buildBookComponents } from './BookControllerBuilder.js';

export class BookController {
  /**
   * @param {Object} [_config] - CONFIG (устанавливается через loadConfigFromAPI, здесь не используется)
   * @param {Object} [options]
   * @param {import('../utils/ApiClient.js').ApiClient} [options.apiClient] - API клиент
   * @param {string} [options.bookId] - ID книги
   * @param {Object} [options.serverProgress] - Прогресс чтения с сервера
   * @param {'owner'|'guest'|'embed'} [options.readerMode='owner'] - Режим ридера (Phase 6)
   * @param {Object} [options.bookOwner] - Данные автора книги (guest/embed режим)
   */
  constructor(_config, options = {}) {
    this.isDestroyed = false;
    this._apiClient = options.apiClient || null;
    this._bookId = options.bookId || null;
    this._readerMode = options.readerMode || 'owner';
    this._bookOwner = options.bookOwner || null;

    /** @type {import('../types.js').BookControllerState} Централизованное состояние */
    this.state = {
      index: 0,
      chapterStarts: []
    };

    // Screen reader announcer (singleton)
    this.announcer = getAnnouncer();

    // Фазы 1-3: чистая конструкция графа зависимостей
    const {
      core, factory, settings, audio, render, content,
      stateMachine, debugPanel, delegates,
    } = buildBookComponents({
      state: this.state,
      apiClient: this._apiClient,
      bookId: this._bookId,
      serverProgress: options.serverProgress,
      readerMode: this._readerMode,
    });

    this.core = core;
    this.factory = factory;
    this.settings = settings;
    this.audio = audio;
    this.render = render;
    this.content = content;
    this.stateMachine = stateMachine;
    this.debugPanel = debugPanel;
    this.chapterDelegate = delegates.chapter;
    this.navigationDelegate = delegates.navigation;
    this.lifecycleDelegate = delegates.lifecycle;
    this.settingsDelegate = delegates.settings;
    this.dragDelegate = delegates.drag;

    // Подключить sync-индикатор (серверный режим)
    if (this._apiClient && this._bookId) {
      this._setupSyncIndicator();
    }

    // Фазы 4-5: медиатор и менеджеры (требуют доступа к this)
    this._createMediator();
    this._setupManagers();
  }

  // ═══════════════════════════════════════════
  // ВЫЧИСЛЯЕМЫЕ СВОЙСТВА
  // ═══════════════════════════════════════════

  get isMobile() {
    return mediaQueries.isMobile;
  }

  // Удобные геттеры для совместимости с существующим кодом
  get index() { return this.state.index; }
  set index(value) { this.state.index = value; }

  get chapterStarts() { return this.state.chapterStarts; }
  set chapterStarts(value) { this.state.chapterStarts = value; }

  // ═══════════════════════════════════════════
  // ИНИЦИАЛИЗАЦИЯ (фазы 4-5)
  // ═══════════════════════════════════════════

  /**
   * Проверить наличие обязательных зависимостей для фазы инициализации.
   * @private
   * @param {Object<string, *>} deps - Объект { имя: значение } зависимостей
   * @param {string} phase - Имя фазы для сообщения об ошибке
   * @throws {Error} Если хотя бы одна зависимость null/undefined
   */
  _assertDependencies(deps, phase) {
    const missing = Object.entries(deps)
      .filter(([, value]) => value === null || value === undefined)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(
        `BookController.${phase}: отсутствуют зависимости: ${missing.join(', ')}. ` +
        `Проверьте порядок инициализации.`
      );
    }
  }

  /**
   * Подключить индикатор синхронизации к SettingsManager
   * @private
   */
  _setupSyncIndicator() {
    const el = document.getElementById('sync-indicator');
    const textEl = document.getElementById('sync-indicator-text');
    if (!el || !textEl) return;

    this.settings.onSyncStateChange = (state) => {
      el.hidden = false;
      el.className = 'sync-indicator';

      switch (state) {
        case 'syncing':
          el.classList.add('sync-indicator--syncing');
          textEl.textContent = 'Сохранение...';
          break;
        case 'synced':
          el.classList.add('sync-indicator--synced');
          textEl.textContent = 'Сохранено';
          // Скрыть через 2 секунды
          setTimeout(() => { el.hidden = true; }, 2000);
          break;
        case 'error':
          el.classList.add('sync-indicator--error');
          textEl.textContent = 'Не сохранено';
          break;
      }
    };
  }

  /**
   * Создать медиатор для координации событий между делегатами
   * @private
   */
  _createMediator() {
    this._assertDependencies({
      navigationDelegate: this.navigationDelegate,
      lifecycleDelegate: this.lifecycleDelegate,
      settingsDelegate: this.settingsDelegate,
      chapterDelegate: this.chapterDelegate,
      dragDelegate: this.dragDelegate,
      stateMachine: this.stateMachine,
      settings: this.settings,
      render: this.render,
      core: this.core,
      debugPanel: this.debugPanel,
      factory: this.factory,
    }, '_createMediator');

    this.mediator = new DelegateMediator({
      state: this.state,
      delegates: {
        navigation: this.navigationDelegate,
        lifecycle: this.lifecycleDelegate,
        settings: this.settingsDelegate,
        chapter: this.chapterDelegate,
        drag: this.dragDelegate,
      },
      services: {
        settings: this.settings,
        renderer: this.render.renderer,
        dom: this.core.dom,
        eventManager: this.core.eventManager,
        stateMachine: this.stateMachine,
        debugPanel: this.debugPanel,
        announcer: this.announcer,
      },
      isMobileFn: () => this.isMobile,
    });

    // EventController (переиспользуем фабрику)
    this.eventController = this.factory.createEventController({
      onFlip: (dir) => this.navigationDelegate.flip(dir),
      onTOCClick: (ch) => this.navigationDelegate.handleTOCNavigation(ch),
      onOpen: (cont) => this.mediator.handleBookOpen(cont),
      onSettings: (k, v) => this.settingsDelegate.handleChange(k, v),
      isBusy: () => this.stateMachine.isBusy || this.dragDelegate?.isActive,
      isOpened: () => this.stateMachine.isOpened,
      getFontSize: () => this.settings.get("fontSize"),
    });

    // Инициализатор приложения
    this.initializer = new AppInitializer({
      dom: this.core.dom,
      settings: this.settings,
      settingsDelegate: this.settingsDelegate,
      backgroundManager: this.content.backgroundManager,
      eventController: this.eventController,
      dragDelegate: this.dragDelegate,
      lifecycleDelegate: this.lifecycleDelegate,
      readerMode: this._readerMode,
      bookOwner: this._bookOwner,
      bookId: this._bookId,
    });
  }

  /**
   * Настроить менеджеры подписок и resize
   * @private
   */
  _setupManagers() {
    this._assertDependencies({
      core: this.core,
      mediator: this.mediator,
      stateMachine: this.stateMachine,
    }, '_setupManagers');

    this.subscriptions = new SubscriptionManager();
    this.resizeHandler = new ResizeHandler({
      eventManager: this.core.eventManager,
      timerManager: this.core.timerManager,
      repaginateFn: (keepIndex) => this.mediator.repaginate(keepIndex),
      isOpenedFn: () => this.stateMachine.isOpened,
      isDestroyedFn: () => this.isDestroyed,
    });
  }

  // ═══════════════════════════════════════════
  // ПУБЛИЧНЫЙ API
  // ═══════════════════════════════════════════

  /**
   * Проверить, что контроллер не уничтожен (use-after-free guard).
   * @private
   * @throws {Error}
   */
  _assertAlive() {
    if (this.isDestroyed) {
      throw new Error('BookController: вызов после уничтожения (use-after-free)');
    }
  }

  async init() {
    if (this.isDestroyed) return;

    try {
      await this.initializer.initialize();

      this.subscriptions.subscribeToState(
        this.stateMachine,
        this.core.dom,
        () => this.mediator.updateDebug()
      );

      this.subscriptions.subscribeToPagination(
        this.render.paginator,
        this.render.loadingIndicator
      );

      this.subscriptions.subscribeToMediaQueries(
        (keepIndex) => this.mediator.repaginate(keepIndex),
        () => this.stateMachine.isOpened
      );

      this.subscriptions.subscribeToSwipeHint(this.stateMachine);

      this.resizeHandler.bind();
      this.mediator.updateDebug();
    } catch (error) {
      // Очистить частично установленные подписки, чтобы не оставлять
      // несогласованное состояние (часть подписок есть, часть — нет)
      this.subscriptions?.unsubscribeAll();
      this.resizeHandler?.destroy();
      ErrorHandler.handle(error, "Не удалось инициализировать приложение");
      throw error;
    }
  }

  /**
   * Уничтожить контроллер и очистить ресурсы.
   * Каждый компонент уничтожается в отдельном try-catch, чтобы
   * ошибка в одном не блокировала очистку остальных.
   */
  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    const errors = [];

    /** @param {Function} fn */
    const safeDestroy = (fn) => {
      try { fn(); } catch (err) { errors.push(err); }
    };

    // 1. Отписываемся от всех событий (не вызывает делегаты/сервисы)
    safeDestroy(() => this.subscriptions?.unsubscribeAll());
    safeDestroy(() => this.resizeHandler?.destroy());

    // 2. Уничтожаем делегаты (могут ещё обращаться к сервисам при cleanup)
    const delegates = [
      this.navigationDelegate,
      this.settingsDelegate,
      this.lifecycleDelegate,
      this.chapterDelegate,
      this.dragDelegate,
      this.eventController,
    ];
    delegates.forEach((d) => safeDestroy(() => d?.destroy?.()));

    // 3. Уничтожаем отдельные компоненты
    safeDestroy(() => this.initializer?.destroy());
    safeDestroy(() => this.stateMachine?.destroy?.());
    safeDestroy(() => this.settings?.destroy?.());

    // 4. Уничтожаем сервисные группы в порядке обратном зависимостям:
    //    content → render → audio → core (core — последним, от него зависят все)
    safeDestroy(() => this.content?.destroy());
    safeDestroy(() => this.render?.destroy());
    safeDestroy(() => this.audio?.destroy());

    // 5. Сброс DOM книги в начальное состояние (до уничтожения core)
    //    Без этого при повторном открытии book-wrap остаётся в "opened",
    //    анимация не запускается и страницы рендерятся пустыми.
    safeDestroy(() => this.core?.dom?.resetBookDOM());

    safeDestroy(() => this.core?.destroy());

    if (errors.length > 0) {
      console.error(`BookController.destroy: ${errors.length} ошибок при очистке:`, errors);
    }

    // Зануляем ссылки
    this.state = null;
    this.mediator = null;
    this.core = null;
    this.audio = null;
    this.render = null;
    this.content = null;
    this.factory = null;
    this.settings = null;
    this.stateMachine = null;
    this.eventController = null;
    this.navigationDelegate = null;
    this.settingsDelegate = null;
    this.lifecycleDelegate = null;
    this.chapterDelegate = null;
    this.dragDelegate = null;
  }
}
