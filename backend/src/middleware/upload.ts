import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { UPLOADS_DIR } from '../lib/uploads';

const UPLOAD_DIR = UPLOADS_DIR;
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safe);
  },
});

const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req: Request, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED.has(ext)) return cb(null, true);
    cb(new Error('Only image files (jpg, png, webp, gif) are allowed'));
  },
});

export const UPLOADS_PATH = UPLOAD_DIR;
