/**
 * PUBLIC API — Публичное API (без авторизации)
 */

/** @type {Object<string, Function>} */
export const PublicApi = {
  /** Публичная полка автора */
  async getPublicShelf(username) {
    return this._fetchWithRetry(`/api/v1/public/shelves/${encodeURIComponent(username)}`);
  },

  /** Витрина публичных книг */
  async getPublicDiscover(limit = 6) {
    return this._fetchWithRetry(`/api/v1/public/discover?limit=${limit}`);
  },

  /** Публичная книга (детали для чтения) */
  async getPublicBook(bookId) {
    return this._fetchWithRetry(`/api/v1/public/books/${encodeURIComponent(bookId)}`);
  },

  /** Публичная книга по username + slug */
  async getPublicBookBySlug(username, slug) {
    return this._fetchWithRetry(
      `/api/v1/public/shelves/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`
    );
  },

  /** Контент главы публичной книги */
  async getPublicChapterContent(bookId, chapterId) {
    return this._fetchWithRetry(
      `/api/v1/public/books/${encodeURIComponent(bookId)}/chapters/${encodeURIComponent(chapterId)}/content`
    );
  },
};
