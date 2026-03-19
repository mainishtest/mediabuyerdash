// app/api/creative-lab/briefs/[id]/route.ts
// PATCH — update brief status or individual variant review decision.
//
// Body (JSON) — two action types:
//   { action: "status",  status: CreativeBriefStatus, notes?: string }
//   { action: "variant", variantId: string, reviewDecision: CreativeReviewDecision, reviewNote?: string }

import { NextRequest, NextResponse }    from "next/server";
import { updateBriefStatus }            from "../../../../../lib/creativeBrief/db";
import { updateVariantReview }          from "../../../../../lib/creativeBrief/db";
import type { CreativeBriefStatus }     from "../../../../../types/creativeBrief";
import type { CreativeReviewDecision }  from "../../../../../types/creativeBrief";

const VALID_STATUSES = new Set<string>([
  "draft", "in_review", "approved", "rejected", "revision_requested",
]);

const VALID_DECISIONS = new Set<string>(["approve", "reject", "request_revision"]);

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const id = params.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action as string | undefined;

  // ── Brief status update ────────────────────────────────────────────────────
  if (action === "status") {
    const status = body.status as string | undefined;
    const notes  = body.notes  as string | undefined;

    if (!status || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    await updateBriefStatus(id, status as CreativeBriefStatus, notes).catch((err) => {
      console.error("[briefs PATCH status]", err);
      throw err;
    });

    return NextResponse.json({ ok: true, id, status });
  }

  // ── Variant review decision ────────────────────────────────────────────────
  if (action === "variant") {
    const variantId      = body.variantId      as string | undefined;
    const reviewDecision = body.reviewDecision as string | undefined;
    const reviewNote     = body.reviewNote     as string | undefined;

    if (!variantId) {
      return NextResponse.json({ error: "Missing variantId" }, { status: 400 });
    }
    if (!reviewDecision || !VALID_DECISIONS.has(reviewDecision)) {
      return NextResponse.json({ error: `Invalid reviewDecision: ${reviewDecision}` }, { status: 400 });
    }

    await updateVariantReview({
      variantId,
      reviewDecision: reviewDecision as CreativeReviewDecision,
      reviewNote,
    }).catch((err) => {
      console.error("[briefs PATCH variant]", err);
      throw err;
    });

    return NextResponse.json({ ok: true, variantId, reviewDecision });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
