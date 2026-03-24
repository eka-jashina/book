import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent, createCsrfAgent } from './helpers.js';
import { getPrisma } from '../src/utils/prisma.js';

const app = createApp();

/**
 * Helper: request a password reset and extract the raw token.
 * Since NODE_ENV=test doesn't return the token in the response,
 * we reverse-lookup via the hashed token stored in the DB.
 * Instead, we use the service directly to get the token.
 */
async function requestResetToken(agent: ReturnType<typeof request.agent>, email: string): Promise<string> {
  // Import the service function to get the raw token
  const { createPasswordResetToken } = await import('../src/services/auth.service.js');
  const token = await createPasswordResetToken(email);
  if (!token) throw new Error(`No reset token created for ${email}`);
  return token;
}

describe('Password Reset API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should return 200 for existing user (prevents email enumeration)', async () => {
      const { email } = await createAuthenticatedAgent(app);
      const { agent } = await createCsrfAgent(app);

      const res = await agent
        .post('/api/v1/auth/forgot-password')
        .send({ email })
        .expect(200);

      expect(res.body.data.message).toContain('reset link');
    });

    it('should return 200 for non-existent email (prevents enumeration)', async () => {
      const { agent } = await createCsrfAgent(app);

      const res = await agent
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nobody@example.com' })
        .expect(200);

      expect(res.body.data.message).toContain('reset link');
    });

    it('should reject invalid email format', async () => {
      const { agent } = await createCsrfAgent(app);

      await agent
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'not-an-email' })
        .expect(400);
    });

    it('should reject request without email', async () => {
      const { agent } = await createCsrfAgent(app);

      await agent
        .post('/api/v1/auth/forgot-password')
        .send({})
        .expect(400);
    });

    it('should store hashed token in database', async () => {
      const { email } = await createAuthenticatedAgent(app);

      // Use service directly to get the raw token
      const token = await requestResetToken(null as any, email);

      const prisma = getPrisma();
      const user = await prisma.user.findUnique({
        where: { email },
        select: { resetToken: true, resetTokenExpiresAt: true },
      });

      expect(user!.resetToken).toBeDefined();
      // Verify the stored hash matches SHA-256 of the raw token
      const expectedHash = createHash('sha256').update(token).digest('hex');
      expect(user!.resetToken).toBe(expectedHash);
      expect(user!.resetTokenExpiresAt).toBeDefined();
      expect(new Date(user!.resetTokenExpiresAt!).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      const { email } = await createAuthenticatedAgent(app);
      const { agent } = await createCsrfAgent(app);

      const token = await requestResetToken(agent, email);

      const res = await agent
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'NewPassword456!' })
        .expect(200);

      expect(res.body.data.message).toContain('reset successfully');
    });

    it('should allow login with new password after reset', async () => {
      const { email } = await createAuthenticatedAgent(app);
      const { agent, tokenRef } = await createCsrfAgent(app);

      const token = await requestResetToken(agent, email);

      await agent
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'NewPassword456!' })
        .expect(200);

      // Re-fetch CSRF (session may have been invalidated)
      const csrfRes = await agent.get('/api/v1/auth/csrf-token').expect(200);
      tokenRef.value = csrfRes.body.data.token;

      // Login with new password
      const loginRes = await agent
        .post('/api/v1/auth/login')
        .send({ email, password: 'NewPassword456!' })
        .expect(200);

      expect(loginRes.body.data.user.email).toBe(email);
    });

    it('should reject login with old password after reset', async () => {
      const { email, password: oldPassword } = await createAuthenticatedAgent(app);
      const { agent, tokenRef } = await createCsrfAgent(app);

      const token = await requestResetToken(agent, email);

      await agent
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'NewPassword456!' })
        .expect(200);

      // Re-fetch CSRF
      const csrfRes = await agent.get('/api/v1/auth/csrf-token').expect(200);
      tokenRef.value = csrfRes.body.data.token;

      // Old password should fail
      await agent
        .post('/api/v1/auth/login')
        .send({ email, password: oldPassword })
        .expect(401);
    });

    it('should reject invalid token', async () => {
      const { agent } = await createCsrfAgent(app);

      await agent
        .post('/api/v1/auth/reset-password')
        .send({ token: 'invalid-token-value', password: 'NewPassword456!' })
        .expect(400);
    });

    it('should reject reuse of consumed token', async () => {
      const { email } = await createAuthenticatedAgent(app);
      const { agent } = await createCsrfAgent(app);

      const token = await requestResetToken(agent, email);

      // First reset — should succeed
      await agent
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'NewPassword456!' })
        .expect(200);

      // Second reset with same token — should fail
      await agent
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'AnotherPassword789!' })
        .expect(400);
    });

    it('should reject expired token', async () => {
      const { email } = await createAuthenticatedAgent(app);
      const { agent } = await createCsrfAgent(app);

      const token = await requestResetToken(agent, email);

      // Manually expire the token in DB
      const prisma = getPrisma();
      await prisma.user.update({
        where: { email },
        data: { resetTokenExpiresAt: new Date(Date.now() - 1000) },
      });

      await agent
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'NewPassword456!' })
        .expect(400);
    });

    it('should reject weak password', async () => {
      const { email } = await createAuthenticatedAgent(app);
      const { agent } = await createCsrfAgent(app);

      const token = await requestResetToken(agent, email);

      await agent
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'short' })
        .expect(400);
    });

    it('should clear reset token from database after successful reset', async () => {
      const { email } = await createAuthenticatedAgent(app);
      const { agent } = await createCsrfAgent(app);

      const token = await requestResetToken(agent, email);

      await agent
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'NewPassword456!' })
        .expect(200);

      const prisma = getPrisma();
      const user = await prisma.user.findUnique({
        where: { email },
        select: { resetToken: true, resetTokenExpiresAt: true },
      });

      expect(user!.resetToken).toBeNull();
      expect(user!.resetTokenExpiresAt).toBeNull();
    });
  });
});
