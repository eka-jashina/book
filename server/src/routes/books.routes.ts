import { Router } from 'express';
import {
  getUserBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  reorderBooks,
  isSlugAvailable,
  restoreBook,
  purgeExpiredBooks,
} from '../services/books.service.js';
import { requireAuth } from '../middleware/auth.js';
import { requireBookOwnership } from '../middleware/bookOwnership.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { createBookSchema, updateBookSchema, reorderBooksSchema, listBooksQuerySchema } from '../schemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, noContent } from '../utils/response.js';

const router = Router();

// All book routes require authentication
router.use(requireAuth);

/**
 * GET /api/books — List user's books
 */
router.get(
  '/',
  validateQuery(listBooksQuerySchema),
  asyncHandler(async (req, res) => {
    const { limit, offset } = res.locals.query as { limit?: number; offset?: number };
    const result = await getUserBooks(req.user!.id, { limit, offset });
    ok(res, result);
  }),
);

/**
 * POST /api/books — Create a new book
 */
router.post(
  '/',
  validate(createBookSchema),
  asyncHandler(async (req, res) => {
    const book = await createBook(req.user!.id, req.body);
    created(res, book);
  }),
);

/**
 * PATCH /api/books/reorder — Reorder books
 */
router.patch(
  '/reorder',
  validate(reorderBooksSchema),
  asyncHandler(async (req, res) => {
    await reorderBooks(req.user!.id, req.body.bookIds);
    ok(res, { message: 'Books reordered' });
  }),
);

/**
 * GET /api/books/check-slug/:slug — Check slug availability for current user
 */
router.get(
  '/check-slug/:slug',
  asyncHandler(async (req, res) => {
    const slug = req.params.slug as string;
    const bookId = req.query.excludeBookId as string | undefined;
    const available = await isSlugAvailable(req.user!.id, slug, bookId);
    ok(res, { slug, available });
  }),
);

/**
 * POST /api/books/purge-expired — Permanently delete books past retention period (admin/cron use)
 */
router.post(
  '/purge-expired',
  asyncHandler(async (req, res) => {
    const count = await purgeExpiredBooks();
    ok(res, { purged: count });
  }),
);

/**
 * POST /api/books/:bookId/restore — Restore a soft-deleted book (within 30-day retention).
 * No ownership middleware here: book is soft-deleted so standard ownership check won't find it.
 * Service verifies userId match directly.
 */
router.post(
  '/:bookId/restore',
  asyncHandler(async (req, res) => {
    const book = await restoreBook(req.params.bookId as string, req.user!.id);
    ok(res, book);
  }),
);

// Ownership check — applied once for every /:bookId route below.
// (Sub-resource routes like /chapters, /sounds etc. are covered separately
//  by the centralised middleware in app.ts.)
router.all('/:bookId', requireBookOwnership);

/**
 * GET /api/books/:bookId — Get book details
 */
router.get(
  '/:bookId',
  asyncHandler(async (req, res) => {
    const book = await getBookById(req.params.bookId as string, req.user!.id);
    ok(res, book);
  }),
);

/**
 * PATCH /api/books/:bookId — Update book
 */
router.patch(
  '/:bookId',
  validate(updateBookSchema),
  asyncHandler(async (req, res) => {
    const ifUnmodifiedSince = req.headers['if-unmodified-since'] as string | undefined;
    const book = await updateBook(
      req.params.bookId as string,
      req.user!.id,
      { ...req.body, ...(ifUnmodifiedSince && { ifUnmodifiedSince }) },
    );
    ok(res, book);
  }),
);

/**
 * DELETE /api/books/:bookId — Delete book
 */
router.delete(
  '/:bookId',
  asyncHandler(async (req, res) => {
    await deleteBook(req.params.bookId as string, req.user!.id);
    noContent(res);
  }),
);

export default router;
