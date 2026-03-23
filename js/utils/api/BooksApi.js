/**
 * BOOKS API — Книги
 */

/** @type {Object<string, Function>} */
export const BooksApi = {
  /** Список книг (для полки) */
  async getBooks() {
    return this._fetchWithRetry('/api/v1/books');
  },

  /** Создать книгу */
  async createBook(data) {
    return this._fetchWithRetry('/api/v1/books', { method: 'POST', body: data });
  },

  /** Полная информация о книге */
  async getBook(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}`);
  },

  /** Обновить метаданные книги */
  async updateBook(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}`, { method: 'PATCH', body: data });
  },

  /** Удалить книгу */
  async deleteBook(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}`, { method: 'DELETE' });
  },

  /** Изменить порядок книг */
  async reorderBooks(bookIds) {
    return this._fetchWithRetry('/api/v1/books/reorder', { method: 'PATCH', body: { bookIds } });
  },

  /** Проверить доступность slug для книги */
  async checkBookSlug(slug, excludeBookId) {
    const params = excludeBookId ? `?excludeBookId=${encodeURIComponent(excludeBookId)}` : '';
    return this._fetchWithRetry(`/api/v1/books/check-slug/${encodeURIComponent(slug)}${params}`);
  },
};
