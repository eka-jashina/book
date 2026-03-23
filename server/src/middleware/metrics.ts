import { Registry, collectDefaultMetrics, Histogram, Counter, Gauge } from 'prom-client';
import type { Request, Response, NextFunction } from 'express';

export const register = new Registry();

// Метрики Node.js по умолчанию (CPU, память, event loop, GC)
collectDefaultMetrics({ register });

// HTTP-метрики
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

export const httpRequestsInFlight = new Gauge({
  name: 'http_requests_in_flight',
  help: 'Number of HTTP requests currently being processed',
  registers: [register],
});

// Бизнес-метрики
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation'] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const authAttemptsTotal = new Counter({
  name: 'auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['method', 'result'] as const,
  registers: [register],
});

export const s3OperationsTotal = new Counter({
  name: 's3_operations_total',
  help: 'Total S3 storage operations',
  labelNames: ['operation', 'result'] as const,
  registers: [register],
});

export const activeSessionsGauge = new Gauge({
  name: 'active_sessions_total',
  help: 'Number of active user sessions (approximate)',
  registers: [register],
});

/**
 * Нормализация пути роута для метрик (заменяем UUID/ID на :id)
 */
function normalizeRoute(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}

/**
 * Middleware: замеряет длительность каждого HTTP-запроса
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Не замеряем сам /api/metrics
  if (req.path === '/api/metrics') {
    next();
    return;
  }

  httpRequestsInFlight.inc();
  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    const route = normalizeRoute(req.path);
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    end(labels);
    httpRequestsTotal.inc(labels);
    httpRequestsInFlight.dec();
  });

  next();
}
