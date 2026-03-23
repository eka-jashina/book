import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent } from './helpers.js';

const app = createApp();

describe('Appearance API', () => {
  beforeEach(async () => { await cleanDatabase(); });

  async function createBookWithAgent() {
    const { agent } = await createAuthenticatedAgent(app);
    const bookRes = await agent.post('/api/v1/books').send({ title: 'Test Book', author: 'Author' }).expect(201);
    return { agent, bookId: bookRes.body.data.id };
  }

  it('should return appearance with defaults', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const res = await agent.get(`/api/v1/books/${bookId}/appearance`).expect(200);
    expect(res.body.data.fontMin).toBe(14);
    expect(res.body.data.fontMax).toBe(22);
    expect(res.body.data.light.coverBgStart).toBe('#3a2d1f');
    expect(res.body.data.dark.coverBgStart).toBe('#111111');
  });

  it('should require authentication', async () => {
    await request(app).get('/api/v1/books/00000000-0000-0000-0000-000000000000/appearance').expect(401);
  });

  it('should update fontMin and fontMax', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const res = await agent.patch(`/api/v1/books/${bookId}/appearance`).send({ fontMin: 12, fontMax: 28 }).expect(200);
    expect(res.body.data.fontMin).toBe(12);
    expect(res.body.data.fontMax).toBe(28);
  });

  it('should update light theme only', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const res = await agent.patch(`/api/v1/books/${bookId}/appearance/light`).send({ coverBgStart: '#ffffff' }).expect(200);
    expect(res.body.data.light.coverBgStart).toBe('#ffffff');
    expect(res.body.data.dark.coverBgStart).toBe('#111111');
  });

  it('should update dark theme only', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const res = await agent.patch(`/api/v1/books/${bookId}/appearance/dark`).send({ coverBgEnd: '#222222' }).expect(200);
    expect(res.body.data.dark.coverBgEnd).toBe('#222222');
    expect(res.body.data.light.coverBgEnd).toBe('#2a2016');
  });

  it('should reject invalid theme name', async () => {
    const { agent, bookId } = await createBookWithAgent();
    await agent.patch(`/api/v1/books/${bookId}/appearance/sepia`).send({ coverBgStart: '#fff' }).expect(400);
  });

  it('should return 403 for another user', async () => {
    const { bookId } = await createBookWithAgent();
    const { agent: agent2 } = await createAuthenticatedAgent(app, { email: 'other@example.com' });
    await agent2.get(`/api/v1/books/${bookId}/appearance`).expect(403);
  });
});
