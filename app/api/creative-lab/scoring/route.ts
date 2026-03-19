// app/api/creative-lab/scoring/route.ts
// POST /api/creative-lab/scoring
//
// Scores and ranks all draft variants for a given brief.
// Steps:
//   1. Validate briefId
//   2. Load brief (includes all variants) from DB
//   3. Score each variant using scoreCreativeDraft()
//   4. Rank via buildCreativeDraftReviewSet()
//   5. Return full review set
//
// No DB writes — scores are computed on demand and returned to the client.
// Scores are deterministic: same brief + variant always produces same score.

import { NextRequest, NextResponse }      from "next/server";
import { loadCreativeBriefById }          from "../../../../lib/creativeBrief/db";
import { scoreCreativeDraft }             from "../../../../lib/creativeScoring/scorer";
import { buildCreativeDraftReviewSet }    from "../../../../lib/creativeScoring/ranking";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { briefId } = (body ?? {}) as { briefId?: string };

  if (!briefId || typeof briefId !== "string") {
    return NextResponse.json({ error: "briefId is required" }, { status: 400 });
  }

  // Load brief (includes variants via loadCreativeBriefById)
  let brief;
  try {
    brief = await loadCreativeBriefById(briefId);
  } catch {
    return NextResponse.json({ error: "Failed to load brief" }, { status: 500 });
  }

  if (!brief) {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }

  const variants = brief.draftSet.variants;

  if (variants.length === 0) {
    return NextResponse.json({
      ok:      true,
      briefId,
      message: "No variants to score — generate drafts first.",
      reviewSet: {
        briefId,
        rankings: [],
        summary: {
          totalVariants: 0, readyForPublishPrep: 0, conditionallyReady: 0,
          reviewRequired: 0, notReady: 0, highRisk: 0,
          topRankedVariantId: null, averageScore: 0,
        },
        scoredAt: new Date().toISOString(),
      },
    });
  }

  // Score every variant
  const scorecards = variants.map((v) => scoreCreativeDraft(v, brief));

  // Build ranked review set
  const reviewSet = buildCreativeDraftReviewSet(briefId, scorecards);

  return NextResponse.json({ ok: true, briefId, reviewSet });
}
