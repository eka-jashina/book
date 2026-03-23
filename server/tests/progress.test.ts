import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent } from './helpers.js';

const app = createApp();
const progressData = { page: 42, font: 'georgia', fontSize: 18, theme: 'dark', soundEnabled: true, soundVolume: 0.5, ambientType: 'rain', ambientVolume: 0.3 };

describe('Reading Progress API', () => {
  beforeEach(async () => { await cleanDatabase(); });

  async function createBookWithAgent() {
    const { agent } = await createAuthenticatedAgent(app);
    const bookRes = await agent.post('/api/v1/books').send({ title: 'Test Book', author: 'Author' }).expect(201);
    return { agent, bookId: bookRes.body.data.id };
  }

  it('should return null progress for new book', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const res = await agent.get(`/api/v1/books/${bookId}/progress`).expect(200);
    expect(res.body.data.progress).toBeNull();
  });

  it('should require authentication', async () => {
    await request(app).get('/api/v1/books/00000000-0000-0000-0000-000000000000/progress').expect(401);
  });

  it('should save reading progress', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const res = await agent.put(`/api/v1/books/${bookId}/progress`).send(progressData).expect(200);
    expect(res.body.data.page).toBe(42);
    expect(res.body.data.updatedAt).toBeDefined();
  });

  it('should upsert progress', async () => {
    const { agent, bookId } = await createBookWithAgent();
    await agent.put(`/api/v1/books/${bookId}/progress`).send(progressData).expect(200);
    const res = await agent.put(`/api/v1/books/${bookId}/progress`).send({ ...progressData, page: 100 }).expect(200);
    expect(res.body.data.page).toBe(100);
  });

  it('should be retrievable after save', async () => {
    const { agent, bookId } = await createBookWithAgent();
    await agent.put(`/api/v1/books/${bookId}/progress`).send(progressData).expect(200);
    const res = await agent.get(`/api/v1/books/${bookId}/progress`).expect(200);
    expect(res.body.data.progress.page).toBe(42);
  });

  it('should validate required fields', async () => {
    const { agent, bookId } = await createBookWithAgent();
    await agent.put(`/api/v1/books/${bookId}/progress`).send({ page: 0 }).expect(400);
  });

  it('should allow any user to save reading progress for any book', async () => {
    const { bookId } = await createBookWithAgent();
    const { agent: agent2 } = await createAuthenticatedAgent(app, { email: 'other@example.com' });
    await agent2.put(`/api/v1/books/${bookId}/progress`).send(progressData).expect(200);
  });
});
