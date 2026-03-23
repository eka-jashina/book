import { Router } from 'express';
import {
  getAmbients,
  createAmbient,
  updateAmbient,
  deleteAmbient,
  reorderAmbients,
} from '../services/ambients.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createAmbientSchema, updateAmbientSchema, reorderAmbientsSchema } from '../schemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, noContent } from '../utils/response.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

/**
 * GET /api/books/:bookId/ambients
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const ambients = await getAmbients(req.params.bookId as string);
    ok(res, { ambients });
  }),
);

/**
 * POST /api/books/:bookId/ambients
 */
router.post(
  '/',
  validate(createAmbientSchema),
  asyncHandler(async (req, res) => {
    const ambient = await createAmbient(req.params.bookId as string, req.body);
    created(res, ambient);
  }),
);

/**
 * PATCH /api/books/:bookId/ambients/reorder
 */
router.patch(
  '/reorder',
  validate(reorderAmbientsSchema),
  asyncHandler(async (req, res) => {
    await reorderAmbients(req.params.bookId as string, req.body.ambientIds);
    ok(res, { message: 'Ambients reordered' });
  }),
);

/**
 * PATCH /api/books/:bookId/ambients/:ambientId
 */
router.patch(
  '/:ambientId',
  validate(updateAmbientSchema),
  asyncHandler(async (req, res) => {
    const ambient = await updateAmbient(
      req.params.bookId as string,
      req.params.ambientId as string,
      req.body,
    );
    ok(res, ambient);
  }),
);

/**
 * DELETE /api/books/:bookId/ambients/:ambientId
 */
router.delete(
  '/:ambientId',
  asyncHandler(async (req, res) => {
    await deleteAmbient(
      req.params.bookId as string,
      req.params.ambientId as string,
    );
    noContent(res);
  }),
);

export default router;
