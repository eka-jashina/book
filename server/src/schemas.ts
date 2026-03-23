/**
 * Central Zod validation schemas.
 * Imported by route handlers and used to auto-generate Swagger spec.
 */
import { z } from 'zod';

// ── Shared constants ──────────────────────────────────────────
/** Absolute min/max bounds for font size across the entire app */
const FONT_SIZE_MIN = 8;
const FONT_SIZE_MAX = 72;

/**
 * Refinement predicate: allows relative paths and http(s) URLs.
 * Blocks javascript:, data: (except data:font/), and other dangerous schemes.
 */
function isSafeUrl(val: string): boolean {
  const trimmed = val.trim().toLowerCase();
  if (trimmed.startsWith('javascript:')) return false;
  if (trimmed.startsWith('vbscript:')) return false;
  // Allow data: URLs only for font files (data:font/...)
  if (trimmed.startsWith('data:') && !trimmed.startsWith('data:font/')) return false;
  return true;
}
const UNSAFE_URL_MSG = { message: 'URL contains a disallowed scheme' };

/** URL/path string — max 500 chars, blocks dangerous URI schemes */
const safeUrlOrPath = z.string().max(500).refine(isSafeUrl, UNSAFE_URL_MSG);

// ── Username ──────────────────────────────────────────
/** Username: lowercase latin, digits, hyphens. 3-40 chars, starts with alphanumeric. */
const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{2,39}$/;
const USERNAME_MSG = { message: 'Username must be 3-40 chars: lowercase letters, digits, hyphens. Must start with letter or digit.' };

const RESERVED_USERNAMES = new Set([
  'account', 'admin', 'api', 'auth', 'about', 'assets',
  'book', 'books',
  'embed', 'explore',
  'help',
  'login',
  'new',
  'public',
  'register',
  'search', 'settings', 'static',
]);

const usernameField = z.string()
  .min(3).max(40)
  .regex(USERNAME_REGEX, USERNAME_MSG)
  .refine((val) => !RESERVED_USERNAMES.has(val), { message: 'This username is reserved' });

// ── Auth ───────────────────────────────────────────
export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().max(100).optional(),
  username: usernameField,
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(255),
  password: z.string().min(8).max(128),
});

// ── Book Slug ─────────────────────────────────────
/** Book slug: lowercase latin, digits, hyphens. 3-100 chars, starts with alphanumeric. */
const BOOK_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{2,99}$/;
const BOOK_SLUG_MSG = { message: 'Slug must be 3-100 chars: lowercase letters, digits, hyphens. Must start with letter or digit.' };

const bookSlugField = z.string()
  .min(3).max(100)
  .regex(BOOK_SLUG_REGEX, BOOK_SLUG_MSG);

// ── Books ──────────────────────────────────────────
export const createBookSchema = z.object({
  title: z.string().min(1).max(500),
  author: z.string().max(500).optional(),
  type: z.enum(['book', 'album']).optional(),
});

export const updateBookSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  author: z.string().max(500).optional(),
  type: z.enum(['book', 'album']).optional(),
  visibility: z.enum(['draft', 'published', 'unlisted']).optional(),
  description: z.string().max(2000).nullable().optional(),
  slug: bookSlugField.nullable().optional(),
  coverBgMode: z.enum(['default', 'none', 'custom']).optional(),
  coverBgCustomUrl: safeUrlOrPath.nullable().optional(),
});

export const bookSlugParamSchema = z.object({
  slug: z.string().min(3).max(100),
});

export const reorderBooksSchema = z.object({
  bookIds: z.array(z.string().uuid()),
});

export const listBooksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).transform((v) => Math.min(v, 100)).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// ── Chapters ───────────────────────────────────────
/** Max chapter HTML size: 2 MB */
const MAX_HTML_CONTENT_LENGTH = 2 * 1024 * 1024;

export const listChaptersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const createChapterSchema = z.object({
  title: z.string().max(500).optional().default(''),
  htmlContent: z.string().max(MAX_HTML_CONTENT_LENGTH).optional(),
  filePath: safeUrlOrPath.optional(),
  bg: safeUrlOrPath.optional(),
  bgMobile: safeUrlOrPath.optional(),
  albumData: z.any().optional(),
});

export const updateChapterSchema = z.object({
  title: z.string().max(500).optional(),
  htmlContent: z.string().max(MAX_HTML_CONTENT_LENGTH).nullable().optional(),
  filePath: safeUrlOrPath.nullable().optional(),
  bg: safeUrlOrPath.optional(),
  bgMobile: safeUrlOrPath.optional(),
  albumData: z.any().nullable().optional(),
});

export const reorderChaptersSchema = z.object({
  chapterIds: z.array(z.string().uuid()),
});

// ── Appearance ─────────────────────────────────────
export const updateAppearanceSchema = z.object({
  fontMin: z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX).optional(),
  fontMax: z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX).optional(),
}).refine(
  (data) => {
    if (data.fontMin !== undefined && data.fontMax !== undefined) {
      return data.fontMin <= data.fontMax;
    }
    return true;
  },
  { message: 'fontMin must be less than or equal to fontMax', path: ['fontMin'] },
);

export const updateThemeSchema = z.object({
  coverBgStart: z.string().max(20).optional(),
  coverBgEnd: z.string().max(20).optional(),
  coverText: z.string().max(20).optional(),
  coverBgImageUrl: safeUrlOrPath.nullable().optional(),
  pageTexture: z.string().max(20).optional(),
  customTextureUrl: safeUrlOrPath.nullable().optional(),
  bgPage: z.string().max(20).optional(),
  bgApp: z.string().max(20).optional(),
});

// ── Sounds ─────────────────────────────────────────
export const updateSoundsSchema = z.object({
  pageFlip: safeUrlOrPath.optional(),
  bookOpen: safeUrlOrPath.optional(),
  bookClose: safeUrlOrPath.optional(),
});

// ── Ambients ───────────────────────────────────────
export const createAmbientSchema = z.object({
  ambientKey: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  shortLabel: z.string().max(50).optional(),
  icon: z.string().max(20).optional(),
  fileUrl: safeUrlOrPath.optional(),
  visible: z.boolean().optional(),
  builtin: z.boolean().optional(),
});

export const updateAmbientSchema = z.object({
  ambientKey: z.string().min(1).max(100).optional(),
  label: z.string().min(1).max(200).optional(),
  shortLabel: z.string().max(50).nullable().optional(),
  icon: z.string().max(20).nullable().optional(),
  fileUrl: safeUrlOrPath.nullable().optional(),
  visible: z.boolean().optional(),
});

export const reorderAmbientsSchema = z.object({
  ambientIds: z.array(z.string().uuid()),
});

// ── Decorative Font ────────────────────────────────
export const upsertDecorativeFontSchema = z.object({
  name: z.string().min(1).max(200),
  fileUrl: z.string().min(1).max(500).refine(isSafeUrl, UNSAFE_URL_MSG),
});

// ── Default Settings ───────────────────────────────
export const updateDefaultSettingsSchema = z.object({
  font: z.string().max(100).optional(),
  fontSize: z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX).optional(),
  theme: z.string().max(20).optional(),
  soundEnabled: z.boolean().optional(),
  soundVolume: z.number().min(0).max(1).optional(),
  ambientType: z.string().max(100).optional(),
  ambientVolume: z.number().min(0).max(1).optional(),
});

// ── Fonts (global) ─────────────────────────────────
export const createFontSchema = z.object({
  fontKey: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  family: z.string().min(1).max(300),
  builtin: z.boolean().optional(),
  enabled: z.boolean().optional(),
  fileUrl: safeUrlOrPath.optional(),
});

export const updateFontSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  family: z.string().min(1).max(300).optional(),
  enabled: z.boolean().optional(),
  fileUrl: safeUrlOrPath.nullable().optional(),
});

export const reorderFontsSchema = z.object({
  fontIds: z.array(z.string().uuid()),
});

// ── Settings (global) ──────────────────────────────
export const updateSettingsSchema = z.object({
  fontMin: z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX).optional(),
  fontMax: z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX).optional(),
  settingsVisibility: z.object({
    fontSize: z.boolean().optional(),
    theme: z.boolean().optional(),
    font: z.boolean().optional(),
    fullscreen: z.boolean().optional(),
    sound: z.boolean().optional(),
    ambient: z.boolean().optional(),
  }).optional(),
}).refine(
  (data) => {
    if (data.fontMin !== undefined && data.fontMax !== undefined) {
      return data.fontMin <= data.fontMax;
    }
    return true;
  },
  { message: 'fontMin must be less than or equal to fontMax', path: ['fontMin'] },
);

// ── Progress ───────────────────────────────────────
export const upsertProgressSchema = z.object({
  page: z.number().int().min(0),
  font: z.string().max(100),
  fontSize: z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX),
  theme: z.string().max(20),
  soundEnabled: z.boolean(),
  soundVolume: z.number().min(0).max(1),
  ambientType: z.string().max(100),
  ambientVolume: z.number().min(0).max(1),
});

// ── Reading Sessions ──────────────────────────────
export const createReadingSessionSchema = z.object({
  startPage: z.number().int().min(0),
  endPage: z.number().int().min(0),
  pagesRead: z.number().int().min(0),
  durationSec: z.number().int().min(0).max(86400), // max 24h
  startedAt: z.string().datetime(),
});

// ── Profile ───────────────────────────────────────
export const updateProfileSchema = z.object({
  displayName: z.string().max(100).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  avatarUrl: safeUrlOrPath.nullable().optional(),
  username: usernameField.optional(),
});

export const usernameParamSchema = z.object({
  username: z.string().min(3).max(40),
});

// ── Public ────────────────────────────────────────
export const discoverQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).transform((v) => Math.min(v, 50)).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// Re-export for use in services
export { RESERVED_USERNAMES };
