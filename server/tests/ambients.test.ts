import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent } from './helpers.js';

const app = createApp();

describe('Ambients API', () => {
  beforeEach(async () => { await cleanDatabase(); });

  async function createBookWithAgent() {
    const { agent } = await createAuthenticatedAgent(app);
    const bookRes = await agent.post('/api/v1/books').send({ title: 'Test Book', author: 'Author' }).expect(201);
    return { agent, bookId: bookRes.body.data.id };
  }

  it('should return default builtin ambients for new book', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const res = await agent.get(`/api/v1/books/${bookId}/ambients`).expect(200);
    expect(res.body.data.ambients).toHaveLength(4);
    const keys = res.body.data.ambients.map((a: any) => a.ambientKey);
    expect(keys).toEqual(['none', 'rain', 'fireplace', 'cafe']);
    expect(res.body.data.ambients.every((a: any) => a.builtin === true)).toBe(true);
  });

  it('should require authentication', async () => {
    await request(app).get('/api/v1/books/00000000-0000-0000-0000-000000000000/ambients').expect(401);
  });

  it('should create an ambient after builtins', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const res = await agent.post(`/api/v1/books/${bookId}/ambients`).send({ ambientKey: 'custom1', label: 'Custom' }).expect(201);
    expect(res.body.data.ambientKey).toBe('custom1');
    expect(res.body.data.position).toBe(4); // 4 builtins at positions 0-3
  });

  it('should auto-increment position after builtins', async () => {
    const { agent, bookId } = await createBookWithAgent();
    await agent.post(`/api/v1/books/${bookId}/ambients`).send({ ambientKey: 'custom1', label: 'Custom 1' }).expect(201);
    const res = await agent.post(`/api/v1/books/${bookId}/ambients`).send({ ambientKey: 'custom2', label: 'Custom 2' }).expect(201);
    expect(res.body.data.position).toBe(5); // 4 builtins + 1 custom before
  });

  it('should update ambient', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const cr = await agent.post(`/api/v1/books/${bookId}/ambients`).send({ ambientKey: 'rain', label: 'Rain' }).expect(201);
    const res = await agent.patch(`/api/v1/books/${bookId}/ambients/${cr.body.data.id}`).send({ label: 'Heavy Rain', visible: false }).expect(200);
    expect(res.body.data.label).toBe('Heavy Rain');
    expect(res.body.data.visible).toBe(false);
  });

  it('should delete a custom ambient', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const cr = await agent.post(`/api/v1/books/${bookId}/ambients`).send({ ambientKey: 'custom1', label: 'Custom' }).expect(201);
    await agent.delete(`/api/v1/books/${bookId}/ambients/${cr.body.data.id}`).expect(204);
    const res = await agent.get(`/api/v1/books/${bookId}/ambients`).expect(200);
    expect(res.body.data.ambients).toHaveLength(4); // only builtins remain
  });

  it('should reorder ambients', async () => {
    const { agent, bookId } = await createBookWithAgent();
    // Get builtin ambient ids
    const listRes = await agent.get(`/api/v1/books/${bookId}/ambients`).expect(200);
    const builtins = listRes.body.data.ambients;
    // Reverse the order
    const reversedIds = [...builtins].reverse().map((a: any) => a.id);
    await agent.patch(`/api/v1/books/${bookId}/ambients/reorder`).send({ ambientIds: reversedIds }).expect(200);
    const res = await agent.get(`/api/v1/books/${bookId}/ambients`).expect(200);
    expect(res.body.data.ambients[0].ambientKey).toBe('cafe');
  });

  it('should return 403 for another user', async () => {
    const { bookId } = await createBookWithAgent();
    const { agent: agent2 } = await createAuthenticatedAgent(app, { email: 'other@example.com' });
    await agent2.get(`/api/v1/books/${bookId}/ambients`).expect(403);
  });
});
