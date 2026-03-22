// app/api/creative-lab/review-launch/route.ts
// POST /api/creative-lab/review-launch
//
// Unified endpoint for the approve → launch flow.
// Takes an approved candidate + source context and executes the full
// publish-prep → Meta launch pipeline in one call.
//
// Request body:
//   {
//     candidate: { id, variantType, title, content, rationale, sourceId, sourceType },
//     clientAccountId: string,
//     clientName: string,
//     campaignName: string | null,
//     creativeName: string | null,
//     controlExternalId: string | null,    // existing ad's Meta ID (for experiment wiring)
//     target: {
//       campaignExternalId, campaignName,
//       adSetExternalId, adSetName,
//       destinationUrl, ctaType,
//     }
//   }
//
// Response:
//   { ok: true, result: CreativeLaunchResult, summary: CreativeQuickLaunchSummary }
//   { ok: false, error: string, blockers?: CreativeLaunchBlocker[] }

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import {
  approveCreativeCandidate,
  buildCreativeLaunchDraft,
  validateCreativeLaunchDraft,
  executeCreativeTestLaunch,
  summarizeCreativeQuickLaunch,
} from "../../../../lib/creativelab/reviewAndLaunch";
import type { CreativeReviewCandidate } from "../../../../types/creativeReviewLaunch";

type RequestBody = {
  candidate:         CreativeReviewCandidate;
  clientAccountId:   string;
  clientName:        string;
  campaignName:      string | null;
  creativeName:      string | null;
  controlExternalId: string | null;
  target: {
    campaignExternalId:  string | null;
    campaignName:        string | null;
    adSetExternalId:     string | null;
    adSetName:           string | null;
    destinationUrl:      string | null;
    ctaType:             string | null;
  };
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.candidate?.id || !body.candidate?.variantType) {
    return NextResponse.json(
      { ok: false, error: "candidate.id and candidate.variantType are required" },
      { status: 400 },
    );
  }

  if (!body.clientAccountId) {
    return NextResponse.json(
      { ok: false, error: "clientAccountId is required" },
      { status: 400 },
    );
  }

  // Step 1: Record approval
  const _approval = approveCreativeCandidate(body.candidate);

  // Step 2: Build launch draft
  const draft = buildCreativeLaunchDraft({
    candidate:       body.candidate,
    clientAccountId: body.clientAccountId,
    clientName:      body.clientName,
    campaignName:    body.campaignName,
    creativeName:    body.creativeName,
    target:          body.target ?? {
      campaignExternalId: null,
      campaignName:       null,
      adSetExternalId:    null,
      adSetName:          null,
      destinationUrl:     null,
      ctaType:            null,
    },
  });

  // Step 3: Validate
  const validation = validateCreativeLaunchDraft(draft);
  if (!validation.ready) {
    return NextResponse.json(
      {
        ok:       false,
        error:    "Launch draft has blockers",
        blockers: validation.blockers,
        draft,
      },
      { status: 422 },
    );
  }

  // Step 4: Execute launch
  try {
    const result = await executeCreativeTestLaunch(draft, body.controlExternalId);
    const summary = summarizeCreativeQuickLaunch(draft, result);

    if (!result.success) {
      return NextResponse.json(
        {
          ok:      false,
          error:   result.message,
          result,
          summary,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, result, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[review-launch] error:", msg);
    return NextResponse.json(
      { ok: false, error: `Launch failed: ${msg}` },
      { status: 500 },
    );
  }
}
