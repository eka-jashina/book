import { BoolStr, getConfig } from '../config.js';

/**
 * BACKGROUND MANAGER
 * Управление фоновыми изображениями с кроссфейдом и предзагрузкой.
 *
 * Использует технику двойного буфера для плавного кроссфейда между фонами.
 * Два элемента .bg чередуются: один активный (видимый), другой подготавливается.
 *
 * @example
 * const bgManager = new BackgroundManager();
 * await bgManager.preload('chapter2.webp'); // Предзагрузка
 * bgManager.setBackground('chapter2.webp'); // Плавный переход
 */
export class BackgroundManager {
  /** Sentinel: начальное состояние, отличается от null (= «нет фона») */
  static _UNSET = Symbol('unset');
  /**
   * Создаёт менеджер фоновых изображений
   *
   * Ожидает наличие элементов `.chapter-bg .bg` в DOM (минимум 2 для кроссфейда).
   */
  constructor() {
    /** @type {NodeListOf<HTMLElement>} Элементы для фона (чередуются) */
    this.backgrounds = document.querySelectorAll(".chapter-bg .bg");
    /** @type {string|null|symbol} URL текущего фона (Symbol = не задан, отличается от null = «нет фона») */
    this.currentBg = BackgroundManager._UNSET;
    /** @type {number} Индекс активного элемента фона */
    this.activeIndex = 0;
    /** @type {Set<string>} Множество уже загруженных URL */
    this.preloadedUrls = new Set();
    /** @type {Array<{url: string, promise: Promise}>} Очередь загрузки */
    this.preloadQueue = [];
  }

  /**
   * Установить фон с кроссфейд-эффектом и blur placeholder
   *
   * Использует двойную буферизацию: новый фон загружается в неактивный элемент,
   * затем элементы меняются местами через data-active атрибут (CSS transition).
   * Пока изображение загружается, показывается размытый placeholder.
   *
   * @param {string} url - URL изображения фона
   */
  setBackground(url) {
    if (this.currentBg === url) return;
    this.currentBg = url;

    const nextIndex = (this.activeIndex + 1) % this.backgrounds.length;
    const incoming = this.backgrounds[nextIndex];
    const outgoing = this.backgrounds[this.activeIndex];

    // Режим «нет фона» — очищаем изображение
    if (!url) {
      incoming.style.backgroundImage = '';
      incoming.dataset.loading = BoolStr.FALSE;
      incoming.dataset.active = BoolStr.TRUE;
      outgoing.dataset.active = BoolStr.FALSE;
      this.activeIndex = nextIndex;
      return;
    }

    // Если изображение уже предзагружено - показываем сразу без blur
    const isPreloaded = this.preloadedUrls.has(url);

    incoming.style.backgroundImage = `url(${url})`;
    incoming.dataset.loading = isPreloaded ? BoolStr.FALSE : BoolStr.TRUE;
    incoming.dataset.active = BoolStr.TRUE;
    outgoing.dataset.active = BoolStr.FALSE;

    this.activeIndex = nextIndex;

    // Если не предзагружено - загружаем и убираем blur
    if (!isPreloaded) {
      this._loadAndReveal(url, incoming);
    }
  }

  /**
   * Загрузить изображение и убрать blur placeholder
   *
   * @param {string} url - URL изображения
   * @param {HTMLElement} element - Элемент фона для обновления
   * @private
   */
  _loadAndReveal(url, element) {
    const img = new Image();
    const { FETCH_TIMEOUT } = getConfig().NETWORK;

    const timeoutId = setTimeout(() => {
      img.src = '';
      // Таймаут — убираем blur чтобы не застрять
      if (element.style.backgroundImage.includes(url)) {
        element.dataset.loading = BoolStr.FALSE;
      }
    }, FETCH_TIMEOUT);

    img.onload = () => {
      clearTimeout(timeoutId);
      this.preloadedUrls.add(url);
      // Убираем blur только если это всё ещё текущий фон
      if (element.style.backgroundImage.includes(url)) {
        element.dataset.loading = BoolStr.FALSE;
      }
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      // При ошибке тоже убираем blur чтобы не застрять
      if (element.style.backgroundImage.includes(url)) {
        element.dataset.loading = BoolStr.FALSE;
      }
    };

    img.src = url;
  }

  /**
   * Предзагрузить изображение в кэш браузера
   *
   * Использует `<link rel="preload">` для интеграции с HTTP/2 push
   * и оптимальной приоритизации браузером.
   *
   * @param {string} url - URL изображения для предзагрузки
   * @param {boolean} [highPriority=false] - Использовать fetchPriority="high"
   * @returns {Promise<void>} Резолвится при успешной загрузке (ошибки подавляются)
   */
  async preload(url, highPriority = false) {
    if (!url || this.preloadedUrls.has(url)) {
      return Promise.resolve();
    }

    // Если уже в очереди - не добавляем повторно
    if (this.preloadQueue.some(item => item.url === url)) {
      return;
    }

    const preloadPromise = new Promise((resolve, reject) => {
      // Используем link rel="preload" для лучшей интеграции с браузером
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = url;

      if (highPriority) {
        link.fetchPriority = "high";
      }

      let settled = false;
      const { FETCH_TIMEOUT } = getConfig().NETWORK;

      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        console.warn(`Preload timeout for image: ${url}`);
        this._removeFromQueue(url);
        document.head.removeChild(link);
        reject(new Error(`Preload timeout: ${url}`));
      }, FETCH_TIMEOUT);

      link.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.preloadedUrls.add(url);
        this._removeFromQueue(url);
        document.head.removeChild(link);
        resolve();
      };

      link.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        console.warn(`Failed to preload image: ${url}`);
        this._removeFromQueue(url);
        document.head.removeChild(link);
        reject(new Error(`Failed to preload: ${url}`));
      };

      document.head.appendChild(link);
    });

    this.preloadQueue.push({ url, promise: preloadPromise });
    return preloadPromise.catch(() => {}); // Не прерываем выполнение при ошибке
  }

  /**
   * Удалить элемент из очереди загрузки
   *
   * @param {string} url - URL для удаления из очереди
   * @private
   */
  _removeFromQueue(url) {
    const index = this.preloadQueue.findIndex(item => item.url === url);
    if (index !== -1) {
      this.preloadQueue.splice(index, 1);
    }
  }

  /**
   * Освободить ресурсы и очистить ссылки
   *
   * Обнуляет ссылки на DOM-элементы и очищает очереди.
   */
  destroy() {
    this.backgrounds = null;
    this.currentBg = null;
    this.preloadedUrls.clear();
    this.preloadQueue = [];
  }
}