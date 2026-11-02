import type { AttachmentItem } from '../types';

// Thin client for the server's REST API (see server/API.md). The session lives in
// an httpOnly cookie, so requests just need to be same-origin.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new CustomEvent('app:unauthorized'));
    throw new ApiError(res.status, (data && data.error) || `Request failed (${res.status}).`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown = {}) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown = {}) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

/** Human-readable message for any thrown value. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Uploads files (or recorded Blobs) and returns attachment records whose `url`
 * points at /api/files/:id. Images are compressed first by the callers that want it.
 */
export async function uploadFiles(files: (File | { blob: Blob; name: string })[]): Promise<AttachmentItem[]> {
  if (!files.length) return [];
  const form = new FormData();
  for (const f of files) {
    const blob = f instanceof File ? f : f.blob;
    const name = f instanceof File ? f.name : f.name;
    if (blob.size > MAX_UPLOAD_BYTES) {
      throw new ApiError(413, `"${name}" is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
    }
    form.append('files', blob, name);
  }
  let res: Response;
  try {
    res = await fetch('/api/uploads', { method: 'POST', body: form, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'Upload failed. Check your connection and try again.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || 'Upload failed.');
  return data.files as AttachmentItem[];
}

/** Uploads a single file and returns its URL. */
export async function uploadFile(file: File | { blob: Blob; name: string }): Promise<string> {
  const [item] = await uploadFiles([file]);
  return item.url;
}
