import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent } from './helpers.js';

const app = createApp();

describe('Decorative Font API', () => {
  beforeEach(async () => { await cleanDatabase(); });

  async function createBookWithAgent() {
    const { agent } = await createAuthenticatedAgent(app);
    const bookRes = await agent.post('/api/v1/books').send({ title: 'Test Book', author: 'Author' }).expect(201);
    return { agent, bookId: bookRes.body.data.id };
  }

  it('should return 204 when no font set', async () => {
    const { agent, bookId } = await createBookWithAgent();
    await agent.get(`/api/v1/books/${bookId}/decorative-font`).expect(204);
  });

  it('should require authentication', async () => {
    await request(app).get('/api/v1/books/00000000-0000-0000-0000-000000000000/decorative-font').expect(401);
  });

  it('should create a decorative font', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const res = await agent.put(`/api/v1/books/${bookId}/decorative-font`).send({ name: 'Fantasy', fileUrl: 'fonts/fantasy.woff2' }).expect(200);
    expect(res.body.data.name).toBe('Fantasy');
  });

  it('should upsert decorative font', async () => {
    const { agent, bookId } = await createBookWithAgent();
    await agent.put(`/api/v1/books/${bookId}/decorative-font`).send({ name: 'Fantasy', fileUrl: 'fonts/fantasy.woff2' }).expect(200);
    const res = await agent.put(`/api/v1/books/${bookId}/decorative-font`).send({ name: 'Gothic', fileUrl: 'fonts/gothic.woff2' }).expect(200);
    expect(res.body.data.name).toBe('Gothic');
  });

  it('should delete decorative font', async () => {
    const { agent, bookId } = await createBookWithAgent();
    await agent.put(`/api/v1/books/${bookId}/decorative-font`).send({ name: 'Fantasy', fileUrl: 'fonts/fantasy.woff2' }).expect(200);
    await agent.delete(`/api/v1/books/${bookId}/decorative-font`).expect(204);
    await agent.get(`/api/v1/books/${bookId}/decorative-font`).expect(204);
  });

  it('should return 404 when deleting non-existent', async () => {
    const { agent, bookId } = await createBookWithAgent();
    await agent.delete(`/api/v1/books/${bookId}/decorative-font`).expect(404);
  });

  it('should return 403 for another user', async () => {
    const { bookId } = await createBookWithAgent();
    const { agent: agent2 } = await createAuthenticatedAgent(app, { email: 'other@example.com' });
    await agent2.get(`/api/v1/books/${bookId}/decorative-font`).expect(403);
  });
});
