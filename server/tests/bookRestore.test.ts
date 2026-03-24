import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent } from './helpers.js';
import { getPrisma } from '../src/utils/prisma.js';

const app = createApp();

describe('Book Restore & Purge API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('POST /api/books/:bookId/restore', () => {
    it('should restore a soft-deleted book', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      // Create and delete a book
      const createRes = await agent
        .post('/api/v1/books')
        .send({ title: 'Restorable Book', author: 'Author' })
        .expect(201);

      const bookId = createRes.body.data.id;
      await agent.delete(`/api/v1/books/${bookId}`).expect(204);

      // Book should not appear in list
      const listBefore = await agent.get('/api/v1/books').expect(200);
      expect(listBefore.body.data.books).toHaveLength(0);

      // Restore
      const res = await agent
        .post(`/api/v1/books/${bookId}/restore`)
        .expect(200);

      expect(res.body.data.title).toBe('Restorable Book');
      expect(res.body.data.id).toBe(bookId);

      // Book should reappear in list
      const listAfter = await agent.get('/api/v1/books').expect(200);
      expect(listAfter.body.data.books).toHaveLength(1);
      expect(listAfter.body.data.books[0].id).toBe(bookId);
    });

    it('should return 404 for non-existent book', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      await agent
        .post('/api/v1/books/00000000-0000-0000-0000-000000000000/restore')
        .expect(404);
    });

    it('should return 404 for a book that is not deleted', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const createRes = await agent
        .post('/api/v1/books')
        .send({ title: 'Active Book' })
        .expect(201);

      // Trying to restore a non-deleted book should 404
      await agent
        .post(`/api/v1/books/${createRes.body.data.id}/restore`)
        .expect(404);
    });

    it('should not allow restoring another user\'s deleted book', async () => {
      const { agent: agent1 } = await createAuthenticatedAgent(app, {
        email: 'owner@example.com',
      });
      const { agent: agent2 } = await createAuthenticatedAgent(app, {
        email: 'other@example.com',
      });

      // User 1 creates and deletes a book
      const createRes = await agent1
        .post('/api/v1/books')
        .send({ title: 'Private Book' })
        .expect(201);

      await agent1.delete(`/api/v1/books/${createRes.body.data.id}`).expect(204);

      // User 2 should not be able to restore it
      await agent2
        .post(`/api/v1/books/${createRes.body.data.id}/restore`)
        .expect(404);
    });

    it('should reject restore of book past 30-day retention period', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const createRes = await agent
        .post('/api/v1/books')
        .send({ title: 'Expired Book' })
        .expect(201);

      const bookId = createRes.body.data.id;
      await agent.delete(`/api/v1/books/${bookId}`).expect(204);

      // Manually set deletedAt to 31 days ago
      const prisma = getPrisma();
      const expiredDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      await prisma.book.update({
        where: { id: bookId },
        data: { deletedAt: expiredDate },
      });

      await agent
        .post(`/api/v1/books/${bookId}/restore`)
        .expect(410);
    });

    it('should require authentication', async () => {
      // Unauthenticated POST without CSRF token returns 403 (CSRF check fires first)
      await request(app)
        .post('/api/v1/books/00000000-0000-0000-0000-000000000000/restore')
        .expect(403);
    });

    it('should preserve book sub-resources after restore', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      // Create a book (which creates default appearance, sounds, settings)
      const createRes = await agent
        .post('/api/v1/books')
        .send({ title: 'Book With Data', author: 'Author' })
        .expect(201);

      const bookId = createRes.body.data.id;

      // Delete and restore
      await agent.delete(`/api/v1/books/${bookId}`).expect(204);
      const res = await agent.post(`/api/v1/books/${bookId}/restore`).expect(200);

      // Sub-resources should still be intact
      expect(res.body.data.appearance).toBeDefined();
      expect(res.body.data.sounds).toBeDefined();
      expect(res.body.data.defaultSettings).toBeDefined();
    });
  });

  describe('POST /api/books/purge-expired', () => {
    it('should purge books past retention period', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const createRes = await agent
        .post('/api/v1/books')
        .send({ title: 'Old Deleted Book' })
        .expect(201);

      const bookId = createRes.body.data.id;
      await agent.delete(`/api/v1/books/${bookId}`).expect(204);

      // Set deletedAt to 31 days ago
      const prisma = getPrisma();
      const expiredDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      await prisma.book.update({
        where: { id: bookId },
        data: { deletedAt: expiredDate },
      });

      const res = await agent
        .post('/api/v1/books/purge-expired')
        .expect(200);

      expect(res.body.data.purged).toBe(1);

      // Book should be permanently gone from DB
      const dbBook = await prisma.book.findUnique({ where: { id: bookId } });
      expect(dbBook).toBeNull();
    });

    it('should not purge recently deleted books', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const createRes = await agent
        .post('/api/v1/books')
        .send({ title: 'Recently Deleted' })
        .expect(201);

      await agent.delete(`/api/v1/books/${createRes.body.data.id}`).expect(204);

      const res = await agent
        .post('/api/v1/books/purge-expired')
        .expect(200);

      expect(res.body.data.purged).toBe(0);

      // Book should still exist in DB
      const prisma = getPrisma();
      const dbBook = await prisma.book.findUnique({
        where: { id: createRes.body.data.id },
      });
      expect(dbBook).not.toBeNull();
      expect(dbBook!.deletedAt).not.toBeNull();
    });

    it('should return 0 when no expired books exist', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const res = await agent
        .post('/api/v1/books/purge-expired')
        .expect(200);

      expect(res.body.data.purged).toBe(0);
    });

    it('should cascade-delete sub-resources when purging', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const createRes = await agent
        .post('/api/v1/books')
        .send({ title: 'Cascade Test' })
        .expect(201);

      const bookId = createRes.body.data.id;
      await agent.delete(`/api/v1/books/${bookId}`).expect(204);

      // Expire the book
      const prisma = getPrisma();
      const expiredDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      await prisma.book.update({
        where: { id: bookId },
        data: { deletedAt: expiredDate },
      });

      await agent.post('/api/v1/books/purge-expired').expect(200);

      // All sub-resources should be gone
      const appearance = await prisma.bookAppearance.findUnique({ where: { bookId } });
      const sounds = await prisma.bookSounds.findUnique({ where: { bookId } });
      const settings = await prisma.bookDefaultSettings.findUnique({ where: { bookId } });
      const ambients = await prisma.ambient.findMany({ where: { bookId } });

      expect(appearance).toBeNull();
      expect(sounds).toBeNull();
      expect(settings).toBeNull();
      expect(ambients).toHaveLength(0);
    });

    it('should require authentication', async () => {
      // Unauthenticated POST without CSRF token returns 403 (CSRF check fires first)
      await request(app)
        .post('/api/v1/books/purge-expired')
        .expect(403);
    });
  });
});
