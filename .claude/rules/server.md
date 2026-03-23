# Server Rules (server/**)

## Stack
- Express 5 + TypeScript + Prisma ORM + PostgreSQL 17
- Auth: Passport.js (local + Google OAuth)
- Storage: S3-compatible (MinIO in dev)
- Validation: Zod schemas on ALL endpoints
- Logging: Pino (with pino-loki)
- Metrics: prom-client (Prometheus)

## Best Practices

### Route Handlers
Follow the established pattern:
```typescript
router.post(
  '/',
  validate(createBookSchema),          // 1. Zod validation middleware
  asyncHandler(async (req, res) => {   // 2. asyncHandler wrapper
    const book = await createBook(req.user!.id, req.body);  // 3. Service call
    created(res, book);                // 4. Response helper
  }),
);
```
- Authentication: `router.use(requireAuth)` at top of router
- Body validation: `validate(schema)` middleware from `schemas.ts`
- Query params: `validateQuery(schema)` middleware
- Async handlers: always wrap with `asyncHandler()` from `utils/asyncHandler.ts`
- Responses: use helpers `ok()`, `created()`, `noContent()` from `utils/response.ts`

### Service Layer
```typescript
// One function per operation, typed inputs/outputs
export async function getUserBooks(
  userId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<PaginatedBooks> {
  const prisma = getPrisma();
  const limit = Math.min(options.limit ?? 50, 100);  // Enforce max
  const where = activeBooks(userId);                   // Reusable filter

  const [books, total] = await Promise.all([           // Parallel queries
    prisma.book.findMany({ where, ... }),
    prisma.book.count({ where }),
  ]);

  return { books: books.map(mapBookToListItem), total, limit, offset };
}
```
- One service per resource (`services/*.service.ts`)
- Prisma queries only — no raw SQL
- Use `Promise.all()` for independent parallel queries
- Apply mappers to convert DB models → API responses (never expose DB internals)
- Extract reusable where-clauses as helper functions
- Enforce limits: `Math.min(options.limit ?? 50, 100)`

### Error Handling
```typescript
// Custom errors — use AppError from middleware/errorHandler.ts
throw new AppError(404, 'Book not found', 'BOOK_NOT_FOUND');
throw new AppError(403, 'Not authorized', 'FORBIDDEN');
```
- `AppError(statusCode, message, code, details?)` for application errors
- `ZodError` handled automatically by validation middleware
- `MulterError` handled for file uploads (413/400)
- Prisma constraint violations caught and mapped to friendly messages
- Security-sensitive errors logged at WARN, not exposed to client

### Database
- Run `npx prisma validate` after schema changes
- Run `npx prisma migrate dev --name <name>` to create migrations
- Run `npx prisma generate` after migration
- Never modify migration files after they've been applied
- Use mappers (`utils/mappers.ts`) to convert DB models → API responses

### Naming
- **Files:** kebab-case with suffix: `books.routes.ts`, `books.service.ts`
- **Functions:** camelCase, verb-first: `getUserBooks()`, `createBook()`, `deleteBook()`
- **Interfaces:** PascalCase, descriptive: `PaginatedBooks`, `BookListItem`
- **Constants:** SCREAMING_SNAKE_CASE or inline

## Testing
- Vitest + supertest
- Tests in `server/tests/*.test.ts`
- Fixtures generated via `tests/fixtures/generate.ts`
- Each test file tests one route/service

## Security Checklist
- [ ] Zod validation on all inputs
- [ ] Book ownership verified for mutations (`bookOwnership` middleware)
- [ ] Rate limiting on auth endpoints
- [ ] CSRF token required for state-changing requests
- [ ] No raw SQL — use Prisma queries only
- [ ] HTML sanitized via DOMPurify (`utils/sanitize.ts`)
- [ ] File uploads via Multer → S3, never to local filesystem
- [ ] Passwords hashed with bcrypt (`utils/password.ts`)

## Common Mistakes to Avoid
- `req.body.field` without Zod validation → always validate via `schemas.ts`
- `res.json(dbModel)` → use mappers from `utils/mappers.ts` (don't leak DB internals)
- Async handler without `asyncHandler()` wrapper → unhandled promise rejections
- `fs.writeFile()` for uploads → use S3 storage (`utils/storage.ts`)
- Missing `bookOwnership` middleware on book mutation routes
- `prisma.$queryRaw()` → use Prisma typed queries instead
- `console.log()` → use `logger` from `utils/logger.ts` (Pino)
- Hardcoded config values → use `config.ts` (Zod-validated env vars)
- Sequential queries that could be parallel → use `Promise.all()`
- Missing limit enforcement → always `Math.min(input, MAX)`
