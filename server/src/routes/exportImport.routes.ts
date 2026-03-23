import { Router } from 'express';
import express from 'express';
import { exportUserConfig, importUserConfig } from '../services/exportImport.service.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';

const router = Router();
router.use(requireAuth);

router.get('/export', asyncHandler(async (req, res) => {
  const data = await exportUserConfig(req.user!.id);
  res.setHeader('Content-Disposition', 'attachment; filename="flipbook-export.json"');
  ok(res, data);
}));

router.post('/import', express.json({ limit: '10mb' }), asyncHandler(async (req, res) => {
  ok(res, await importUserConfig(req.user!.id, req.body));
}));

export default router;
