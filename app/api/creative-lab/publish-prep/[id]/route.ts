// app/api/creative-lab/publish-prep/[id]/route.ts
// GET  — load a single publish prep item with full detail
// PATCH — update: approve | reject | hold | set_target | set_notes | publish
//
// Action summary:
//   approve     — grants human approval, re-evaluates guardrails, advances status
//   reject      — resets to draft, clears approval
//   hold        — pauses the item without rejecting (reviewer not ready to proceed)
//   set_target  — updates target mapping and re-runs validation/guardrails
//   set_notes   — saves launch notes without changing status
//   publish     — guarded launch action; routes to execution bridge

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
import { attemptMetaLaunch }                   from "../../../../../lib/publishExecution/metaLaunch";
import type {
  PublishTargetMapping,
  PublishPayload,
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

  // ── hold — pause without rejecting ───────────────────────────────────────────
  // Used when a reviewer wants to pause work on this item without sending it back.
  // The item retains its validation/guardrail state — can be resumed (re-approved).
  if (action === "hold") {
    if (item.status === "published") {
      return NextResponse.json({ error: "Cannot hold a published item." }, { status: 400 });
    }
    await updatePublishPrepStatus(id, "held", undefined, undefined, undefined, null);
    return NextResponse.json({ ok: true, id, status: "held" });
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
  //
  // Flow:
  //   1. Re-evaluate guardrails (authoritative check before any I/O)
  //   2. Build a typed PublishPayload and pass to execution bridge
  //   3. Bridge routes to manual or guarded launch based on executionMode
  //   4. Update status: published on success, publish_failed on failure
  if (action === "publish") {
    // Safety gate: re-evaluate all required guardrails from current state
    const guardrails = evaluatePublishGuardrails(
      {
        status:            item.status,
        executionMode:     item.executionMode,
        approvedForLaunch: item.approvedForLaunch,
        clientAccountId:   item.clientAccountId,
        targetMapping:     item.targetMapping,
      },
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

    if (!item.payloadPreview) {
      return NextResponse.json({
        ok:    false,
        error: "Cannot publish — payload preview is missing. Re-save the target mapping to rebuild the payload.",
      }, { status: 422 });
    }

    // Build the typed PublishPayload passed to the execution bridge
    const publishPayload: PublishPayload = {
      prepItemId:      item.id,
      clientAccountId: item.clientAccountId,
      executionMode:   item.executionMode,
      payloadPreview:  item.payloadPreview,
      validation:      item.validation!,
      guardrails,
      isLaunchReady:   true,
      assembledAt:     new Date().toISOString(),
    };

    // Call the execution bridge — never throws, always returns typed result
    const launchResult = await attemptMetaLaunch({
      payload:      publishPayload,
      // For guarded_publish, token and account would come from MetaConnection.
      // In this release, the caller opts in by providing query params.
      // manual_publish mode does not use these fields.
      accessToken:  (body as Record<string, unknown>).accessToken  as string | undefined,
      adAccountId:  (body as Record<string, unknown>).adAccountId  as string | undefined,
    });

    const now = new Date().toISOString();

    if (launchResult.success) {
      await updatePublishPrepStatus(id, "published", true, item.approvedAt, now, null);
      return NextResponse.json({
        ok:              true,
        id,
        status:          "published",
        publishedAt:     now,
        mode:            launchResult.mode,
        message:         launchResult.message,
        metaCreativeId:  launchResult.metaCreativeId ?? null,
        metaAdId:        launchResult.metaAdId        ?? null,
      });
    } else {
      // Execution failed — mark as publish_failed with error details
      const errorDetail = [launchResult.message, launchResult.errorDetail]
        .filter(Boolean).join(" | ");
      await updatePublishPrepStatus(id, "publish_failed", true, item.approvedAt, null, errorDetail);
      return NextResponse.json({
        ok:          false,
        id,
        status:      "publish_failed",
        error:       launchResult.message,
        errorCode:   launchResult.errorCode ?? null,
        errorDetail: launchResult.errorDetail ?? null,
      }, { status: 422 });
    }
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
