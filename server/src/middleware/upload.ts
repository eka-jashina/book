import multer from 'multer';
import os from 'node:os';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

// Use memory storage for small files (fonts, sounds, images)
const memoryStorage = multer.memoryStorage();

// Use disk storage for large files (books up to 50 MB) to avoid OOM
const bookDiskStorage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (_req, file, cb) => cb(null, `upload-${Date.now()}-${file.originalname}`),
});

// ═══════════════════════════════════════════════════════════════════════════
// Magic-byte signatures for content-type verification
// ═══════════════════════════════════════════════════════════════════════════

type MagicSignature = { bytes: number[]; offset?: number };

const FONT_SIGNATURES: MagicSignature[] = [
  { bytes: [0x77, 0x4F, 0x46, 0x32] },          // woff2
  { bytes: [0x77, 0x4F, 0x46, 0x46] },          // woff
  { bytes: [0x00, 0x01, 0x00, 0x00] },          // ttf
  { bytes: [0x4F, 0x54, 0x54, 0x4F] },          // otf (OpenType with CFF)
];

const AUDIO_SIGNATURES: MagicSignature[] = [
  { bytes: [0x49, 0x44, 0x33] },                // mp3 (ID3 tag)
  { bytes: [0xFF, 0xFB] },                      // mp3 (frame sync)
  { bytes: [0xFF, 0xF3] },                      // mp3 (frame sync)
  { bytes: [0xFF, 0xF2] },                      // mp3 (frame sync)
  { bytes: [0x52, 0x49, 0x46, 0x46] },          // wav / webm (RIFF container)
  { bytes: [0x4F, 0x67, 0x67, 0x53] },          // ogg
  { bytes: [0x66, 0x4C, 0x61, 0x43] },          // flac
  { bytes: [0xFF, 0xF1] },                      // aac (ADTS)
  { bytes: [0xFF, 0xF9] },                      // aac (ADTS)
  { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // m4a / mp4 (ftyp box)
];

const IMAGE_SIGNATURES: MagicSignature[] = [
  { bytes: [0x89, 0x50, 0x4E, 0x47] },          // png
  { bytes: [0xFF, 0xD8, 0xFF] },                // jpeg
  { bytes: [0x47, 0x49, 0x46, 0x38] },          // gif (GIF8)
  { bytes: [0x52, 0x49, 0x46, 0x46] },          // webp (RIFF container — further check not required, safe format)
  { bytes: [0x42, 0x4D] },                      // bmp
];

const BOOK_SIGNATURES: MagicSignature[] = [
  { bytes: [0x50, 0x4B, 0x03, 0x04] },          // zip (epub, docx)
  { bytes: [0xD0, 0xCF, 0x11, 0xE0] },          // OLE2 (doc)
];

function matchesSignature(header: Buffer, signatures: MagicSignature[]): boolean {
  for (const sig of signatures) {
    const offset = sig.offset ?? 0;
    if (header.length < offset + sig.bytes.length) continue;
    if (sig.bytes.every((b, i) => header[offset + i] === b)) return true;
  }
  return false;
}

/**
 * Check if a buffer looks like a text file (txt, fb2/xml).
 * Scans first 512 bytes for printable ASCII / valid UTF-8 content.
 */
function looksLikeText(header: Buffer): boolean {
  if (header.length === 0) return false;
  // Allow BOM
  let start = 0;
  if (header[0] === 0xEF && header[1] === 0xBB && header[2] === 0xBF) start = 3;
  for (let i = start; i < Math.min(header.length, 512); i++) {
    const b = header[i];
    // Allow printable ASCII, tab, newline, CR, and bytes >= 0x80 (valid UTF-8 continuation)
    if (b >= 0x20 || b === 0x09 || b === 0x0A || b === 0x0D || b >= 0x80) continue;
    return false;
  }
  return true;
}

/**
 * Check if a buffer starts with an SVG-like XML tag.
 */
function looksLikeSvg(header: Buffer): boolean {
  const str = header.subarray(0, 512).toString('utf-8').trimStart().toLowerCase();
  return str.startsWith('<svg') || (str.startsWith('<?xml') && str.includes('<svg'));
}

// ═══════════════════════════════════════════════════════════════════════════
// Post-upload magic-byte middleware factories
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Express middleware that validates the uploaded file's magic bytes.
 * Must be placed AFTER the multer middleware in the handler chain.
 */
export function requireValidFont(req: Request, _res: Response, next: NextFunction): void {
  const buf = req.file?.buffer;
  if (!buf || buf.length < 4) return next(new AppError(400, 'Font file too small or missing', 'INVALID_FILE_TYPE'));
  if (!matchesSignature(buf, FONT_SIGNATURES)) {
    return next(new AppError(400, 'File content does not match any known font format', 'INVALID_FILE_CONTENT'));
  }
  next();
}

export function requireValidAudio(req: Request, _res: Response, next: NextFunction): void {
  const buf = req.file?.buffer;
  if (!buf || buf.length < 4) return next(new AppError(400, 'Audio file too small or missing', 'INVALID_FILE_TYPE'));
  if (!matchesSignature(buf, AUDIO_SIGNATURES)) {
    return next(new AppError(400, 'File content does not match any known audio format', 'INVALID_FILE_CONTENT'));
  }
  next();
}

export function requireValidImage(req: Request, _res: Response, next: NextFunction): void {
  const buf = req.file?.buffer;
  if (!buf || buf.length < 4) return next(new AppError(400, 'Image file too small or missing', 'INVALID_FILE_TYPE'));
  if (matchesSignature(buf, IMAGE_SIGNATURES) || looksLikeSvg(buf)) {
    return next();
  }
  next(new AppError(400, 'File content does not match any known image format', 'INVALID_FILE_CONTENT'));
}

/**
 * For book uploads (disk storage), read the first 512 bytes to validate.
 */
export async function requireValidBook(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.file?.path) return next(new AppError(400, 'Book file missing', 'INVALID_FILE_TYPE'));
  try {
    const fd = await import('node:fs').then((fs) => fs.promises.open(req.file!.path, 'r'));
    const header = Buffer.alloc(512);
    const { bytesRead } = await fd.read(header, 0, 512, 0);
    await fd.close();

    // Use only the bytes actually read (small files may be < 512 bytes)
    const data = header.subarray(0, bytesRead);

    // Binary book formats (zip/OLE2)
    if (matchesSignature(data, BOOK_SIGNATURES)) return next();
    // Text-based formats (txt, fb2)
    if (looksLikeText(data)) return next();

    next(new AppError(400, 'File content does not match any known book format', 'INVALID_FILE_CONTENT'));
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Multer instances (MIME pre-filter, still kept as first line of defence)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Font upload handler (max 400 KB, .woff2/.woff/.ttf/.otf).
 */
export const fontUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 400 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'font/woff2',
      'font/woff',
      'font/ttf',
      'font/otf',
      'application/font-woff2',
      'application/font-woff',
      'application/x-font-ttf',
      'application/x-font-opentype',
      'application/octet-stream',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'Invalid font file type', 'INVALID_FILE_TYPE'));
    }
  },
});

/**
 * Sound upload handler (max 3 MB, audio files).
 */
export const soundUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'Invalid audio file type', 'INVALID_FILE_TYPE'));
    }
  },
});

/**
 * Image upload handler (max 5 MB, image files).
 */
export const imageUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'Invalid image file type', 'INVALID_FILE_TYPE'));
    }
  },
});

/**
 * Book upload handler (max 50 MB, document files).
 */
export const bookUpload = multer({
  storage: bookDiskStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/epub+zip',
      'application/xml',
      'text/xml',
      'application/octet-stream',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'Invalid book file type', 'INVALID_FILE_TYPE'));
    }
  },
});
