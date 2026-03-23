/**
 * TESTS: BookSelectorManager
 * Тесты для менеджера выбора книг (карточки книг, переключение, удаление, сортировка)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@i18n', () => ({
  t: (key) => key,
}));

import { BookSelectorManager } from '../../../js/admin/modules/BookSelectorManager.js';

function createMockHost(books = [{ id: 'b1', title: 'Book 1', author: 'Author', chaptersCount: 3 }]) {
  return {
    store: {
      getBooks: vi.fn(() => books),
      getActiveBookId: vi.fn(() => books[0]?.id),
      setActiveBook: vi.fn(),
      removeBook: vi.fn(),
      moveBook: vi.fn(),
    },
    app: { _render: vi.fn(), openEditor: vi.fn(), _showView: vi.fn() },
    _escapeHtml: vi.fn(s => s),
    _showToast: vi.fn(),
    _confirm: vi.fn(async () => true),
    _renderJsonPreview: vi.fn(),
  };
}

function setupDOM() {
  document.body.innerHTML = `
    <div id="bookSelector"></div>
    <button id="deleteBook"></button>
  `;
}

describe('BookSelectorManager', () => {
  let manager;
  let host;

  beforeEach(() => {
    setupDOM();
    host = createMockHost();
    manager = new BookSelectorManager(host);
    manager.cacheDOM();
  });

  // ─── constructor ───────────────────────────────────────────

  describe('constructor', () => {
    it('stores the host reference', () => {
      expect(manager._host).toBe(host);
    });
  });

  // ─── cacheDOM ──────────────────────────────────────────────

  describe('cacheDOM', () => {
    it('caches bookSelector element', () => {
      expect(manager.bookSelector).toBe(document.getElementById('bookSelector'));
    });

    it('caches deleteBookBtn element', () => {
      expect(manager.deleteBookBtn).toBe(document.getElementById('deleteBook'));
    });
  });

  // ─── render ────────────────────────────────────────────────

  describe('render', () => {
    it('renders a single book card with active class', () => {
      manager.render();

      const cards = manager.bookSelector.querySelectorAll('[data-book-id]');
      expect(cards).toHaveLength(1);
      expect(cards[0].dataset.bookId).toBe('b1');
      expect(cards[0].classList.contains('active')).toBe(true);
    });

    it('hides delete button when only one book exists', () => {
      manager.render();
      expect(manager.deleteBookBtn.hidden).toBe(true);
    });

    it('shows delete button when multiple books exist', () => {
      const books = [
        { id: 'b1', title: 'Book 1', author: 'Author 1', chaptersCount: 3 },
        { id: 'b2', title: 'Book 2', author: 'Author 2', chaptersCount: 5 },
      ];
      host.store.getBooks.mockReturnValue(books);
      manager.render();

      expect(manager.deleteBookBtn.hidden).toBe(false);
    });

    it('renders multiple book cards with correct active state', () => {
      const books = [
        { id: 'b1', title: 'Book 1', author: 'Author 1', chaptersCount: 3 },
        { id: 'b2', title: 'Book 2', author: 'Author 2', chaptersCount: 5 },
      ];
      host.store.getBooks.mockReturnValue(books);
      host.store.getActiveBookId.mockReturnValue('b1');
      manager.render();

      const cards = manager.bookSelector.querySelectorAll('[data-book-id]');
      expect(cards).toHaveLength(2);
      expect(cards[0].classList.contains('active')).toBe(true);
      expect(cards[1].classList.contains('active')).toBe(false);
    });

    it('renders book title and author in card', () => {
      manager.render();

      const title = manager.bookSelector.querySelector('.book-card-title');
      expect(title.textContent).toBe('Book 1');

      const meta = manager.bookSelector.querySelector('.book-card-meta');
      expect(meta.textContent).toContain('Author');
    });

    it('uses default title when book has no title', () => {
      host.store.getBooks.mockReturnValue([{ id: 'b1', title: '', author: '', chaptersCount: 1 }]);
      manager.render();

      const title = manager.bookSelector.querySelector('.book-card-title');
      // t() is mocked, returns the key - 'admin.upload.defaultTitle'
      expect(title.textContent).toBe('admin.upload.defaultTitle');
    });

    it('renders move buttons for multiple books', () => {
      const books = [
        { id: 'b1', title: 'Book 1', author: '', chaptersCount: 1 },
        { id: 'b2', title: 'Book 2', author: '', chaptersCount: 2 },
        { id: 'b3', title: 'Book 3', author: '', chaptersCount: 3 },
      ];
      host.store.getBooks.mockReturnValue(books);
      manager.render();

      const cards = manager.bookSelector.querySelectorAll('[data-book-id]');

      // First book: only down button
      const firstMoveBtns = cards[0].querySelectorAll('[data-book-move]');
      expect(firstMoveBtns).toHaveLength(1);
      expect(firstMoveBtns[0].dataset.bookMove).toBe('down');

      // Middle book: both up and down
      const middleMoveBtns = cards[1].querySelectorAll('[data-book-move]');
      expect(middleMoveBtns).toHaveLength(2);

      // Last book: only up button
      const lastMoveBtns = cards[2].querySelectorAll('[data-book-move]');
      expect(lastMoveBtns).toHaveLength(1);
      expect(lastMoveBtns[0].dataset.bookMove).toBe('up');
    });

    it('does not render move buttons for a single book', () => {
      manager.render();

      const moveBtns = manager.bookSelector.querySelectorAll('[data-book-move]');
      expect(moveBtns).toHaveLength(0);
    });

    it('does not render inline delete button for a single book', () => {
      manager.render();

      const deleteBtns = manager.bookSelector.querySelectorAll('[data-book-delete]');
      expect(deleteBtns).toHaveLength(0);
    });

    it('renders inline delete buttons for multiple books', () => {
      const books = [
        { id: 'b1', title: 'Book 1', author: '', chaptersCount: 1 },
        { id: 'b2', title: 'Book 2', author: '', chaptersCount: 2 },
      ];
      host.store.getBooks.mockReturnValue(books);
      manager.render();

      const deleteBtns = manager.bookSelector.querySelectorAll('[data-book-delete]');
      expect(deleteBtns).toHaveLength(2);
      expect(deleteBtns[0].dataset.bookDelete).toBe('b1');
      expect(deleteBtns[1].dataset.bookDelete).toBe('b2');
    });

    it('renders active badge only for the active book', () => {
      const books = [
        { id: 'b1', title: 'Book 1', author: '', chaptersCount: 1 },
        { id: 'b2', title: 'Book 2', author: '', chaptersCount: 2 },
      ];
      host.store.getBooks.mockReturnValue(books);
      host.store.getActiveBookId.mockReturnValue('b2');
      manager.render();

      const cards = manager.bookSelector.querySelectorAll('[data-book-id]');
      expect(cards[0].querySelector('.book-card-active-badge')).toBeNull();
      expect(cards[1].querySelector('.book-card-active-badge')).not.toBeNull();
    });

    it('escapes HTML in book id, title, and author', () => {
      manager.render();

      // _escapeHtml should be called for id, title (twice: data attr + text), author
      expect(host._escapeHtml).toHaveBeenCalled();
    });

    it('sets tabindex and role on book cards', () => {
      manager.render();

      const card = manager.bookSelector.querySelector('[data-book-id]');
      expect(card.getAttribute('tabindex')).toBe('0');
      expect(card.getAttribute('role')).toBe('button');
    });

    it('renders meta without separator when author is empty', () => {
      host.store.getBooks.mockReturnValue([{ id: 'b1', title: 'Book 1', author: '', chaptersCount: 3 }]);
      manager.render();

      const meta = manager.bookSelector.querySelector('.book-card-meta');
      expect(meta.textContent).not.toContain(' · ');
    });

    it('renders meta with separator when author is present', () => {
      manager.render();

      const meta = manager.bookSelector.querySelector('.book-card-meta');
      expect(meta.textContent).toContain(' · ');
    });
  });

  // ─── _handleSelectBook ────────────────────────────────────

  describe('_handleSelectBook', () => {
    it('sets active book and re-renders when selecting a different book', () => {
      host.store.getActiveBookId.mockReturnValue('b1');

      manager._handleSelectBook('b2');

      expect(host.store.setActiveBook).toHaveBeenCalledWith('b2');
      expect(host.app._render).toHaveBeenCalled();
      expect(host.app.openEditor).toHaveBeenCalled();
    });

    it('skips setActiveBook if already active, but still opens editor', () => {
      host.store.getActiveBookId.mockReturnValue('b1');

      manager._handleSelectBook('b1');

      expect(host.store.setActiveBook).not.toHaveBeenCalled();
      expect(host.app._render).not.toHaveBeenCalled();
      expect(host.app.openEditor).toHaveBeenCalled();
    });
  });

  // ─── _handleDeleteBook ────────────────────────────────────

  describe('_handleDeleteBook', () => {
    it('shows toast and returns when only one book exists', async () => {
      await manager._handleDeleteBook('b1');

      expect(host._showToast).toHaveBeenCalledWith('admin.chapters.cannotDeleteOnly');
      expect(host._confirm).not.toHaveBeenCalled();
      expect(host.store.removeBook).not.toHaveBeenCalled();
    });

    it('confirms and deletes book when multiple books exist', async () => {
      const books = [
        { id: 'b1', title: 'Book 1', author: '', chaptersCount: 1 },
        { id: 'b2', title: 'Book 2', author: '', chaptersCount: 2 },
      ];
      host.store.getBooks.mockReturnValue(books);

      await manager._handleDeleteBook('b1');

      expect(host._confirm).toHaveBeenCalled();
      expect(host.store.removeBook).toHaveBeenCalledWith('b1');
      expect(host.app._render).toHaveBeenCalled();
      expect(host.app._showView).toHaveBeenCalledWith('bookshelf');
      expect(host._showToast).toHaveBeenCalledWith('admin.chapters.bookDeleted');
    });

    it('does not delete when confirm is cancelled', async () => {
      const books = [
        { id: 'b1', title: 'Book 1', author: '', chaptersCount: 1 },
        { id: 'b2', title: 'Book 2', author: '', chaptersCount: 2 },
      ];
      host.store.getBooks.mockReturnValue(books);
      host._confirm.mockResolvedValue(false);

      await manager._handleDeleteBook('b1');

      expect(host._confirm).toHaveBeenCalled();
      expect(host.store.removeBook).not.toHaveBeenCalled();
    });

    it('passes book title in confirm message', async () => {
      const books = [
        { id: 'b1', title: 'My Book', author: '', chaptersCount: 1 },
        { id: 'b2', title: 'Other', author: '', chaptersCount: 2 },
      ];
      host.store.getBooks.mockReturnValue(books);

      await manager._handleDeleteBook('b1');

      expect(host._confirm).toHaveBeenCalledWith(
        expect.stringContaining('admin.chapters.bookDeleteConfirm')
      );
    });

    it('uses bookId as fallback when book title is not found', async () => {
      const books = [
        { id: 'b1', title: 'Book 1', author: '', chaptersCount: 1 },
        { id: 'b2', title: 'Book 2', author: '', chaptersCount: 2 },
      ];
      host.store.getBooks.mockReturnValue(books);

      await manager._handleDeleteBook('nonexistent');

      // confirm should still be called (book?.title is undefined, falls back to bookId)
      expect(host._confirm).toHaveBeenCalled();
    });
  });

  // ─── bindEvents ────────────────────────────────────────────

  describe('bindEvents', () => {
    beforeEach(() => {
      manager.bindEvents();
    });

    describe('click delegation on bookSelector', () => {
      it('selects a book when clicking a book card', () => {
        const books = [
          { id: 'b1', title: 'Book 1', author: '', chaptersCount: 1 },
          { id: 'b2', title: 'Book 2', author: '', chaptersCount: 2 },
        ];
        host.store.getBooks.mockReturnValue(books);
        manager.render();

        const card = manager.bookSelector.querySelector('[data-book-id="b2"]');
        card.click();

        expect(host.store.setActiveBook).toHaveBeenCalledWith('b2');
        expect(host.app.openEditor).toHaveBeenCalled();
      });

      it('ignores clicks outside of book cards', () => {
        manager.render();
        manager.bookSelector.click();

        expect(host.store.setActiveBook).not.toHaveBeenCalled();
        expect(host.app.openEditor).not.toHaveBeenCalled();
      });

      it('handles move up button click', () => {
        const books = [
          { id: 'b1', title: 'Book 1', author: '', chaptersCount: 1 },
          { id: 'b2', title: 'Book 2', author: '', chaptersCount: 2 },
        ];
        host.store.getBooks.mockReturnValue(books);
        manager.render();

        const moveUpBtn = manager.bookSelector.querySelector('[data-book-move="up"]');
        if (moveUpBtn) {
          moveUpBtn.click();

          expect(host.store.moveBook).toHaveBeenCalled();
          expect(host._renderJsonPreview).toHaveBeenCalled();
          expect(host._showToast).toHaveBeenCalledWith('admin.chapters.orderChanged');
        }
      });

      it('handles move down button click', () => {
        const books = [
          { id: 'b1', title: 'Book 1', author: '', chaptersCount: 1 },
          { id: 'b2', title: 'Book 2', author: '', chaptersCount: 2 },
        ];
        host.store.getBooks.mockReturnValue(books);
        manager.render();

        const moveDownBtn = manager.bookSelector.querySelector('[data-book-move="down"]');
        moveDownBtn.click();

        expect(host.store.moveBook).toHaveBeenCalledWith(0, 1);
        expect(host._renderJsonPreview).toHaveBeenCalled();
        expect(host._showToast).toHaveBeenCalledWith('admin.chapters.orderChanged');
      });

      it('move up calculates correct indices', () => {
        const books = [
          { id: 'b1', title: 'Book 1', author: '', chaptersCount: 1 },
          { id: 'b2', title: 'Book 2', author: '', chaptersCount: 2 },
          { id: 'b3', title: 'Book 3', author: '', chaptersCount: 3 },
        ];
        host.store.getBooks.mockReturnValue(books);
        manager.render();

        // The second book (index 1) should have an up button
        const upBtns = manager.bookSelector.querySelectorAll('[data-book-move="up"]');
        // Click the first up button (belongs to second card, index 1)
        upBtns[0].click();

        expect(host.store.moveBook).toHaveBeenCalledWith(1, 0);
      });

      it('handles inline delete button click', async () => {
        const books = [
          { id: 'b1', title: 'Book 1', author: '', chaptersCount: 1 },
          { id: 'b2', title: 'Book 2', author: '', chaptersCount: 2 },
        ];
        host.store.getBooks.mockReturnValue(books);
        manager.render();

        const deleteBtn = manager.bookSelector.querySelector('[data-book-delete="b1"]');
        deleteBtn.click();

        // Wait for async _handleDeleteBook
        await vi.waitFor(() => {
          expect(host._confirm).toHaveBeenCalled();
        });
      });

      it('does not select book when inline delete is clicked', async () => {
        const books = [
          { id: 'b1', title: 'Book 1', author: '', chaptersCount: 1 },
          { id: 'b2', title: 'Book 2', author: '', chaptersCount: 2 },
        ];
        host.store.getBooks.mockReturnValue(books);
        manager.render();

        const deleteBtn = manager.bookSelector.querySelector('[data-book-delete="b1"]');
        deleteBtn.click();

        await vi.waitFor(() => {
          expect(host._confirm).toHaveBeenCalled();
        });

        // setActiveBook should not be called from the card click handler
        // (stopPropagation prevents it, but since we click the delete btn directly,
        // the card click path is avoided via the deleteBtn closest check)
        expect(host.app.openEditor).not.toHaveBeenCalled();
      });
    });

    describe('keyboard navigation on bookSelector', () => {
      it('selects book on Enter key', () => {
        const books = [
          { id: 'b1', title: 'Book 1', author: '', chaptersCount: 1 },
          { id: 'b2', title: 'Book 2', author: '', chaptersCount: 2 },
        ];
        host.store.getBooks.mockReturnValue(books);
        manager.render();

        const card = manager.bookSelector.querySelector('[data-book-id="b2"]');
        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        card.dispatchEvent(event);

        expect(host.store.setActiveBook).toHaveBeenCalledWith('b2');
        expect(host.app.openEditor).toHaveBeenCalled();
      });

      it('selects book on Space key', () => {
        const books = [
          { id: 'b1', title: 'Book 1', author: '', chaptersCount: 1 },
          { id: 'b2', title: 'Book 2', author: '', chaptersCount: 2 },
        ];
        host.store.getBooks.mockReturnValue(books);
        manager.render();

        const card = manager.bookSelector.querySelector('[data-book-id="b2"]');
        const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
        card.dispatchEvent(event);

        expect(host.store.setActiveBook).toHaveBeenCalledWith('b2');
      });

      it('ignores other keys', () => {
        manager.render();

        const card = manager.bookSelector.querySelector('[data-book-id="b1"]');
        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
        card.dispatchEvent(event);

        expect(host.app.openEditor).not.toHaveBeenCalled();
      });

      it('ignores keydown when not on a book card', () => {
        manager.render();

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        manager.bookSelector.dispatchEvent(event);

        expect(host.app.openEditor).not.toHaveBeenCalled();
      });
    });

    describe('deleteBookBtn click', () => {
      it('calls _handleDeleteBook with active book id', async () => {
        const books = [
          { id: 'b1', title: 'Book 1', author: '', chaptersCount: 1 },
          { id: 'b2', title: 'Book 2', author: '', chaptersCount: 2 },
        ];
        host.store.getBooks.mockReturnValue(books);
        host.store.getActiveBookId.mockReturnValue('b1');

        manager.deleteBookBtn.click();

        await vi.waitFor(() => {
          expect(host._confirm).toHaveBeenCalled();
        });

        expect(host.store.removeBook).toHaveBeenCalledWith('b1');
      });
    });
  });
});
