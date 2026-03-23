/**
 * OpenAPI 3.0 specification for the Flipbook API.
 *
 * Component schemas are auto-generated from Zod validation schemas
 * to keep API docs in sync with the actual validation logic.
 *
 * Served at /api/docs (Swagger UI) and /api/docs/spec.json (raw spec).
 */
import { zodToOpenApi } from './utils/zodToOpenApi.js';
import * as S from './schemas.js';

// Auto-generate request body schemas from Zod definitions
const schemas = {
  Error: {
    type: 'object',
    properties: {
      error: { type: 'string' },
      message: { type: 'string' },
      statusCode: { type: 'integer' },
      requestId: { type: 'string', format: 'uuid' },
    },
  },
  HealthCheck: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok', 'degraded'] },
      timestamp: { type: 'string', format: 'date-time' },
      checks: {
        type: 'object',
        properties: {
          database: { type: 'string', enum: ['ok', 'error'] },
          storage: { type: 'string', enum: ['ok', 'error'] },
        },
      },
    },
  },
  // Auth
  Register: zodToOpenApi(S.registerSchema),
  Login: zodToOpenApi(S.loginSchema),
  // Books
  CreateBook: zodToOpenApi(S.createBookSchema),
  UpdateBook: zodToOpenApi(S.updateBookSchema),
  ReorderBooks: zodToOpenApi(S.reorderBooksSchema),
  // Chapters
  CreateChapter: zodToOpenApi(S.createChapterSchema),
  UpdateChapter: zodToOpenApi(S.updateChapterSchema),
  ReorderChapters: zodToOpenApi(S.reorderChaptersSchema),
  // Appearance
  UpdateAppearance: zodToOpenApi(S.updateAppearanceSchema),
  UpdateTheme: zodToOpenApi(S.updateThemeSchema),
  // Sounds
  UpdateSounds: zodToOpenApi(S.updateSoundsSchema),
  // Ambients
  CreateAmbient: zodToOpenApi(S.createAmbientSchema),
  UpdateAmbient: zodToOpenApi(S.updateAmbientSchema),
  ReorderAmbients: zodToOpenApi(S.reorderAmbientsSchema),
  // Decorative Font
  UpsertDecorativeFont: zodToOpenApi(S.upsertDecorativeFontSchema),
  // Default Settings
  UpdateDefaultSettings: zodToOpenApi(S.updateDefaultSettingsSchema),
  // Fonts
  CreateFont: zodToOpenApi(S.createFontSchema),
  UpdateFont: zodToOpenApi(S.updateFontSchema),
  ReorderFonts: zodToOpenApi(S.reorderFontsSchema),
  // Settings
  UpdateSettings: zodToOpenApi(S.updateSettingsSchema),
  // Progress
  UpsertProgress: zodToOpenApi(S.upsertProgressSchema),
};

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const jsonBody = (schemaName: string) => ({
  required: true,
  content: { 'application/json': { schema: ref(schemaName) } },
});
const bookIdParam = { name: 'bookId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Flipbook API',
    version: '1.0.0',
    description:
      'Backend API for the Flipbook interactive e-book reader. Supports multi-book management, chapters, appearance customization, sounds, fonts, reading progress, and more.',
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  tags: [
    { name: 'Auth', description: 'Authentication (email/password + Google OAuth)' },
    { name: 'Books', description: 'Book CRUD & reordering' },
    { name: 'Chapters', description: 'Chapter CRUD within a book' },
    { name: 'Appearance', description: 'Per-book appearance (cover colors, textures)' },
    { name: 'Sounds', description: 'Per-book page-flip sounds' },
    { name: 'Ambients', description: 'Per-book ambient background sounds' },
    { name: 'DecorativeFont', description: 'Per-book decorative (title) font' },
    { name: 'Progress', description: 'Per-book reading progress' },
    { name: 'DefaultSettings', description: 'Per-book default reader settings' },
    { name: 'Fonts', description: 'Global reading fonts' },
    { name: 'Settings', description: 'Global user settings' },
    { name: 'Upload', description: 'File uploads (fonts, sounds, images, books)' },
    { name: 'ExportImport', description: 'Full config export/import' },
    { name: 'Health', description: 'Server health checks' },
  ],
  components: {
    securitySchemes: {
      session: {
        type: 'apiKey',
        in: 'cookie',
        name: 'connect.sid',
        description: 'Session cookie (set after login)',
      },
    },
    schemas,
  },
  security: [{ session: [] }],
  paths: {
    // ── Health ──────────────────────────────────────
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check with DB & S3 status',
        security: [],
        responses: {
          200: { description: 'All systems operational', content: { 'application/json': { schema: ref('HealthCheck') } } },
          503: { description: 'One or more subsystems degraded' },
        },
      },
    },
    // ── Auth ────────────────────────────────────────
    '/auth/register': {
      post: {
        tags: ['Auth'], summary: 'Register a new user (email + password)', security: [],
        requestBody: jsonBody('Register'),
        responses: { 201: { description: 'User created & logged in' }, 409: { description: 'Email already taken' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Login with email + password', security: [],
        requestBody: jsonBody('Login'),
        responses: { 200: { description: 'Login successful' }, 401: { description: 'Invalid credentials' } },
      },
    },
    '/auth/logout': {
      post: { tags: ['Auth'], summary: 'Logout (destroy session)', responses: { 200: { description: 'Logged out' } } },
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Get current user', responses: { 200: { description: 'Authenticated user' }, 401: { description: 'Not authenticated' } } },
    },
    '/auth/google': {
      get: { tags: ['Auth'], summary: 'Redirect to Google OAuth', security: [], responses: { 302: { description: 'Redirect to Google' } } },
    },
    '/auth/google/callback': {
      get: { tags: ['Auth'], summary: 'Google OAuth callback', security: [], responses: { 302: { description: 'Redirect to app after auth' } } },
    },
    // ── Books ───────────────────────────────────────
    '/books': {
      get: {
        tags: ['Books'], summary: 'List user books (paginated)',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 }, description: 'Max books per page (default 50)' },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 }, description: 'Number of books to skip' },
        ],
        responses: { 200: { description: 'Paginated list of books' } },
      },
      post: { tags: ['Books'], summary: 'Create a book', requestBody: jsonBody('CreateBook'), responses: { 201: { description: 'Book created' } } },
    },
    '/books/reorder': {
      patch: { tags: ['Books'], summary: 'Reorder books', requestBody: jsonBody('ReorderBooks'), responses: { 200: { description: 'Reordered' } } },
    },
    '/books/{bookId}': {
      get: { tags: ['Books'], summary: 'Get book by ID', parameters: [bookIdParam], responses: { 200: { description: 'Book details' }, 404: { description: 'Not found' } } },
      patch: { tags: ['Books'], summary: 'Update book', parameters: [bookIdParam], requestBody: jsonBody('UpdateBook'), responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Books'], summary: 'Delete book', parameters: [bookIdParam], responses: { 204: { description: 'Deleted' } } },
    },
    // ── Chapters ────────────────────────────────────
    '/books/{bookId}/chapters': {
      get: { tags: ['Chapters'], summary: 'List chapters', parameters: [bookIdParam], responses: { 200: { description: 'Array of chapters' } } },
      post: { tags: ['Chapters'], summary: 'Create chapter', parameters: [bookIdParam], requestBody: jsonBody('CreateChapter'), responses: { 201: { description: 'Chapter created' } } },
    },
    '/books/{bookId}/chapters/reorder': {
      patch: { tags: ['Chapters'], summary: 'Reorder chapters', parameters: [bookIdParam], requestBody: jsonBody('ReorderChapters'), responses: { 200: { description: 'Reordered' } } },
    },
    '/books/{bookId}/chapters/{chapterId}': {
      get: { tags: ['Chapters'], summary: 'Get chapter', parameters: [bookIdParam, { name: 'chapterId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Chapter details' } } },
      patch: { tags: ['Chapters'], summary: 'Update chapter', parameters: [bookIdParam, { name: 'chapterId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: jsonBody('UpdateChapter'), responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Chapters'], summary: 'Delete chapter', parameters: [bookIdParam, { name: 'chapterId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 204: { description: 'Deleted' } } },
    },
    '/books/{bookId}/chapters/{chapterId}/content': {
      get: { tags: ['Chapters'], summary: 'Get chapter HTML content', parameters: [bookIdParam, { name: 'chapterId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Chapter HTML' } } },
    },
    // ── Appearance ──────────────────────────────────
    '/books/{bookId}/appearance': {
      get: { tags: ['Appearance'], summary: 'Get book appearance', parameters: [bookIdParam], responses: { 200: { description: 'Appearance settings' } } },
      patch: { tags: ['Appearance'], summary: 'Update appearance (fontMin/fontMax)', parameters: [bookIdParam], requestBody: jsonBody('UpdateAppearance'), responses: { 200: { description: 'Updated' } } },
    },
    '/books/{bookId}/appearance/{theme}': {
      patch: { tags: ['Appearance'], summary: 'Update theme appearance (light/dark)', parameters: [bookIdParam, { name: 'theme', in: 'path', required: true, schema: { type: 'string', enum: ['light', 'dark'] } }], requestBody: jsonBody('UpdateTheme'), responses: { 200: { description: 'Theme updated' } } },
    },
    // ── Sounds ──────────────────────────────────────
    '/books/{bookId}/sounds': {
      get: { tags: ['Sounds'], summary: 'Get book sounds', parameters: [bookIdParam], responses: { 200: { description: 'Sound config' } } },
      patch: { tags: ['Sounds'], summary: 'Update book sounds', parameters: [bookIdParam], requestBody: jsonBody('UpdateSounds'), responses: { 200: { description: 'Updated' } } },
    },
    // ── Ambients ────────────────────────────────────
    '/books/{bookId}/ambients': {
      get: { tags: ['Ambients'], summary: 'List ambients', parameters: [bookIdParam], responses: { 200: { description: 'Array of ambients' } } },
      post: { tags: ['Ambients'], summary: 'Create ambient', parameters: [bookIdParam], requestBody: jsonBody('CreateAmbient'), responses: { 201: { description: 'Created' } } },
    },
    '/books/{bookId}/ambients/reorder': {
      patch: { tags: ['Ambients'], summary: 'Reorder ambients', parameters: [bookIdParam], requestBody: jsonBody('ReorderAmbients'), responses: { 200: { description: 'Reordered' } } },
    },
    '/books/{bookId}/ambients/{ambientId}': {
      patch: { tags: ['Ambients'], summary: 'Update ambient', parameters: [bookIdParam, { name: 'ambientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: jsonBody('UpdateAmbient'), responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Ambients'], summary: 'Delete ambient', parameters: [bookIdParam, { name: 'ambientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 204: { description: 'Deleted' } } },
    },
    // ── Decorative Font ─────────────────────────────
    '/books/{bookId}/decorative-font': {
      get: { tags: ['DecorativeFont'], summary: 'Get decorative font', parameters: [bookIdParam], responses: { 200: { description: 'Font data' }, 204: { description: 'No font set' } } },
      put: { tags: ['DecorativeFont'], summary: 'Upsert decorative font', parameters: [bookIdParam], requestBody: jsonBody('UpsertDecorativeFont'), responses: { 200: { description: 'Font saved' } } },
      delete: { tags: ['DecorativeFont'], summary: 'Delete decorative font', parameters: [bookIdParam], responses: { 204: { description: 'Deleted' } } },
    },
    // ── Progress ────────────────────────────────────
    '/books/{bookId}/progress': {
      get: { tags: ['Progress'], summary: 'Get reading progress', parameters: [bookIdParam], responses: { 200: { description: 'Reading progress' } } },
      put: { tags: ['Progress'], summary: 'Save reading progress', parameters: [bookIdParam], requestBody: jsonBody('UpsertProgress'), responses: { 200: { description: 'Progress saved' } } },
    },
    // ── Default Settings ────────────────────────────
    '/books/{bookId}/default-settings': {
      get: { tags: ['DefaultSettings'], summary: 'Get default reader settings', parameters: [bookIdParam], responses: { 200: { description: 'Default settings' } } },
      patch: { tags: ['DefaultSettings'], summary: 'Update default reader settings', parameters: [bookIdParam], requestBody: jsonBody('UpdateDefaultSettings'), responses: { 200: { description: 'Updated' } } },
    },
    // ── Fonts (global) ──────────────────────────────
    '/fonts': {
      get: { tags: ['Fonts'], summary: 'List reading fonts', responses: { 200: { description: 'Array of fonts' } } },
      post: { tags: ['Fonts'], summary: 'Create reading font', requestBody: jsonBody('CreateFont'), responses: { 201: { description: 'Font created' } } },
    },
    '/fonts/reorder': {
      patch: { tags: ['Fonts'], summary: 'Reorder fonts', requestBody: jsonBody('ReorderFonts'), responses: { 200: { description: 'Reordered' } } },
    },
    '/fonts/{fontId}': {
      patch: { tags: ['Fonts'], summary: 'Update font', parameters: [{ name: 'fontId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: jsonBody('UpdateFont'), responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Fonts'], summary: 'Delete font', parameters: [{ name: 'fontId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 204: { description: 'Deleted' } } },
    },
    // ── Settings (global) ───────────────────────────
    '/settings': {
      get: { tags: ['Settings'], summary: 'Get global settings', responses: { 200: { description: 'Settings' } } },
      patch: { tags: ['Settings'], summary: 'Update global settings', requestBody: jsonBody('UpdateSettings'), responses: { 200: { description: 'Updated' } } },
    },
    // ── Upload ──────────────────────────────────────
    '/upload/font': {
      post: { tags: ['Upload'], summary: 'Upload a font file', requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { 200: { description: 'Uploaded URL' } } },
    },
    '/upload/sound': {
      post: { tags: ['Upload'], summary: 'Upload a sound file', requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { 200: { description: 'Uploaded URL' } } },
    },
    '/upload/image': {
      post: { tags: ['Upload'], summary: 'Upload an image', requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { 200: { description: 'Uploaded URL' } } },
    },
    '/upload/book': {
      post: { tags: ['Upload'], summary: 'Upload & parse a book file (txt/doc/docx/epub/fb2)', requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { 200: { description: 'Parsed book data' } } },
    },
    // ── Export / Import ─────────────────────────────
    '/export': {
      get: { tags: ['ExportImport'], summary: 'Export full user config as JSON', responses: { 200: { description: 'JSON config file' } } },
    },
    '/import': {
      post: { tags: ['ExportImport'], summary: 'Import user config from JSON', responses: { 200: { description: 'Import result' } } },
    },
  },
};

export const swaggerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="script-src 'self' cdn.jsdelivr.net; style-src 'self' cdn.jsdelivr.net 'unsafe-inline'">
  <title>Flipbook API — Swagger</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>SwaggerUIBundle({ url: '/api/docs/spec.json', dom_id: '#swagger-ui' });</script>
</body>
</html>`;
