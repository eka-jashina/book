---
name: release-check
description: Run all quality gates before a release — lint, test, build, bundle analysis.
---

# Release Check

## Steps (run sequentially)

1. **Lint**
   ```bash
   npm run lint
   ```
   Fix any errors before proceeding.

2. **Frontend tests**
   ```bash
   npm run test:run
   ```
   All tests must pass.

3. **Server tests**
   ```bash
   cd server && npm run test
   ```
   All tests must pass.

4. **Production build**
   ```bash
   npm run build:prod
   ```
   Must complete without errors.

5. **Bundle size check**
   ```bash
   npm run size
   ```
   Report the total dist size. Flag if significantly larger than previous build.

6. **E2E smoke test** (optional, if Playwright available)
   ```bash
   npm run test:e2e -- --grep smoke
   ```

## Report

After all checks, provide a summary:
- Lint: PASS/FAIL (number of issues)
- Frontend tests: PASS/FAIL (passed/total)
- Server tests: PASS/FAIL (passed/total)
- Build: PASS/FAIL (dist size)
- Overall: READY / NOT READY for release
