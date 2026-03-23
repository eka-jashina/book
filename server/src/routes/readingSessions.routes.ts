import { Router } from 'express';
import { createReadingSession, getReadingSessions, getReadingStats } from '../services/readingSessions.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createReadingSessionSchema } from '../schemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

// POST /api/v1/books/:bookId/reading-sessions — создать запись о сессии
router.post('/', validate(createReadingSessionSchema), asyncHandler(async (req, res) => {
  const session = await createReadingSession(req.params.bookId as string, req.user!.id, req.body);
  created(res, { session });
}));

// GET /api/v1/books/:bookId/reading-sessions — история сессий (с пагинацией)
router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  ok(res, await getReadingSessions(req.params.bookId as string, req.user!.id, limit, offset));
}));

// GET /api/v1/books/:bookId/reading-sessions/stats — агрегированная статистика
router.get('/stats', asyncHandler(async (req, res) => {
  ok(res, await getReadingStats(req.params.bookId as string, req.user!.id));
}));

export default router;
