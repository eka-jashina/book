/**
 * BOOK RENDERER
 * Отвечает за рендеринг страниц в DOM.
 *
 * Особенности:
 * - Двойная буферизация (active/buffer) для плавных переходов
 * - Viewport reuse: один клон source на контейнер, переключение через translateX
 * - Раздельный рендеринг для desktop (разворот) и mobile (одна страница)
 * - Подготовка sheet (перелистываемый лист) для анимации
 */

import { BoolStr } from '../config.js';

/** @constant {number} Максимальное количество URL изображений в кэше */
const IMAGE_URL_CACHE_LIMIT = 100;

export class BookRenderer {
  /**
   * @param {Object} options - Конфигурация рендерера
   * @param {HTMLElement} options.leftActive - Левая активная страница
   * @param {HTMLElement} options.rightActive - Правая активная страница
   * @param {HTMLElement} options.leftBuffer - Левый буфер
   * @param {HTMLElement} options.rightBuffer - Правый буфер
   * @param {HTMLElement} options.sheetFront - Лицевая сторона перелистываемого листа
   * @param {HTMLElement} options.sheetBack - Оборотная сторона перелистываемого листа
   */

  constructor(options) {
    /** @type {Set<string>} Уже загруженные URL изображений (ограниченный размер) */
    this.loadedImageUrls = new Set();

    // Данные для ленивой материализации страниц
    /** @type {HTMLElement|null} Исходный multi-column элемент */
    this._sourceElement = null;
    /** @type {number} Общее количество страниц */
    this._totalPages = 0;
    /** @type {number} Ширина одной страницы (px) */
    this._pageWidth = 0;
    /** @type {number} Высота одной страницы (px) */
    this._pageHeight = 0;
    /** @type {boolean} Есть ли оглавление (TOC) на первой странице */
    this._hasTOC = false;
    /** @type {boolean} Запланирован ли pre-warm viewport'ов */
    this._preWarmScheduled = false;
    /** @type {number} Текущий индекс страницы (для pre-warm на нужной позиции) */
    this._currentPageIndex = 0;

    this.elements = {
      leftActive: options.leftActive,
      rightActive: options.rightActive,
      leftBuffer: options.leftBuffer,
      rightBuffer: options.rightBuffer,
      sheetFront: options.sheetFront,
      sheetBack: options.sheetBack,
    };

    // Сброс data-атрибутов в исходное состояние — после предыдущего
    // BookRenderer.swapBuffers() они могут остаться инвертированными
    this._resetBufferAttributes();
  }

  /**
   * Сбросить data-active/data-buffer атрибуты на DOM-элементах в исходное состояние.
   * swapBuffers() инвертирует эти атрибуты при каждом перелистывании,
   * и после destroy() они не восстанавливаются — новый экземпляр
   * рендерит контент в элементы, которые CSS скрывает.
   * @private
   */
  _resetBufferAttributes() {
    const { leftActive, rightActive, leftBuffer, rightBuffer } = this.elements;

    if (leftActive) {
      leftActive.dataset.active = BoolStr.TRUE;
      delete leftActive.dataset.buffer;
    }
    if (rightActive) {
      rightActive.dataset.active = BoolStr.TRUE;
      delete rightActive.dataset.buffer;
    }
    if (leftBuffer) {
      leftBuffer.dataset.buffer = BoolStr.TRUE;
      delete leftBuffer.dataset.active;
    }
    if (rightBuffer) {
      rightBuffer.dataset.buffer = BoolStr.TRUE;
      delete rightBuffer.dataset.active;
    }
  }

  /**
   * Общее количество страниц
   * @returns {number}
   */
  get totalPages() {
    return this._totalPages;
  }

  /**
   * Установить данные пагинации (viewport reuse)
   *
   * Вместо хранения N DOM-клонов, хранит один исходный элемент.
   * При fill() создаётся один клон на контейнер (viewport), дальнейшие
   * переключения страниц — только через CSS translateX (мгновенно, GPU).
   *
   * @param {Object|null} pageData - Данные пагинации
   * @param {HTMLElement} pageData.sourceElement - Исходный multi-column элемент
   * @param {number} pageData.pageCount - Количество страниц
   * @param {number} pageData.pageWidth - Ширина страницы
   * @param {number} pageData.pageHeight - Высота страницы
   * @param {boolean} [pageData.hasTOC=false] - Есть ли оглавление на первой странице
   */
  setPaginationData(pageData) {
    this._sourceElement = pageData?.sourceElement || null;
    this._totalPages = pageData?.pageCount || 0;
    this._pageWidth = pageData?.pageWidth || 0;
    this._pageHeight = pageData?.pageHeight || 0;
    this._hasTOC = pageData?.hasTOC || false;
    // Очищаем все viewport'ы — при смене контента нужны новые клоны
    this._clearAllViewports();
    // Очищаем loadedImageUrls при смене контента для предотвращения утечки памяти
    this.loadedImageUrls.clear();
  }

  /**
   * Заполнить контейнер содержимым страницы (viewport reuse)
   *
   * Если контейнер уже содержит viewport — обновляет только translateX (мгновенно).
   * Если нет — создаёт viewport с одним cloneNode исходного элемента.
   * Итого: максимум 6 клонов (по числу контейнеров), все перелистывания — CSS.
   *
   * @param {HTMLElement} container - Контейнер страницы
   * @param {number} pageIndex - Индекс страницы
   */
  fill(container, pageIndex) {
    if (!container) return;

    // Невалидный индекс — очищаем контейнер
    if (pageIndex < 0 || pageIndex >= this._totalPages || !this._sourceElement) {
      this._clearViewport(container);
      const page = container.closest(".page");
      if (page) page.classList.remove("page--toc");
      return;
    }

    const viewport = container.firstElementChild;

    if (viewport && viewport._isBookViewport) {
      // Viewport уже есть — обновляем только translate3d (мгновенно, GPU-слой)
      viewport.firstChild.style.transform =
        `translate3d(${-pageIndex * this._pageWidth}px, 0px, 0px)`;
    } else {
      // Первый раз для этого контейнера — создаём viewport с клоном
      const newViewport = this._createViewport(pageIndex);
      container.replaceChildren(newViewport);
      this._setupImageBlurPlaceholders(container);
    }

    // Пометить страницу с оглавлением (по метаданным, без DOM-поиска)
    const page = container.closest(".page");
    if (page) {
      page.classList.toggle("page--toc", this._hasTOC && pageIndex === 0);
    }
  }

  /**
   * Создать viewport с клоном исходного элемента
   *
   * Viewport — div с overflow:hidden, внутри клон всего контента.
   * Нужная страница отображается через translateX.
   *
   * @param {number} pageIndex - Индекс страницы для отображения
   * @returns {HTMLElement} Viewport элемент
   * @private
   */
  _createViewport(pageIndex) {
    const viewport = document.createElement("div");
    viewport._isBookViewport = true;
    // contain:strict — изолирует layout/paint от остального DOM,
    // критично для производительности при большом контенте (400+ страниц)
    viewport.style.cssText =
      `width:${this._pageWidth}px;height:${this._pageHeight}px;overflow:hidden;contain:strict;`;

    const clone = this._sourceElement.cloneNode(true);
    clone.style.width = `${this._totalPages * this._pageWidth}px`;
    // Фиксированная высота вместо height:100% из клона —
    // предотвращает проблему в PWA, где contain:strict + dvh
    // могут привести к некорректному разрешению процентной высоты
    clone.style.height = `${this._pageHeight}px`;
    // translate3d промоутит клон в GPU-слой, что заставляет браузер держать
    // paint-кэш наготове даже для скрытых буферных страниц (предотвращает
    // белый проморг при swapBuffers). Современные браузеры используют тайлинг
    // и растеризуют только видимую часть (в пределах viewport overflow:hidden),
    // поэтому GPU-текстура ≈ размер страницы, а не всего контента.
    // will-change НЕ ставим — он создавал постоянный нетайлованный GPU-слой
    // шириной totalPages*pageWidth (до 480MB для 300-страничной книги).
    clone.style.transform = `translate3d(${-pageIndex * this._pageWidth}px, 0px, 0px)`;
    viewport.appendChild(clone);

    return viewport;
  }

  /**
   * Очистить viewport в контейнере
   * @param {HTMLElement} container - Контейнер страницы
   * @private
   */
  _clearViewport(container) {
    container.replaceChildren();
  }

  /**
   * Очистить все viewport'ы во всех контейнерах
   * Вызывается при смене контента (setPaginationData)
   * @private
   */
  _clearAllViewports() {
    if (!this.elements) return;
    const containers = [
      this.elements.leftActive, this.elements.rightActive,
      this.elements.leftBuffer, this.elements.rightBuffer,
      this.elements.sheetFront, this.elements.sheetBack,
    ];
    for (const container of containers) {
      if (container) this._clearViewport(container);
    }
  }

  /**
   * Pre-warm viewports для контейнеров, где их ещё нет.
   *
   * Создаёт по ОДНОМУ viewport'у за кадр (staggered), чтобы не блокировать
   * рендер тяжёлыми cloneNode операциями. Для книги 400+ страниц
   * один cloneNode занимает десятки миллисекунд — 4 за раз = длинный фрейм.
   *
   * Порядок приоритета: sheetFront/Back первыми — они нужны при первом флипе
   * и драге. Буферы вторыми — нужны после завершения анимации (swap buffers).
   *
   * Вызывается через requestIdleCallback (или RAF как fallback).
   * @private
   */
  _preWarmViewports() {
    if (!this._sourceElement || !this.elements) return;

    // sheetFront/Back — в первую очередь: нужны сразу при флипе/драге.
    // leftBuffer/rightBuffer — после: нужны только по завершении анимации.
    const containers = [
      this.elements.sheetFront, this.elements.sheetBack,
      this.elements.leftBuffer, this.elements.rightBuffer,
      this.elements.leftActive, this.elements.rightActive,
    ];

    // Находим первый контейнер без viewport'а
    for (const container of containers) {
      if (!container) continue;
      if (container.firstElementChild?._isBookViewport) continue;

      // Создаём ОДИН viewport на текущей странице и планируем следующий
      container.replaceChildren(this._createViewport(this._currentPageIndex));
      this._schedulePreWarm();
      return;
    }
    // Все контейнеры прогреты — больше не планируем
  }

  /**
   * Настроить placeholder для изображений в контейнере
   * @param {HTMLElement} container - Контейнер с контентом
   * @private
   */
  _setupImageBlurPlaceholders(container) {
    const images = container.querySelectorAll("img");

    images.forEach((img) => {
      const src = img.src;

      // Если это изображение уже загружалось ранее - показываем сразу
      if (this.loadedImageUrls.has(src)) {
        img.dataset.loading = "false";
        return;
      }

      // Если изображение уже загружено (из кэша браузера)
      if (img.complete && img.naturalWidth > 0) {
        this._trackLoadedImage(src);
        img.dataset.loading = "false";
        return;
      }

      // Показываем placeholder
      img.dataset.loading = "true";

      // Убираем placeholder после загрузки
      img.addEventListener("load", () => {
        this._trackLoadedImage(src);
        img.dataset.loading = "false";
      }, { once: true });

      // При ошибке тоже убираем placeholder
      img.addEventListener("error", () => {
        img.dataset.loading = "false";
      }, { once: true });
    });
  }

  /**
   * Добавить URL в список загруженных изображений с ограничением размера
   * @param {string} src - URL изображения
   * @private
   */
  _trackLoadedImage(src) {
    if (this.loadedImageUrls.has(src)) {
      return;
    }

    // FIFO-вытеснение: удаляем самый старый URL при превышении лимита
    if (this.loadedImageUrls.size >= IMAGE_URL_CACHE_LIMIT) {
      const oldestUrl = this.loadedImageUrls.values().next().value;
      this.loadedImageUrls.delete(oldestUrl);
    }

    this.loadedImageUrls.add(src);
  }

  /**
   * Отрендерить текущий разворот (две страницы на desktop, одна на mobile)
   * @param {number} index - Индекс левой страницы
   * @param {boolean} isMobile - Мобильный режим
   */
  renderSpread(index, isMobile) {
    const { leftActive, rightActive } = this.elements;

    if (!this._totalPages) {
      leftActive?.replaceChildren();
      rightActive?.replaceChildren();
      return;
    }

    // Запоминаем текущую позицию — pre-warm создаст viewport'ы на этой странице,
    // а не на странице 0, чтобы браузер не тратил paint на далёкий контент
    this._currentPageIndex = index;

    if (isMobile) {
      // На мобильных: левая пустая, правая = текущая страница
      leftActive?.replaceChildren();
      this.fill(rightActive, index);
    } else {
      // На desktop: левая = чётная, правая = нечётная
      this.fill(leftActive, index);
      this.fill(rightActive, index + 1);
    }

    // Pre-warm: создаём viewport'ы для buffer/sheet контейнеров заранее,
    // чтобы первый flip не тратил время на cloneNode
    this._schedulePreWarm();
  }

  /**
   * Запланировать pre-warm viewport'ов в idle-время браузера.
   *
   * Использует requestIdleCallback когда он доступен — cloneNode выполняется
   * между кадрами, не воруя время у анимаций и пользовательских событий.
   * Для книг 300+ страниц это критично: один cloneNode занимает 30-100мс,
   * и если он попадёт в кадр флипа — анимация подвиснет.
   *
   * Timeout 500мс гарантирует выполнение даже под нагрузкой (например,
   * если пользователь скроллит или взаимодействует сразу после открытия книги).
   *
   * Fallback на RAF для браузеров без requestIdleCallback (Safari < 16).
   * @private
   */
  _schedulePreWarm() {
    if (this._preWarmScheduled) return;
    this._preWarmScheduled = true;

    const doWarm = () => {
      this._preWarmScheduled = false;
      this._preWarmViewports();
    };

    if (typeof requestIdleCallback === 'function') {
      // Idle-время: cloneNode не конкурирует с анимациями и событиями
      requestIdleCallback(doWarm, { timeout: 50 });
    } else {
      // Fallback: RAF (Safari < 16, некоторые WebView)
      requestAnimationFrame(doWarm);
    }
  }

  /**
   * Подготовить буферные страницы для следующего разворота
   * @param {number} index - Индекс левой страницы следующего разворота
   * @param {boolean} isMobile - Мобильный режим
   */
  prepareBuffer(index, isMobile) {
    const { leftBuffer, rightBuffer } = this.elements;

    if (isMobile) {
      leftBuffer?.replaceChildren();
      this.fill(rightBuffer, index);
    } else {
      this.fill(leftBuffer, index);
      this.fill(rightBuffer, index + 1);
    }
  }

  /**
   * Подготовить sheet (перелистываемый лист) для анимации
   * @param {number} currentIndex - Текущий индекс
   * @param {number} nextIndex - Следующий индекс
   * @param {'next'|'prev'} direction - Направление перелистывания
   * @param {boolean} isMobile - Мобильный режим
   */
  prepareSheet(currentIndex, nextIndex, direction, isMobile) {
    const { sheetFront, sheetBack } = this.elements;

    if (isMobile) {
      this.fill(sheetFront, currentIndex);
      this.fill(sheetBack, nextIndex);
    } else {
      // Desktop: sheet содержит правую страницу текущего разворота
      // и левую страницу следующего/предыдущего
      if (direction === "next") {
        this.fill(sheetFront, currentIndex + 1);
        this.fill(sheetBack, currentIndex + 2);
      } else {
        this.fill(sheetFront, currentIndex);
        this.fill(sheetBack, currentIndex - 1);
      }
    }
  }

  /**
   * Поменять местами active и buffer страницы
   * Вызывается в середине анимации перелистывания
   */
  swapBuffers() {
    const { leftActive, rightActive, leftBuffer, rightBuffer } = this.elements;

    // Текущие active становятся buffer
    leftActive.dataset.buffer = BoolStr.TRUE;
    rightActive.dataset.buffer = BoolStr.TRUE;
    leftActive.dataset.active = BoolStr.FALSE;
    rightActive.dataset.active = BoolStr.FALSE;

    // Текущие buffer становятся active
    leftBuffer.dataset.buffer = BoolStr.FALSE;
    rightBuffer.dataset.buffer = BoolStr.FALSE;
    leftBuffer.dataset.active = BoolStr.TRUE;
    rightBuffer.dataset.active = BoolStr.TRUE;

    // Обновляем ссылки
    this.elements.leftActive = leftBuffer;
    this.elements.leftBuffer = leftActive;
    this.elements.rightActive = rightBuffer;
    this.elements.rightBuffer = rightActive;
  }

  /**
   * Очистить все viewport'ы (аналог clearCache для нового подхода).
   * Обнуляет sourceElement, чтобы отложенный pre-warm (requestIdleCallback)
   * не воссоздал viewport'ы со старыми данными пагинации.
   */
  clearCache() {
    this._sourceElement = null;
    this._clearAllViewports();
  }

  /**
   * Получить максимальный допустимый индекс страницы
   * @param {boolean} isMobile - Мобильный режим
   * @returns {number}
   */
  getMaxIndex(isMobile) {
    const total = this._totalPages;
    // На desktop последняя страница = total - 2 (левая страница последнего разворота)
    return isMobile ? total - 1 : Math.max(0, total - 2);
  }

  /**
   * Очистка ресурсов
   */
  destroy() {
    this._preWarmScheduled = false;
    this._currentPageIndex = 0;
    this._clearAllViewports();
    this.loadedImageUrls.clear();
    this._sourceElement = null;
    this._totalPages = 0;
    this._pageWidth = 0;
    this._pageHeight = 0;
    this._hasTOC = false;
    this.elements = null;
  }
}