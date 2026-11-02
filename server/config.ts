import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  rootDir,
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL || '',
  pgliteDir: path.resolve(rootDir, process.env.PGLITE_DIR || '.data/pglite'),
  uploadDir: path.resolve(rootDir, process.env.UPLOAD_DIR || '.data/uploads'),
  // Max size of a single uploaded file.
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024,
  sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
  sessionCookie: 'cc_session',
  googleDriveApiKey: process.env.GOOGLE_DRIVE_API_KEY || '',
};
