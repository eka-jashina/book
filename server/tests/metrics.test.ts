import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  metricsMiddleware,
  register,
  httpRequestDuration,
  httpRequestsTotal,
  httpRequestsInFlight,
} from '../src/middleware/metrics.js';

function createMockReqRes(path = '/api/v1/books', method = 'GET') {
  const finishHandlers: Array<() => void> = [];

  const req = {
    path,
    method,
  } as unknown as Request;

  const res = {
    statusCode: 200,
    on: vi.fn((event: string, handler: () => void) => {
      if (event === 'finish') finishHandlers.push(handler);
    }),
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;

  const triggerFinish = () => {
    finishHandlers.forEach((fn) => fn());
  };

  return { req, res, next, triggerFinish };
}

describe('Metrics Middleware', () => {
  beforeEach(async () => {
    // Reset all metrics between tests
    register.resetMetrics();
  });

  it('should call next() for regular requests', () => {
    const { req, res, next } = createMockReqRes();
    metricsMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should skip metrics endpoint itself', () => {
    const { req, res, next } = createMockReqRes('/api/metrics');
    metricsMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    // res.on should NOT have been called for /api/metrics
    expect(res.on).not.toHaveBeenCalled();
  });

  it('should register finish handler on response', () => {
    const { req, res, next } = createMockReqRes();
    metricsMiddleware(req, res, next);

    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('should increment in-flight gauge and decrement on finish', async () => {
    const { req, res, next, triggerFinish } = createMockReqRes();

    metricsMiddleware(req, res, next);

    // After middleware, in-flight should be incremented
    const beforeFinish = await httpRequestsInFlight.get();
    expect(beforeFinish.values[0].value).toBe(1);

    triggerFinish();

    const afterFinish = await httpRequestsInFlight.get();
    expect(afterFinish.values[0].value).toBe(0);
  });

  it('should record request duration on finish', async () => {
    const { req, res, next, triggerFinish } = createMockReqRes('/api/v1/books', 'POST');
    res.statusCode = 201;

    metricsMiddleware(req, res, next);
    triggerFinish();

    const metric = await httpRequestDuration.get();
    // Should have at least one observation
    expect(metric.values.length).toBeGreaterThan(0);
  });

  it('should normalize UUIDs in route paths', async () => {
    const { req, res, next, triggerFinish } = createMockReqRes(
      '/api/v1/books/550e8400-e29b-41d4-a716-446655440000/chapters',
    );

    metricsMiddleware(req, res, next);
    triggerFinish();

    const metric = await httpRequestsTotal.get();
    const entry = metric.values.find((v) => v.labels.route?.includes('/:id/'));
    expect(entry).toBeDefined();
    expect(entry!.labels.route).toBe('/api/v1/books/:id/chapters');
  });

  it('should normalize numeric IDs in route paths', async () => {
    const { req, res, next, triggerFinish } = createMockReqRes('/api/v1/items/42');

    metricsMiddleware(req, res, next);
    triggerFinish();

    const metric = await httpRequestsTotal.get();
    const entry = metric.values.find((v) => v.labels.route === '/api/v1/items/:id');
    expect(entry).toBeDefined();
  });

  it('should track status code label', async () => {
    const { req, res, next, triggerFinish } = createMockReqRes();
    res.statusCode = 404;

    metricsMiddleware(req, res, next);
    triggerFinish();

    const metric = await httpRequestsTotal.get();
    const entry = metric.values.find((v) => v.labels.status_code === '404');
    expect(entry).toBeDefined();
  });

  it('should expose a registry with default metrics', async () => {
    const metrics = await register.getMetricsAsJSON();
    // Should include Node.js default metrics
    const names = metrics.map((m) => m.name);
    expect(names).toContain('http_request_duration_seconds');
    expect(names).toContain('http_requests_total');
    expect(names).toContain('http_requests_in_flight');
  });
});
