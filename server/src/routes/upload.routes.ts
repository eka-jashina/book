import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  fontUpload, soundUpload, imageUpload, bookUpload,
  requireValidFont, requireValidAudio, requireValidImage, requireValidBook,
} from '../middleware/upload.js';
import { uploadUserFile, uploadAndParseBook } from '../services/upload.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';

const router = Router();
router.use(requireAuth);

router.post('/font', fontUpload.single('file'), requireValidFont, asyncHandler(async (req, res) => {
  ok(res, await uploadUserFile(req.file, req.user!.id, 'fonts'));
}));

router.post('/sound', soundUpload.single('file'), requireValidAudio, asyncHandler(async (req, res) => {
  ok(res, await uploadUserFile(req.file, req.user!.id, 'sounds'));
}));

router.post('/image', imageUpload.single('file'), requireValidImage, asyncHandler(async (req, res) => {
  ok(res, await uploadUserFile(req.file, req.user!.id, 'images'));
}));

router.post('/book', bookUpload.single('file'), asyncHandler(requireValidBook), asyncHandler(async (req, res) => {
  ok(res, await uploadAndParseBook(req.file));
}));

export default router;
