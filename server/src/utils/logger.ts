import { createRequire } from 'node:module';
import pino from 'pino';

const require = createRequire(import.meta.url);

function hasPinoPretty(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

const targets: pino.TransportTargetOptions[] = [];

if (process.env.NODE_ENV === 'development') {
  if (hasPinoPretty()) {
    targets.push({
      target: 'pino-pretty',
      options: { colorize: true },
      level: 'info',
    });
  } else {
    // pino-pretty is a devDependency — absent in Docker (npm ci --omit=dev)
    targets.push({
      target: 'pino/file',
      options: { destination: 1 },
      level: 'info',
    });
  }
} else if (process.env.NODE_ENV !== 'test') {
  // Production: JSON stdout (для Docker log driver / Loki / CloudWatch)
  targets.push({
    target: 'pino/file',
    options: { destination: 1 },
    level: 'info',
  });
}

// Loki transport — отправка логов в Grafana Loki (если LOKI_URL задан)
if (process.env.LOKI_URL) {
  targets.push({
    target: 'pino-loki',
    options: {
      host: process.env.LOKI_URL,
      batching: true,
      interval: 5,
      labels: {
        app: 'flipbook-server',
        env: process.env.NODE_ENV || 'development',
      },
    },
    level: 'info',
  });
}

export const logger =
  process.env.NODE_ENV === 'test'
    ? pino({ level: 'silent' })
    : pino(
        { level: 'info' },
        targets.length > 0 ? pino.transport({ targets }) : undefined,
      );
