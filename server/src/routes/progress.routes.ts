import { Router } from 'express';
import { getReadingProgress, upsertReadingProgress } from '../services/progress.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { upsertProgressSchema } from '../schemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  ok(res, { progress: await getReadingProgress(req.params.bookId as string, req.user!.id) });
}));

router.put('/', validate(upsertProgressSchema), asyncHandler(async (req, res) => {
  const ifUnmodifiedSince = req.headers['if-unmodified-since'] as string | undefined;
  const data = { ...req.body, ...(ifUnmodifiedSince && { ifUnmodifiedSince }) };
  ok(res, await upsertReadingProgress(req.params.bookId as string, req.user!.id, data));
}));

export default router;
