// app/api/creative-lab/quick-generate/route.ts
// POST /api/creative-lab/quick-generate
//
// Unified endpoint for generating copy and/or image variations
// from an uploaded asset or existing synced ad.
//
// Request body:
//   {
//     source: CreativeVariationSource,
//     intent: "copy_only" | "image_only" | "copy_and_image",
//     copyCount?: number,   // default 3
//     imageCount?: number,  // default 3
//   }
//
// Response:
//   { ok: true, set: UnifiedVariationSet, summary: CreativeVariationSummary }
//   { ok: false, error: string }

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import {
  generateUnifiedVariationSet,
  summarizeVariationGeneration,
} from "../../../../lib/creativelab/variationGenerator";
import type { CreativeVariationRequest } from "../../../../types/creativeVariation";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: CreativeVariationRequest;
  try {
    body = (await req.json()) as CreativeVariationRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.source?.sourceId) {
    return NextResponse.json(
      { ok: false, error: "source.sourceId is required" },
      { status: 400 },
    );
  }

  if (!body.intent || !["copy_only", "image_only", "copy_and_image"].includes(body.intent)) {
    return NextResponse.json(
      { ok: false, error: "intent must be copy_only, image_only, or copy_and_image" },
      { status: 400 },
    );
  }

  // Validate source has the right context for the intent
  if (
    (body.intent === "copy_only" || body.intent === "copy_and_image") &&
    !body.source.sourceCopy &&
    body.source.spend === 0
  ) {
    // Allow generation without copy — the engine will use performance context
  }

  const startMs = Date.now();

  try {
    const set = await generateUnifiedVariationSet(body);
    const summary = summarizeVariationGeneration(set, Date.now() - startMs);

    return NextResponse.json({ ok: true, set, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[quick-generate] error:", msg);
    return NextResponse.json(
      { ok: false, error: `Generation failed: ${msg}` },
      { status: 500 },
    );
  }
}
