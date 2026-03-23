/**
 * Unit tests for BookshelfScreen
 * Главный экран приложения: полки с книгами, контекстное меню, пагинация полок
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BookshelfScreen,
  getBookshelfData,
  clearActiveBook,
} from '../../../js/core/BookshelfScreen.js';

// ═══════════════════════════════════════════════════════════════════════════
// DOM HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Создать <template> для одной полки
 */
function createShelfTemplate() {
  const tmpl = document.createElement('template');
  tmpl.id = 'tmpl-bookshelf-shelf';
  tmpl.innerHTML = `<div class="bookshelf-shelf"><div class="bookshelf-books"></div></div>`;
  document.body.appendChild(tmpl);
}

/**
 * Создать <template> для карточки книги
 */
function createBookTemplate() {
  const tmpl = document.createElement('template');
  tmpl.id = 'tmpl-bookshelf-book';
  tmpl.innerHTML = `
    <div class="bookshelf-book-wrapper">
      <button class="bookshelf-book" type="button"></button>
      <div class="bookshelf-book-cover"></div>
      <span class="bookshelf-book-title"></span>
      <span class="bookshelf-book-author"></span>
      <div class="bookshelf-book-menu" hidden>
        <button data-book-action="read">Читать</button>
        <button data-book-action="edit">Редактировать</button>
        <button data-book-action="delete">Удалить</button>
      </div>
    </div>
  `;
  document.body.appendChild(tmpl);
}

/**
 * Создать контейнер с необходимыми статическими элементами
 */
function createContainer() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="bookshelf-header"></div>
    <div id="bookshelf-shelves"></div>
    <div id="bookshelf-actions"></div>
    <div id="bookshelf-empty" hidden></div>
    <span id="bookshelf-subtitle"></span>
  `;
  document.body.appendChild(container);
  return container;
}

/**
 * Создать минимальный объект книги
 */
function makeBook(id = 'book-1', title = 'Тестовая книга', author = 'Автор') {
  return {
    id,
    cover: { title, author },
    appearance: {
      light: {
        coverBgStart: '#111111',
        coverBgEnd: '#222222',
        coverText: '#ffffff',
      },
    },
  };
}

/**
 * Симулировать bubbling click по элементу
 */
function click(element) {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('BookshelfScreen', () => {
  let container;
  let screen;
  let onBookSelect;

  beforeEach(() => {
    createShelfTemplate();
    createBookTemplate();
    container = createContainer();
    onBookSelect = vi.fn();
  });

  afterEach(() => {
    if (screen) {
      screen.destroy();
      screen = null;
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // constructor
  // ─────────────────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should store books reference', () => {
      const books = [makeBook()];
      screen = new BookshelfScreen({ container, books, onBookSelect });
      expect(screen.books).toBe(books);
    });

    it('should store onBookSelect callback', () => {
      screen = new BookshelfScreen({ container, books: [], onBookSelect });
      expect(screen.onBookSelect).toBe(onBookSelect);
    });

    it('should cache all static DOM elements', () => {
      screen = new BookshelfScreen({ container, books: [], onBookSelect });
      expect(screen._els.shelves).not.toBeNull();
      expect(screen._els.actions).not.toBeNull();
      expect(screen._els.empty).not.toBeNull();
      expect(screen._els.subtitle).not.toBeNull();
      expect(screen._els.header).not.toBeNull();
    });

    it('should initialize _openMenuBookId to null', () => {
      screen = new BookshelfScreen({ container, books: [], onBookSelect });
      expect(screen._openMenuBookId).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // render() — пустое состояние (нет книг)
  // ─────────────────────────────────────────────────────────────────────────

  describe('render() — empty state', () => {
    beforeEach(() => {
      screen = new BookshelfScreen({ container, books: [], onBookSelect });
      screen.render();
    });

    it('should hide shelves element', () => {
      expect(screen._els.shelves.hidden).toBe(true);
    });

    it('should hide actions element', () => {
      expect(screen._els.actions.hidden).toBe(true);
    });

    it('should show empty state element', () => {
      expect(screen._els.empty.hidden).toBe(false);
    });

    it('should set subtitle text to empty string', () => {
      expect(screen._els.subtitle.textContent).toBe('');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // render() — есть книги
  // ─────────────────────────────────────────────────────────────────────────

  describe('render() — with books', () => {
    it('should hide empty element and show shelves and actions', () => {
      screen = new BookshelfScreen({ container, books: [makeBook()], onBookSelect });
      screen.render();
      expect(screen._els.empty.hidden).toBe(true);
      expect(screen._els.shelves.hidden).toBe(false);
      expect(screen._els.actions.hidden).toBe(false);
    });

    it('should set subtitle with count and pluralized word', () => {
      screen = new BookshelfScreen({ container, books: [makeBook()], onBookSelect });
      screen.render();
      expect(screen._els.subtitle.textContent).toBe('1 книга');
    });

    it('should render all 5 books on one shelf', () => {
      const books = Array.from({ length: 5 }, (_, i) => makeBook(`b${i}`));
      screen = new BookshelfScreen({ container, books, onBookSelect });
      screen.render();
      const shelves = screen._els.shelves.querySelectorAll('.bookshelf-shelf');
      expect(shelves).toHaveLength(1);
    });

    it('should paginate 6 books onto 2 shelves', () => {
      const books = Array.from({ length: 6 }, (_, i) => makeBook(`b${i}`));
      screen = new BookshelfScreen({ container, books, onBookSelect });
      screen.render();
      const shelves = screen._els.shelves.querySelectorAll('.bookshelf-shelf');
      expect(shelves).toHaveLength(2);
    });

    it('should paginate 11 books onto 3 shelves', () => {
      const books = Array.from({ length: 11 }, (_, i) => makeBook(`b${i}`));
      screen = new BookshelfScreen({ container, books, onBookSelect });
      screen.render();
      const shelves = screen._els.shelves.querySelectorAll('.bookshelf-shelf');
      expect(shelves).toHaveLength(3);
    });

    it('should put exactly 5 books on the first shelf and the rest on the second', () => {
      const books = Array.from({ length: 7 }, (_, i) => makeBook(`b${i}`));
      screen = new BookshelfScreen({ container, books, onBookSelect });
      screen.render();
      const shelves = screen._els.shelves.querySelectorAll('.bookshelf-shelf');
      expect(shelves[0].querySelectorAll('.bookshelf-book-wrapper')).toHaveLength(5);
      expect(shelves[1].querySelectorAll('.bookshelf-book-wrapper')).toHaveLength(2);
    });

    it('should set data-book-id on wrapper and button', () => {
      screen = new BookshelfScreen({ container, books: [makeBook('my-id')], onBookSelect });
      screen.render();
      const wrapper = screen._els.shelves.querySelector('.bookshelf-book-wrapper');
      const btn = screen._els.shelves.querySelector('.bookshelf-book');
      expect(wrapper.dataset.bookId).toBe('my-id');
      expect(btn.dataset.bookId).toBe('my-id');
    });

    it('should render book title', () => {
      screen = new BookshelfScreen({ container, books: [makeBook('b1', 'Гарри Поттер')], onBookSelect });
      screen.render();
      expect(screen._els.shelves.querySelector('.bookshelf-book-title').textContent).toBe('Гарри Поттер');
    });

    it('should render author when present', () => {
      screen = new BookshelfScreen({ container, books: [makeBook('b1', 'Заголовок', 'Роулинг')], onBookSelect });
      screen.render();
      expect(screen._els.shelves.querySelector('.bookshelf-book-author').textContent).toBe('Роулинг');
    });

    it('should remove author element when author is empty string', () => {
      const book = { id: 'b1', cover: { title: 'Без автора', author: '' }, appearance: {} };
      screen = new BookshelfScreen({ container, books: [book], onBookSelect });
      screen.render();
      expect(screen._els.shelves.querySelector('.bookshelf-book-author')).toBeNull();
    });

    it('should use "Без названия" fallback when title is missing', () => {
      const book = { id: 'b1', cover: {}, appearance: {} };
      screen = new BookshelfScreen({ container, books: [book], onBookSelect });
      screen.render();
      expect(screen._els.shelves.querySelector('.bookshelf-book-title').textContent).toBe('Без названия');
    });

    it('should apply gradient background when no coverBgImage', () => {
      screen = new BookshelfScreen({ container, books: [makeBook()], onBookSelect });
      screen.render();
      const cover = screen._els.shelves.querySelector('.bookshelf-book-cover');
      expect(cover.style.background).toContain('linear-gradient');
    });

    it('should apply image background when coverBgImage is set', () => {
      const book = {
        id: 'b1',
        cover: { title: 'T' },
        appearance: { light: { coverBgImage: 'http://example.com/cover.jpg' } },
      };
      screen = new BookshelfScreen({ container, books: [book], onBookSelect });
      screen.render();
      const cover = screen._els.shelves.querySelector('.bookshelf-book-cover');
      expect(cover.style.background).toContain('url(');
    });

    it('should apply coverText color to cover', () => {
      screen = new BookshelfScreen({ container, books: [makeBook()], onBookSelect });
      screen.render();
      const cover = screen._els.shelves.querySelector('.bookshelf-book-cover');
      expect(cover.style.color).toBeTruthy();
    });

    it('should set data-book-id on all menu action items', () => {
      screen = new BookshelfScreen({ container, books: [makeBook('abc')], onBookSelect });
      screen.render();
      const menuItems = screen._els.shelves.querySelectorAll('[data-book-action]');
      expect(menuItems.length).toBeGreaterThan(0);
      menuItems.forEach(item => {
        expect(item.dataset.bookId).toBe('abc');
      });
    });

    it('should set aria-label on book button', () => {
      screen = new BookshelfScreen({ container, books: [makeBook('b1', 'Моя книга')], onBookSelect });
      screen.render();
      const btn = screen._els.shelves.querySelector('.bookshelf-book');
      expect(btn.getAttribute('aria-label')).toContain('Моя книга');
    });

    it('should clear previous shelves content on re-render', () => {
      screen = new BookshelfScreen({ container, books: [makeBook()], onBookSelect });
      screen.render();
      screen.render();
      const shelves = screen._els.shelves.querySelectorAll('.bookshelf-shelf');
      expect(shelves).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // show() / hide()
  // ─────────────────────────────────────────────────────────────────────────

  describe('show()', () => {
    beforeEach(() => {
      screen = new BookshelfScreen({ container, books: [], onBookSelect });
    });

    it('should set container.hidden to false', () => {
      container.hidden = true;
      screen.show();
      expect(container.hidden).toBe(false);
    });

    it('should set document.body.dataset.screen to "bookshelf"', () => {
      screen.show();
      expect(document.body.dataset.screen).toBe('bookshelf');
    });
  });

  describe('hide()', () => {
    it('should set document.body.dataset.screen to "reader"', () => {
      screen = new BookshelfScreen({ container, books: [], onBookSelect });
      screen.hide();
      expect(document.body.dataset.screen).toBe('reader');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // destroy()
  // ─────────────────────────────────────────────────────────────────────────

  describe('destroy()', () => {
    beforeEach(() => {
      screen = new BookshelfScreen({ container, books: [makeBook('b1')], onBookSelect });
      screen.render();
    });

    it('should remove click event listener from container', () => {
      const spy = vi.spyOn(container, 'removeEventListener');
      screen.destroy();
      expect(spy).toHaveBeenCalledWith('click', screen._boundHandleClick);
    });

    it('should clear shelves innerHTML', () => {
      screen.destroy();
      expect(screen._els.shelves.innerHTML).toBe('');
    });

    it('should close any open menu', () => {
      const spy = vi.spyOn(screen, '_closeBookMenu');
      screen.destroy();
      expect(spy).toHaveBeenCalled();
    });

    it('should not throw when called multiple times', () => {
      screen.destroy();
      expect(() => screen.destroy()).not.toThrow();
      screen = null; // prevent afterEach from calling destroy again
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _formatBooksCount() — склонение с i18n
  // ─────────────────────────────────────────────────────────────────────────

  describe('_formatBooksCount()', () => {
    beforeEach(() => {
      screen = new BookshelfScreen({ container, books: [], onBookSelect });
    });

    it('returns "1 книга" for 1', () => expect(screen._formatBooksCount(1)).toBe('1 книга'));
    it('returns "2 книги" for 2', () => expect(screen._formatBooksCount(2)).toBe('2 книги'));
    it('returns "3 книги" for 3', () => expect(screen._formatBooksCount(3)).toBe('3 книги'));
    it('returns "4 книги" for 4', () => expect(screen._formatBooksCount(4)).toBe('4 книги'));
    it('returns "5 книг" for 5', () => expect(screen._formatBooksCount(5)).toBe('5 книг'));
    it('returns "0 книг" for 0', () => expect(screen._formatBooksCount(0)).toBe('0 книг'));
    it('returns "6 книг" for 6', () => expect(screen._formatBooksCount(6)).toBe('6 книг'));
    it('returns "11 книг" for 11 (исключение: 11)', () => expect(screen._formatBooksCount(11)).toBe('11 книг'));
    it('returns "12 книг" for 12 (исключение: 12)', () => expect(screen._formatBooksCount(12)).toBe('12 книг'));
    it('returns "13 книг" for 13 (исключение: 13)', () => expect(screen._formatBooksCount(13)).toBe('13 книг'));
    it('returns "14 книг" for 14 (исключение: 14)', () => expect(screen._formatBooksCount(14)).toBe('14 книг'));
    it('returns "21 книга" for 21', () => expect(screen._formatBooksCount(21)).toBe('21 книга'));
    it('returns "22 книги" for 22', () => expect(screen._formatBooksCount(22)).toBe('22 книги'));
    it('returns "101 книга" for 101', () => expect(screen._formatBooksCount(101)).toBe('101 книга'));
    it('returns "111 книг" for 111 (исключение: 111)', () => expect(screen._formatBooksCount(111)).toBe('111 книг'));
    it('returns "1004 книги" for 1004', () => expect(screen._formatBooksCount(1004)).toBe('1004 книги'));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _handleClick() — маршрутизация кликов
  // ─────────────────────────────────────────────────────────────────────────

  describe('_handleClick()', () => {
    beforeEach(() => {
      screen = new BookshelfScreen({ container, books: [makeBook('b1')], onBookSelect });
      screen.render();
    });

    it('should navigate to /account?create=true when add-book button is clicked with router', () => {
      const mockRouter = { navigate: vi.fn() };
      screen = new BookshelfScreen({ container, books: [makeBook('b1')], onBookSelect, router: mockRouter });
      screen.render();
      const btn = document.createElement('button');
      btn.dataset.action = 'add-book';
      container.appendChild(btn);
      click(btn);
      expect(mockRouter.navigate).toHaveBeenCalledWith('/account?create=true');
    });

    it('should prevent default on add-book click', () => {
      const btn = document.createElement('button');
      btn.dataset.action = 'add-book';
      container.appendChild(btn);
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      btn.dispatchEvent(event);
      expect(preventSpy).toHaveBeenCalled();
    });

    it('should call _openBookMenu when a book button is clicked', () => {
      const spy = vi.spyOn(screen, '_openBookMenu');
      const bookBtn = container.querySelector('.bookshelf-book');
      click(bookBtn);
      expect(spy).toHaveBeenCalledWith('b1');
    });

    it('should call _handleBookAction for menu item clicks', () => {
      const spy = vi.spyOn(screen, '_handleBookAction');
      const menuItem = container.querySelector('[data-book-action="read"]');
      click(menuItem);
      expect(spy).toHaveBeenCalledWith('read', 'b1', undefined);
    });

    it('should close menu before handling menu item action', () => {
      const closeSpy = vi.spyOn(screen, '_closeBookMenu');
      const menuItem = container.querySelector('[data-book-action="read"]');
      click(menuItem);
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should close open menu when clicking outside', () => {
      screen._openMenuBookId = 'b1';
      const closeSpy = vi.spyOn(screen, '_closeBookMenu');
      const outsideEl = document.createElement('div');
      container.appendChild(outsideEl);
      click(outsideEl);
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should not call _closeBookMenu when clicking outside with no open menu', () => {
      const closeSpy = vi.spyOn(screen, '_closeBookMenu');
      const outsideEl = document.createElement('div');
      container.appendChild(outsideEl);
      click(outsideEl);
      expect(closeSpy).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _openBookMenu()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_openBookMenu()', () => {
    beforeEach(() => {
      screen = new BookshelfScreen({ container, books: [makeBook('b1')], onBookSelect });
      screen.render();
    });

    it('should add menu-open class to book wrapper', () => {
      screen._openBookMenu('b1');
      const wrapper = container.querySelector('.bookshelf-book-wrapper[data-book-id="b1"]');
      expect(wrapper.classList.contains('menu-open')).toBe(true);
    });

    it('should set menu hidden to false', () => {
      screen._openBookMenu('b1');
      const menu = container.querySelector('.bookshelf-book-menu');
      expect(menu.hidden).toBe(false);
    });

    it('should set _openMenuBookId to the book id', () => {
      screen._openBookMenu('b1');
      expect(screen._openMenuBookId).toBe('b1');
    });

    it('should close the previously open menu before opening a new one', () => {
      screen = new BookshelfScreen({
        container,
        books: [makeBook('b1'), makeBook('b2')],
        onBookSelect,
      });
      screen.render();
      screen._openBookMenu('b1');
      const closeSpy = vi.spyOn(screen, '_closeBookMenu');
      screen._openBookMenu('b2');
      expect(closeSpy).toHaveBeenCalled();
      expect(screen._openMenuBookId).toBe('b2');
    });

    it('should do nothing for an unknown bookId', () => {
      screen._openBookMenu('nonexistent');
      expect(screen._openMenuBookId).toBeNull();
    });

    it('should add document click listener after setTimeout(0)', () => {
      vi.useFakeTimers();
      const docSpy = vi.spyOn(document, 'addEventListener');
      screen._openBookMenu('b1');
      vi.runAllTimers();
      expect(docSpy).toHaveBeenCalledWith('click', screen._boundCloseMenu);
      vi.useRealTimers();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _closeBookMenu()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_closeBookMenu()', () => {
    beforeEach(() => {
      screen = new BookshelfScreen({ container, books: [makeBook('b1')], onBookSelect });
      screen.render();
    });

    it('should not throw when no menu is open', () => {
      expect(() => screen._closeBookMenu()).not.toThrow();
    });

    it('should remove menu-open class from the wrapper', () => {
      screen._openBookMenu('b1');
      const wrapper = container.querySelector('.bookshelf-book-wrapper[data-book-id="b1"]');
      screen._closeBookMenu();
      expect(wrapper.classList.contains('menu-open')).toBe(false);
    });

    it('should hide the menu element', () => {
      screen._openBookMenu('b1');
      const menu = container.querySelector('.bookshelf-book-menu');
      screen._closeBookMenu();
      expect(menu.hidden).toBe(true);
    });

    it('should reset _openMenuBookId to null', () => {
      screen._openBookMenu('b1');
      screen._closeBookMenu();
      expect(screen._openMenuBookId).toBeNull();
    });

    it('should remove document click listener', () => {
      // Simulate an open menu state without going through setTimeout
      screen._openMenuBookId = 'b1';
      const docSpy = vi.spyOn(document, 'removeEventListener');
      screen._closeBookMenu();
      expect(docSpy).toHaveBeenCalledWith('click', screen._boundCloseMenu);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _handleBookAction()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_handleBookAction()', () => {
    beforeEach(() => {
      screen = new BookshelfScreen({ container, books: [makeBook('b1')], onBookSelect });
      screen.render();
    });

    describe('action: read', () => {
      it('should call onBookSelect with bookId', () => {
        screen._handleBookAction('read', 'b1');
        expect(onBookSelect).toHaveBeenCalledWith('b1');
      });

      it('should not set sessionStorage flags (router handles navigation)', () => {
        screen._handleBookAction('read', 'b1');
        expect(sessionStorage.getItem('flipbook-reading-session')).toBeNull();
      });
    });

    describe('action: edit', () => {
      it('should navigate to /account?edit=bookId via router', () => {
        const mockRouter = { navigate: vi.fn() };
        screen = new BookshelfScreen({ container, books: [makeBook('b1')], onBookSelect, router: mockRouter });
        screen.render();
        screen._handleBookAction('edit', 'b1');
        expect(mockRouter.navigate).toHaveBeenCalledWith('/account?edit=b1');
      });

      it('should not throw when router is not provided', () => {
        expect(() => screen._handleBookAction('edit', 'b1')).not.toThrow();
      });
    });

    describe('action: delete', () => {
      it('should call _deleteBook with bookId', () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        const spy = vi.spyOn(screen, '_deleteBook');
        screen._handleBookAction('delete', 'b1');
        expect(spy).toHaveBeenCalledWith('b1');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _deleteBook()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_deleteBook()', () => {
    beforeEach(() => {
      screen = new BookshelfScreen({
        container,
        books: [makeBook('b1'), makeBook('b2', 'Вторая книга')],
        onBookSelect,
      });
      screen.render();
    });

    it('should not delete when user cancels confirm dialog', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      screen._deleteBook('b1');
      expect(screen.books).toHaveLength(2);
    });

    it('should remove the book from the books array when confirmed', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      screen._deleteBook('b1');
      expect(screen.books.find(b => b.id === 'b1')).toBeUndefined();
    });

    it('should keep other books intact', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      screen._deleteBook('b1');
      expect(screen.books.find(b => b.id === 'b2')).toBeDefined();
    });

    it('should include book title in confirm dialog message', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      screen._deleteBook('b1');
      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Тестовая книга'));
    });

    it('should remove book from localStorage config', () => {
      localStorage.setItem(
        'flipbook-admin-config',
        JSON.stringify({ books: [{ id: 'b1' }, { id: 'b2' }] }),
      );
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      screen._deleteBook('b1');
      const updated = JSON.parse(localStorage.getItem('flipbook-admin-config'));
      expect(updated.books.find(b => b.id === 'b1')).toBeUndefined();
    });

    it('should preserve remaining books in localStorage', () => {
      localStorage.setItem(
        'flipbook-admin-config',
        JSON.stringify({ books: [{ id: 'b1' }, { id: 'b2' }] }),
      );
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      screen._deleteBook('b1');
      const updated = JSON.parse(localStorage.getItem('flipbook-admin-config'));
      expect(updated.books.find(b => b.id === 'b2')).toBeDefined();
    });

    it('should clear activeBookId when deleting the active book', () => {
      localStorage.setItem(
        'flipbook-admin-config',
        JSON.stringify({ books: [{ id: 'b1' }, { id: 'b2' }], activeBookId: 'b1' }),
      );
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      screen._deleteBook('b1');
      const updated = JSON.parse(localStorage.getItem('flipbook-admin-config'));
      expect(updated.activeBookId).toBeUndefined();
    });

    it('should preserve activeBookId when deleting a different book', () => {
      localStorage.setItem(
        'flipbook-admin-config',
        JSON.stringify({ books: [{ id: 'b1' }, { id: 'b2' }], activeBookId: 'b2' }),
      );
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      screen._deleteBook('b1');
      const updated = JSON.parse(localStorage.getItem('flipbook-admin-config'));
      expect(updated.activeBookId).toBe('b2');
    });

    it('should re-render after deletion', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const renderSpy = vi.spyOn(screen, 'render');
      screen._deleteBook('b1');
      expect(renderSpy).toHaveBeenCalled();
    });

    it('should not throw when localStorage contains invalid JSON', () => {
      localStorage.setItem('flipbook-admin-config', 'INVALID{JSON');
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      expect(() => screen._deleteBook('b1')).not.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getBookshelfData()
// ═══════════════════════════════════════════════════════════════════════════

describe('getBookshelfData()', () => {
  it('should return default book when localStorage is empty', () => {
    const result = getBookshelfData();
    expect(result.books).toHaveLength(1);
    expect(result.books[0].id).toBe('default');
  });

  it('should return books from localStorage config', () => {
    localStorage.setItem(
      'flipbook-admin-config',
      JSON.stringify({ books: [{ id: 'my-book', cover: { title: 'Custom' } }] }),
    );
    const result = getBookshelfData();
    expect(result.books[0].id).toBe('my-book');
  });

  it('should return books regardless of activeBookId (router determines screen)', () => {
    localStorage.setItem(
      'flipbook-admin-config',
      JSON.stringify({ books: [{ id: 'b1' }], activeBookId: 'b1' }),
    );
    const result = getBookshelfData();
    expect(result.books).toHaveLength(1);
    expect(result.books[0].id).toBe('b1');
  });

  it('should fall back to default book when books array is empty', () => {
    localStorage.setItem('flipbook-admin-config', JSON.stringify({ books: [] }));
    const result = getBookshelfData();
    expect(result.books[0].id).toBe('default');
  });

  it('should fall back to default book when books key is missing', () => {
    localStorage.setItem('flipbook-admin-config', JSON.stringify({ activeBookId: 'b1' }));
    const result = getBookshelfData();
    expect(result.books[0].id).toBe('default');
  });

  it('should return defaults on corrupt JSON', () => {
    localStorage.setItem('flipbook-admin-config', 'INVALID{{{JSON');
    const result = getBookshelfData();
    expect(result.books[0].id).toBe('default');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// clearActiveBook()
// ═══════════════════════════════════════════════════════════════════════════

describe('clearActiveBook()', () => {
  it('should remove activeBookId from config', () => {
    localStorage.setItem(
      'flipbook-admin-config',
      JSON.stringify({ books: [{ id: 'b1' }], activeBookId: 'b1' }),
    );
    clearActiveBook();
    const updated = JSON.parse(localStorage.getItem('flipbook-admin-config'));
    expect(updated.activeBookId).toBeUndefined();
  });

  it('should preserve the books array', () => {
    localStorage.setItem(
      'flipbook-admin-config',
      JSON.stringify({ books: [{ id: 'b1' }, { id: 'b2' }], activeBookId: 'b1' }),
    );
    clearActiveBook();
    const updated = JSON.parse(localStorage.getItem('flipbook-admin-config'));
    expect(updated.books).toHaveLength(2);
  });

  it('should work even when sessionStorage has old reading-session flag', () => {
    sessionStorage.setItem('flipbook-reading-session', '1');
    expect(() => clearActiveBook()).not.toThrow();
  });

  it('should not throw when localStorage is empty', () => {
    expect(() => clearActiveBook()).not.toThrow();
  });

  it('should not throw on corrupt JSON', () => {
    localStorage.setItem('flipbook-admin-config', 'INVALID{JSON');
    expect(() => clearActiveBook()).not.toThrow();
  });

  it('should keep localStorage unchanged when no entry exists', () => {
    clearActiveBook();
    expect(localStorage.getItem('flipbook-admin-config')).toBeNull();
  });
});
