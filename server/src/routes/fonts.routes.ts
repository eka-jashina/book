import { Router } from 'express';
import { getReadingFonts, createReadingFont, updateReadingFont, deleteReadingFont, reorderReadingFonts } from '../services/fonts.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createFontSchema, updateFontSchema, reorderFontsSchema } from '../schemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, noContent } from '../utils/response.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  ok(res, { fonts: await getReadingFonts(req.user!.id) });
}));

router.post('/', validate(createFontSchema), asyncHandler(async (req, res) => {
  created(res, await createReadingFont(req.user!.id, req.body));
}));

router.patch('/reorder', validate(reorderFontsSchema), asyncHandler(async (req, res) => {
  await reorderReadingFonts(req.user!.id, req.body.fontIds);
  ok(res, { message: 'Fonts reordered' });
}));

router.patch('/:fontId', validate(updateFontSchema), asyncHandler(async (req, res) => {
  ok(res, await updateReadingFont(req.params.fontId as string, req.user!.id, req.body));
}));

router.delete('/:fontId', asyncHandler(async (req, res) => {
  await deleteReadingFont(req.params.fontId as string, req.user!.id);
  noContent(res);
}));

export default router;
