# Test Rules (tests/**)

## Stack
- Unit/Integration: Vitest + jsdom
- E2E: Playwright (Chrome, Firefox, Safari, mobile)
- Server: Vitest + supertest
- Load: K6

## Structure
- `tests/unit/` — isolated module tests (mirrors `js/` structure)
- `tests/integration/flows/` — user flow tests (multi-component)
- `tests/e2e/flows/` — full browser tests
- `tests/e2e/pages/` — Page Object Models (BookPage, SettingsPanel)
- `server/tests/` — API endpoint tests

## Conventions
- Test file naming: `{ModuleName}.test.js` (frontend) or `*.test.ts` (server)
- Use test helpers from `tests/helpers/testUtils.js` (unit) and `integrationUtils.js` (integration)
- Setup file: `tests/setup.js` — provides DOM environment and common mocks
- Server fixtures: `server/tests/fixtures/generate.ts`

## Running
```bash
npm run test:run          # Frontend unit + integration (single run)
npm run test:coverage     # With coverage
npm run test:e2e          # All browsers
cd server && npm run test # Server tests
```

## Guidelines
- Mock external dependencies (API, IndexedDB, localStorage)
- Test public API, not implementation details
- Integration tests should simulate real user flows
- E2E tests use Page Object pattern
- Don't test CSS animations in unit tests
- Clean up DOM and listeners after each test (setup.js handles this)
