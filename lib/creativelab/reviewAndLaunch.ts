// lib/creativelab/reviewAndLaunch.ts
// Bridge from quick-generate review → publish-prep → Meta launch.
//
// The happy path is 3 clicks:
//   1. Select candidate (approve)
//   2. Confirm target (auto-populated from source)
//   3. Launch (creates publish-prep item, auto-approves, executes Meta launch)
//
// Reuses:
//   - savePublishPrepItem() for creating the publish-prep record
//   - executeMetaLaunch() for the actual Meta API call
//   - evaluatePublishGuardrails() for safety checks

import { randomUUID } from "crypto";
import { savePublishPrepItem } from "../publishPrep/db";
import { evaluatePublishGuardrails, canProceedToLaunch } from "../publishPrep/guardrails";
import { executeMetaLaunch } from "../metaLaunch/executor";
import type {
  PublishTargetMapping,
  PublishPayloadPreview,
  PublishValidationResult,
  PublishGuardrailResult,
} from "../../types/publishPrep";
import type {
  CreativeReviewCandidate,
  CreativeApprovalSelection,
  CreativeLaunchDraft,
  CreativeLaunchTarget,
  CreativeLaunchResult,
  CreativeLaunchBlocker,
  CreativeQuickLaunchSummary,
} from "../../types/creativeReviewLaunch";

// ---------------------------------------------------------------------------
// Step 1: Build review set from quick-generate output
// ---------------------------------------------------------------------------

export function buildCreativeReviewSet(
  variants: Array<{
    id: string;
    type: "copy" | "image_brief";
    title: string;
    content: string;
    rationale: string;
  }>,
  sourceId: string,
  sourceType: "synced_ad" | "uploaded_asset",
  generationJobId: string | null,
): CreativeReviewCandidate[] {
  return variants.map((v) => ({
    id:              v.id,
    variantType:     v.type === "image_brief" ? "image" as const : "copy" as const,
    title:           v.title,
    content:         v.content,
    rationale:       v.rationale,
    sourceId,
    sourceType,
    generationJobId,
  }));
}

// ---------------------------------------------------------------------------
// Step 2: Record approval selection
// ---------------------------------------------------------------------------

export function approveCreativeCandidate(
  candidate: CreativeReviewCandidate,
): CreativeApprovalSelection {
  return {
    candidateId:  candidate.id,
    variantType:  candidate.variantType,
    title:        candidate.title,
    content:      candidate.content,
    decision:     "approved",
    approvedAt:   new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Step 3: Build launch draft
// ---------------------------------------------------------------------------

export function buildCreativeLaunchDraft(opts: {
  candidate:       CreativeReviewCandidate;
  clientAccountId: string;
  clientName:      string;
  campaignName:    string | null;
  creativeName:    string | null;
  target:          CreativeLaunchTarget;
}): CreativeLaunchDraft {
  const { candidate, target } = opts;

  // Parse copy content back into structured fields
  const contentParts = candidate.content.split("\n\n");
  const isCopy = candidate.variantType === "copy";

  const blockers: CreativeLaunchBlocker[] = [];

  // Validate minimum requirements
  if (!opts.clientAccountId) {
    blockers.push({ code: "NO_CLIENT", message: "No client account linked" });
  }
  if (!target.campaignExternalId && !target.adSetExternalId) {
    blockers.push({ code: "NO_TARGET", message: "No campaign or ad set target specified" });
  }
  if (isCopy && (!contentParts[0] || contentParts[0].trim() === "")) {
    blockers.push({ code: "EMPTY_COPY", message: "Copy content is empty" });
  }

  return {
    id:               randomUUID(),
    prepItemId:       null,
    candidateId:      candidate.id,
    variantType:      candidate.variantType,
    variantTitle:     candidate.title,
    sourceCreativeId: candidate.sourceId,
    sourceType:       candidate.sourceType,
    clientAccountId:  opts.clientAccountId,
    clientName:       opts.clientName,
    campaignName:     opts.campaignName,
    creativeName:     opts.creativeName,
    target,
    hook:             isCopy ? (contentParts[0] ?? null) : null,
    body:             isCopy ? (contentParts[1] ?? null) : null,
    callToAction:     isCopy ? (contentParts[2] ?? null) : null,
    conceptSummary:   !isCopy ? (contentParts[0] ?? null) : null,
    visualChanges:    !isCopy ? (contentParts[1] ?? null) : null,
    imageNote:        !isCopy ? (contentParts[2] ?? null) : null,
    status:           blockers.length > 0 ? "blocked" : "ready",
    blockers,
  };
}

// ---------------------------------------------------------------------------
// Step 4: Validate launch draft (guardrails)
// ---------------------------------------------------------------------------

export function validateCreativeLaunchDraft(
  draft: CreativeLaunchDraft,
): { ready: boolean; blockers: CreativeLaunchBlocker[] } {
  const blockers = [...draft.blockers];

  if (!draft.clientAccountId) {
    blockers.push({ code: "NO_CLIENT", message: "Client account is required" });
  }

  if (draft.variantType === "copy" && !draft.hook && !draft.body) {
    blockers.push({ code: "NO_COPY", message: "Copy content is missing" });
  }

  return {
    ready: blockers.length === 0,
    blockers,
  };
}

// ---------------------------------------------------------------------------
// Step 5: Execute the full launch pipeline
// ---------------------------------------------------------------------------

export async function executeCreativeTestLaunch(
  draft: CreativeLaunchDraft,
  controlExternalId: string | null,
): Promise<CreativeLaunchResult> {
  // 1. Validate
  const validation = validateCreativeLaunchDraft(draft);
  if (!validation.ready) {
    return {
      success:        false,
      launchRecordId: null,
      metaCreativeId: null,
      metaAdId:       null,
      experimentId:   null,
      message:        `Launch blocked: ${validation.blockers.map((b) => b.message).join("; ")}`,
      errorCode:      "VALIDATION_FAILED",
    };
  }

  // 2. Create publish-prep item (auto-approved)
  const prepItemId = randomUUID();

  const targetMapping: PublishTargetMapping = {
    targetCampaignId:         null,
    targetCampaignName:       draft.target.campaignName,
    targetCampaignExternalId: draft.target.campaignExternalId,
    targetAdSetId:            null,
    targetAdSetName:          draft.target.adSetName,
    targetAdSetExternalId:    draft.target.adSetExternalId,
    destinationUrl:           draft.target.destinationUrl,
    ctaType:                  draft.target.ctaType,
  };

  const payloadPreview: PublishPayloadPreview = {
    variantTitle:        draft.variantTitle,
    variantType:         draft.variantType,
    hook:                draft.hook,
    body:                draft.body,
    callToAction:        draft.callToAction,
    conceptSummary:      draft.conceptSummary,
    visualChanges:       draft.visualChanges,
    goal:                null,
    directResponseAngle: null,
    metaPayloadShape: {
      adMessage:      [draft.hook, draft.body].filter(Boolean).join("\n\n"),
      adHeadline:     draft.variantTitle,
      adDescription:  draft.body ?? draft.conceptSummary,
      ctaText:        draft.callToAction,
      ctaType:        draft.target.ctaType ?? "SHOP_NOW",
      destinationUrl: draft.target.destinationUrl,
      imageNote:      draft.imageNote,
      adSetId:        draft.target.adSetExternalId,
      campaignId:     draft.target.campaignExternalId,
    },
    targetMapping,
    launchNotes: `Quick launch from Creative Lab — candidate ${draft.candidateId}`,
  };

  const validationResult: PublishValidationResult = {
    passed:   true,
    checks:   [{ key: "quick_launch_approved", label: "Quick Launch Approved", passed: true, message: "Auto-approved via Creative Lab" }],
    blockers: [],
    warnings: [],
  };

  const guardrails: PublishGuardrailResult[] = evaluatePublishGuardrails(
    {
      status:            "approved_for_launch",
      executionMode:     "guarded_publish",
      approvedForLaunch: true,
      clientAccountId:   draft.clientAccountId,
      targetMapping,
    },
    validationResult,
  );

  // Check guardrails
  if (!canProceedToLaunch(guardrails)) {
    const blockerMessages = guardrails.filter((g) => g.required && !g.passed).map((g) => g.message);
    return {
      success:        false,
      launchRecordId: null,
      metaCreativeId: null,
      metaAdId:       null,
      experimentId:   null,
      message:        `Guardrail blocked: ${blockerMessages.join("; ")}`,
      errorCode:      "GUARDRAIL_BLOCKED",
    };
  }

  // 3. Save the publish-prep item (auto-approved)
  try {
    await savePublishPrepItem(
      {
        id:               prepItemId,
        briefId:          draft.sourceCreativeId,
        variantId:        draft.candidateId,
        clientAccountId:  draft.clientAccountId,
        status:           "approved_for_launch",
        executionMode:    "guarded_publish",
        variantTitle:     draft.variantTitle,
        variantType:      draft.variantType,
        briefIntent:      "quick_launch",
        briefDraftType:   "variation",
        clientName:       draft.clientName,
        campaignName:     draft.campaignName,
        creativeName:     draft.creativeName,
        targetMapping,
        payloadPreview,
        launchNotes:      payloadPreview.launchNotes,
        approvedForLaunch: true,
        approvedAt:       new Date().toISOString(),
        publishedAt:      null,
        publishError:     null,
        createdAt:        new Date().toISOString(),
        updatedAt:        new Date().toISOString(),
      },
      validationResult,
      guardrails,
    );
  } catch (err) {
    return {
      success:        false,
      launchRecordId: null,
      metaCreativeId: null,
      metaAdId:       null,
      experimentId:   null,
      message:        `Failed to create publish-prep item: ${err instanceof Error ? err.message : String(err)}`,
      errorCode:      "PREP_SAVE_FAILED",
    };
  }

  // 4. Execute Meta launch through the real pipeline
  try {
    const result = await executeMetaLaunch({
      prepItemId,
      clientAccountId:  draft.clientAccountId,
      variantRole:      "challenger",
      executionMode:    "guarded_publish",
      controlAdExternalId:       controlExternalId,
      controlAdSetExternalId:    draft.target.adSetExternalId,
      controlCampaignExternalId: draft.target.campaignExternalId,
      controlCreativeId:         draft.sourceCreativeId,
      controlLabel:              draft.creativeName ?? "Control",
    });

    return {
      success:        result.success,
      launchRecordId: result.launchRecordId || null,
      metaCreativeId: result.metaCreativeId ?? null,
      metaAdId:       result.metaAdId ?? null,
      experimentId:   result.experimentId ?? null,
      message:        result.message,
      errorCode:      result.errorCode ?? null,
    };
  } catch (err) {
    return {
      success:        false,
      launchRecordId: null,
      metaCreativeId: null,
      metaAdId:       null,
      experimentId:   null,
      message:        `Meta launch failed: ${err instanceof Error ? err.message : String(err)}`,
      errorCode:      "META_LAUNCH_ERROR",
    };
  }
}

// ---------------------------------------------------------------------------
// Step 6: Summarize
// ---------------------------------------------------------------------------

export function summarizeCreativeQuickLaunch(
  draft: CreativeLaunchDraft,
  result: CreativeLaunchResult,
): CreativeQuickLaunchSummary {
  return {
    candidateTitle:     draft.variantTitle,
    variantType:        draft.variantType,
    sourceCreativeName: draft.creativeName,
    launchStatus:       result.success ? "launched" : "failed",
    metaAdId:           result.metaAdId,
    experimentId:       result.experimentId,
    launchedAt:         result.success ? new Date().toISOString() : null,
  };
}
