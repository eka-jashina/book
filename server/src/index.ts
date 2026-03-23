import * as Sentry from '@sentry/node';
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';
import { disconnectPrisma, validateConnection } from './utils/prisma.js';

// Load configuration from environment
const config = loadConfig();

// Initialize Sentry (only if DSN is configured)
if (config.SENTRY_DSN) {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    tracesSampleRate: config.NODE_ENV === 'production' ? 0.2 : 1.0,
  });
  logger.info('Sentry initialized');
}

const app = createApp();

// Validate database connectivity before accepting traffic
validateConnection()
  .then(() => {
    logger.info('Database connection verified');
  })
  .catch((err) => {
    logger.fatal({ err }, 'Database connection failed — check DATABASE_URL and pool settings');
    process.exit(1);
  });

const server = app.listen(config.PORT, () => {
  logger.info(
    { port: config.PORT, env: config.NODE_ENV },
    'Flipbook server started',
  );
});

// Graceful shutdown
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return; // prevent double shutdown
  isShuttingDown = true;

  logger.info({ signal }, 'Shutting down gracefully...');

  server.close(async () => {
    await disconnectPrisma();
    logger.info('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds.
  // .unref() ensures the timer doesn't keep the event loop alive
  // if all connections drain before the timeout.
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled errors so they are logged (not silently lost)
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  shutdown('uncaughtException');
});
