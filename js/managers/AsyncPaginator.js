/**
 * ASYNC PAGINATOR
 * Разбивает HTML-контент на страницы с использованием CSS Multi-column layout.
 *
 * Алгоритм работы:
 * 1. Санитизация HTML (защита от XSS)
 * 2. Парсинг и извлечение статей (article)
 * 3. Создание скрытого контейнера с CSS multi-column
 * 4. Добавление оглавления (TOC) и контента по чанкам
 * 5. Выравнивание глав по чётным страницам (desktop)
 * 6. Нарезка на отдельные страницы
 *
 * @fires AsyncPaginator#start - Начало пагинации
 * @fires AsyncPaginator#progress - Прогресс {phase, progress}
 * @fires AsyncPaginator#complete - Завершение {pages, chapterStarts}
 * @fires AsyncPaginator#abort - Отмена операции
 * @fires AsyncPaginator#error - Ошибка
 *
 * @extends EventEmitter
 */

import { EventEmitter } from '../utils/EventEmitter.js';
import { sanitizer } from '../utils/HTMLSanitizer.js';
import { mediaQueries } from '../utils/MediaQueryManager.js';

/**
 * @typedef {Object} PageData
 * @property {HTMLElement} sourceElement - Исходный multi-column элемент (один клон)
 * @property {number} pageCount - Общее количество страниц
 * @property {number} pageWidth - Ширина одной страницы (px)
 * @property {number} pageHeight - Высота одной страницы (px)
 * @property {boolean} hasTOC - Есть ли оглавление (TOC) на первой странице
 */

/**
 * @typedef {Object} PaginationResult
 * @property {PageData|null} pageData - Данные для ленивой материализации страниц
 * @property {number[]} chapterStarts - Индексы страниц, с которых начинаются главы
 */

/**
 * @typedef {Object} PaginatorOptions
 * @property {Object} [sanitizer] - Кастомный санитайзер HTML
 * @property {number} [chunkSize=5] - Количество статей, обрабатываемых за один yield
 * @property {number} [yieldInterval=16] - Интервал yield в мс (~1 кадр при 60fps)
 */

export class AsyncPaginator extends EventEmitter {
  /**
   * Создаёт асинхронный пагинатор
   * @param {PaginatorOptions} [options={}] - Опции конфигурации
   */
  constructor(options = {}) {
    super();
    /** @type {Object} Санитайзер для HTML */
    this.sanitizer = options.sanitizer || sanitizer;
    /** @type {number} Размер чанка для обработки */
    this.chunkSize = options.chunkSize || 5;
    /** @type {number} Интервал yield для UI responsiveness */
    this.yieldInterval = options.yieldInterval || 16;
    /** @type {AbortController|null} Контроллер для отмены операции */
    this.abortController = null;
  }

  /**
   * Разбить HTML-контент на страницы
   *
   * Асинхронно обрабатывает HTML, периодически возвращая управление
   * браузеру для поддержания отзывчивости UI.
   *
   * @param {string} html - HTML-контент для пагинации (должен содержать article элементы)
   * @param {HTMLElement} measureElement - Элемент для измерения размеров страницы
   * @param {Object} [options={}] - Дополнительные опции
   * @param {string[]} [options.chapterTitles] - Заголовки глав (используются в TOC, приоритетнее h2 из HTML)
   * @returns {Promise<PaginationResult>} Результат пагинации
   * @throws {Error} При ошибке обработки (кроме AbortError)
   *
   * @example
   * const paginator = new AsyncPaginator();
   * paginator.on('progress', ({phase, progress}) => updateUI(progress));
   * const {pages, chapterStarts} = await paginator.paginate(html, pageElement);
   */
  async paginate(html, measureElement, options = {}) {
    this.abort();
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const result = { pageData: null, chapterStarts: [] };

    try {
      this.emit("start");

      // Санитизация
      this.emit("progress", { phase: "sanitize", progress: 0 });
      const sanitizedHtml = this.sanitizer.sanitize(html);
      await this._yieldToUI(signal);

      // Парсинг
      this.emit("progress", { phase: "parse", progress: 10 });
      const doc = new DOMParser().parseFromString(sanitizedHtml, "text/html");
      this._restoreAlbumPhotoStyles(doc);
      const articles = [...doc.querySelectorAll("article")];

      if (!articles.length) {
        console.warn("No articles found");
        return result;
      }

      await this._yieldToUI(signal);

      // Создание контейнера для измерений
      this.emit("progress", { phase: "layout", progress: 20 });
      const { container, columnLayout, pageContent, pageWidth, pageHeight } =
        this._createPaginationContainer(measureElement);

      document.body.appendChild(container);

      // Вычислить реальную высоту контента колонки для фотоальбомов:
      // с border-box высота колонки = pageHeight минус вертикальные padding-и .cols.
      // Ставим переменную на columnLayout, чтобы она попала в клон (sourceElement) при рендеринге.
      const columnLayoutStyle = getComputedStyle(columnLayout);
      const colPaddingTop = parseFloat(columnLayoutStyle.paddingTop) || 0;
      const colPaddingBottom = parseFloat(columnLayoutStyle.paddingBottom) || 0;
      const albumPageHeight = pageHeight - colPaddingTop - colPaddingBottom;
      columnLayout.style.setProperty('--album-page-height', `${albumPageHeight}px`);

      try {
        // Оглавление (только если больше одной главы)
        if (articles.length > 1) {
          this._addTOC(pageContent, articles, options.chapterTitles);
        }
        await this._yieldToUI(signal);

        // Статьи
        const isMobile = mediaQueries.isMobile;
        const totalArticles = articles.length;

        for (let i = 0; i < totalArticles; i += this.chunkSize) {
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");

          const chunk = articles.slice(i, Math.min(i + this.chunkSize, totalArticles));
          this._addArticlesChunk(pageContent, chunk, i);

          const progress = 20 + Math.round((i / totalArticles) * 40);
          this.emit("progress", { phase: "content", progress });

          await this._yieldToUI(signal);
        }

        // Выравнивание глав
        if (!isMobile) {
          this.emit("progress", { phase: "align", progress: 65 });
          this._alignChapters(container, pageWidth);
          await this._yieldToUI(signal);
        }

        // Главы
        this.emit("progress", { phase: "chapters", progress: 70 });
        result.chapterStarts = this._calculateChapterStarts(container, pageWidth);
        await this._yieldToUI(signal);

        // Подготовка данных для ленивой материализации страниц
        this.emit("progress", { phase: "slice", progress: 75 });
        const hasTOC = articles.length > 1;
        result.pageData = this._buildPageData(
          columnLayout, pageContent, pageWidth, pageHeight, hasTOC
        );

      } finally {
        document.body.removeChild(container);
      }

      this.emit("progress", { phase: "complete", progress: 100 });
      this.emit("complete", result);

      return result;

    } catch (error) {
      if (error.name === "AbortError") {
        this.emit("abort");
        return result;
      }
      throw error;
    }
  }

  /**
   * Отменить текущую операцию пагинации
   *
   * Если пагинация выполняется, она будет прервана и вызовет событие 'abort'.
   */
  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Передать управление браузеру для обновления UI
   *
   * Используется для предотвращения блокировки главного потока
   * при длительных операциях.
   *
   * @param {AbortSignal} [signal] - Сигнал для отмены
   * @returns {Promise<void>}
   * @throws {DOMException} AbortError при отмене
   * @private
   */
  async _yieldToUI(signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }

      const onAbort = () => {
        clearTimeout(timeoutId);
        reject(new DOMException("Aborted", "AbortError"));
      };

      const timeoutId = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, this.yieldInterval);

      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  /**
   * Создать контейнер для измерения пагинации
   *
   * Создаёт скрытый off-screen контейнер с CSS multi-column layout
   * для расчёта разбиения контента на страницы.
   *
   * @param {HTMLElement} measureElement - Элемент-образец для размеров страницы
   * @returns {{container: HTMLDivElement, columnLayout: HTMLDivElement, pageContent: HTMLDivElement, pageWidth: number, pageHeight: number}}
   * @private
   */
  _createPaginationContainer(measureElement) {
    const pageWidth = measureElement.clientWidth;
    const pageHeight = measureElement.clientHeight;

    const container = document.createElement("div");
    container.style.cssText = `
      position: absolute;
      left: -99999px;
      top: 0;
      height: ${pageHeight}px;
      overflow: hidden;
      visibility: hidden;
    `;

    const columnLayout = document.createElement("div");
    columnLayout.style.cssText = `
      height: 100%;
      column-gap: 0;
      column-width: ${pageWidth}px;
      column-fill: auto;
    `;
    columnLayout.className = "cols";

    const contentWrapper = document.createElement("div");
    const pageContent = document.createElement("div");
    pageContent.className = "page-content";

    contentWrapper.appendChild(pageContent);
    columnLayout.appendChild(contentWrapper);
    container.appendChild(columnLayout);

    return { container, columnLayout, pageContent, pageWidth, pageHeight };
  }

  /**
   * Добавить оглавление (Table of Contents)
   *
   * Создаёт секцию с заголовками всех глав в виде нумерованного списка.
   * Оглавление занимает отдельную колонку (страницу).
   *
   * Приоритет заголовка: chapterTitles[i] > article h2.textContent
   *
   * @param {HTMLElement} pageContent - Контейнер для контента
   * @param {HTMLElement[]} articles - Массив статей (глав)
   * @param {string[]} [chapterTitles] - Заголовки глав из конфигурации
   * @private
   */
  _addTOC(pageContent, articles, chapterTitles) {
    const toc = document.createElement("section");
    toc.className = "toc";

    const tocTitle = document.createElement("h2");
    tocTitle.textContent = "Содержание";

    const tocList = document.createElement("ol");

    articles.forEach((article, i) => {
      // Приоритет: заголовок из конфига, затем h2 из HTML
      const configTitle = chapterTitles?.[i];
      const heading = article.querySelector("h2");
      const title = configTitle || heading?.textContent;
      if (!title) return;

      const li = document.createElement("li");
      li.textContent = title;
      li.dataset.chapter = i;
      li.setAttribute("tabindex", "0");
      li.setAttribute("role", "button");
      tocList.appendChild(li);
    });

    toc.appendChild(tocTitle);
    toc.appendChild(tocList);
    toc.style.breakAfter = "column";
    pageContent.appendChild(toc);
  }

  /**
   * Добавить чанк статей в контейнер
   *
   * Каждая статья предваряется маркером начала главы для последующего
   * расчёта позиций глав. Статьи клонируются для изоляции от оригинала.
   *
   * @param {HTMLElement} pageContent - Контейнер для контента
   * @param {HTMLElement[]} articles - Чанк статей для добавления
   * @param {number} startIndex - Индекс первой статьи в общем массиве
   * @private
   */
  _addArticlesChunk(pageContent, articles, startIndex) {
    articles.forEach((article, i) => {
      const marker = document.createElement("div");
      marker.dataset.chapterStart = startIndex + i;
      marker.style.breakBefore = "column";
      pageContent.appendChild(marker);

      const clone = article.cloneNode(true);
      clone.removeAttribute("id");
      clone.style.margin = "0";
      pageContent.appendChild(clone);
    });
  }

  /**
   * Выровнять главы по чётным страницам (левым в развороте)
   *
   * На desktop книга показывает разворот из двух страниц.
   * Главы должны начинаться с левой страницы (чётный индекс).
   * Если глава попадает на нечётную страницу - вставляется пустой спейсер.
   *
   * @param {HTMLElement} container - Контейнер пагинации
   * @param {number} pageWidth - Ширина одной страницы
   * @private
   */
  _alignChapters(container, pageWidth) {
    const markers = [...container.querySelectorAll("[data-chapter-start]")];

    // offsetLeft вместо getBoundingClientRect:
    // - Не требует colsRect (один layout-read экономится)
    // - offsetLeft возвращает позицию относительно offset-parent (columnLayout),
    //   что эквивалентно markerRect.left - colsRect.left для off-screen контейнера
    // - Аналогично тому, что делает _calculateChapterStarts
    // Layout thrashing при вставке spacer'ов неизбежен — каждый spacer меняет
    // раскладку и влияет на позицию следующих маркеров (это намеренно).
    markers.forEach((marker) => {
      const colIndex = Math.round(marker.offsetLeft / pageWidth);

      if (colIndex % 2 !== 0) {
        const spacer = document.createElement("div");
        spacer.style.height = "100%";
        spacer.style.breakBefore = "column";
        marker.before(spacer);
      }
    });
  }

  /**
   * Рассчитать индексы страниц начала глав
   *
   * Находит все маркеры глав и вычисляет их позиции
   * на основе горизонтального смещения.
   *
   * @param {HTMLElement} container - Контейнер пагинации
   * @param {number} pageWidth - Ширина одной страницы
   * @returns {number[]} Массив индексов страниц начала глав
   * @private
   */
  _calculateChapterStarts(container, pageWidth) {
    const markers = [...container.querySelectorAll("[data-chapter-start]")];
    return markers.map(m => Math.round(m.offsetLeft / pageWidth));
  }

  /**
   * Построить данные для ленивой материализации страниц
   *
   * Вместо создания N DOM-клонов (по одному на страницу), сохраняет
   * один исходный элемент и метаданные. Страницы материализуются
   * по требованию в BookRenderer через LRU-кэш.
   *
   * Для книги в 1200 страниц это экономит ~95% памяти и 2-5 секунд
   * на старте (вместо 1200 cloneNode — один).
   *
   * @param {HTMLElement} columnLayout - Элемент с колонками
   * @param {HTMLElement} pageContent - Контейнер контента
   * @param {number} pageWidth - Ширина страницы
   * @param {number} pageHeight - Высота страницы
   * @returns {PageData} Метаданные для ленивой материализации
   * @private
   */
  _buildPageData(columnLayout, pageContent, pageWidth, pageHeight, hasTOC = false) {
    const measureColumn = document.createElement("div");
    measureColumn.style.width = "1px";
    measureColumn.style.height = `${pageHeight}px`;
    measureColumn.style.breakBefore = "column";
    pageContent.appendChild(measureColumn);

    const measuredColumnCount = Math.max(1, Math.ceil(columnLayout.scrollWidth / pageWidth));
    // Убираем измерительную колонку из подсчёта — она нужна только для измерения,
    // но не содержит реального контента
    const pageCount = Math.max(1, measuredColumnCount - 1);

    // Удаляем измерительную колонку перед клонированием — она не нужна в результате
    pageContent.removeChild(measureColumn);

    // Один клон вместо N: храним исходный элемент для ленивой материализации
    const sourceElement = columnLayout.cloneNode(true);

    this.emit("progress", { phase: "slice", progress: 100 });

    return { sourceElement, pageCount, pageWidth, pageHeight, hasTOC };
  }

  /**
   * Восстановить inline-стили фотоальбома из data-атрибутов после санитизации.
   *
   * Санитайзер удаляет inline style (для безопасности), но data-атрибуты
   * из белого списка сохраняются. Этот метод читает data-filter,
   * data-filter-intensity и data-rotation и применяет соответствующие
   * CSS filter / transform как inline-стили.
   *
   * @param {Document} doc - Распарсенный DOM документа
   * @private
   */
  _restoreAlbumPhotoStyles(doc) {
    for (const img of doc.querySelectorAll('.photo-album__item img')) {
      const filter = img.dataset.filter;
      const intensity = img.dataset.filterIntensity;
      const rotation = img.dataset.rotation;

      if (filter && filter !== 'none') {
        const filterStyle = this._computePhotoFilter(filter, Number(intensity) || 100);
        if (filterStyle) img.style.filter = filterStyle;
      }

      if (rotation && rotation !== '0') {
        img.style.transform = `rotate(${rotation}deg)`;
      }
    }
  }

  /**
   * Вычислить CSS filter для фото альбома
   * (дублирует логику AlbumManager._computeFilterStyle для изоляции от admin-кода)
   *
   * @param {string} filter - Тип фильтра (grayscale, sepia, contrast, warm, cool)
   * @param {number} intensity - Интенсивность 0–100
   * @returns {string} CSS filter value
   * @private
   */
  _computePhotoFilter(filter, intensity) {
    const normalizedIntensity = Math.max(0, Math.min(100, intensity)) / 100;
    switch (filter) {
      case 'grayscale': return `grayscale(${normalizedIntensity})`;
      case 'sepia': return `sepia(${+(normalizedIntensity * 0.75).toFixed(3)})`;
      case 'contrast': return `contrast(${+(1 + normalizedIntensity * 0.35).toFixed(3)})`;
      case 'warm': return `saturate(${+(1 + normalizedIntensity * 0.3).toFixed(3)}) hue-rotate(${+(-normalizedIntensity * 10).toFixed(2)}deg)`;
      case 'cool': return `saturate(${+(1 + normalizedIntensity * 0.1).toFixed(3)}) hue-rotate(${+(normalizedIntensity * 15).toFixed(2)}deg) brightness(${+(1 + normalizedIntensity * 0.05).toFixed(3)})`;
      default: return '';
    }
  }

  /**
   * Уничтожить пагинатор и освободить ресурсы
   *
   * Отменяет текущую операцию (если есть) и очищает подписки EventEmitter.
   */
  destroy() {
    this.abort();
    super.destroy();
  }
}
