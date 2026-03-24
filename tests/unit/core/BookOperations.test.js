import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════
// Тесты для BookOperations — операции над книгами
// ═══════════════════════════════════════════

vi.mock('../config/configHelpers.js', () => ({
  adminConfigStorage: {
    save: vi.fn(),
    load: vi.fn(() => ({ books: [] })),
  },
}));

vi.mock('@i18n', () => ({
  t: vi.fn((key) => key),
}));

vi.mock('@core/bookshelfUtils.js', () => ({
  VISIBILITY_NEXT: {
    draft: 'published',
    published: 'unlisted',
    unlisted: 'draft',
  },
}));

import {
  toggleVisibility,
  setVisibility,
  deleteBook,
} from '@core/BookOperations.js';

function createMockBooks() {
  return [
    { id: 'book-1', title: 'Book One', visibility: 'draft' },
    { id: 'book-2', title: 'Book Two', visibility: 'published' },
    { id: 'book-3', title: 'Book Three', visibility: 'unlisted' },
  ];
}

function createMockApiClient() {
  return {
    updateBook: vi.fn().mockResolvedValue({}),
    deleteBook: vi.fn().mockResolvedValue({}),
  };
}

describe('BookOperations', () => {
  let originalConfirm;

  beforeEach(() => {
    vi.clearAllMocks();
    originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    window.confirm = originalConfirm;
  });

  // ═══════════════════════════════════════════
  // toggleVisibility
  // ═══════════════════════════════════════════

  describe('toggleVisibility', () => {
    it('циклирует видимость draft → published', async () => {
      const books = createMockBooks();
      const api = createMockApiClient();

      await toggleVisibility('book-1', books, api);

      expect(books[0].visibility).toBe('published');
    });

    it('циклирует видимость published → unlisted', async () => {
      const books = createMockBooks();
      const api = createMockApiClient();

      await toggleVisibility('book-2', books, api);

      expect(books[1].visibility).toBe('unlisted');
    });

    it('циклирует видимость unlisted → draft', async () => {
      const books = createMockBooks();
      const api = createMockApiClient();

      await toggleVisibility('book-3', books, api);

      expect(books[2].visibility).toBe('draft');
    });

    it('вызывает apiClient.updateBook', async () => {
      const books = createMockBooks();
      const api = createMockApiClient();

      await toggleVisibility('book-1', books, api);

      expect(api.updateBook).toHaveBeenCalledWith(
        'book-1',
        expect.objectContaining({ visibility: 'published' }),
      );
    });
  });

  // ═══════════════════════════════════════════
  // setVisibility
  // ═══════════════════════════════════════════

  describe('setVisibility', () => {
    it('устанавливает указанную видимость', async () => {
      const books = createMockBooks();
      const api = createMockApiClient();

      const result = await setVisibility('book-1', 'published', books, api);

      expect(books[0].visibility).toBe('published');
      expect(result).not.toBe(false);
    });

    it('вызывает apiClient.updateBook', async () => {
      const books = createMockBooks();
      const api = createMockApiClient();

      await setVisibility('book-1', 'unlisted', books, api);

      expect(api.updateBook).toHaveBeenCalledWith(
        'book-1',
        expect.objectContaining({ visibility: 'unlisted' }),
      );
    });

    it('возвращает false если apiClient не передан', async () => {
      const books = createMockBooks();

      const result = await setVisibility('book-1', 'published', books, null);

      expect(result).toBe(false);
    });

    it('возвращает false для невалидной видимости', async () => {
      const books = createMockBooks();
      const api = createMockApiClient();

      const result = await setVisibility('book-1', 'invalid', books, api);

      expect(result).toBe(false);
    });

    it('возвращает false если видимость не изменилась', async () => {
      const books = createMockBooks();
      const api = createMockApiClient();

      const result = await setVisibility('book-1', 'draft', books, api);

      expect(result).toBe(false);
      expect(api.updateBook).not.toHaveBeenCalled();
    });

    it('мутирует объект книги в массиве', async () => {
      const books = createMockBooks();
      const api = createMockApiClient();
      const originalBook = books[0];

      await setVisibility('book-1', 'published', books, api);

      expect(originalBook.visibility).toBe('published');
    });
  });

  // ═══════════════════════════════════════════
  // deleteBook
  // ═══════════════════════════════════════════

  describe('deleteBook', () => {
    it('показывает confirm-диалог', async () => {
      const books = createMockBooks();
      const api = createMockApiClient();

      await deleteBook('book-1', books, api);

      expect(window.confirm).toHaveBeenCalled();
    });

    it('вызывает apiClient.deleteBook при подтверждении', async () => {
      const books = createMockBooks();
      const api = createMockApiClient();
      window.confirm.mockReturnValue(true);

      await deleteBook('book-1', books, api);

      expect(api.deleteBook).toHaveBeenCalledWith('book-1');
    });

    it('не удаляет при отмене confirm', async () => {
      const books = createMockBooks();
      const api = createMockApiClient();
      window.confirm.mockReturnValue(false);

      await deleteBook('book-1', books, api);

      expect(api.deleteBook).not.toHaveBeenCalled();
    });

    it('работает с localStorage-фолбэком без apiClient', async () => {
      const books = createMockBooks();
      window.confirm.mockReturnValue(true);

      // Не должен упасть без apiClient
      await expect(deleteBook('book-1', books, null)).resolves.not.toThrow();
    });
  });
});
