// app/api/uploads/[...path]/route.ts
// Serves uploaded files from the temp directory when the public/ filesystem
// is read-only (serverless/container environments).
//
// GET /api/uploads/creatives/abc123.jpg → reads from /tmp/uploads/creatives/abc123.jpg
// GET /api/uploads/generated/def456.png → reads from /tmp/uploads/generated/def456.png

import { NextResponse } from "next/server";
import { readFile }     from "fs/promises";
import { join }         from "path";
import { existsSync }   from "fs";
import { tmpdir }       from "os";

const MIME_TYPES: Record<string, string> = {
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  // Validate path segments to prevent directory traversal
  if (
    !segments ||
    segments.length < 2 ||
    segments.some((s) => s.includes("..") || s.includes("/") || s.includes("\\"))
  ) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const subdir   = segments.slice(0, -1).join("/");
  const filename = segments[segments.length - 1];
  const ext      = filename.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = MIME_TYPES[ext];

  if (!mimeType) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const filePath = join(tmpdir(), "uploads", subdir, filename);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":  mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
