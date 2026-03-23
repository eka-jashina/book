import { Router } from 'express';
import { getGlobalSettings, updateGlobalSettings } from '../services/settings.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateSettingsSchema } from '../schemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  ok(res, await getGlobalSettings(req.user!.id));
}));

router.patch('/', validate(updateSettingsSchema), asyncHandler(async (req, res) => {
  ok(res, await updateGlobalSettings(req.user!.id, req.body));
}));

export default router;
