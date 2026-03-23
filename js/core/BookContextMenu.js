/**
 * Контекстное меню книги на полке
 * Управляет открытием/закрытием popup-меню с действиями над книгой.
 */
export class BookContextMenu {
  /**
   * @param {HTMLElement} container - Корневой контейнер полки
   */
  constructor(container) {
    this._container = container;
    this._openMenuBookId = null;
    this._boundCloseMenu = this.close.bind(this);
  }

  /** @returns {string|null} ID книги с открытым меню */
  get openBookId() {
    return this._openMenuBookId;
  }

  /**
   * Открыть меню для книги (с автоматическим закрытием предыдущего)
   * @param {string} bookId
   */
  open(bookId) {
    if (this._openMenuBookId) {
      this.close();
    }
    this._doOpen(bookId);
  }

  /**
   * Открыть меню без предварительного закрытия (внутренний метод)
   * @param {string} bookId
   */
  _doOpen(bookId) {
    const wrapper = this._container.querySelector(`.bookshelf-book-wrapper[data-book-id="${bookId}"]`);
    if (!wrapper) return;

    const menu = wrapper.querySelector('.bookshelf-book-menu');
    if (!menu) return;

    wrapper.classList.add('menu-open');
    menu.hidden = false;
    this._openMenuBookId = bookId;

    // Закрыть по клику снаружи (с задержкой, чтобы текущий клик не сработал)
    setTimeout(() => {
      document.addEventListener('click', this._boundCloseMenu);
    }, 0);
  }

  /**
   * Закрыть текущее открытое меню
   */
  close() {
    if (!this._openMenuBookId) return;

    const wrapper = this._container.querySelector(`.bookshelf-book-wrapper[data-book-id="${this._openMenuBookId}"]`);
    if (wrapper) {
      wrapper.classList.remove('menu-open');
      const menu = wrapper.querySelector('.bookshelf-book-menu');
      if (menu) menu.hidden = true;
    }

    this._openMenuBookId = null;
    document.removeEventListener('click', this._boundCloseMenu);
  }
}
