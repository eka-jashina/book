import { Router } from 'express';
import express from 'express';
import {
  getChapters,
  getChapterById,
  getChapterContent,
  createChapter,
  updateChapter,
  deleteChapter,
  reorderChapters,
} from '../services/chapters.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { createChapterSchema, updateChapterSchema, reorderChaptersSchema, listChaptersQuerySchema } from '../schemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, noContent } from '../utils/response.js';

const router = Router({ mergeParams: true });

// All chapter routes require authentication
router.use(requireAuth);

/**
 * GET /api/books/:bookId/chapters — List chapters (meta only, paginated)
 * Query: ?limit=100&offset=0
 */
router.get(
  '/',
  validateQuery(listChaptersQuerySchema),
  asyncHandler(async (req, res) => {
    const { limit, offset } = res.locals.query as { limit?: number; offset?: number };
    const result = await getChapters(req.params.bookId as string, { limit, offset });
    ok(res, result);
  }),
);

// Chapters may contain large HTML content (up to 2 MB)
const largeJsonBody = express.json({ limit: '3mb' });

/**
 * POST /api/books/:bookId/chapters — Create chapter
 */
router.post(
  '/',
  largeJsonBody,
  validate(createChapterSchema),
  asyncHandler(async (req, res) => {
    const chapter = await createChapter(
      req.params.bookId as string,
      req.body,
    );
    created(res, chapter);
  }),
);

/**
 * PATCH /api/books/:bookId/chapters/reorder — Reorder chapters
 */
router.patch(
  '/reorder',
  validate(reorderChaptersSchema),
  asyncHandler(async (req, res) => {
    await reorderChapters(
      req.params.bookId as string,
      req.body.chapterIds,
    );
    ok(res, { message: 'Chapters reordered' });
  }),
);

/**
 * GET /api/books/:bookId/chapters/:chapterId — Get chapter details
 */
router.get(
  '/:chapterId',
  asyncHandler(async (req, res) => {
    const chapter = await getChapterById(
      req.params.bookId as string,
      req.params.chapterId as string,
    );
    ok(res, chapter);
  }),
);

/**
 * GET /api/books/:bookId/chapters/:chapterId/content — Get chapter HTML
 */
router.get(
  '/:chapterId/content',
  asyncHandler(async (req, res) => {
    const html = await getChapterContent(
      req.params.bookId as string,
      req.params.chapterId as string,
    );
    ok(res, { html });
  }),
);

/**
 * PATCH /api/books/:bookId/chapters/:chapterId — Update chapter
 */
router.patch(
  '/:chapterId',
  largeJsonBody,
  validate(updateChapterSchema),
  asyncHandler(async (req, res) => {
    const ifUnmodifiedSince = req.headers['if-unmodified-since'] as string | undefined;
    const chapter = await updateChapter(
      req.params.bookId as string,
      req.params.chapterId as string,
      { ...req.body, ...(ifUnmodifiedSince && { ifUnmodifiedSince }) },
    );
    ok(res, chapter);
  }),
);

/**
 * DELETE /api/books/:bookId/chapters/:chapterId — Delete chapter
 */
router.delete(
  '/:chapterId',
  asyncHandler(async (req, res) => {
    await deleteChapter(
      req.params.bookId as string,
      req.params.chapterId as string,
    );
    noContent(res);
  }),
);

export default router;
