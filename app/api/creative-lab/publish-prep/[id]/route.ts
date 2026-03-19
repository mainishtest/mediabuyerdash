// app/api/creative-lab/publish-prep/[id]/route.ts
// GET  — load a single publish prep item with full detail
// PATCH — update: approve | reject | set_target | set_notes | publish

import { NextRequest, NextResponse }           from "next/server";
import { loadCreativeBriefById }               from "../../../../../lib/creativeBrief/db";
import {
  buildPublishPayloadPreview,
}                                              from "../../../../../lib/publishPrep/builder";
import { validateCreativeDraftForPublish }     from "../../../../../lib/publishPrep/validator";
import {
  evaluatePublishGuardrails,
  deriveStatusFromResults,
  canProceedToLaunch,
}                                              from "../../../../../lib/publishPrep/guardrails";
import {
  loadPublishPrepItemById,
  updatePublishPrepStatus,
  updatePublishPrepMapping,
  updatePublishPrepNotes,
}                                              from "../../../../../lib/publishPrep/db";
import type {
  PublishTargetMapping,
}                                              from "../../../../../types/publishPrep";

// ---------------------------------------------------------------------------
// GET — detail
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const item = await loadPublishPrepItemById(id);
    if (!item) return NextResponse.json({ error: "Prep item not found." }, { status: 404 });
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    console.error("[publish-prep/[id] GET]", err);
    return NextResponse.json({ error: "Failed to load prep item." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — actions
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { action } = (body ?? {}) as { action?: string };
  if (!action) return NextResponse.json({ error: "action is required." }, { status: 400 });

  // Load current item
  let item;
  try { item = await loadPublishPrepItemById(id); } catch {
    return NextResponse.json({ error: "Failed to load prep item." }, { status: 500 });
  }
  if (!item) return NextResponse.json({ error: "Prep item not found." }, { status: 404 });

  // ── approve ─────────────────────────────────────────────────────────────────
  if (action === "approve") {
    if (item.status === "published") {
      return NextResponse.json({ error: "Cannot approve a published item." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const guardrails = evaluatePublishGuardrails(
      { status: item.status, executionMode: item.executionMode, approvedForLaunch: true, clientAccountId: item.clientAccountId, targetMapping: item.targetMapping },
      item.validation,
    );
    const newStatus = deriveStatusFromResults(item.status, item.validation, guardrails, true);
    await updatePublishPrepStatus(id, newStatus, true, now, null, null);
    return NextResponse.json({ ok: true, id, status: newStatus, approvedAt: now });
  }

  // ── reject / send back ───────────────────────────────────────────────────────
  if (action === "reject") {
    await updatePublishPrepStatus(id, "draft", false, null, null, null);
    return NextResponse.json({ ok: true, id, status: "draft" });
  }

  // ── set_target — update mapping and re-validate ────────────────────────────
  if (action === "set_target") {
    const d = body as Record<string, unknown>;
    const newMapping: PublishTargetMapping = {
      targetCampaignId:         (d.targetCampaignId         as string | null) ?? item.targetMapping.targetCampaignId,
      targetCampaignName:       (d.targetCampaignName       as string | null) ?? item.targetMapping.targetCampaignName,
      targetCampaignExternalId: (d.targetCampaignExternalId as string | null) ?? item.targetMapping.targetCampaignExternalId,
      targetAdSetId:            (d.targetAdSetId            as string | null) ?? item.targetMapping.targetAdSetId,
      targetAdSetName:          (d.targetAdSetName          as string | null) ?? item.targetMapping.targetAdSetName,
      targetAdSetExternalId:    (d.targetAdSetExternalId    as string | null) ?? item.targetMapping.targetAdSetExternalId,
      destinationUrl:           (d.destinationUrl           as string | null) ?? item.targetMapping.destinationUrl,
      ctaType:                  (d.ctaType                  as string | null) ?? item.targetMapping.ctaType,
    };

    // Reload brief + variant to re-validate
    const brief   = await loadCreativeBriefById(item.briefId).catch(() => null);
    const variant = brief?.draftSet.variants.find((v) => v.id === item.variantId) ?? null;

    let validation = item.validation;
    let payload    = item.payloadPreview;

    if (brief && variant) {
      validation = validateCreativeDraftForPublish(variant, brief, newMapping);
      payload    = buildPublishPayloadPreview(variant, newMapping, item.launchNotes);
    }

    const guardrails = evaluatePublishGuardrails(
      { status: item.status, executionMode: item.executionMode, approvedForLaunch: item.approvedForLaunch, clientAccountId: item.clientAccountId, targetMapping: newMapping },
      validation,
    );
    const newStatus = deriveStatusFromResults(item.status, validation, guardrails, item.approvedForLaunch);

    await updatePublishPrepMapping(id, newMapping, validation, guardrails, newStatus, payload);
    return NextResponse.json({ ok: true, id, status: newStatus });
  }

  // ── set_notes ────────────────────────────────────────────────────────────────
  if (action === "set_notes") {
    const { notes } = body as { notes?: string | null };
    await updatePublishPrepNotes(id, notes ?? null);
    return NextResponse.json({ ok: true, id });
  }

  // ── publish — guarded launch action ─────────────────────────────────────────
  if (action === "publish") {
    // Safety gate: check all required guardrails pass
    const guardrails = evaluatePublishGuardrails(
      { status: item.status, executionMode: item.executionMode, approvedForLaunch: item.approvedForLaunch, clientAccountId: item.clientAccountId, targetMapping: item.targetMapping },
      item.validation,
    );

    if (!canProceedToLaunch(guardrails)) {
      const blockers = guardrails.filter((g) => g.required && !g.passed).map((g) => g.message);
      return NextResponse.json({
        ok:       false,
        error:    "Launch blocked by guardrail failures.",
        blockers,
      }, { status: 422 });
    }

    // In this version, "publish" marks the item as published.
    // Actual Meta ad creation API (createMetaAd) is a future step.
    // The payload preview contains everything needed for manual Meta Ads Manager entry.
    const now = new Date().toISOString();
    await updatePublishPrepStatus(id, "published", true, item.approvedAt, now, null);

    return NextResponse.json({
      ok:          true,
      id,
      status:      "published",
      publishedAt: now,
      note:        "Item marked as published. Actual Meta ad creation requires manual execution via Meta Ads Manager using the payload preview. Automated Meta ad creation is a future workflow step.",
    });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
