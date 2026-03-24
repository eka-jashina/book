import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════
// Тесты для bookshelfUtils — утилиты книжной полки
// ═══════════════════════════════════════════

vi.mock('@i18n', () => ({
  t: vi.fn((key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key)),
}));

import {
  BOOKS_PER_SHELF,
  VISIBILITY_NEXT,
  visibilityLabel,
  getDefaultBook,
  formatBooksCount,
} from '@core/bookshelfUtils.js';

import { t } from '@i18n';

describe('bookshelfUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // Константы
  // ═══════════════════════════════════════════

  describe('BOOKS_PER_SHELF', () => {
    it('равен 5', () => {
      expect(BOOKS_PER_SHELF).toBe(5);
    });
  });

  describe('VISIBILITY_NEXT', () => {
    it('draft → published', () => {
      expect(VISIBILITY_NEXT.draft).toBe('published');
    });

    it('published → unlisted', () => {
      expect(VISIBILITY_NEXT.published).toBe('unlisted');
    });

    it('unlisted → draft', () => {
      expect(VISIBILITY_NEXT.unlisted).toBe('draft');
    });

    it('содержит ровно 3 ключа', () => {
      expect(Object.keys(VISIBILITY_NEXT)).toHaveLength(3);
    });
  });

  // ═══════════════════════════════════════════
  // visibilityLabel
  // ═══════════════════════════════════════════

  describe('visibilityLabel', () => {
    it('возвращает перевод для draft', () => {
      visibilityLabel('draft');

      expect(t).toHaveBeenCalledWith(
        expect.stringContaining('Draft'),
      );
    });

    it('возвращает перевод для published', () => {
      visibilityLabel('published');

      expect(t).toHaveBeenCalledWith(
        expect.stringContaining('Published'),
      );
    });

    it('возвращает перевод для unlisted', () => {
      visibilityLabel('unlisted');

      expect(t).toHaveBeenCalledWith(
        expect.stringContaining('Unlisted'),
      );
    });

    it('вызывает функцию t для перевода', () => {
      visibilityLabel('draft');

      expect(t).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // getDefaultBook
  // ═══════════════════════════════════════════

  describe('getDefaultBook', () => {
    it('возвращает объект', () => {
      const book = getDefaultBook();

      expect(book).toBeTypeOf('object');
      expect(book).not.toBeNull();
    });

    it('содержит id', () => {
      const book = getDefaultBook();

      expect(book).toHaveProperty('id');
    });

    it('каждый вызов возвращает новый объект', () => {
      const book1 = getDefaultBook();
      const book2 = getDefaultBook();

      expect(book1).not.toBe(book2);
    });
  });

  // ═══════════════════════════════════════════
  // formatBooksCount — русская плюрализация
  // ═══════════════════════════════════════════

  describe('formatBooksCount', () => {
    it.each([
      [1, 'bookshelf.booksCount_one'],
      [21, 'bookshelf.booksCount_one'],
      [101, 'bookshelf.booksCount_one'],
      [2, 'bookshelf.booksCount_few'],
      [3, 'bookshelf.booksCount_few'],
      [4, 'bookshelf.booksCount_few'],
      [22, 'bookshelf.booksCount_few'],
      [102, 'bookshelf.booksCount_few'],
      [0, 'bookshelf.booksCount_many'],
      [5, 'bookshelf.booksCount_many'],
      [11, 'bookshelf.booksCount_many'],
      [12, 'bookshelf.booksCount_many'],
      [111, 'bookshelf.booksCount_many'],
    ])('для count=%i вызывает t("%s", { count })', (count, expectedKey) => {
      formatBooksCount(count);

      expect(t).toHaveBeenCalledWith(expectedKey, { count });
    });

    it('возвращает строку', () => {
      const result = formatBooksCount(5);

      expect(result).toBeTypeOf('string');
    });
  });
});
