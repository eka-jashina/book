import { Router } from 'express';
import { getDefaultSettings, updateDefaultSettings } from '../services/defaultSettings.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateDefaultSettingsSchema } from '../schemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

/**
 * GET /api/books/:bookId/default-settings
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const settings = await getDefaultSettings(req.params.bookId as string);
    ok(res, settings);
  }),
);

/**
 * PATCH /api/books/:bookId/default-settings
 */
router.patch(
  '/',
  validate(updateDefaultSettingsSchema),
  asyncHandler(async (req, res) => {
    const settings = await updateDefaultSettings(req.params.bookId as string, req.body);
    ok(res, settings);
  }),
);

export default router;
