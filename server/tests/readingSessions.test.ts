import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent, createCsrfAgent } from './helpers.js';

const app = createApp();

describe('Reading Sessions API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  async function createBookWithAgent() {
    const { agent } = await createAuthenticatedAgent(app);
    const bookRes = await agent
      .post('/api/v1/books')
      .send({ title: 'Test Book', author: 'Author' })
      .expect(201);
    return { agent, bookId: bookRes.body.data.id };
  }

  const sessionData = {
    startPage: 0,
    endPage: 10,
    pagesRead: 10,
    durationSec: 300,
    startedAt: new Date().toISOString(),
  };

  // ── POST /api/v1/books/:bookId/reading-sessions ──────────────

  describe('POST /api/v1/books/:bookId/reading-sessions', () => {
    it('should create a reading session', async () => {
      const { agent, bookId } = await createBookWithAgent();

      const res = await agent
        .post(`/api/v1/books/${bookId}/reading-sessions`)
        .send(sessionData)
        .expect(201);

      expect(res.body.data.session).toBeDefined();
      expect(res.body.data.session.id).toBeDefined();
      expect(res.body.data.session.bookId).toBe(bookId);
      expect(res.body.data.session.startPage).toBe(0);
      expect(res.body.data.session.endPage).toBe(10);
      expect(res.body.data.session.pagesRead).toBe(10);
      expect(res.body.data.session.durationSec).toBe(300);
      expect(res.body.data.session.startedAt).toBeDefined();
      expect(res.body.data.session.endedAt).toBeDefined();
    });

    it('should require authentication', async () => {
      const { agent } = await createCsrfAgent(app);
      await agent
        .post('/api/v1/books/00000000-0000-0000-0000-000000000000/reading-sessions')
        .send(sessionData)
        .expect(401);
    });

    it('should validate required fields', async () => {
      const { agent, bookId } = await createBookWithAgent();

      await agent
        .post(`/api/v1/books/${bookId}/reading-sessions`)
        .send({ startPage: 0 })
        .expect(400);
    });

    it('should validate durationSec max (86400)', async () => {
      const { agent, bookId } = await createBookWithAgent();

      await agent
        .post(`/api/v1/books/${bookId}/reading-sessions`)
        .send({ ...sessionData, durationSec: 100000 })
        .expect(400);
    });

    it('should validate startedAt as ISO datetime', async () => {
      const { agent, bookId } = await createBookWithAgent();

      await agent
        .post(`/api/v1/books/${bookId}/reading-sessions`)
        .send({ ...sessionData, startedAt: 'not-a-date' })
        .expect(400);
    });

    it('should validate non-negative values', async () => {
      const { agent, bookId } = await createBookWithAgent();

      await agent
        .post(`/api/v1/books/${bookId}/reading-sessions`)
        .send({ ...sessionData, pagesRead: -1 })
        .expect(400);
    });
  });

  // ── GET /api/v1/books/:bookId/reading-sessions ───────────────

  describe('GET /api/v1/books/:bookId/reading-sessions', () => {
    it('should return empty list for new book', async () => {
      const { agent, bookId } = await createBookWithAgent();

      const res = await agent
        .get(`/api/v1/books/${bookId}/reading-sessions`)
        .expect(200);

      expect(res.body.data.sessions).toEqual([]);
      expect(res.body.data.total).toBe(0);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/books/00000000-0000-0000-0000-000000000000/reading-sessions')
        .expect(401);
    });

    it('should return created sessions', async () => {
      const { agent, bookId } = await createBookWithAgent();

      await agent
        .post(`/api/v1/books/${bookId}/reading-sessions`)
        .send(sessionData)
        .expect(201);

      await agent
        .post(`/api/v1/books/${bookId}/reading-sessions`)
        .send({ ...sessionData, startPage: 10, endPage: 20, pagesRead: 10 })
        .expect(201);

      const res = await agent
        .get(`/api/v1/books/${bookId}/reading-sessions`)
        .expect(200);

      expect(res.body.data.sessions).toHaveLength(2);
      expect(res.body.data.total).toBe(2);
    });

    it('should support pagination with limit and offset', async () => {
      const { agent, bookId } = await createBookWithAgent();

      // Create 3 sessions
      for (let i = 0; i < 3; i++) {
        await agent
          .post(`/api/v1/books/${bookId}/reading-sessions`)
          .send({ ...sessionData, startPage: i * 10, endPage: (i + 1) * 10 })
          .expect(201);
      }

      const res = await agent
        .get(`/api/v1/books/${bookId}/reading-sessions?limit=2&offset=0`)
        .expect(200);

      expect(res.body.data.sessions).toHaveLength(2);
      expect(res.body.data.total).toBe(3);

      const res2 = await agent
        .get(`/api/v1/books/${bookId}/reading-sessions?limit=2&offset=2`)
        .expect(200);

      expect(res2.body.data.sessions).toHaveLength(1);
      expect(res2.body.data.total).toBe(3);
    });

    it('should order sessions by endedAt desc', async () => {
      const { agent, bookId } = await createBookWithAgent();

      await agent
        .post(`/api/v1/books/${bookId}/reading-sessions`)
        .send({ ...sessionData, pagesRead: 5 })
        .expect(201);

      await agent
        .post(`/api/v1/books/${bookId}/reading-sessions`)
        .send({ ...sessionData, pagesRead: 15 })
        .expect(201);

      const res = await agent
        .get(`/api/v1/books/${bookId}/reading-sessions`)
        .expect(200);

      // Most recent session should be first
      expect(res.body.data.sessions[0].pagesRead).toBe(15);
      expect(res.body.data.sessions[1].pagesRead).toBe(5);
    });

    it('should not show sessions from another user', async () => {
      const { agent, bookId } = await createBookWithAgent();

      await agent
        .post(`/api/v1/books/${bookId}/reading-sessions`)
        .send(sessionData)
        .expect(201);

      const { agent: agent2 } = await createAuthenticatedAgent(app, {
        email: 'other@example.com',
      });

      const res = await agent2
        .get(`/api/v1/books/${bookId}/reading-sessions`)
        .expect(200);

      expect(res.body.data.sessions).toEqual([]);
      expect(res.body.data.total).toBe(0);
    });

    it('should cap limit at 100', async () => {
      const { agent, bookId } = await createBookWithAgent();

      // Should not error with limit > 100 — it gets capped
      const res = await agent
        .get(`/api/v1/books/${bookId}/reading-sessions?limit=200`)
        .expect(200);

      expect(res.body.data.sessions).toEqual([]);
    });
  });

  // ── GET /api/v1/books/:bookId/reading-sessions/stats ─────────

  describe('GET /api/v1/books/:bookId/reading-sessions/stats', () => {
    it('should return zero stats for book with no sessions', async () => {
      const { agent, bookId } = await createBookWithAgent();

      const res = await agent
        .get(`/api/v1/books/${bookId}/reading-sessions/stats`)
        .expect(200);

      expect(res.body.data.totalSessions).toBe(0);
      expect(res.body.data.totalPages).toBe(0);
      expect(res.body.data.totalDurationSec).toBe(0);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/books/00000000-0000-0000-0000-000000000000/reading-sessions/stats')
        .expect(401);
    });

    it('should aggregate stats correctly', async () => {
      const { agent, bookId } = await createBookWithAgent();

      await agent
        .post(`/api/v1/books/${bookId}/reading-sessions`)
        .send({ ...sessionData, pagesRead: 10, durationSec: 300 })
        .expect(201);

      await agent
        .post(`/api/v1/books/${bookId}/reading-sessions`)
        .send({ ...sessionData, pagesRead: 20, durationSec: 600 })
        .expect(201);

      await agent
        .post(`/api/v1/books/${bookId}/reading-sessions`)
        .send({ ...sessionData, pagesRead: 5, durationSec: 100 })
        .expect(201);

      const res = await agent
        .get(`/api/v1/books/${bookId}/reading-sessions/stats`)
        .expect(200);

      expect(res.body.data.totalSessions).toBe(3);
      expect(res.body.data.totalPages).toBe(35);
      expect(res.body.data.totalDurationSec).toBe(1000);
    });

    it('should not include sessions from another user in stats', async () => {
      const { agent, bookId } = await createBookWithAgent();

      await agent
        .post(`/api/v1/books/${bookId}/reading-sessions`)
        .send({ ...sessionData, pagesRead: 10, durationSec: 300 })
        .expect(201);

      const { agent: agent2 } = await createAuthenticatedAgent(app, {
        email: 'other@example.com',
      });

      // Other user also tracks sessions for the same book
      await agent2
        .post(`/api/v1/books/${bookId}/reading-sessions`)
        .send({ ...sessionData, pagesRead: 50, durationSec: 1000 })
        .expect(201);

      // Original user stats should only include their sessions
      const res = await agent
        .get(`/api/v1/books/${bookId}/reading-sessions/stats`)
        .expect(200);

      expect(res.body.data.totalSessions).toBe(1);
      expect(res.body.data.totalPages).toBe(10);
      expect(res.body.data.totalDurationSec).toBe(300);
    });

    it('should not include sessions from another book', async () => {
      const { agent, bookId } = await createBookWithAgent();

      // Create second book
      const book2Res = await agent
        .post('/api/v1/books')
        .send({ title: 'Book 2' })
        .expect(201);
      const bookId2 = book2Res.body.data.id;

      await agent
        .post(`/api/v1/books/${bookId}/reading-sessions`)
        .send({ ...sessionData, pagesRead: 10 })
        .expect(201);

      await agent
        .post(`/api/v1/books/${bookId2}/reading-sessions`)
        .send({ ...sessionData, pagesRead: 99 })
        .expect(201);

      const res = await agent
        .get(`/api/v1/books/${bookId}/reading-sessions/stats`)
        .expect(200);

      expect(res.body.data.totalSessions).toBe(1);
      expect(res.body.data.totalPages).toBe(10);
    });
  });
});
