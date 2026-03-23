import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent } from './helpers.js';

const app = createApp();

describe('Profile API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('GET /api/profile', () => {
    it('should return the current user profile', async () => {
      const { agent, email, username } = await createAuthenticatedAgent(app, {
        username: 'testprofile',
        displayName: 'Test Profile',
      });

      const res = await agent.get('/api/v1/profile').expect(200);

      expect(res.body.data.email).toBe(email);
      expect(res.body.data.username).toBe('testprofile');
      expect(res.body.data.displayName).toBe('Test Profile');
      expect(res.body.data.bio).toBeNull();
    });

    it('should return 401 for unauthenticated requests', async () => {
      const { default: request } = await import('supertest');
      await request(app).get('/api/v1/profile').expect(401);
    });
  });

  describe('PUT /api/profile', () => {
    it('should update bio', async () => {
      const { agent } = await createAuthenticatedAgent(app, { username: 'bio-test' });

      const res = await agent
        .put('/api/v1/profile')
        .send({ bio: 'Hello, world!' })
        .expect(200);

      expect(res.body.data.bio).toBe('Hello, world!');
    });

    it('should update displayName', async () => {
      const { agent } = await createAuthenticatedAgent(app, { username: 'name-test' });

      const res = await agent
        .put('/api/v1/profile')
        .send({ displayName: 'New Name' })
        .expect(200);

      expect(res.body.data.displayName).toBe('New Name');
    });

    it('should update username', async () => {
      const { agent } = await createAuthenticatedAgent(app, { username: 'old-name' });

      const res = await agent
        .put('/api/v1/profile')
        .send({ username: 'new-name' })
        .expect(200);

      expect(res.body.data.username).toBe('new-name');
    });

    it('should reject taken username', async () => {
      await createAuthenticatedAgent(app, { username: 'taken-name' });
      const { agent } = await createAuthenticatedAgent(app, { username: 'other-name' });

      const res = await agent
        .put('/api/v1/profile')
        .send({ username: 'taken-name' })
        .expect(409);

      expect(res.body.message).toContain('taken');
    });

    it('should allow keeping the same username', async () => {
      const { agent } = await createAuthenticatedAgent(app, { username: 'keep-me' });

      const res = await agent
        .put('/api/v1/profile')
        .send({ username: 'keep-me' })
        .expect(200);

      expect(res.body.data.username).toBe('keep-me');
    });

    it('should reject invalid username format', async () => {
      const { agent } = await createAuthenticatedAgent(app, { username: 'valid-name' });

      await agent
        .put('/api/v1/profile')
        .send({ username: 'AB' })
        .expect(400);
    });

    it('should reject reserved username', async () => {
      const { agent } = await createAuthenticatedAgent(app, { username: 'valid-name2' });

      await agent
        .put('/api/v1/profile')
        .send({ username: 'admin' })
        .expect(400);
    });
  });

  describe('GET /api/profile/check-username/:username', () => {
    it('should return available: true for unused username', async () => {
      const { agent } = await createAuthenticatedAgent(app, { username: 'checker' });

      const res = await agent
        .get('/api/v1/profile/check-username/available-name')
        .expect(200);

      expect(res.body.data.available).toBe(true);
    });

    it('should return available: false for taken username', async () => {
      await createAuthenticatedAgent(app, { username: 'taken-check' });
      const { agent } = await createAuthenticatedAgent(app, { username: 'other-check' });

      const res = await agent
        .get('/api/v1/profile/check-username/taken-check')
        .expect(200);

      expect(res.body.data.available).toBe(false);
    });

    it('should return available: false for reserved username', async () => {
      const { agent } = await createAuthenticatedAgent(app, { username: 'reserve-check' });

      const res = await agent
        .get('/api/v1/profile/check-username/admin')
        .expect(200);

      expect(res.body.data.available).toBe(false);
    });
  });
});
