// lib/creativelab/storage.ts
// Handles uploaded image files by converting them to base64 data URLs.
//
// v1: stored to public/uploads/creatives/[id].[ext] (broke on Vercel)
// v2: converts to base64 data URL stored in database — works everywhere
// Production upgrade path: swap for S3/R2/Cloudinary upload without changing callers.

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface StorageResult {
  storagePath: string;  // data URL (base64) or external URL
  fileName:    string;  // original file name from the upload
  mimeType:    string;
  fileSize:    number;  // bytes
}

/** Convert a File/Blob to a base64 data URL and return storage metadata. */
export async function writeImageFile(
  _imageId: string,
  file: File
): Promise<StorageResult> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File too large: ${file.size} bytes (max ${MAX_FILE_SIZE_BYTES})`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  return {
    storagePath: dataUrl,
    fileName:    file.name,
    mimeType:    file.type,
    fileSize:    file.size,
  };
}
