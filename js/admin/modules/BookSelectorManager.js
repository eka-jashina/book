/**
 * Менеджер переключателя книг (bookshelf view в админке)
 * Отвечает за рендер карточек книг, выбор и удаление книг, сортировку.
 * Извлечён из ChaptersModule для разделения ответственности.
 */
import { t } from '@i18n';

export class BookSelectorManager {
  /**
   * @param {import('./ChaptersModule.js').ChaptersModule} host - Родительский модуль
   */
  constructor(host) {
    this._host = host;
  }

  /** Кэшировать DOM-элементы переключателя книг */
  cacheDOM() {
    this.bookSelector = document.getElementById('bookSelector');
    this.deleteBookBtn = document.getElementById('deleteBook');
  }

  /** Привязать события переключателя книг */
  bindEvents() {
    // Делегирование — клик на карточку книги
    this.bookSelector.addEventListener('click', (e) => {
      // Сортировка книг (вверх/вниз)
      const moveBtn = e.target.closest('[data-book-move]');
      if (moveBtn) {
        e.stopPropagation();
        const index = parseInt(moveBtn.dataset.bookIndex, 10);
        const direction = moveBtn.dataset.bookMove;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        this._host.store.moveBook(index, newIndex);
        this.render();
        this._host._renderJsonPreview();
        this._host._showToast(t('admin.chapters.orderChanged'));
        return;
      }

      const card = e.target.closest('[data-book-id]');
      if (!card) return;

      const deleteBtn = e.target.closest('[data-book-delete]');
      if (deleteBtn) {
        e.stopPropagation();
        this._handleDeleteBook(deleteBtn.dataset.bookDelete);
        return;
      }

      // Выбрать книгу и открыть редактор
      this._handleSelectBook(card.dataset.bookId);
    });

    // Клавиатурная навигация для карточек книг (Enter / Space)
    this.bookSelector.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('[data-book-id]');
      if (!card) return;
      e.preventDefault();
      this._handleSelectBook(card.dataset.bookId);
    });

    // Удаление активной книги (кнопка в editor)
    this.deleteBookBtn.addEventListener('click', () => {
      this._handleDeleteBook(this._host.store.getActiveBookId());
    });
  }

  /** Рендер переключателя книг */
  render() {
    const books = this._host.store.getBooks();
    const activeId = this._host.store.getActiveBookId();
    const tmpl = document.getElementById('tmpl-admin-book-card');
    const frag = document.createDocumentFragment();
    const multipleBooks = books.length > 1;

    books.forEach((b, i) => {
      const clone = tmpl.content.cloneNode(true);
      const card = clone.querySelector('.book-card');
      const title = b.title || t('admin.upload.defaultTitle');

      card.dataset.bookId = b.id;
      card.setAttribute('aria-label', title);
      if (b.id === activeId) card.classList.add('active');

      card.querySelector('.book-card-title').textContent = title;
      const metaParts = b.author ? `${b.author} · ` : '';
      card.querySelector('.book-card-meta').textContent = metaParts + t('admin.chapters.chapterCount', { count: b.chaptersCount });

      // Кнопки сортировки
      const upBtn = card.querySelector('.book-move-up-btn');
      const downBtn = card.querySelector('.book-move-down-btn');
      if (multipleBooks && i > 0) {
        upBtn.hidden = false;
        upBtn.dataset.bookIndex = i;
        upBtn.title = t('admin.chapters.moveLeft');
      }
      if (multipleBooks && i < books.length - 1) {
        downBtn.hidden = false;
        downBtn.dataset.bookIndex = i;
        downBtn.title = t('admin.chapters.moveRight');
      }

      // Бейдж активной книги
      const badge = card.querySelector('.book-card-active-badge');
      if (b.id === activeId) {
        badge.hidden = false;
        badge.textContent = t('admin.chapters.activeLabel');
      }

      // Кнопка удаления
      const deleteBtn = card.querySelector('.book-delete-btn');
      if (multipleBooks) {
        deleteBtn.hidden = false;
        deleteBtn.dataset.bookDelete = b.id;
        deleteBtn.title = t('common.delete');
      }

      frag.appendChild(clone);
    });

    this.bookSelector.innerHTML = '';
    this.bookSelector.appendChild(frag);
    this.deleteBookBtn.hidden = !multipleBooks;
  }

  _handleSelectBook(bookId) {
    if (bookId !== this._host.store.getActiveBookId()) {
      this._host.store.setActiveBook(bookId);
      this._host.app._render();
    }
    this._host.app.openEditor();
  }

  async _handleDeleteBook(bookId) {
    const books = this._host.store.getBooks();
    if (books.length <= 1) {
      this._host._showToast(t('admin.chapters.cannotDeleteOnly'));
      return;
    }
    const book = books.find(b => b.id === bookId);
    if (!await this._host._confirm(t('admin.chapters.bookDeleteConfirm', { title: book?.title || bookId }))) return;

    this._host.store.removeBook(bookId);
    this._host.app._render();
    this._host.app._showView('bookshelf');
    this._host._showToast(t('admin.chapters.bookDeleted'));
  }
}
