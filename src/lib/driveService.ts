import { DriveItem, DriveItemType, DriveConfig } from '../types';
import { api, errorMessage } from './api';

export function extractDriveFolderId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) return folderMatch[1];
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) return idParamMatch[1];
  return trimmed;
}

export function detectItemType(mimeType: string, name: string): DriveItemType {
  const lowerName = name.toLowerCase();
  if (mimeType === 'application/vnd.google-apps.folder') return 'folder';
  if (mimeType.includes('pdf') || lowerName.endsWith('.pdf')) return 'pdf';
  if (mimeType.includes('audio') || lowerName.endsWith('.mp3') || lowerName.endsWith('.m4a') || lowerName.endsWith('.wav') || lowerName.endsWith('.ogg')) return 'audio';
  if (mimeType.includes('image') || lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.webp')) return 'image';
  if (mimeType.includes('word') || mimeType.includes('document') || mimeType.includes('text') || lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) return 'doc';
  if (mimeType.includes('video') || lowerName.endsWith('.mp4') || lowerName.endsWith('.mkv')) return 'video';
  return 'other';
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Lists a Drive folder (the configured root when folderId is empty). Throws on errors. */
export async function fetchDriveFolderContents(
  folderId = '',
  isManualRefresh = false
): Promise<{ items: DriveItem[]; folderName: string; source: 'google_drive' }> {
  const params = new URLSearchParams();
  if (folderId) params.set('folderId', folderId);
  if (isManualRefresh) params.set('refresh', 'true');
  const data = await api.get<{ items: DriveItem[]; folderName: string }>(`/drive/folder-contents?${params}`);
  return { items: data.items, folderName: data.folderName || 'Career Code Drive', source: 'google_drive' };
}

/** The configured Drive root, or null when none has been set up yet. */
export async function getDriveConfig(): Promise<DriveConfig | null> {
  const data = await api.get<{ config: DriveConfig | null }>('/drive/config');
  return data.config;
}

export async function updateDriveConfig(
  config: Partial<DriveConfig>
): Promise<{ success: boolean; config?: DriveConfig; error?: string }> {
  try {
    return await api.post<{ success: boolean; config: DriveConfig }>('/drive/config', config);
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to update Drive configuration.') };
  }
}

/** Streams a Drive file through the server (used for audio playback with seeking). */
export const driveFileStreamUrl = (fileId: string) => `/api/drive/file-stream?fileId=${encodeURIComponent(fileId)}`;
