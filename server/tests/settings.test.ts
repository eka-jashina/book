import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent } from './helpers.js';

const app = createApp();

describe('Global Settings API', () => {
  beforeEach(async () => { await cleanDatabase(); });

  it('should return defaults for new user', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const res = await agent.get('/api/v1/settings').expect(200);
    expect(res.body.data.fontMin).toBe(14);
    expect(res.body.data.fontMax).toBe(22);
    expect(res.body.data.settingsVisibility.fontSize).toBe(true);
  });

  it('should require authentication', async () => {
    await request(app).get('/api/v1/settings').expect(401);
  });

  it('should update fontMin and fontMax', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const res = await agent.patch('/api/v1/settings').send({ fontMin: 10, fontMax: 30 }).expect(200);
    expect(res.body.data.fontMin).toBe(10);
    expect(res.body.data.fontMax).toBe(30);
  });

  it('should update settings visibility', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const res = await agent.patch('/api/v1/settings').send({ settingsVisibility: { sound: false, ambient: false } }).expect(200);
    expect(res.body.data.settingsVisibility.sound).toBe(false);
    expect(res.body.data.settingsVisibility.fontSize).toBe(true);
  });

  it('should merge updates', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    await agent.patch('/api/v1/settings').send({ fontMin: 12 }).expect(200);
    const res = await agent.patch('/api/v1/settings').send({ fontMax: 28 }).expect(200);
    expect(res.body.data.fontMin).toBe(12);
    expect(res.body.data.fontMax).toBe(28);
  });
});
