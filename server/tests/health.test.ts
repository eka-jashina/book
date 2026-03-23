import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('Health Check', () => {
  it('GET /api/health should return status with checks', async () => {
    const res = await request(app).get('/api/health');

    expect(res.body.timestamp).toBeDefined();
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.database).toBeDefined();
    expect(res.body.checks.storage).toBeDefined();
    // Status can be 'ok' or 'degraded' depending on available services
    expect(['ok', 'degraded']).toContain(res.body.status);
  });
});
