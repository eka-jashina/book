import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent } from './helpers.js';

const app = createApp();

describe('Reading Fonts API', () => {
  beforeEach(async () => { await cleanDatabase(); });

  it('should return empty font list', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const res = await agent.get('/api/v1/fonts').expect(200);
    expect(res.body.data.fonts).toEqual([]);
  });

  it('should require authentication', async () => {
    await request(app).get('/api/v1/fonts').expect(401);
  });

  it('should create a reading font', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const res = await agent.post('/api/v1/fonts').send({ fontKey: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true }).expect(201);
    expect(res.body.data.fontKey).toBe('georgia');
    expect(res.body.data.position).toBe(0);
  });

  it('should auto-increment position', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    await agent.post('/api/v1/fonts').send({ fontKey: 'georgia', label: 'Georgia', family: 'Georgia' }).expect(201);
    const res = await agent.post('/api/v1/fonts').send({ fontKey: 'arial', label: 'Arial', family: 'Arial' }).expect(201);
    expect(res.body.data.position).toBe(1);
  });

  it('should update a font', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const cr = await agent.post('/api/v1/fonts').send({ fontKey: 'georgia', label: 'Georgia', family: 'Georgia' }).expect(201);
    const res = await agent.patch(`/api/v1/fonts/${cr.body.data.id}`).send({ enabled: false }).expect(200);
    expect(res.body.data.enabled).toBe(false);
  });

  it('should delete a font', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const cr = await agent.post('/api/v1/fonts').send({ fontKey: 'georgia', label: 'Georgia', family: 'Georgia' }).expect(201);
    await agent.delete(`/api/v1/fonts/${cr.body.data.id}`).expect(204);
    const res = await agent.get('/api/v1/fonts').expect(200);
    expect(res.body.data.fonts).toHaveLength(0);
  });

  it('should reorder fonts', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const f1 = await agent.post('/api/v1/fonts').send({ fontKey: 'georgia', label: 'Georgia', family: 'Georgia' }).expect(201);
    const f2 = await agent.post('/api/v1/fonts').send({ fontKey: 'arial', label: 'Arial', family: 'Arial' }).expect(201);
    await agent.patch('/api/v1/fonts/reorder').send({ fontIds: [f2.body.data.id, f1.body.data.id] }).expect(200);
    const res = await agent.get('/api/v1/fonts').expect(200);
    expect(res.body.data.fonts[0].fontKey).toBe('arial');
  });

  it('should not allow updating another user font', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const cr = await agent.post('/api/v1/fonts').send({ fontKey: 'georgia', label: 'Georgia', family: 'Georgia' }).expect(201);
    const { agent: agent2 } = await createAuthenticatedAgent(app, { email: 'other@example.com' });
    await agent2.patch(`/api/v1/fonts/${cr.body.data.id}`).send({ enabled: false }).expect(403);
  });
});
