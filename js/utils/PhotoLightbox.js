/**
 * PHOTO LIGHTBOX
 *
 * Полноэкранный просмотр фотографий из фотоальбома.
 * Использует FLIP-анимацию: изображение «вылетает» из своей позиции
 * в центр экрана и «возвращается» обратно при закрытии.
 *
 * Навигация: стрелки ←/→, кнопки prev/next, свайп на мобильных.
 * Закрытие: крестик, клик по оверлею, Escape, Back (popstate).
 */

const TRANSITION_MS = 300;
const SWIPE_THRESHOLD = 40;

export class PhotoLightbox {
  constructor() {
    /** @type {HTMLElement|null} Оверлей */
    this._overlay = null;
    /** @type {HTMLImageElement|null} Полноэкранное изображение */
    this._img = null;
    /** @type {HTMLButtonElement|null} Кнопка закрытия */
    this._closeBtn = null;
    /** @type {DOMRect|null} Исходная позиция миниатюры */
    this._originRect = null;
    /** @type {HTMLImageElement|null} Исходная миниатюра */
    this._originImg = null;
    /** @type {boolean} */
    this._isOpen = false;
    /** @type {boolean} */
    this._isAnimating = false;
    /** @type {string} Поворот изображения (например 'rotate(90deg)') */
    this._rotation = '';

    /** @type {HTMLImageElement[]} Все фото в текущем контейнере */
    this._images = [];
    /** @type {number} Индекс текущего фото */
    this._currentIndex = -1;

    /** @type {{x: number, y: number}|null} Начало свайпа */
    this._touchStart = null;

    /** @type {number|null} Pending navigation timeout */
    this._navigateTimer = null;
    /** @type {number|null} Pending close animation timeout */
    this._closeTimer = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onPopState = this._onPopState.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);

    this._buildDOM();
  }

  /**
   * Создать DOM-структуру лайтбокса из HTML-шаблона (один раз)
   */
  _buildDOM() {
    const tmpl = document.getElementById('tmpl-lightbox');
    if (!tmpl) return;
    const clone = tmpl.content.cloneNode(true);

    this._overlay = clone.querySelector('.lightbox');
    this._img = clone.querySelector('.lightbox__img');
    this._imgShield = clone.querySelector('.lightbox__shield');
    this._closeBtn = clone.querySelector('.lightbox__close');
    this._prevBtn = clone.querySelector('.lightbox__nav--prev');
    this._nextBtn = clone.querySelector('.lightbox__nav--next');
    this._counter = clone.querySelector('.lightbox__counter');
    this._caption = clone.querySelector('.lightbox__caption');

    // Клик по оверлею или щиту — закрыть (через history.back → popstate → close)
    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay || e.target === this._imgShield) {
        if (this._isOpen) history.back();
      }
    });

    this._closeBtn.addEventListener('click', () => {
      if (this._isOpen) history.back();
    });
    this._prevBtn.addEventListener('click', (e) => { e.stopPropagation(); this.prev(); });
    this._nextBtn.addEventListener('click', (e) => { e.stopPropagation(); this.next(); });

    // Защита от скачивания: блокировка контекстного меню и перетаскивания
    this._overlay.addEventListener('contextmenu', (e) => {
      if (e.target === this._img || e.target === this._imgShield) {
        e.preventDefault();
      }
    });
    this._img.addEventListener('dragstart', (e) => e.preventDefault());

    document.body.appendChild(this._overlay);
  }

  /**
   * Привязать делегированный обработчик клика к контейнеру
   * @param {HTMLElement} container — элемент, на котором слушать клики (обычно .book)
   */
  attach(container) {
    this._container = container;

    // Клик по ::before оверлею (на .photo-album__item) открывает лайтбокс
    container.addEventListener('click', (e) => {
      const item = e.target.closest('.photo-album__item');
      if (!item) return;
      const img = item.querySelector('img');
      if (!img) return;

      e.stopPropagation();
      e.preventDefault();
      this.open(img);
    });

    // Защита от скачивания: блокировка контекстного меню на фото
    container.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.photo-album__item')) {
        e.preventDefault();
      }
    });

    // Защита от скачивания: блокировка перетаскивания изображений
    container.addEventListener('dragstart', (e) => {
      if (e.target.closest('.photo-album__item')) {
        e.preventDefault();
      }
    });
  }

  /**
   * Собрать массив всех фото в контейнере
   */
  _collectImages() {
    if (!this._container) return [];
    return [...this._container.querySelectorAll('.photo-album__item img')].filter(img => img.src);
  }

  /**
   * Открыть лайтбокс с FLIP-анимацией
   * @param {HTMLImageElement} imgEl — кликнутая миниатюра
   */
  open(imgEl) {
    if (this._isOpen || this._isAnimating) return;
    if (!this._overlay) this._buildDOM();
    this._isAnimating = true;

    // Собрать все фото для навигации
    this._images = this._collectImages();
    this._currentIndex = this._images.indexOf(imgEl);

    this._originImg = imgEl;
    this._originRect = imgEl.getBoundingClientRect();

    this._applyImage(imgEl);

    // FLIP: First — установить картинку в позицию миниатюры
    this._setTransformFromRect(this._originRect);
    this._overlay.classList.add('lightbox--visible');

    // Дать браузеру отрисовать первый кадр
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // FLIP: Play — убрать трансформацию, картинка поедет в центр
        this._overlay.classList.add('lightbox--active');
        this._img.style.transform = this._rotation || '';

        this._isOpen = true;
        this._isAnimating = false;
      });
    });

    // Слушатели (capture: перехватить ДО EventController и Router)
    document.addEventListener('keydown', this._onKeyDown, true);
    window.addEventListener('popstate', this._onPopState, true);
    this._overlay.addEventListener('touchstart', this._onTouchStart, { passive: true });
    this._overlay.addEventListener('touchend', this._onTouchEnd, { passive: true });

    // Добавить запись в history, чтобы Back закрывал лайтбокс
    history.pushState({ lightbox: true }, '');
  }

  /**
   * Применить данные изображения к лайтбоксу (src, filter, rotation, caption)
   * @param {HTMLImageElement} imgEl
   */
  _applyImage(imgEl) {
    this._img.src = imgEl.src;
    this._img.alt = imgEl.alt || '';

    // Перенести CSS-фильтр с миниатюры
    const computedFilter = getComputedStyle(imgEl).filter;
    this._img.style.filter = (computedFilter && computedFilter !== 'none') ? computedFilter : '';

    // Перенести поворот с миниатюры (inline style transform:rotate)
    const rotateMatch = imgEl.style.transform?.match(/rotate\(\d+deg\)/);
    this._rotation = rotateMatch ? rotateMatch[0] : '';

    // Подпись из figcaption
    const figcaption = imgEl.closest('.photo-album__item')?.querySelector('figcaption');
    if (figcaption?.textContent) {
      this._caption.textContent = figcaption.textContent;
      this._caption.hidden = false;
    } else {
      this._caption.textContent = '';
      this._caption.hidden = true;
    }

    this._updateNav();
  }

  /**
   * Обновить видимость кнопок навигации и счётчик
   */
  _updateNav() {
    const total = this._images.length;
    const hasPrev = this._currentIndex > 0;
    const hasNext = this._currentIndex < total - 1;

    this._prevBtn.hidden = !hasPrev;
    this._nextBtn.hidden = !hasNext;

    if (total > 1) {
      this._counter.textContent = `${this._currentIndex + 1} / ${total}`;
      this._counter.hidden = false;
    } else {
      this._counter.hidden = true;
    }
  }

  /**
   * Перейти к следующему фото
   */
  next() {
    if (this._isAnimating) return;
    if (this._currentIndex >= this._images.length - 1) return;
    this._navigateTo(this._currentIndex + 1);
  }

  /**
   * Перейти к предыдущему фото
   */
  prev() {
    if (this._isAnimating) return;
    if (this._currentIndex <= 0) return;
    this._navigateTo(this._currentIndex - 1);
  }

  /**
   * Перейти к фото по индексу с crossfade-анимацией
   * @param {number} index
   */
  _navigateTo(index) {
    if (index < 0 || index >= this._images.length) return;

    this._currentIndex = index;
    const imgEl = this._images[index];
    this._originImg = imgEl;

    // Плавная смена: fade-out / fade-in через CSS transition
    this._img.classList.add('lightbox__img--fade');
    if (this._navigateTimer !== null) clearTimeout(this._navigateTimer);
    this._navigateTimer = setTimeout(() => {
      this._navigateTimer = null;
      this._applyImage(imgEl);
      this._img.style.transform = this._rotation || '';
      this._img.classList.remove('lightbox__img--fade');
    }, 150);
  }

  /**
   * Закрыть лайтбокс с обратной анимацией
   */
  close() {
    if (!this._isOpen || this._isAnimating) return;
    this._isAnimating = true;

    // Убрать слушатели (capture: как при добавлении)
    document.removeEventListener('keydown', this._onKeyDown, true);
    window.removeEventListener('popstate', this._onPopState, true);
    this._overlay.removeEventListener('touchstart', this._onTouchStart);
    this._overlay.removeEventListener('touchend', this._onTouchEnd);

    this._overlay.classList.remove('lightbox--active');

    // FLIP обратно: вернуть картинку в позицию миниатюры
    // Пересчитать rect (может измениться при скролле)
    if (this._originImg) {
      this._originRect = this._originImg.getBoundingClientRect();
    }
    if (this._originRect) {
      this._setTransformFromRect(this._originRect);
    }

    this._closeTimer = setTimeout(() => {
      this._closeTimer = null;
      if (!this._overlay) return;
      this._overlay.classList.remove('lightbox--visible');
      this._img.style.transform = '';
      this._img.style.filter = '';
      this._img.src = '';
      this._isOpen = false;
      this._isAnimating = false;
      this._originImg = null;
      this._originRect = null;
      this._rotation = '';
      this._images = [];
      this._currentIndex = -1;
      this._touchStart = null;
    }, TRANSITION_MS);
  }

  /**
   * Установить CSS transform на картинку, чтобы она визуально
   * совпала с переданным rect (позиция миниатюры)
   * @param {DOMRect} rect
   */
  _setTransformFromRect(rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Целевой размер: картинка займёт ~90% экрана с object-fit: contain
    const padding = 40;
    const targetW = vw - padding * 2;
    const targetH = vh - padding * 2;

    // Масштаб миниатюры относительно целевого размера
    const scaleX = rect.width / targetW;
    const scaleY = rect.height / targetH;
    const scale = Math.max(scaleX, scaleY);

    // Центр целевой позиции
    const targetCx = vw / 2;
    const targetCy = vh / 2;

    // Центр миниатюры
    const originCx = rect.left + rect.width / 2;
    const originCy = rect.top + rect.height / 2;

    const dx = originCx - targetCx;
    const dy = originCy - targetCy;

    this._img.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
  }

  /** @private */
  _onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      // Убрать history-запись
      history.back();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.prev();
    }
  }

  /** @private */
  _onPopState(e) {
    if (this._isOpen) {
      // Блокируем всплытие, чтобы Router не обработал этот popstate
      e.stopImmediatePropagation();
      this.close();
    }
  }

  /** @private */
  _onTouchStart(e) {
    if (e.touches.length === 1) {
      this._touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }

  /** @private */
  _onTouchEnd(e) {
    if (!this._touchStart) return;
    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - this._touchStart.x;
    const dy = touch.clientY - this._touchStart.y;
    this._touchStart = null;

    // Горизонтальный свайп с достаточной дистанцией
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) this.next();
      else this.prev();
    }
  }

  destroy() {
    if (this._navigateTimer !== null) {
      clearTimeout(this._navigateTimer);
      this._navigateTimer = null;
    }
    if (this._closeTimer !== null) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
    }
    document.removeEventListener('keydown', this._onKeyDown, true);
    window.removeEventListener('popstate', this._onPopState, true);
    this._overlay?.removeEventListener('touchstart', this._onTouchStart);
    this._overlay?.removeEventListener('touchend', this._onTouchEnd);
    this._overlay?.remove();
    this._overlay = null;

    // Сбросить состояние, чтобы синглтон мог работать после пересоздания overlay
    this._isOpen = false;
    this._isAnimating = false;
    this._originImg = null;
    this._originRect = null;
    this._rotation = '';
    this._images = [];
    this._currentIndex = -1;
    this._touchStart = null;
  }
}

/** Синглтон */
export const photoLightbox = new PhotoLightbox();
