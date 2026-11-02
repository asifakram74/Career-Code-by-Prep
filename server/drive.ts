import { Router } from 'express';
import { Readable } from 'stream';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { config } from './config';
import { db, t } from './db';
import { currentUser, requireAuth, requireRole } from './auth';
import { HttpError, parse, route } from './http';
import { audit } from './audit';

// Google Drive resource explorer, backed by the official Drive API v3 with an API
// key. The shared folder must be "Anyone with the link can view". Only the server
// talks to Google; browsing is limited to the configured root folder's subtree.

const API = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut';
const CACHE_TTL_MS = 5 * 60 * 1000;
const DRIVE_ID = /^[A-Za-z0-9_-]{10,200}$/;

interface DriveConfig {
  rootFolderId: string;
  rootFolderName: string;
  rootFolderUrl: string;
  lastSyncedAt: number;
  syncStatus: 'synced' | 'error' | 'idle';
}

interface ApiFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  parents?: string[];
  shortcutDetails?: { targetId: string; targetMimeType: string };
}

function requireKey() {
  if (!config.googleDriveApiKey) {
    throw new HttpError(503, 'Google Drive is not configured on the server (GOOGLE_DRIVE_API_KEY is missing).');
  }
}

async function driveGet<T>(pathAndQuery: string, params: Record<string, string>): Promise<T> {
  requireKey();
  const qs = new URLSearchParams({ ...params, key: config.googleDriveApiKey, supportsAllDrives: 'true' });
  const res = await fetch(`${API}${pathAndQuery}?${qs}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (res.status === 404) throw new HttpError(404, 'Drive folder or file not found, or it is not shared publicly.');
    throw new HttpError(502, `Google Drive error: ${body?.error?.message ?? res.statusText}`);
  }
  return (await res.json()) as T;
}

function itemType(mimeType: string, name: string) {
  const lower = name.toLowerCase();
  if (mimeType === FOLDER_MIME) return 'folder';
  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf';
  if (mimeType.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|oga|aac)$/.test(lower)) return 'audio';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.includes('document') || mimeType.includes('word') || /\.docx?$/.test(lower)) return 'doc';
  return 'other';
}

function toItem(f: ApiFile, parentId: string) {
  const isShortcut = f.mimeType === SHORTCUT_MIME && f.shortcutDetails;
  const id = isShortcut ? f.shortcutDetails!.targetId : f.id;
  const mimeType = isShortcut ? f.shortcutDetails!.targetMimeType : f.mimeType;
  const isFolder = mimeType === FOLDER_MIME;
  return {
    id,
    name: f.name,
    mimeType,
    type: itemType(mimeType, f.name),
    parentId,
    size: f.size ? Number(f.size) : undefined,
    modifiedTime: f.modifiedTime,
    webViewLink:
      f.webViewLink ??
      (isFolder ? `https://drive.google.com/drive/folders/${id}` : `https://drive.google.com/file/d/${id}/view`),
    webContentLink: f.webContentLink,
    thumbnailLink: f.thumbnailLink,
  };
}

// ---------------------------------------------------------------------------
// Config (settings table)
// ---------------------------------------------------------------------------

async function getConfig(): Promise<DriveConfig | null> {
  const [row] = await db.select().from(t.settings).where(eq(t.settings.key, 'drive_config')).limit(1);
  return (row?.value as DriveConfig) ?? null;
}

export function extractFolderId(input: string): string | null {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/\/folders\/([A-Za-z0-9_-]+)/) ?? trimmed.match(/[?&]id=([A-Za-z0-9_-]+)/);
  const id = fromUrl ? fromUrl[1] : trimmed;
  return DRIVE_ID.test(id) ? id : null;
}

// ---------------------------------------------------------------------------
// Listing with cache, restricted to the configured root's subtree
// ---------------------------------------------------------------------------

const listCache = new Map<string, { at: number; folderName: string; items: ReturnType<typeof toItem>[] }>();
const parentCache = new Map<string, { at: number; parents: string[] }>();

async function parentsOf(id: string): Promise<string[]> {
  const cached = parentCache.get(id);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.parents;
  const f = await driveGet<ApiFile>(`/files/${id}`, { fields: 'parents' });
  const parents = f.parents ?? [];
  parentCache.set(id, { at: Date.now(), parents });
  return parents;
}

/** True when `id` is the root folder or lives somewhere beneath it. */
async function isWithinRoot(id: string, rootId: string): Promise<boolean> {
  let frontier = [id];
  const seen = new Set<string>();
  for (let depth = 0; depth < 25 && frontier.length; depth++) {
    const next: string[] = [];
    for (const current of frontier) {
      if (current === rootId) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      next.push(...(await parentsOf(current).catch(() => [])));
    }
    frontier = next;
  }
  return false;
}

async function listFolder(folderId: string, refresh: boolean) {
  const cached = listCache.get(folderId);
  if (!refresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached;

  const folder = await driveGet<ApiFile>(`/files/${folderId}`, { fields: 'id,name,mimeType' });
  if (folder.mimeType !== FOLDER_MIME) throw new HttpError(400, 'That Drive item is not a folder.');

  const items: ReturnType<typeof toItem>[] = [];
  let pageToken: string | undefined;
  do {
    const page = await driveGet<{ files: ApiFile[]; nextPageToken?: string }>('/files', {
      q: `'${folderId}' in parents and trashed = false`,
      fields:
        'nextPageToken, files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink,thumbnailLink,shortcutDetails)',
      orderBy: 'folder,name_natural',
      pageSize: '1000',
      includeItemsFromAllDrives: 'true',
      ...(pageToken ? { pageToken } : {}),
    });
    items.push(...page.files.map((f) => toItem(f, folderId)));
    pageToken = page.nextPageToken;
  } while (pageToken);

  for (const item of items) parentCache.set(item.id, { at: Date.now(), parents: [folderId] });
  const entry = { at: Date.now(), folderName: folder.name, items };
  listCache.set(folderId, entry);
  return entry;
}

async function rootOrThrow(): Promise<DriveConfig> {
  const cfg = await getConfig();
  if (!cfg?.rootFolderId) throw new HttpError(404, 'No Google Drive folder has been configured yet.');
  return cfg;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const driveRouter = Router();

driveRouter.get(
  '/drive/config',
  requireAuth,
  route(async (_req, res) => {
    res.json({ success: true, config: await getConfig(), apiConfigured: Boolean(config.googleDriveApiKey) });
  })
);

const configBody = z.object({
  rootFolderId: z.string().optional(),
  rootFolderUrl: z.string().optional(),
  rootFolderName: z.string().max(200).optional(),
});

driveRouter.post(
  '/drive/config',
  requireRole('expert_admin', 'super_admin'),
  route(async (req, res) => {
    const body = parse(configBody, req.body);
    const id = extractFolderId(body.rootFolderUrl || body.rootFolderId || '');
    if (!id) throw new HttpError(400, 'Enter a valid Google Drive folder link or ID.');

    // Fails with a clear message when the folder is missing or not public.
    const folder = await driveGet<ApiFile>(`/files/${id}`, { fields: 'id,name,mimeType' });
    if (folder.mimeType !== FOLDER_MIME) throw new HttpError(400, 'That link points to a file, not a folder.');

    const value: DriveConfig = {
      rootFolderId: id,
      rootFolderName: body.rootFolderName?.trim() || folder.name,
      rootFolderUrl: `https://drive.google.com/drive/folders/${id}`,
      lastSyncedAt: Date.now(),
      syncStatus: 'synced',
    };
    await db
      .insert(t.settings)
      .values({ key: 'drive_config', value })
      .onConflictDoUpdate({ target: t.settings.key, set: { value, updatedAt: Date.now() } });
    await audit(currentUser(req), 'drive_config_updated', {
      targetType: 'settings',
      details: `Drive root set to ${folder.name} (${id})`,
    });
    listCache.clear();
    res.json({ success: true, config: value });
  })
);

driveRouter.get(
  '/drive/folder-contents',
  requireAuth,
  route(async (req, res) => {
    const cfg = await rootOrThrow();
    const folderId = typeof req.query.folderId === 'string' && req.query.folderId ? req.query.folderId : cfg.rootFolderId;
    if (!DRIVE_ID.test(folderId)) throw new HttpError(400, 'Invalid folder ID.');
    if (!(await isWithinRoot(folderId, cfg.rootFolderId))) throw new HttpError(404, 'Folder not found.');

    const { folderName, items } = await listFolder(folderId, req.query.refresh === 'true');
    res.json({ success: true, items, folderName, source: 'google_drive' });
  })
);

// Streams a Drive file (used for audio playback, which Drive's viewer handles poorly).
// Range headers are forwarded so seeking works without buffering the whole file.
driveRouter.get(
  '/drive/file-stream',
  requireAuth,
  route(async (req, res) => {
    requireKey();
    const cfg = await rootOrThrow();
    const fileId = String(req.query.fileId ?? '');
    if (!DRIVE_ID.test(fileId)) throw new HttpError(400, 'Invalid file ID.');
    if (!(await isWithinRoot(fileId, cfg.rootFolderId))) throw new HttpError(404, 'File not found.');

    const qs = new URLSearchParams({ alt: 'media', key: config.googleDriveApiKey, supportsAllDrives: 'true' });
    const upstream = await fetch(`${API}/files/${fileId}?${qs}`, {
      headers: req.headers.range ? { Range: req.headers.range } : {},
    });
    if (!upstream.ok && upstream.status !== 206) throw new HttpError(502, 'Could not fetch the file from Google Drive.');

    res.status(upstream.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (!upstream.body) return res.end();
    Readable.fromWeb(upstream.body as import('stream/web').ReadableStream).pipe(res);
  })
);
