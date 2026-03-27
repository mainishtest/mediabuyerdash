// lib/publishPrep/builder.ts
// Assembles a PublishPrepItem and PublishPayloadPreview from brief + variant.
// All functions are pure — no API calls, no DB access.
//
// Architecture rules:
//   - buildPublishPrepItem() is the single public entry point for assembly.
//   - buildPublishPayloadPreview() constructs the Meta-ready payload shape.
//   - CRM ROAS/CPA from brief context inform the rationale, not the payload itself.
//   - Target mapping must be supplied by caller (selected from available campaigns).

import type {
  PublishPrepItem,
  PublishPrepStatus,
  LaunchExecutionMode,
  PublishTargetMapping,
  PublishPayloadPreview,
  MetaCreativePayloadShape,
  LaunchApprovalRequirement,
}                            from "../../types/publishPrep";
import type {
  CreativeBrief,
  CreativeDraftVariant,
}                            from "../../types/creativeBrief";

// ---------------------------------------------------------------------------
// CTA text → Meta CTA type mapper (best-effort)
// ---------------------------------------------------------------------------

function inferCtaType(ctaText: string | null | undefined): string | null {
  if (!ctaText) return null;
  const t = ctaText.toLowerCase();
  if (/shop|buy|order|purchase/.test(t))  return "SHOP_NOW";
  if (/learn|discover|find out/.test(t))  return "LEARN_MORE";
  if (/sign.?up|register|join/.test(t))   return "SIGN_UP";
  if (/get|claim|grab|start/.test(t))     return "GET_OFFER";
  if (/book|reserve|schedule/.test(t))    return "BOOK_TRAVEL";
  if (/download|install|try/.test(t))     return "DOWNLOAD";
  if (/contact|reach|call/.test(t))       return "CONTACT_US";
  return "LEARN_MORE";  // safe default
}

// ---------------------------------------------------------------------------
// Assemble the Meta creative payload shape
// This is a preview — no Meta API call is made.
// ---------------------------------------------------------------------------

export function buildPublishPayloadPreview(
  variant:  CreativeDraftVariant,
  mapping:  PublishTargetMapping,
  notes:    string | null,
): PublishPayloadPreview {
  const ctaType = mapping.ctaType ?? inferCtaType(variant.callToAction);

  let metaPayload: MetaCreativePayloadShape;

  if (variant.variantType === "copy") {
    // Primary text = hook + body combined (standard Meta ad text field)
    const adMessage = [variant.hook, variant.body].filter(Boolean).join("\n\n") || null;

    metaPayload = {
      adMessage,
      adHeadline:    variant.title,
      adDescription: variant.body ?? null,
      ctaText:       variant.callToAction ?? null,
      ctaType,
      destinationUrl: mapping.destinationUrl,
      imageNote:      null,
      adSetId:        mapping.targetAdSetExternalId,
      campaignId:     mapping.targetCampaignExternalId,
    };
  } else {
    // Image brief: concept summary becomes designer instruction
    const adMessage = variant.directResponseAngle ?? variant.conceptSummary ?? null;
    metaPayload = {
      adMessage,
      adHeadline:    variant.title,
      adDescription: variant.conceptSummary ?? null,
      ctaText:       null,
      ctaType:       ctaType ?? "LEARN_MORE",
      destinationUrl: mapping.destinationUrl,
      imageNote:      [variant.conceptSummary, variant.visualChanges].filter(Boolean).join(" | ") || null,
      adSetId:        mapping.targetAdSetExternalId,
      campaignId:     mapping.targetCampaignExternalId,
    };
  }

  return {
    variantTitle:        variant.title,
    variantType:         variant.variantType,
    hook:                variant.hook ?? null,
    body:                variant.body ?? null,
    callToAction:        variant.callToAction ?? null,
    conceptSummary:      variant.conceptSummary ?? null,
    visualChanges:       variant.visualChanges ?? null,
    goal:                variant.goal ?? null,
    directResponseAngle: variant.directResponseAngle ?? null,
    metaPayloadShape:    metaPayload,
    targetMapping:       mapping,
    launchNotes:         notes,
  };
}

// ---------------------------------------------------------------------------
// Build the approval requirement
// ---------------------------------------------------------------------------

function buildApprovalRequirement(
  approvedForLaunch: boolean,
  status: PublishPrepStatus,
  guardrailsPassed:  boolean,
): LaunchApprovalRequirement {
  const blocked: string[] = [];

  if (!approvedForLaunch) blocked.push("Human approval required before launch");
  if (!guardrailsPassed)  blocked.push("One or more guardrails have not passed");
  if (status === "blocked") blocked.push("Prep item is currently blocked — resolve validation errors first");

  return {
    requiresHumanApproval: true,   // always required — no autonomous publish
    approverNote: "A human reviewer must approve this item before any launch action can proceed.",
    blockedReasons: blocked,
  };
}

// ---------------------------------------------------------------------------
// Public API: buildPublishPrepItem
// Assembles the full in-memory PublishPrepItem from brief + variant + mapping.
// Validation and guardrails are evaluated separately (see validator.ts, guardrails.ts).
// ---------------------------------------------------------------------------

export function buildPublishPrepItem(opts: {
  id:              string;
  brief:           CreativeBrief;
  variant:         CreativeDraftVariant;
  targetMapping:   PublishTargetMapping;
  executionMode?:  LaunchExecutionMode;
  launchNotes?:    string | null;
}): Omit<PublishPrepItem, "validation" | "guardrails"> {
  const { id, brief, variant, targetMapping, executionMode = "manual_publish", launchNotes = null } = opts;

  const payloadPreview = buildPublishPayloadPreview(variant, targetMapping, launchNotes);
  const approvalReq    = buildApprovalRequirement(false, "draft", false);

  return {
    id,
    briefId:         brief.id,
    variantId:       variant.id,
    clientAccountId: brief.clientAccountId,
    status:          "draft",
    executionMode,
    variantTitle:    variant.title,
    variantType:     variant.variantType,
    briefIntent:     brief.intent,
    briefDraftType:  brief.draftType,
    clientName:      brief.clientName,
    campaignName:    brief.campaignName ?? null,
    creativeName:    brief.creativeName ?? null,
    targetMapping,
    payloadPreview,
    approvalRequirement: approvalReq,
    launchNotes,
    approvedForLaunch: false,
    approvedAt:        null,
    publishedAt:       null,
    publishError:      null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
