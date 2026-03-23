# CLAUDE.md - Flipbook

Interactive e-book reader with 3D page-flip animations. Vanilla JS (ES Modules) + CSS + Vite. Backend: Express + Prisma + PostgreSQL. Admin panel for managing books, chapters, fonts, sounds, appearance.

## Commands

```bash
# Dev
npm run dev                    # Frontend (port 3000, proxies /api → :4000)
cd server && npm run dev       # Backend (port 4000)
docker compose up -d           # PostgreSQL + MinIO + server

# Test
npm run test:run               # Frontend unit + integration
npm run test:e2e               # E2E (Playwright)
cd server && npm run test      # Server API tests

# Lint & Build
npm run lint                   # ESLint + Stylelint
npm run build:prod             # Production build

# Database
cd server && npm run db:migrate   # Prisma migrations
cd server && npm run db:seed      # Seed test data
cd server && npm run db:generate  # Generate Prisma client
```

## Architecture

### State Machine (`BookStateMachine.js`)

```
CLOSED → OPENING → OPENED ↔ FLIPPING → CLOSING → CLOSED
```

### Data Flow

```
User Input → EventController → Delegate → BookController → BookAnimator + BookRenderer → DOM
```

### SPA Routes (`Router.js`)

| Route | Screen |
|-------|--------|
| `/` | Landing (guests) / Bookshelf (auth) |
| `/book/:id` | Reader |
| `/account` | Account management |
| `/:username` | Public author shelf |

### Design Patterns

State Machine, Observer (EventEmitter), DI (BookController), Builder (BookControllerBuilder), Factory, Delegate, Mediator, Double Buffering, LRU Cache, Adapter (ServerAdminConfigStore)

## Directory Map

```
js/utils/        — Low-level: EventEmitter, Router, ApiClient, HTMLSanitizer, IdbStorage, etc.
js/managers/     — Business logic: BookStateMachine, SettingsManager, AsyncPaginator, SoundManager
js/core/         — Orchestration: BookController, BookRenderer, BookAnimator, screens
js/core/delegates/  — Navigation, Drag, Settings, Audio, Font, Theme delegates
js/core/services/   — DI bundles: Core, Audio, Render, Content services
js/admin/        — Admin panel: config stores, modules, parsers
js/i18n/         — i18next, 5 languages (ru, en, es, fr, de)
css/             — Modular CSS: variables, themes, controls/, admin/
server/src/      — Express routes, services, middleware, parsers, utils
server/prisma/   — Schema (16 models), migrations
tests/           — unit/, integration/flows/, e2e/flows/
server/tests/    — API endpoint tests (Vitest + supertest)
```

## Configuration

### Config System (`js/config.js`)

Three data sources:
1. **Default** — hardcoded chapters (Tolkien's "The Hobbit")
2. **Admin** — localStorage (`flipbook-admin-config`)
3. **Server API** — REST API (authenticated users)

Key exports: `createConfig()`, `createConfigFromAPI()`, `loadConfigFromAPI()`, `getConfig()`, `setConfig()`

### Key Config Shape

```javascript
CONFIG = {
  CHAPTERS, FONTS, SOUNDS, AMBIENT, DECORATIVE_FONT,
  DEFAULT_SETTINGS: { font, fontSize, theme, page, soundEnabled, soundVolume, ambientType, ambientVolume },
  APPEARANCE: { light: {...}, dark: {...} },
  SETTINGS_VISIBILITY: { fontSize, theme, font, fullscreen, sound, ambient },
}
```

### Path Aliases (vite.config.js)

`@` → `/js`, `@utils` → `/js/utils`, `@managers` → `/js/managers`, `@core` → `/js/core`, `@i18n` → `/js/i18n`

### CSS Variables (`css/variables.css`)

Animation timings (`--timing-lift`, `--timing-rotate`, `--timing-drop`, `--timing-cover`), font limits, 3D perspective, pagination settings. JS reads these via `CSSVariables` utility.

## Backend

Express 5 + TypeScript + Prisma ORM + PostgreSQL 17. Auth: Passport (local + Google OAuth). Storage: S3-compatible (MinIO dev). Validation: Zod. Monitoring: Sentry + Prometheus.

### API Routes

```
/api/auth/*              — Register, login, logout, Google OAuth
/api/books               — CRUD books
/api/books/:id/chapters  — CRUD chapters
/api/books/:id/sounds    — Sound config
/api/books/:id/ambients  — Ambient sounds
/api/books/:id/appearance — Theme appearance
/api/fonts               — User reading fonts
/api/settings            — Global settings
/api/progress            — Reading progress
/api/upload              — File upload (S3)
/api/profile             — User profile
/api/public/*            — Discovery, author shelves
/api/reading-sessions    — Session tracking
/api/export, /api/import — Config export/import
```

### Database Models

User, Book, Chapter, BookAppearance, BookSounds, BookDefaultSettings, Ambient, DecorativeFont, ReadingFont, GlobalSettings, ReadingProgress, ReadingPreferences, ReadingSession

## Conventions

- **Comments:** Russian. **Code:** English identifiers.
- One class/function per file. ES Modules. Async/await.
- Detailed rules: see `.claude/rules/` (frontend, server, admin, tests)
- Common tasks: see `.claude/skills/` (add-chapter, add-language, server-diagnosis, release-check)

## Verification (REQUIRED after code changes)

After modifying any code, ALWAYS run the relevant checks before considering the task done:

| Changed | Run |
|---------|-----|
| `js/**` | `npm run lint:js` then `npm run test:run` |
| `css/**` | `npm run lint:css` |
| `server/**` | `cd server && npm run test` |
| Both frontend + backend | All of the above |
| Prisma schema | `cd server && npx prisma validate` |

If tests or lint fail — fix before committing. Never skip verification.

## Build & Deploy

Production: `npm run build:prod` → Terser, Gzip+Brotli, image optimization, PWA Service Worker.
CI: `deploy.yml` (lint→test→e2e→build), `server-tests.yml`, `lighthouse.yml`, `security.yml`.
Deploy: `git push amvera main` (Dockerfile, multi-stage build).

## Keyboard Shortcuts

`←`/`→` — prev/next page, `Home`/`End` — beginning/end, `Ctrl+D` — debug panel
