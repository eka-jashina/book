/**
 * DOM MANAGER
 * Централизованное кэширование и управление DOM элементами.
 * 
 * Преимущества:
 * - Единая точка доступа к элементам
 * - Проверка существования элементов при старте
 * - Типобезопасность (через JSDoc)
 */

export class DOMManager {
  constructor() {
    this.elements = this._cacheElements();
    this._validateElements();
  }

  /**
   * Кэширование всех DOM элементов
   * @private
   * @returns {Object} Объект с элементами
   */
  _cacheElements() {
    const $ = id => document.getElementById(id);
    
    return {
      // Корневые элементы
      html: document.documentElement,
      body: document.body,

      // Структура книги
      book: $("book"),
      bookWrap: $("book-wrap"),
      cover: $("cover"),

      // Страницы (активный буфер)
      leftA: $("leftA"),
      rightA: $("rightA"),

      // Страницы (вторичный буфер)
      leftB: $("leftB"),
      rightB: $("rightB"),

      // Анимированный лист
      sheet: $("sheet"),
      sheetFront: $("sheetFront"),
      sheetBack: $("sheetBack"),

      // Эффекты
      flipShadow: $("flipShadow"),

      // Загрузка
      loadingOverlay: $("loadingOverlay"),
      loadingProgress: $("loadingProgress"),

      // Элементы навигации (Navigation Pod)
      nextBtn: $("next"),
      prevBtn: $("prev"),
      tocBtn: $("tocBtn"),
      continueBtn: $("continueBtn"),
      currentPage: $("current-page"),
      totalPages: $("total-pages"),
      readingProgress: $("reading-progress"),

      // Элементы настроек (Settings Pod)
      increaseBtn: $("increase"),
      decreaseBtn: $("decrease"),
      fontSizeValue: $("font-size-value"),
      fontSelect: $("font-select"),
      themeSegmented: document.querySelector(".theme-segmented"),
      debugToggle: $("debugToggle"),

      // Элементы звука (Audio Pod)
      soundToggle: $("sound-toggle"),
      volumeSlider: $("volume-slider"),
      pageVolumeControl: $("page-volume-control"),

      // Элементы ambient (кнопки-таблетки)
      ambientPills: document.querySelector(".ambient-pills"),
      ambientVolume: $("ambient-volume"),
      ambientVolumeWrapper: $("ambient-volume-wrapper"),

      // Чекбокс настроек (fallback для Safari без :has())
      settingsCheckbox: $("settings-checkbox"),

      // Язык интерфейса
      languageSelect: $("language-select"),

      // Полноэкранный режим
      fullscreenBtn: $("fullscreen-btn"),

      // Панель отладки
      debugInfo: $("debugInfo"),
      debugState: $("debugState"),
      debugTotal: $("debugTotal"),
      debugCurrent: $("debugCurrent"),
      debugCache: $("debugCache"),
      debugMemory: $("debugMemory"),
      debugListeners: $("debugListeners"),
    };
  }

  /**
   * Проверка критичных элементов
   * @private
   */
  _validateElements() {
    const critical = [
      'book', 'bookWrap', 'leftA', 'rightA', 
      'sheet', 'sheetFront', 'sheetBack'
    ];
    
    const missing = critical.filter(key => !this.elements[key]);
    
    if (missing.length > 0) {
      throw new Error(`Critical DOM elements missing: ${missing.join(', ')}`);
    }
  }

  /**
   * Получить элемент по ключу
   * @param {string} key
   * @returns {HTMLElement|null}
   */
  get(key) {
    return this.elements[key] || null;
  }

  /**
   * Получить несколько элементов
   * @param {...string} keys
   * @returns {Object}
   */
  getMultiple(...keys) {
    const result = {};
    for (const key of keys) {
      result[key] = this.elements[key];
    }
    return result;
  }

  /**
   * Очистить содержимое страниц
   */
  clearPages() {
    const pageIds = ['leftA', 'rightA', 'leftB', 'rightB', 'sheetFront', 'sheetBack'];
    pageIds.forEach(id => {
      const el = this.elements[id];
      if (el) el.innerHTML = "";
    });
  }

  /**
   * Сбросить DOM книги в начальное состояние.
   *
   * При уходе из ридера без штатного close() (например, кнопка «К полке»)
   * на DOM остаются data-state="opened", инвертированные data-active/data-buffer
   * и прочие артефакты предыдущей сессии. Без сброса повторное открытие
   * приводит к пустым страницам: анимация открытия не запускается (bookWrap
   * уже "opened"), а контент рендерится в скрытые элементы.
   */
  resetBookDOM() {
    const { book, bookWrap, cover, sheet,
            leftA, rightA, leftB, rightB,
            sheetFront, sheetBack } = this.elements;

    // Состояния контейнеров → closed (как в исходном HTML)
    if (bookWrap) bookWrap.dataset.state = 'closed';
    if (book) book.dataset.state = 'closed';

    // Обложка: убираем артефакты анимации
    if (cover) delete cover.dataset.animation;

    // Sheet: убираем фазу и направление перелистывания
    if (sheet) {
      delete sheet.dataset.phase;
      delete sheet.dataset.direction;
    }

    // Страницы: восстанавливаем исходные data-active / data-buffer
    // (swapBuffers инвертирует их, destroy не возвращает назад)
    if (leftA) { leftA.dataset.active = 'true'; delete leftA.dataset.buffer; }
    if (rightA) { rightA.dataset.active = 'true'; delete rightA.dataset.buffer; }
    if (leftB) { leftB.dataset.buffer = 'true'; delete leftB.dataset.active; }
    if (rightB) { rightB.dataset.buffer = 'true'; delete rightB.dataset.active; }

    // Очищаем содержимое страниц и sheet
    [leftA, rightA, leftB, rightB, sheetFront, sheetBack].forEach(el => {
      if (el) el.replaceChildren();
    });
  }
}
