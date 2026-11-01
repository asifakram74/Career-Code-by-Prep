/**
 * File upload, image compression, and progress helper.
 * Ensures images and media attachments are optimized to fit securely
 * within Firestore limits while preserving high visual readability (e.g. for marksheets, transcripts, notices).
 */

export interface ProcessedAttachment {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  finalSize: number;
  type: string;
  dataUrl: string;
  previewUrl: string;
  progress: number; // 0 to 100
  status: 'processing' | 'ready' | 'error' | 'uploading';
  error?: string;
}

/**
 * Compresses an image using HTML5 Canvas.
 * Resizes down to maxWidth / maxHeight while maintaining aspect ratio,
 * and encodes with JPEG / WebP quality (default 0.78).
 * A 4MB photo will typically compress down to 60KB - 120KB.
 */
export async function compressImage(
  file: File,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.78,
  onProgress?: (pct: number) => void
): Promise<{ dataUrl: string; size: number }> {
  return new Promise((resolve, reject) => {
    if (onProgress) onProgress(15);
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read image file'));

    reader.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const p = Math.min(40, 15 + Math.round((e.loaded / e.total) * 25));
        onProgress(p);
      }
    };

    reader.onload = (e) => {
      if (onProgress) onProgress(45);
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image element'));

      img.onload = () => {
        if (onProgress) onProgress(65);
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback if canvas 2d context unavailable
          const rawUrl = e.target?.result as string;
          resolve({ dataUrl: rawUrl, size: file.size });
          return;
        }

        // Draw with smoothing for high-quality text/documents
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        if (onProgress) onProgress(85);

        // Export as JPEG (universal format)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        // Estimate size from base64
        const stringLength = compressedDataUrl.length - 'data:image/jpeg;base64,'.length;
        const finalByteSize = Math.round((stringLength * 3) / 4);

        if (onProgress) onProgress(100);
        resolve({
          dataUrl: compressedDataUrl,
          size: finalByteSize,
        });
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Reads a non-image file (e.g. PDF) as Data URL with progress reporting.
 */
export async function readFileDataUrl(
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ dataUrl: string; size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));

    reader.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const p = Math.min(95, Math.round((e.loaded / e.total) * 100));
        onProgress(p);
      }
    };

    reader.onload = () => {
      if (onProgress) onProgress(100);
      resolve({
        dataUrl: reader.result as string,
        size: file.size,
      });
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Format bytes into human readable KB / MB
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
