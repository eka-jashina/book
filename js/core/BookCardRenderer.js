/**
 * Рендер карточек книг и полок для BookshelfScreen
 * Использует HTML <template> элементы для создания DOM.
 */
import { t } from '@i18n';
import { BOOKS_PER_SHELF, visibilityLabel } from './bookshelfUtils.js';

export class BookCardRenderer {
  /**
   * @param {'owner'|'guest'} mode - Режим отображения
   */
  constructor(mode) {
    this._mode = mode;
  }

  /**
   * Создать все полки для массива книг
   * @param {Array} books
   * @returns {DocumentFragment}
   */
  createShelves(books) {
    const frag = document.createDocumentFragment();

    for (let i = 0; i < books.length; i += BOOKS_PER_SHELF) {
      const chunk = books.slice(i, i + BOOKS_PER_SHELF);
      frag.appendChild(this._createShelf(chunk));
    }

    return frag;
  }

  /**
   * Создать одну полку с книгами из шаблона
   * @param {Array} books
   * @returns {DocumentFragment}
   */
  _createShelf(books) {
    const tmpl = document.getElementById('tmpl-bookshelf-shelf');
    const frag = tmpl.content.cloneNode(true);
    const booksContainer = frag.querySelector('.bookshelf-books');

    for (const book of books) {
      booksContainer.appendChild(this._createBook(book));
    }

    return frag;
  }

  /**
   * Создать карточку книги из шаблона.
   * Поддерживает оба формата: localStorage (cover.title) и API (title).
   * @param {Object} book
   * @returns {DocumentFragment}
   */
  _createBook(book) {
    const tmpl = document.getElementById('tmpl-bookshelf-book');
    const frag = tmpl.content.cloneNode(true);
    const isOwner = this._mode === 'owner';

    const title = book.title || book.cover?.title || 'Без названия';
    const author = book.author || book.cover?.author || '';
    const bgStart = book.appearance?.light?.coverBgStart || '#3a2d1f';
    const bgEnd = book.appearance?.light?.coverBgEnd || '#2a2016';
    const textColor = book.appearance?.light?.coverText || '#f2e9d8';
    const coverBgImage = book.appearance?.light?.coverBgImage || book.appearance?.light?.coverBgImageUrl;
    const visibility = book.visibility || 'draft';

    // Wrapper
    const wrapper = frag.querySelector('.bookshelf-book-wrapper');
    wrapper.dataset.bookId = book.id;

    if (isOwner && visibility !== 'published') {
      wrapper.classList.add(`bookshelf-book--${visibility}`);
    }

    // Button
    const btn = frag.querySelector('.bookshelf-book');
    btn.dataset.bookId = book.id;
    btn.setAttribute('aria-label', t('bookshelf.openBook', { title }));

    // Cover
    const cover = frag.querySelector('.bookshelf-book-cover');
    if (coverBgImage) {
      cover.style.background = `linear-gradient(135deg, rgba(0,0,0,0.3), rgba(0,0,0,0.5)), url('${coverBgImage}') center/cover`;
    } else {
      cover.style.background = `linear-gradient(135deg, ${bgStart}, ${bgEnd})`;
    }
    cover.style.color = textColor;

    // Visibility badge (only in owner mode for non-published)
    const badge = frag.querySelector('.bookshelf-book-badge');
    if (isOwner && visibility !== 'published' && badge) {
      badge.textContent = visibilityLabel(visibility);
      badge.hidden = false;
    }

    // Title & author
    frag.querySelector('.bookshelf-book-title').textContent = title;
    const authorEl = frag.querySelector('.bookshelf-book-author');
    if (author) {
      authorEl.textContent = author;
    } else {
      authorEl.remove();
    }

    // Menu items
    if (isOwner) {
      const menuItems = frag.querySelectorAll('[data-book-action]');
      menuItems.forEach(item => {
        item.dataset.bookId = book.id;
      });
      // Отметить текущую видимость
      const activeVis = frag.querySelector(`[data-visibility="${visibility}"]`);
      if (activeVis) activeVis.classList.add('is-active');
    } else {
      const menu = frag.querySelector('.bookshelf-book-menu');
      if (menu) menu.remove();
    }

    return frag;
  }
}
