import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent } from './helpers.js';

const app = createApp();

describe('Default Settings API', () => {
  beforeEach(async () => { await cleanDatabase(); });

  async function createBookWithAgent() {
    const { agent } = await createAuthenticatedAgent(app);
    const bookRes = await agent.post('/api/v1/books').send({ title: 'Test Book', author: 'Author' }).expect(201);
    return { agent, bookId: bookRes.body.data.id };
  }

  it('should return default settings for a new book', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const res = await agent.get(`/api/v1/books/${bookId}/default-settings`).expect(200);
    expect(res.body.data.font).toBe('georgia');
    expect(res.body.data.fontSize).toBe(18);
    expect(res.body.data.theme).toBe('light');
    expect(res.body.data.soundEnabled).toBe(true);
    expect(res.body.data.soundVolume).toBeCloseTo(0.3);
    expect(res.body.data.ambientType).toBe('none');
    expect(res.body.data.ambientVolume).toBeCloseTo(0.5);
  });

  it('should update default settings', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const res = await agent
      .patch(`/api/v1/books/${bookId}/default-settings`)
      .send({ font: 'arial', fontSize: 20, theme: 'dark' })
      .expect(200);
    expect(res.body.data.font).toBe('arial');
    expect(res.body.data.fontSize).toBe(20);
    expect(res.body.data.theme).toBe('dark');
    // Unchanged fields remain at defaults
    expect(res.body.data.soundEnabled).toBe(true);
  });

  it('should update sound settings', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const res = await agent
      .patch(`/api/v1/books/${bookId}/default-settings`)
      .send({ soundEnabled: false, soundVolume: 0.8, ambientType: 'rain', ambientVolume: 0.7 })
      .expect(200);
    expect(res.body.data.soundEnabled).toBe(false);
    expect(res.body.data.soundVolume).toBeCloseTo(0.8);
    expect(res.body.data.ambientType).toBe('rain');
    expect(res.body.data.ambientVolume).toBeCloseTo(0.7);
  });

  it('should require authentication', async () => {
    await request(app).get('/api/v1/books/00000000-0000-0000-0000-000000000000/default-settings').expect(401);
  });

  it('should return 403 for another user', async () => {
    const { bookId } = await createBookWithAgent();
    const { agent: agent2 } = await createAuthenticatedAgent(app, { email: 'other@example.com' });
    await agent2.get(`/api/v1/books/${bookId}/default-settings`).expect(403);
  });

  it('should return 404 for non-existent book', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    await agent.get('/api/v1/books/00000000-0000-0000-0000-000000000000/default-settings').expect(404);
  });

  it('should validate fontSize bounds', async () => {
    const { agent, bookId } = await createBookWithAgent();
    await agent
      .patch(`/api/v1/books/${bookId}/default-settings`)
      .send({ fontSize: 5 })
      .expect(400);
    await agent
      .patch(`/api/v1/books/${bookId}/default-settings`)
      .send({ fontSize: 100 })
      .expect(400);
  });

  it('should validate volume bounds', async () => {
    const { agent, bookId } = await createBookWithAgent();
    await agent
      .patch(`/api/v1/books/${bookId}/default-settings`)
      .send({ soundVolume: -0.1 })
      .expect(400);
    await agent
      .patch(`/api/v1/books/${bookId}/default-settings`)
      .send({ ambientVolume: 1.5 })
      .expect(400);
  });
});
