import { Router } from 'express';
import { getDecorativeFont, upsertDecorativeFont, deleteDecorativeFont } from '../services/decorativeFont.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { upsertDecorativeFontSchema } from '../schemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, noContent } from '../utils/response.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const font = await getDecorativeFont(req.params.bookId as string);
  if (!font) { noContent(res); return; }
  ok(res, font);
}));

router.put('/', validate(upsertDecorativeFontSchema), asyncHandler(async (req, res) => {
  const font = await upsertDecorativeFont(req.params.bookId as string, req.body);
  ok(res, font);
}));

router.delete('/', asyncHandler(async (req, res) => {
  await deleteDecorativeFont(req.params.bookId as string);
  noContent(res);
}));

export default router;
