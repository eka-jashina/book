import { Router } from 'express';
import { getSounds, updateSounds } from '../services/sounds.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateSoundsSchema } from '../schemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

/**
 * GET /api/books/:bookId/sounds
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const sounds = await getSounds(req.params.bookId as string);
    ok(res, sounds);
  }),
);

/**
 * PATCH /api/books/:bookId/sounds
 */
router.patch(
  '/',
  validate(updateSoundsSchema),
  asyncHandler(async (req, res) => {
    const sounds = await updateSounds(req.params.bookId as string, req.body);
    ok(res, sounds);
  }),
);

export default router;
