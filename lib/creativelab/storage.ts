// lib/creativelab/storage.ts
// Handles writing uploaded image files to the local public/ directory.
//
// v1: stores to public/uploads/creatives/[id].[ext]
// Production upgrade path: swap writeImageFile() for an S3/R2/Cloudinary upload
// without changing any callers.

import { writeFile } from "fs/promises";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface StorageResult {
  storagePath: string;  // URL path served by Next.js: /uploads/creatives/[id].[ext]
  fileName:    string;  // original file name from the upload
  mimeType:    string;
  fileSize:    number;  // bytes
}

/** Persist a File/Blob to disk and return storage metadata. */
export async function writeImageFile(
  imageId: string,
  file: File
): Promise<StorageResult> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File too large: ${file.size} bytes (max ${MAX_FILE_SIZE_BYTES})`);
  }

  const ext = extensionFor(file.type);
  const filename = `${imageId}.${ext}`;
  const dir = join(process.cwd(), "public", "uploads", "creatives");

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(dir, filename), buffer);

  return {
    storagePath: `/uploads/creatives/${filename}`,
    fileName:    file.name,
    mimeType:    file.type,
    fileSize:    file.size,
  };
}

function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
    case "image/jpg":  return "jpg";
    case "image/png":  return "png";
    case "image/webp": return "webp";
    default:           return "bin";
  }
}

// ── Generated image download + storage ─────────────────────────────────────

export interface GeneratedImageStorageResult {
  storagePath: string;  // URL path: /uploads/generated/[id].png
  fileSize:    number;
}

/**
 * Download an image from a temporary URL (e.g. OpenAI) and persist it locally.
 * Returns the local storage path for serving via Next.js.
 */
export async function downloadAndStoreGeneratedImage(
  conceptId: string,
  imageUrl: string
): Promise<GeneratedImageStorageResult> {
  const dir = join(process.cwd(), "public", "uploads", "generated");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to download generated image: HTTP ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Generated image too large: ${buffer.length} bytes`);
  }

  // DALL-E 3 always returns PNG
  const filename = `${conceptId}.png`;
  await writeFile(join(dir, filename), buffer);

  return {
    storagePath: `/uploads/generated/${filename}`,
    fileSize:    buffer.length,
  };
}
