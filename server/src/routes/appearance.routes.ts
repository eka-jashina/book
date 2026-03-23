import { Router } from 'express';
import {
  getAppearance,
  updateAppearance,
  updateThemeAppearance,
} from '../services/appearance.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateAppearanceSchema, updateThemeSchema } from '../schemas.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

/**
 * GET /api/books/:bookId/appearance
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const appearance = await getAppearance(req.params.bookId as string);
    ok(res, appearance);
  }),
);

/**
 * PATCH /api/books/:bookId/appearance
 */
router.patch(
  '/',
  validate(updateAppearanceSchema),
  asyncHandler(async (req, res) => {
    const appearance = await updateAppearance(req.params.bookId as string, req.body);
    ok(res, appearance);
  }),
);

/**
 * PATCH /api/books/:bookId/appearance/:theme
 */
router.patch(
  '/:theme',
  validate(updateThemeSchema),
  asyncHandler(async (req, res) => {
    const theme = req.params.theme as string;
    if (theme !== 'light' && theme !== 'dark') {
      throw new AppError(400, 'Theme must be "light" or "dark"', 'INVALID_THEME');
    }
    const appearance = await updateThemeAppearance(
      req.params.bookId as string,
      theme,
      req.body,
    );
    ok(res, appearance);
  }),
);

export default router;
