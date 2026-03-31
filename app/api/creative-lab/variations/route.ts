// ─────────────────────────────────────────────────────────────────────────────
// API Route: Unified Variation Generation
// ─────────────────────────────────────────────────────────────────────────────
// POST: Generate copy and/or image variations from a source creative
// GET:  List recent generation runs for a client
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { generateUnifiedVariationSet } from "../../../../lib/variationGeneration/unified";
import type { CreativeVariationRequest } from "../../../../types/variationGeneration";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreativeVariationRequest;

    // Validate required fields
    if (!body.source?.clientAccountId) {
      return NextResponse.json(
        { ok: false, error: "Client account is required." },
        { status: 400 }
      );
    }

    if (!body.intent) {
      return NextResponse.json(
        { ok: false, error: "Generation intent is required (copy_variations, image_variations, or both)." },
        { status: 400 }
      );
    }

    // Validate source has usable content
    const s = body.source;
    const hasImage = !!s.imageUrl;
    const hasCopy = !!(s.hook || s.bodyText || s.callToAction);

    if (!hasImage && !hasCopy) {
      return NextResponse.json(
        { ok: false, error: "Source must have an image, copy, or both." },
        { status: 400 }
      );
    }

    if (body.intent === "image_variations" && !hasImage) {
      return NextResponse.json(
        { ok: false, error: "Image variations require a source image." },
        { status: 400 }
      );
    }

    if (body.intent === "copy_variations" && !hasCopy) {
      return NextResponse.json(
        { ok: false, error: "Copy variations require source copy (hook, body, or CTA)." },
        { status: 400 }
      );
    }

    // Determine base URL for internal API calls
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const baseUrl = `${proto}://${host}`;

    // Run unified generation
    const result = await generateUnifiedVariationSet(body, { baseUrl });

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("Variation generation error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Generation failed",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);

  try {
    const where: Record<string, unknown> = {};
    if (clientId) where.clientAccountId = clientId;

    const runs = await prisma.generationRun.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        copyVariations: true,
        imageVariations: true,
      },
    });

    return NextResponse.json({ ok: true, runs });
  } catch (err) {
    console.error("Variation list error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to list generation runs" },
      { status: 500 }
    );
  }
}
