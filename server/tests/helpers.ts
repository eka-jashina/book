import { type Express } from 'express';
import request from 'supertest';
import { getPrisma } from '../src/utils/prisma.js';

type TestAgent = ReturnType<typeof request.agent>;

/**
 * Mutable CSRF token holder — allows token to be updated after auth state changes
 * (register/login regenerate the session, which invalidates the old CSRF token).
 */
interface CsrfTokenRef {
  value: string;
}

/**
 * Wrap a supertest agent so POST/PUT/PATCH/DELETE auto-include the CSRF header.
 * Uses a mutable ref so the token can be updated after auth-changing requests.
 */
function wrapAgentWithCsrf(agent: TestAgent, tokenRef: CsrfTokenRef): TestAgent {
  const methods = ['post', 'put', 'patch', 'delete'] as const;
  for (const method of methods) {
    const original = agent[method].bind(agent);
    (agent as any)[method] = (url: string) => original(url).set('x-csrf-token', tokenRef.value);
  }
  return agent;
}

/**
 * Create an unauthenticated agent with a valid CSRF token.
 * Use this for tests that need CSRF but no session (e.g. register/login tests).
 */
export async function createCsrfAgent(app: Express) {
  const agent = request.agent(app);
  const csrfRes = await agent.get('/api/v1/auth/csrf-token').expect(200);
  const tokenRef: CsrfTokenRef = { value: csrfRes.body.data.token };
  wrapAgentWithCsrf(agent, tokenRef);
  return { agent, csrfToken: tokenRef.value, tokenRef };
}

/**
 * Create a test user and return a logged-in agent with session cookie and CSRF token.
 * The agent auto-injects the CSRF header on POST/PUT/PATCH/DELETE requests.
 */
export async function createAuthenticatedAgent(
  app: Express,
  userData?: { email?: string; password?: string; displayName?: string; username?: string },
) {
  const email = userData?.email || `test-${Date.now()}@example.com`;
  const password = userData?.password || 'TestPassword123!';
  const displayName = userData?.displayName || 'Test User';
  const username = userData?.username || `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const agent = request.agent(app);

  // Get CSRF token (sets the CSRF cookie on the agent)
  const csrfRes = await agent.get('/api/v1/auth/csrf-token').expect(200);
  const tokenRef: CsrfTokenRef = { value: csrfRes.body.data.token };

  // Wrap agent to auto-include CSRF token on mutating requests
  wrapAgentWithCsrf(agent, tokenRef);

  // Register the user (CSRF header auto-injected)
  // Register regenerates the session — response includes a new CSRF token
  const regRes = await agent
    .post('/api/v1/auth/register')
    .send({ email, password, displayName, username })
    .expect(201);

  // Update CSRF token from registration response (session was regenerated)
  if (regRes.body.data.csrfToken) {
    tokenRef.value = regRes.body.data.csrfToken;
  }

  return { agent, email, password, displayName, username, csrfToken: tokenRef.value, tokenRef };
}

/**
 * Clean up test data from the database.
 */
export async function cleanDatabase() {
  const prisma = getPrisma();

  // Delete in order respecting foreign key constraints
  await prisma.readingSession.deleteMany();
  await prisma.readingPreferences.deleteMany();
  await prisma.readingProgress.deleteMany();
  await prisma.ambient.deleteMany();
  await prisma.decorativeFont.deleteMany();
  await prisma.bookDefaultSettings.deleteMany();
  await prisma.bookSounds.deleteMany();
  await prisma.bookAppearance.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.book.deleteMany();
  await prisma.readingFont.deleteMany();
  await prisma.globalSettings.deleteMany();
  await prisma.user.deleteMany();
  // Clean session table (managed by connect-pg-simple, not Prisma)
  // Table may not exist in test environments where the session store hasn't initialized
  await prisma.$executeRawUnsafe('DELETE FROM "session"').catch(() => {});
}
