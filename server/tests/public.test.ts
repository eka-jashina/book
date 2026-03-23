import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent } from './helpers.js';

const app = createApp();

/**
 * Helper: create a user with a book and optionally publish it.
 */
async function createUserWithBook(
  opts: { username: string; bookTitle?: string; visibility?: string },
) {
  const { agent, username } = await createAuthenticatedAgent(app, {
    username: opts.username,
  });

  // Create book
  const bookRes = await agent
    .post('/api/v1/books')
    .send({ title: opts.bookTitle || 'Test Book', author: 'Test Author' })
    .expect(201);

  const bookId = bookRes.body.data.id;

  // Set visibility if requested
  if (opts.visibility) {
    await agent
      .patch(`/api/v1/books/${bookId}`)
      .send({ visibility: opts.visibility })
      .expect(200);
  }

  // Add a chapter so it's not empty
  await agent
    .post(`/api/v1/books/${bookId}/chapters`)
    .send({ title: 'Chapter 1', htmlContent: '<p>Hello world</p>' })
    .expect(201);

  return { agent, username, bookId };
}

describe('Public API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('GET /api/public/shelves/:username', () => {
    it('should return author profile and published books', async () => {
      const { username, bookId } = await createUserWithBook({
        username: 'shelf-author',
        bookTitle: 'Published Book',
        visibility: 'published',
      });

      const res = await request(app)
        .get(`/api/v1/public/shelves/${username}`)
        .expect(200);

      expect(res.body.data.author.username).toBe(username);
      expect(res.body.data.author.displayName).toBeDefined();
      // Should not expose email
      expect(res.body.data.author.email).toBeUndefined();
      expect(res.body.data.books).toHaveLength(1);
      expect(res.body.data.books[0].title).toBe('Published Book');
    });

    it('should not include draft books in shelf', async () => {
      const { username } = await createUserWithBook({
        username: 'draft-author',
        bookTitle: 'Draft Book',
        // visibility defaults to 'draft'
      });

      const res = await request(app)
        .get(`/api/v1/public/shelves/${username}`)
        .expect(200);

      expect(res.body.data.books).toHaveLength(0);
    });

    it('should not include unlisted books in shelf', async () => {
      const { username } = await createUserWithBook({
        username: 'unlisted-author',
        bookTitle: 'Unlisted Book',
        visibility: 'unlisted',
      });

      const res = await request(app)
        .get(`/api/v1/public/shelves/${username}`)
        .expect(200);

      expect(res.body.data.books).toHaveLength(0);
    });

    it('should return 404 for non-existent username', async () => {
      await request(app)
        .get('/api/v1/public/shelves/no-such-user')
        .expect(404);
    });
  });

  describe('GET /api/public/books/:bookId', () => {
    it('should return published book details', async () => {
      const { bookId } = await createUserWithBook({
        username: 'book-author',
        bookTitle: 'Public Book',
        visibility: 'published',
      });

      const res = await request(app)
        .get(`/api/v1/public/books/${bookId}`)
        .expect(200);

      expect(res.body.data.title).toBe('Public Book');
      expect(res.body.data.owner.username).toBe('book-author');
      expect(res.body.data.chapters).toHaveLength(1);
    });

    it('should return unlisted book details', async () => {
      const { bookId } = await createUserWithBook({
        username: 'unlisted-book-author',
        bookTitle: 'Unlisted Book',
        visibility: 'unlisted',
      });

      const res = await request(app)
        .get(`/api/v1/public/books/${bookId}`)
        .expect(200);

      expect(res.body.data.title).toBe('Unlisted Book');
    });

    it('should return 404 for draft books', async () => {
      const { bookId } = await createUserWithBook({
        username: 'draft-book-author',
        bookTitle: 'Draft Book',
      });

      await request(app)
        .get(`/api/v1/public/books/${bookId}`)
        .expect(404);
    });

    it('should return 404 for non-existent book', async () => {
      await request(app)
        .get('/api/v1/public/books/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('GET /api/public/books/:bookId/chapters/:chapterId/content', () => {
    it('should return chapter content for published book', async () => {
      const { bookId, agent } = await createUserWithBook({
        username: 'chapter-author',
        visibility: 'published',
      });

      // Get chapters to find chapterId
      const chaptersRes = await request(app)
        .get(`/api/v1/public/books/${bookId}/chapters`)
        .expect(200);

      const chapterId = chaptersRes.body.data[0].id;

      const res = await request(app)
        .get(`/api/v1/public/books/${bookId}/chapters/${chapterId}/content`)
        .expect(200);

      expect(res.body.data.htmlContent).toContain('Hello world');
    });

    it('should return 404 for draft book chapters', async () => {
      const { bookId, agent } = await createUserWithBook({
        username: 'draft-chapter-author',
      });

      // Get chapters via authenticated endpoint
      const chaptersRes = await agent
        .get(`/api/v1/books/${bookId}/chapters`)
        .expect(200);

      const chapterId = chaptersRes.body.data.chapters[0].id;

      await request(app)
        .get(`/api/v1/public/books/${bookId}/chapters/${chapterId}/content`)
        .expect(404);
    });
  });

  describe('GET /api/public/discover', () => {
    it('should return published books sorted by date', async () => {
      await createUserWithBook({
        username: 'discover-author1',
        bookTitle: 'First Book',
        visibility: 'published',
      });

      await createUserWithBook({
        username: 'discover-author2',
        bookTitle: 'Second Book',
        visibility: 'published',
      });

      const res = await request(app)
        .get('/api/v1/public/discover')
        .expect(200);

      expect(res.body.data.books.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.total).toBeGreaterThanOrEqual(2);
      // Each book should have an owner
      for (const book of res.body.data.books) {
        expect(book.owner.username).toBeDefined();
      }
    });

    it('should not include drafts in discover', async () => {
      await createUserWithBook({
        username: 'discover-draft',
        bookTitle: 'Draft Book',
      });

      const res = await request(app)
        .get('/api/v1/public/discover')
        .expect(200);

      const titles = res.body.data.books.map((b: any) => b.title);
      expect(titles).not.toContain('Draft Book');
    });

    it('should respect limit parameter', async () => {
      await createUserWithBook({
        username: 'limit-author1',
        visibility: 'published',
      });
      await createUserWithBook({
        username: 'limit-author2',
        visibility: 'published',
      });

      const res = await request(app)
        .get('/api/v1/public/discover?limit=1')
        .expect(200);

      expect(res.body.data.books).toHaveLength(1);
    });
  });
});

describe('Book visibility via PATCH /api/books/:bookId', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should update visibility to published and set publishedAt', async () => {
    const { agent, bookId } = await createUserWithBook({
      username: 'visibility-author',
    });

    const res = await agent
      .patch(`/api/v1/books/${bookId}`)
      .send({ visibility: 'published' })
      .expect(200);

    expect(res.body.data.visibility).toBe('published');
    expect(res.body.data.publishedAt).toBeTruthy();
  });

  it('should not reset publishedAt when switching back to draft', async () => {
    const { agent, bookId } = await createUserWithBook({
      username: 'keep-date-author',
      visibility: 'published',
    });

    // Get the publishedAt date
    const book1 = await agent.get(`/api/v1/books/${bookId}`).expect(200);
    const publishedAt = book1.body.data.publishedAt;

    // Switch to draft
    const res = await agent
      .patch(`/api/v1/books/${bookId}`)
      .send({ visibility: 'draft' })
      .expect(200);

    expect(res.body.data.visibility).toBe('draft');
    // publishedAt should remain
    expect(res.body.data.publishedAt).toBe(publishedAt);
  });

  it('should update description', async () => {
    const { agent, bookId } = await createUserWithBook({
      username: 'desc-author',
    });

    const res = await agent
      .patch(`/api/v1/books/${bookId}`)
      .send({ description: 'A great book about testing' })
      .expect(200);

    expect(res.body.data.description).toBe('A great book about testing');
  });
});
