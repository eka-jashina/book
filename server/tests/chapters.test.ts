import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent } from './helpers.js';

const app = createApp();

describe('Chapters API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  async function createBookWithAgent(app: ReturnType<typeof createApp>) {
    const { agent } = await createAuthenticatedAgent(app);
    const bookRes = await agent
      .post('/api/v1/books')
      .send({ title: 'Test Book', author: 'Author' })
      .expect(201);
    return { agent, bookId: bookRes.body.data.id };
  }

  describe('GET /api/books/:bookId/chapters', () => {
    it('should return empty chapter list for new book', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      const res = await agent
        .get(`/api/v1/books/${bookId}/chapters`)
        .expect(200);

      expect(res.body.data.chapters).toEqual([]);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.limit).toBe(100);
      expect(res.body.data.offset).toBe(0);
    });

    it('should support pagination via limit and offset', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      // Create 3 chapters
      for (const title of ['Ch 1', 'Ch 2', 'Ch 3']) {
        await agent.post(`/api/v1/books/${bookId}/chapters`).send({ title }).expect(201);
      }

      // Get first 2
      const page1 = await agent
        .get(`/api/v1/books/${bookId}/chapters?limit=2&offset=0`)
        .expect(200);

      expect(page1.body.data.chapters).toHaveLength(2);
      expect(page1.body.data.total).toBe(3);
      expect(page1.body.data.limit).toBe(2);
      expect(page1.body.data.offset).toBe(0);
      expect(page1.body.data.chapters[0].title).toBe('Ch 1');

      // Get remaining
      const page2 = await agent
        .get(`/api/v1/books/${bookId}/chapters?limit=2&offset=2`)
        .expect(200);

      expect(page2.body.data.chapters).toHaveLength(1);
      expect(page2.body.data.total).toBe(3);
      expect(page2.body.data.offset).toBe(2);
      expect(page2.body.data.chapters[0].title).toBe('Ch 3');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/books/00000000-0000-0000-0000-000000000000/chapters')
        .expect(401);
    });
  });

  describe('POST /api/books/:bookId/chapters', () => {
    it('should create a chapter', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      const res = await agent
        .post(`/api/v1/books/${bookId}/chapters`)
        .send({
          title: 'Chapter 1',
          htmlContent: '<p>Hello world</p>',
        })
        .expect(201);

      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe('Chapter 1');
      expect(res.body.data.hasHtmlContent).toBe(true);
      expect(res.body.data.htmlContent).toBe('<p>Hello world</p>');
    });

    it('should auto-increment position', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      await agent
        .post(`/api/v1/books/${bookId}/chapters`)
        .send({ title: 'Ch 1' })
        .expect(201);

      const ch2 = await agent
        .post(`/api/v1/books/${bookId}/chapters`)
        .send({ title: 'Ch 2' })
        .expect(201);

      expect(ch2.body.data.position).toBe(1);
    });
  });

  describe('GET /api/books/:bookId/chapters/:chapterId', () => {
    it('should return chapter details', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      const createRes = await agent
        .post(`/api/v1/books/${bookId}/chapters`)
        .send({ title: 'Detail Chapter', htmlContent: '<p>Content</p>' })
        .expect(201);

      const res = await agent
        .get(`/api/v1/books/${bookId}/chapters/${createRes.body.data.id}`)
        .expect(200);

      expect(res.body.data.title).toBe('Detail Chapter');
      expect(res.body.data.htmlContent).toBe('<p>Content</p>');
    });

    it('should return 404 for non-existent chapter', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      await agent
        .get(
          `/api/v1/books/${bookId}/chapters/00000000-0000-0000-0000-000000000000`,
        )
        .expect(404);
    });
  });

  describe('GET /api/books/:bookId/chapters/:chapterId/content', () => {
    it('should return chapter HTML content', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      const createRes = await agent
        .post(`/api/v1/books/${bookId}/chapters`)
        .send({
          title: 'Content Chapter',
          htmlContent: '<h1>Title</h1><p>Body text</p>',
        })
        .expect(201);

      const res = await agent
        .get(
          `/api/v1/books/${bookId}/chapters/${createRes.body.data.id}/content`,
        )
        .expect(200);

      expect(res.body.data.html).toBe('<h1>Title</h1><p>Body text</p>');
    });
  });

  describe('PATCH /api/books/:bookId/chapters/:chapterId', () => {
    it('should update chapter', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      const createRes = await agent
        .post(`/api/v1/books/${bookId}/chapters`)
        .send({ title: 'Original' })
        .expect(201);

      const res = await agent
        .patch(
          `/api/v1/books/${bookId}/chapters/${createRes.body.data.id}`,
        )
        .send({ title: 'Updated', htmlContent: '<p>New content</p>' })
        .expect(200);

      expect(res.body.data.title).toBe('Updated');
      expect(res.body.data.htmlContent).toBe('<p>New content</p>');
    });
  });

  describe('DELETE /api/books/:bookId/chapters/:chapterId', () => {
    it('should delete a chapter', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      const createRes = await agent
        .post(`/api/v1/books/${bookId}/chapters`)
        .send({ title: 'To Delete' })
        .expect(201);

      await agent
        .delete(
          `/api/v1/books/${bookId}/chapters/${createRes.body.data.id}`,
        )
        .expect(204);

      const res = await agent
        .get(`/api/v1/books/${bookId}/chapters`)
        .expect(200);

      expect(res.body.data.chapters).toHaveLength(0);
    });
  });

  describe('PATCH /api/books/:bookId/chapters/reorder', () => {
    it('should reorder chapters', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      const ch1 = await agent
        .post(`/api/v1/books/${bookId}/chapters`)
        .send({ title: 'Ch A' })
        .expect(201);

      const ch2 = await agent
        .post(`/api/v1/books/${bookId}/chapters`)
        .send({ title: 'Ch B' })
        .expect(201);

      await agent
        .patch(`/api/v1/books/${bookId}/chapters/reorder`)
        .send({ chapterIds: [ch2.body.data.id, ch1.body.data.id] })
        .expect(200);

      const res = await agent
        .get(`/api/v1/books/${bookId}/chapters`)
        .expect(200);

      expect(res.body.data.chapters[0].title).toBe('Ch B');
      expect(res.body.data.chapters[1].title).toBe('Ch A');
    });
  });
});
