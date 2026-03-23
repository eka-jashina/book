import { beforeAll, afterAll } from 'vitest';

// Set test environment variables before importing anything
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://flipbook:flipbook_dev@localhost:5432/flipbook_test';
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters-long';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-32-characters-long!!';
process.env.SESSION_SECURE = 'false';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.S3_ENDPOINT = 'http://localhost:9000';
process.env.S3_BUCKET = 'flipbook-test';
process.env.S3_ACCESS_KEY = 'minioadmin';
process.env.S3_SECRET_KEY = 'minioadmin';
process.env.S3_FORCE_PATH_STYLE = 'true';
process.env.S3_PUBLIC_URL = 'http://localhost:9000/flipbook-test';

import { getPrisma, disconnectPrisma } from '../src/utils/prisma.js';

beforeAll(async () => {
  // Ensure prisma client is initialized
  getPrisma();
});

afterAll(async () => {
  await disconnectPrisma();
});
