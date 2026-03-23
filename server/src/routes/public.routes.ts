import { Router } from 'express';
import {
  getShelf,
  getPublicBook,
  getPublicBookBySlug,
  getPublicChapters,
  getPublicChapterContent,
  discoverBooks,
} from '../services/public.service.js';
import { validateQuery } from '../middleware/validate.js';
import { createPublicRateLimiter } from '../middleware/rateLimit.js';
import { discoverQuerySchema } from '../schemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';

const router = Router();

// Public rate limiting (30 req/min per IP)
router.use(createPublicRateLimiter());

/**
 * GET /api/public/discover — List recently published books
 */
router.get(
  '/discover',
  validateQuery(discoverQuerySchema),
  asyncHandler(async (req, res) => {
    const { limit, offset } = res.locals.query as { limit?: number; offset?: number };
    const result = await discoverBooks({ limit, offset });
    ok(res, result);
  }),
);

/**
 * GET /api/public/shelves/:username — Get author's public shelf
 */
router.get(
  '/shelves/:username',
  asyncHandler(async (req, res) => {
    const shelf = await getShelf(req.params.username as string);
    ok(res, shelf);
  }),
);

/**
 * GET /api/public/shelves/:username/:slug — Get public book by author + slug
 */
router.get(
  '/shelves/:username/:slug',
  asyncHandler(async (req, res) => {
    const book = await getPublicBookBySlug(
      req.params.username as string,
      req.params.slug as string,
    );
    ok(res, book);
  }),
);

/**
 * GET /api/public/books/:bookId — Get public book details
 */
router.get(
  '/books/:bookId',
  asyncHandler(async (req, res) => {
    const book = await getPublicBook(req.params.bookId as string);
    ok(res, book);
  }),
);

/**
 * GET /api/public/books/:bookId/chapters — Get public book chapters (metadata)
 */
router.get(
  '/books/:bookId/chapters',
  asyncHandler(async (req, res) => {
    const chapters = await getPublicChapters(req.params.bookId as string);
    ok(res, chapters);
  }),
);

/**
 * GET /api/public/books/:bookId/chapters/:chapterId/content — Get chapter content
 */
router.get(
  '/books/:bookId/chapters/:chapterId/content',
  asyncHandler(async (req, res) => {
    const content = await getPublicChapterContent(
      req.params.bookId as string,
      req.params.chapterId as string,
    );
    ok(res, { htmlContent: content });
  }),
);

export default router;
