// app/api/creative-lab/publish-prep/route.ts
// GET  — list publish prep items for a client or brief
// POST — create a new publish prep item from an approved creative draft

import { NextRequest, NextResponse }           from "next/server";
import { loadCreativeBriefById }               from "../../../../lib/creativeBrief/db";
import {
  buildPublishPrepItem,
  buildPublishPayloadPreview,
}                                              from "../../../../lib/publishPrep/builder";
import { validateCreativeDraftForPublish }     from "../../../../lib/publishPrep/validator";
import { evaluatePublishGuardrails, deriveStatusFromResults } from "../../../../lib/publishPrep/guardrails";
import {
  savePublishPrepItem,
  loadPublishPrepItems,
  buildPublishPrepSummary,
}                                              from "../../../../lib/publishPrep/db";
import type {
  PublishTargetMapping,
  LaunchExecutionMode,
}                                              from "../../../../types/publishPrep";

// ---------------------------------------------------------------------------
// GET — list prep items
// Query params: clientAccountId?, briefId?, status?
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const clientAccountId  = searchParams.get("clientAccountId") ?? undefined;
  const briefId          = searchParams.get("briefId")         ?? undefined;
  const status           = searchParams.get("status")          ?? undefined;

  try {
    const [items, summary] = await Promise.all([
      loadPublishPrepItems({ clientAccountId, briefId, status: status as never, limit: 50 }),
      buildPublishPrepSummary(clientAccountId),
    ]);
    return NextResponse.json({ ok: true, items, summary });
  } catch (err) {
    console.error("[publish-prep GET]", err);
    return NextResponse.json({ ok: false, error: "Failed to load publish prep items." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create a new prep item
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    briefId,
    variantId,
    executionMode = "manual_publish",
    launchNotes   = null,
    // Target mapping (all optional at creation — can be set later)
    targetCampaignId         = null,
    targetCampaignName       = null,
    targetCampaignExternalId = null,
    targetAdSetId            = null,
    targetAdSetName          = null,
    targetAdSetExternalId    = null,
    destinationUrl           = null,
    ctaType                  = null,
  } = (body ?? {}) as Record<string, unknown>;

  if (!briefId || typeof briefId !== "string") {
    return NextResponse.json({ error: "briefId is required." }, { status: 400 });
  }
  if (!variantId || typeof variantId !== "string") {
    return NextResponse.json({ error: "variantId is required." }, { status: 400 });
  }

  // Load brief + find variant
  let brief;
  try { brief = await loadCreativeBriefById(briefId); } catch {
    return NextResponse.json({ error: "Failed to load brief." }, { status: 500 });
  }
  if (!brief) return NextResponse.json({ error: "Brief not found." }, { status: 404 });

  const variant = brief.draftSet.variants.find((v) => v.id === variantId);
  if (!variant)  return NextResponse.json({ error: "Variant not found in brief." }, { status: 404 });

  const targetMapping: PublishTargetMapping = {
    targetCampaignId:         (targetCampaignId         as string | null),
    targetCampaignName:       (targetCampaignName       as string | null),
    targetCampaignExternalId: (targetCampaignExternalId as string | null),
    targetAdSetId:            (targetAdSetId            as string | null),
    targetAdSetName:          (targetAdSetName          as string | null),
    targetAdSetExternalId:    (targetAdSetExternalId    as string | null),
    destinationUrl:           (destinationUrl           as string | null),
    ctaType:                  (ctaType                  as string | null),
  };

  // Build prep item (in-memory)
  const id = `pp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const prepBase = buildPublishPrepItem({
    id,
    brief,
    variant,
    targetMapping,
    executionMode: executionMode as LaunchExecutionMode,
    launchNotes:  launchNotes as string | null,
  });

  // Validate
  const validation = validateCreativeDraftForPublish(variant, brief, targetMapping);

  // Evaluate guardrails (prep is not yet approved — approvedForLaunch = false)
  const guardrails = evaluatePublishGuardrails(
    { status: "draft", executionMode: prepBase.executionMode, approvedForLaunch: false, clientAccountId: prepBase.clientAccountId, targetMapping },
    validation,
  );

  // Derive status
  const status = deriveStatusFromResults("draft", validation, guardrails, false);

  const prepItem = { ...prepBase, status };

  // Persist
  try {
    await savePublishPrepItem(prepItem, validation, guardrails);
  } catch (err) {
    console.error("[publish-prep POST save]", err);
    return NextResponse.json({ error: "Failed to save publish prep item." }, { status: 500 });
  }

  return NextResponse.json({
    ok:     true,
    id:     prepItem.id,
    status: prepItem.status,
    item:   { ...prepItem, validation, guardrails },
  });
}
