/**
 * SENTRY INITIALIZATION
 *
 * Инициализация Sentry для отслеживания ошибок на клиенте.
 * DSN передаётся через переменную окружения VITE_SENTRY_DSN.
 * Если DSN не задан — Sentry не инициализируется (noop).
 */

import * as Sentry from '@sentry/browser';

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
  });
}
