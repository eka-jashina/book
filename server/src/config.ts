import 'dotenv/config';
import { z } from 'zod';

const isProduction = process.env.NODE_ENV === 'production';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Pool tuning via query params: ?connection_limit=20&pool_timeout=15
  DATABASE_URL: z.string().min(1).refine(
    (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
    'DATABASE_URL must start with postgresql:// or postgres://',
  ),
  // Recommended pool settings per environment (appended to DATABASE_URL):
  //   Development: ?connection_limit=5&pool_timeout=10
  //   Production:  ?connection_limit=20&pool_timeout=15

  SESSION_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32, 'CSRF_SECRET is required (min 32 chars)'),
  SESSION_MAX_AGE: z.coerce.number().default(604800000), // 7 days
  // In production, default to secure cookies (HTTPS only)
  SESSION_SECURE: z
    .string()
    .transform((v) => v === 'true')
    .default(isProduction ? 'true' : 'false'),

  GOOGLE_CLIENT_ID: isProduction
    ? z.string().min(1).refine((v) => v !== 'placeholder', 'GOOGLE_CLIENT_ID must be set in production (not placeholder)')
    : z.string().default('placeholder'),
  GOOGLE_CLIENT_SECRET: isProduction
    ? z.string().min(1).refine((v) => v !== 'placeholder', 'GOOGLE_CLIENT_SECRET must be set in production (not placeholder)')
    : z.string().default('placeholder'),
  GOOGLE_CALLBACK_URL: z
    .string()
    .default('http://localhost:4000/api/auth/google/callback'),

  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().default('flipbook-uploads'),
  S3_REGION: z.string().default('us-east-1'),
  // S3 credentials: required in production, default to MinIO dev creds otherwise
  S3_ACCESS_KEY: isProduction
    ? z.string().min(1, 'S3_ACCESS_KEY is required in production')
    : z.string().default('minioadmin'),
  S3_SECRET_KEY: isProduction
    ? z.string().min(1, 'S3_SECRET_KEY is required in production')
    : z.string().default('minioadmin'),
  S3_FORCE_PATH_STYLE: z
    .string()
    .transform((v) => v === 'true')
    .default(isProduction ? 'false' : 'true'),
  S3_PUBLIC_URL: isProduction
    ? z.string().min(1, 'S3_PUBLIC_URL is required in production')
    : z.string().default('http://localhost:9000/flipbook-uploads'),

  // Supports multiple origins separated by commas: "https://a.com,https://b.com"
  CORS_ORIGIN: isProduction
    ? z.string().min(1, 'CORS_ORIGIN is required in production (no wildcard default)')
    : z.string().default('http://localhost:3000'),
  APP_URL: isProduction
    ? z.string().min(1, 'APP_URL is required in production')
    : z.string().default('http://localhost:3000'),

  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  SENTRY_DSN: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

let _config: Config | null = null;

export function loadConfig(): Config {
  if (_config) return _config;
  _config = envSchema.parse(process.env);

  // Warn if DATABASE_URL lacks explicit pool tuning — Prisma defaults may not suit production
  if (!_config.DATABASE_URL.includes('connection_limit')) {
    const recommended = _config.NODE_ENV === 'production'
      ? 'connection_limit=20&pool_timeout=15'
      : 'connection_limit=5&pool_timeout=10';
    // Use console.warn because logger may not be initialized yet
    console.warn(
      `[config] DATABASE_URL has no connection_limit — consider appending ?${recommended}`,
    );
  }

  return _config;
}

export function getConfig(): Config {
  if (!_config) return loadConfig();
  return _config;
}
