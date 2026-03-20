// app/api/creative-lab/briefs/route.ts
// POST — generate and persist a creative brief from refresh queue item context.
//
// Body (JSON):
//   {
//     sourceItemId, clientAccountId, clientName, campaignId, campaignName,
//     creativeId, creativeName, spend, impressions, clicks, avgCtr, avgFrequency,
//     campaignRoas, campaignCpa, adCopy, callToAction, thumbnailUrl,
//     fatigueStatus, evaluationStatus, priorityReason, signalLabels,
//     recommendedActionType, recommendationRationale, draftType, notes?
//   }
//
// Returns: { ok: true, briefId: string }

import { NextRequest, NextResponse }  from "next/server";
// Deterministic ID using Math.random + timestamp (no extra deps needed)
function createId(): string {
  return `brief_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
import {
  buildCreativeBriefInput,
  buildCreativeBrief,
}                                     from "../../../../lib/creativeBrief/briefs";
import { saveCreativeBrief }          from "../../../../lib/creativeBrief/db";
import type { CreativeDraftType }     from "../../../../types/creativeBrief";

const VALID_DRAFT_TYPES = new Set<string>([
  "copy_variation", "headline_variation", "angle_variation",
  "image_brief", "full_refresh_brief",
]);

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const draftType = body.draftType as string | undefined;
  if (!draftType || !VALID_DRAFT_TYPES.has(draftType)) {
    return NextResponse.json({ error: `Invalid draftType: ${draftType}` }, { status: 400 });
  }

  const clientAccountId = body.clientAccountId as string | undefined;
  if (!clientAccountId) {
    return NextResponse.json({ error: "Missing clientAccountId" }, { status: 400 });
  }

  const sourceItemId = body.sourceItemId as string | undefined;
  if (!sourceItemId) {
    return NextResponse.json({ error: "Missing sourceItemId" }, { status: 400 });
  }

  const input = buildCreativeBriefInput({
    sourceItemId,
    clientAccountId,
    clientName:              (body.clientName              as string)       ?? "",
    campaignId:              (body.campaignId              as string | null) ?? null,
    campaignName:            (body.campaignName            as string | null) ?? null,
    creativeId:              (body.creativeId              as string | null) ?? null,
    creativeName:            (body.creativeName            as string | null) ?? null,
    spend:                   Number(body.spend             ?? 0),
    impressions:             Number(body.impressions       ?? 0),
    clicks:                  Number(body.clicks            ?? 0),
    avgCtr:                  Number(body.avgCtr            ?? 0),
    avgFrequency:            body.avgFrequency != null ? Number(body.avgFrequency) : null,
    campaignRoas:            body.campaignRoas  != null ? Number(body.campaignRoas) : null,
    campaignCpa:             body.campaignCpa   != null ? Number(body.campaignCpa)  : null,
    adCopy:                  (body.adCopy                 as string | null) ?? null,
    callToAction:            (body.callToAction           as string | null) ?? null,
    thumbnailUrl:            (body.thumbnailUrl           as string | null) ?? null,
    fatigueStatus:           (body.fatigueStatus          as string | null) ?? null,
    evaluationStatus:        (body.evaluationStatus        as string)       ?? "average",
    priorityReason:          (body.priorityReason          as string)       ?? "",
    signalLabels:            (body.signalLabels            as string[])     ?? [],
    recommendedActionType:   (body.recommendedActionType   as string)       ?? "",
    recommendationRationale: (body.recommendationRationale as string)       ?? "",
    notes:                   (body.notes                  as string | null) ?? null,
  });

  const briefId = createId();
  const brief   = buildCreativeBrief(input, draftType as CreativeDraftType, briefId);

  await saveCreativeBrief(brief).catch((err) => {
    console.error("[briefs POST] save error", err);
    throw err;
  });

  return NextResponse.json({ ok: true, briefId });
}
