import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent, createCsrfAgent } from './helpers.js';

const app = createApp();

describe('Auth API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const { agent } = await createCsrfAgent(app);

      const res = await agent
        .post('/api/v1/auth/register')
        .send({
          email: 'new@example.com',
          password: 'Password123!',
          displayName: 'New User',
          username: 'newuser',
        })
        .expect(201);

      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('new@example.com');
      expect(res.body.data.user.displayName).toBe('New User');
      expect(res.body.data.user.username).toBe('newuser');
      expect(res.body.data.user.hasPassword).toBe(true);
      expect(res.body.data.user.hasGoogle).toBe(false);
      // Should not expose password hash
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('should reject duplicate emails', async () => {
      const { agent, tokenRef } = await createCsrfAgent(app);

      const regRes = await agent
        .post('/api/v1/auth/register')
        .send({ email: 'dup@example.com', password: 'Password123!', username: 'dup-user1' })
        .expect(201);

      // Update CSRF token after session regeneration
      if (regRes.body.data.csrfToken) tokenRef.value = regRes.body.data.csrfToken;

      const res = await agent
        .post('/api/v1/auth/register')
        .send({ email: 'dup@example.com', password: 'Password123!', username: 'dup-user2' })
        .expect(409);

      expect(res.body.error).toBe('AppError');
    });

    it('should reject weak passwords', async () => {
      const { agent } = await createCsrfAgent(app);

      const res = await agent
        .post('/api/v1/auth/register')
        .send({ email: 'weak@example.com', password: 'short', username: 'weak-user' })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('should reject invalid emails', async () => {
      const { agent } = await createCsrfAgent(app);

      await agent
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'Password123!', username: 'invalid-email-user' })
        .expect(400);
    });

    it('should reject duplicate usernames', async () => {
      const { agent, tokenRef } = await createCsrfAgent(app);

      const regRes = await agent
        .post('/api/v1/auth/register')
        .send({ email: 'user1@example.com', password: 'Password123!', username: 'same-name' })
        .expect(201);

      if (regRes.body.data.csrfToken) tokenRef.value = regRes.body.data.csrfToken;

      const res = await agent
        .post('/api/v1/auth/register')
        .send({ email: 'user2@example.com', password: 'Password123!', username: 'same-name' })
        .expect(409);

      expect(res.body.message).toContain('Username');
    });

    it('should reject reserved usernames', async () => {
      const { agent } = await createCsrfAgent(app);

      const res = await agent
        .post('/api/v1/auth/register')
        .send({ email: 'reserved@example.com', password: 'Password123!', username: 'admin' })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('should reject invalid username format', async () => {
      const { agent } = await createCsrfAgent(app);

      await agent
        .post('/api/v1/auth/register')
        .send({ email: 'bad-user@example.com', password: 'Password123!', username: 'AB' })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const { agent, tokenRef } = await createCsrfAgent(app);

      // Register first
      const regRes = await agent
        .post('/api/v1/auth/register')
        .send({ email: 'login@example.com', password: 'Password123!', username: 'login-user' });

      if (regRes.body.data.csrfToken) tokenRef.value = regRes.body.data.csrfToken;

      // Logout so we can test login
      await agent.post('/api/v1/auth/logout');

      // After logout, session is destroyed — need a fresh CSRF token
      const csrfRes = await agent.get('/api/v1/auth/csrf-token').expect(200);
      tokenRef.value = csrfRes.body.data.token;

      const res = await agent
        .post('/api/v1/auth/login')
        .send({ email: 'login@example.com', password: 'Password123!' })
        .expect(200);

      expect(res.body.data.user.email).toBe('login@example.com');
    });

    it('should reject invalid password', async () => {
      const { agent, tokenRef } = await createCsrfAgent(app);

      const regRes = await agent
        .post('/api/v1/auth/register')
        .send({ email: 'wrong@example.com', password: 'Password123!', username: 'wrong-user' });

      if (regRes.body.data.csrfToken) tokenRef.value = regRes.body.data.csrfToken;

      await agent.post('/api/v1/auth/logout');

      // After logout, session is destroyed — need a fresh CSRF token
      const csrfRes = await agent.get('/api/v1/auth/csrf-token').expect(200);
      tokenRef.value = csrfRes.body.data.token;

      await agent
        .post('/api/v1/auth/login')
        .send({ email: 'wrong@example.com', password: 'WrongPassword!' })
        .expect(401);
    });

    it('should reject non-existent user', async () => {
      const { agent } = await createCsrfAgent(app);

      await agent
        .post('/api/v1/auth/login')
        .send({ email: 'nouser@example.com', password: 'Password123!' })
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user when authenticated', async () => {
      const { agent, email } = await createAuthenticatedAgent(app);

      const res = await agent.get('/api/v1/auth/me').expect(200);
      expect(res.body.data.user.email).toBe(email);
    });

    it('should return null user when not authenticated', async () => {
      const res = await request(app).get('/api/v1/auth/me').expect(200);
      expect(res.body.data.user).toBeNull();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should destroy session', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      // Should be authenticated
      const meRes = await agent.get('/api/v1/auth/me').expect(200);
      expect(meRes.body.data.user).not.toBeNull();

      // Logout
      await agent.post('/api/v1/auth/logout').expect(200);

      // Should no longer be authenticated (returns 200 with user: null)
      const afterRes = await agent.get('/api/v1/auth/me').expect(200);
      expect(afterRes.body.data.user).toBeNull();
    });
  });

  describe('CSRF protection', () => {
    it('should reject POST without CSRF token', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@example.com', password: 'Password123!' })
        .expect(403);
    });

    it('should allow GET without CSRF token', async () => {
      const res = await request(app).get('/api/v1/auth/csrf-token').expect(200);
      expect(res.body.data.token).toBeDefined();
    });
  });
});
