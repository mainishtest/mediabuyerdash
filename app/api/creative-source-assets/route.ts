// API route for Creative Source Assets — list and create.
// POST: Upload/create a new source asset
// GET: List assets for a client
//
// Images are stored as base64 data URLs in the database.
// This works on Vercel (read-only filesystem) and avoids needing S3/Blob storage.

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "../../../lib/db";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  const status   = req.nextUrl.searchParams.get("status") ?? "active";

  const where: Record<string, unknown> = {};
  if (clientId) where.clientAccountId = clientId;
  if (status !== "all") where.status = status;

  const assets = await prisma.creativeSourceAsset.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ ok: true, assets });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    // Handle multipart form upload (image + metadata)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = (formData.get("file") ?? formData.get("image")) as File | null;
      const clientAccountId = formData.get("clientAccountId") as string;
      const label           = formData.get("label") as string | null;
      const hook            = formData.get("hook") as string | null;
      const bodyText        = formData.get("bodyText") as string | null;
      const callToAction    = (formData.get("callToAction") ?? formData.get("cta")) as string | null;
      const imageHeadline   = formData.get("imageHeadline") as string | null;
      const notes           = formData.get("notes") as string | null;
      const workspaceId     = formData.get("workspaceId") as string | null;

      if (!clientAccountId) {
        return NextResponse.json({ ok: false, error: "Client account is required." }, { status: 400 });
      }

      let imageUrl: string | null = null;
      let imageMimeType: string | null = null;
      let imageFileSize: number | null = null;

      if (file && file.size > 0) {
        if (!ALLOWED_TYPES.has(file.type)) {
          return NextResponse.json({
            ok: false,
            error: `Unsupported image type: ${file.type}. Use JPEG, PNG, WebP, or GIF.`,
          }, { status: 400 });
        }
        if (file.size > MAX_SIZE) {
          return NextResponse.json({
            ok: false,
            error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: 10 MB.`,
          }, { status: 400 });
        }

        // Convert to base64 data URL (works on Vercel's read-only filesystem)
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString("base64");
        imageUrl = `data:${file.type};base64,${base64}`;
        imageMimeType = file.type;
        imageFileSize = file.size;
      }

      // Determine asset type
      const hasImage = !!imageUrl;
      const hasCopy = !!(hook || bodyText);
      const assetType = hasImage && hasCopy
        ? "uploaded_image_and_copy"
        : hasImage
          ? "uploaded_image"
          : "uploaded_copy";

      if (!hasImage && !hasCopy) {
        return NextResponse.json({
          ok: false,
          error: "Upload an image or provide ad copy (or both).",
        }, { status: 400 });
      }

      const asset = await prisma.creativeSourceAsset.create({
        data: {
          clientAccountId,
          workspaceId,
          assetType,
          status: "active",
          label: label || null,
          imageUrl,
          imageMimeType,
          imageFileSize,
          hook: hook || null,
          bodyText: bodyText || null,
          callToAction: callToAction || null,
          imageHeadline: imageHeadline || null,
          notes: notes || null,
        },
      });

      return NextResponse.json({ ok: true, asset });
    }

    // Handle JSON body (URL-based image or copy-only or existing ad source)
    const body = await req.json();
    const {
      clientAccountId,
      workspaceId,
      assetType,
      label,
      imageUrl,
      hook,
      bodyText,
      callToAction,
      imageHeadline,
      sourceAdId,
      sourceAdName,
      sourceCampaignId,
      sourceCampaignName,
      notes,
    } = body as {
      clientAccountId: string;
      workspaceId?: string;
      assetType?: string;
      label?: string;
      imageUrl?: string;
      hook?: string;
      bodyText?: string;
      callToAction?: string;
      imageHeadline?: string;
      sourceAdId?: string;
      sourceAdName?: string;
      sourceCampaignId?: string;
      sourceCampaignName?: string;
      notes?: string;
    };

    if (!clientAccountId) {
      return NextResponse.json({ ok: false, error: "Client account is required." }, { status: 400 });
    }

    const hasImage = !!imageUrl;
    const hasCopy = !!(hook || bodyText);
    const hasSourceAd = !!sourceAdId;
    const resolvedType = assetType || (
      hasSourceAd ? "existing_ad_source" :
      hasImage && hasCopy ? "uploaded_image_and_copy" :
      hasImage ? "uploaded_image" :
      "uploaded_copy"
    );

    if (!hasImage && !hasCopy) {
      return NextResponse.json({
        ok: false,
        error: "Provide an image URL or ad copy (or both).",
      }, { status: 400 });
    }

    const asset = await prisma.creativeSourceAsset.create({
      data: {
        clientAccountId,
        workspaceId: workspaceId || null,
        assetType: resolvedType,
        status: "active",
        label: label || null,
        imageUrl: imageUrl || null,
        hook: hook || null,
        bodyText: bodyText || null,
        callToAction: callToAction || null,
        imageHeadline: imageHeadline || null,
        sourceAdId: sourceAdId || null,
        sourceAdName: sourceAdName || null,
        sourceCampaignId: sourceCampaignId || null,
        sourceCampaignName: sourceCampaignName || null,
        notes: notes || null,
      },
    });

    return NextResponse.json({ ok: true, asset });
  } catch (err) {
    console.error("Creative source asset upload error:", err);
    return NextResponse.json({
      ok: false,
      error: `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 500 });
  }
}
