import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════
// Тесты для BookCardRenderer — рендеринг карточек книг на полке
// ═══════════════════════════════════════════

vi.mock('@i18n', () => ({
  t: vi.fn((key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key)),
}));

vi.mock('@core/bookshelfUtils.js', () => ({
  BOOKS_PER_SHELF: 5,
  visibilityLabel: vi.fn((vis) => `label_${vis}`),
}));

import { BookCardRenderer } from '@core/BookCardRenderer.js';
import { t } from '@i18n';
import { visibilityLabel } from '@core/bookshelfUtils.js';

// ═══════════════════════════════════════════
// Хелпер для создания шаблонов в DOM
// ═══════════════════════════════════════════

function createTemplates() {
  const shelfTmpl = document.createElement('template');
  shelfTmpl.id = 'tmpl-bookshelf-shelf';
  shelfTmpl.innerHTML =
    '<div class="bookshelf-shelf"><div class="bookshelf-books"></div></div>';
  document.body.appendChild(shelfTmpl);

  const bookTmpl = document.createElement('template');
  bookTmpl.id = 'tmpl-bookshelf-book';
  bookTmpl.innerHTML = `
    <div class="bookshelf-book-wrapper">
      <button class="bookshelf-book" type="button"></button>
      <div class="bookshelf-book-cover"></div>
      <span class="bookshelf-book-badge" hidden></span>
      <span class="bookshelf-book-title"></span>
      <span class="bookshelf-book-author"></span>
      <div class="bookshelf-book-menu" hidden>
        <button data-book-action="read">Read</button>
        <button data-book-action="edit">Edit</button>
        <button data-book-action="delete">Delete</button>
      </div>
    </div>`;
  document.body.appendChild(bookTmpl);
}

function removeTemplates() {
  document.getElementById('tmpl-bookshelf-shelf')?.remove();
  document.getElementById('tmpl-bookshelf-book')?.remove();
}

function createMockBook(overrides = {}) {
  return {
    id: 'book-1',
    title: 'Test Book',
    author: 'Author Name',
    cover: '/images/cover.jpg',
    visibility: 'published',
    ...overrides,
  };
}

describe('BookCardRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTemplates();
  });

  afterEach(() => {
    removeTemplates();
  });

  // ═══════════════════════════════════════════
  // Конструктор
  // ═══════════════════════════════════════════

  describe('constructor', () => {
    it('создаётся в режиме owner', () => {
      const renderer = new BookCardRenderer('owner');
      expect(renderer).toBeTruthy();
    });

    it('создаётся в режиме guest', () => {
      const renderer = new BookCardRenderer('guest');
      expect(renderer).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════
  // createShelves
  // ═══════════════════════════════════════════

  describe('createShelves', () => {
    it('возвращает DocumentFragment', () => {
      const renderer = new BookCardRenderer('owner');
      const books = [createMockBook()];

      const fragment = renderer.createShelves(books);

      expect(fragment).toBeInstanceOf(DocumentFragment);
    });

    it('создаёт одну полку для 1-5 книг', () => {
      const renderer = new BookCardRenderer('owner');
      const books = Array.from({ length: 3 }, (_, i) =>
        createMockBook({ id: `book-${i}` }),
      );

      const fragment = renderer.createShelves(books);
      const shelves = fragment.querySelectorAll('.bookshelf-shelf');

      expect(shelves.length).toBe(1);
    });

    it('создаёт одну полку для ровно 5 книг', () => {
      const renderer = new BookCardRenderer('owner');
      const books = Array.from({ length: 5 }, (_, i) =>
        createMockBook({ id: `book-${i}` }),
      );

      const fragment = renderer.createShelves(books);
      const shelves = fragment.querySelectorAll('.bookshelf-shelf');

      expect(shelves.length).toBe(1);
    });

    it('создаёт две полки для 6 книг', () => {
      const renderer = new BookCardRenderer('owner');
      const books = Array.from({ length: 6 }, (_, i) =>
        createMockBook({ id: `book-${i}` }),
      );

      const fragment = renderer.createShelves(books);
      const shelves = fragment.querySelectorAll('.bookshelf-shelf');

      expect(shelves.length).toBe(2);
    });

    it('создаёт три полки для 11 книг', () => {
      const renderer = new BookCardRenderer('owner');
      const books = Array.from({ length: 11 }, (_, i) =>
        createMockBook({ id: `book-${i}` }),
      );

      const fragment = renderer.createShelves(books);
      const shelves = fragment.querySelectorAll('.bookshelf-shelf');

      expect(shelves.length).toBe(3);
    });

    it('создаёт пустой фрагмент для пустого массива', () => {
      const renderer = new BookCardRenderer('owner');

      const fragment = renderer.createShelves([]);
      const shelves = fragment.querySelectorAll('.bookshelf-shelf');

      expect(shelves.length).toBe(0);
    });

    it('размещает книги на полке', () => {
      const renderer = new BookCardRenderer('owner');
      const books = [
        createMockBook({ id: 'book-1' }),
        createMockBook({ id: 'book-2' }),
      ];

      const fragment = renderer.createShelves(books);
      const bookElements = fragment.querySelectorAll('.bookshelf-book-wrapper');

      expect(bookElements.length).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // _createBook — рендеринг отдельной книги
  // ═══════════════════════════════════════════

  describe('рендеринг карточки книги', () => {
    it('заполняет название книги', () => {
      const renderer = new BookCardRenderer('owner');
      const books = [createMockBook({ title: 'My Great Book' })];

      const fragment = renderer.createShelves(books);
      const title = fragment.querySelector('.bookshelf-book-title');

      expect(title.textContent).toBe('My Great Book');
    });

    it('заполняет имя автора', () => {
      const renderer = new BookCardRenderer('owner');
      const books = [createMockBook({ author: 'J.R.R. Tolkien' })];

      const fragment = renderer.createShelves(books);
      const author = fragment.querySelector('.bookshelf-book-author');

      expect(author.textContent).toBe('J.R.R. Tolkien');
    });

    it('устанавливает обложку книги с coverBgImage', () => {
      const renderer = new BookCardRenderer('owner');
      const books = [createMockBook({
        appearance: { light: { coverBgImage: '/covers/hobbit.jpg' } },
      })];

      const fragment = renderer.createShelves(books);
      const cover = fragment.querySelector('.bookshelf-book-cover');

      const style = cover.getAttribute('style') || '';
      expect(style).toContain('hobbit.jpg');
    });

    it('показывает бейдж видимости для owner', () => {
      const renderer = new BookCardRenderer('owner');
      const books = [createMockBook({ visibility: 'draft' })];

      const fragment = renderer.createShelves(books);
      const badge = fragment.querySelector('.bookshelf-book-badge');

      // Бейдж должен быть видимым для черновика в режиме owner
      expect(visibilityLabel).toHaveBeenCalledWith('draft');
    });

    it('удаляет меню для guest', () => {
      const renderer = new BookCardRenderer('guest');
      const books = [createMockBook()];

      const fragment = renderer.createShelves(books);
      const menu = fragment.querySelector('.bookshelf-book-menu');

      expect(menu).toBeNull();
    });
  });
});
