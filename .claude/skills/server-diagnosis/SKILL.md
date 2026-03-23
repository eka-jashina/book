---
name: server-diagnosis
description: Diagnose server API errors, test failures, or infrastructure issues.
---

# Server Diagnosis

## Evidence Collection

Run these checks in order:

1. **Infrastructure status**
   ```bash
   docker compose ps
   ```
   Verify PostgreSQL and MinIO containers are running and healthy.

2. **Database connectivity**
   ```bash
   cd server && npx prisma validate
   cd server && npx prisma db pull --force 2>&1 | head -5
   ```

3. **Pending migrations**
   ```bash
   cd server && npx prisma migrate status
   ```

4. **Server tests**
   ```bash
   cd server && npm run test 2>&1 | tail -40
   ```

5. **Environment config** — check `server/.env` has required variables:
   - `DATABASE_URL` — PostgreSQL connection string
   - `SESSION_SECRET` — session encryption key
   - `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` — storage
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — OAuth (optional)

6. **Server logs** (if running)
   ```bash
   docker compose logs server --tail=50
   ```

## Common Fixes

| Symptom | Fix |
|---------|-----|
| Prisma client outdated | `cd server && npx prisma generate` |
| Missing tables | `cd server && npx prisma migrate dev` |
| S3 connection refused | `docker compose up -d minio` |
| Port 4000 in use | `lsof -i :4000` then kill process |
| Session errors | Check `SESSION_SECRET` in `.env` |
