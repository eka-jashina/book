import { Router } from 'express';
import { getProfile, updateProfile, isUsernameAvailable } from '../services/profile.service.js';
import { requireAuth, invalidateUserCache } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateProfileSchema } from '../schemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';

const router = Router();

// All profile routes require authentication
router.use(requireAuth);

/**
 * GET /api/profile — Get current user's profile
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const profile = await getProfile(req.user!.id);
    ok(res, profile);
  }),
);

/**
 * PUT /api/profile — Update current user's profile
 */
router.put(
  '/',
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const profile = await updateProfile(req.user!.id, req.body);
    invalidateUserCache(req.user!.id);
    ok(res, profile);
  }),
);

/**
 * GET /api/profile/check-username/:username — Check username availability
 */
router.get(
  '/check-username/:username',
  asyncHandler(async (req, res) => {
    const username = req.params.username as string;
    const available = await isUsernameAvailable(username);
    ok(res, { username, available });
  }),
);

export default router;
