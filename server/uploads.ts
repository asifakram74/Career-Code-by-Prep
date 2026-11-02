import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { eq } from 'drizzle-orm';
import { config } from './config';
import { db, t } from './db';
import { currentUser, requireAuth } from './auth';
import { HttpError, newId, route } from './http';

// Only types the app actually uses. SVG and HTML are excluded on purpose: served
// from our origin they could run scripts.
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/wav': '.wav',
  'audio/aac': '.aac',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

fs.mkdirSync(config.uploadDir, { recursive: true });

export function fileUrl(id: string) {
  return `/api/files/${id}`;
}

/** Saves a buffer as an uploaded file (used by the Firestore import for base64 data). */
export async function storeBuffer(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
  ownerId: string | null
): Promise<{ id: string; url: string }> {
  const ext = ALLOWED_TYPES[mimeType.split(';')[0]] ?? '.bin';
  const id = newId();
  const storagePath = `${id}${ext}`;
  await fs.promises.writeFile(path.join(config.uploadDir, storagePath), buffer);
  await db.insert(t.files).values({
    id,
    ownerId,
    originalName: originalName.slice(0, 255),
    mimeType: mimeType.split(';')[0],
    size: buffer.length,
    storagePath,
  });
  return { id, url: fileUrl(id) };
}

const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => cb(null, `${newId()}${ALLOWED_TYPES[file.mimetype.split(';')[0]] ?? ''}`),
  }),
  limits: { fileSize: config.maxUploadBytes, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype.split(';')[0]]) cb(null, true);
    else cb(new HttpError(415, `File type ${file.mimetype} is not allowed.`));
  },
});

export const uploadsRouter = Router();

// POST /api/uploads  (multipart, field "files") → AttachmentItem[]
uploadsRouter.post(
  '/uploads',
  requireAuth,
  (req, res, next) =>
    upload.array('files', 10)(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(new HttpError(413, `Each file must be under ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB.`));
      }
      next(err);
    }),
  route(async (req, res) => {
    const user = currentUser(req);
    const uploaded = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!uploaded.length) throw new HttpError(400, 'No files received.');
    const out = [];
    for (const f of uploaded) {
      const id = path.parse(f.filename).name;
      await db.insert(t.files).values({
        id,
        ownerId: user.id,
        originalName: f.originalname.slice(0, 255),
        mimeType: f.mimetype.split(';')[0],
        size: f.size,
        storagePath: f.filename,
      });
      out.push({ id, name: f.originalname, size: f.size, type: f.mimetype.split(';')[0], url: fileUrl(id) });
    }
    res.json({ files: out });
  })
);

// GET /api/files/:id — files are addressed by unguessable UUIDs (article covers and
// avatars must load on the public landing page).
uploadsRouter.get(
  '/files/:id',
  route(async (req, res) => {
    const [file] = await db.select().from(t.files).where(eq(t.files.id, String(req.params.id))).limit(1);
    if (!file) throw new HttpError(404, 'File not found.');
    const inline = file.mimeType.startsWith('image/') || file.mimeType.startsWith('audio/') || file.mimeType === 'application/pdf';
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`
    );
    // sendFile handles Range requests, so audio seeking works.
    res.sendFile(path.join(config.uploadDir, file.storagePath));
  })
);
