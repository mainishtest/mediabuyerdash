// ─────────────────────────────────────────────────────────────────────────────
// Quick Launch — Meta Execution
// ─────────────────────────────────────────────────────────────────────────────
// Executes a launch draft by calling the existing attemptMetaLaunch() function.
// This wraps the existing publish execution pipeline into a single call.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "../db";
import { attemptMetaLaunch } from "../publishExecution/metaLaunch";
import type {
  CreativeLaunchDraft,
  CreativeLaunchResult,
  CreativeQuickLaunchSummary,
} from "../../types/quickReviewLaunch";

/**
 * Execute a Meta test launch from a validated launch draft.
 * Calls the existing attemptMetaLaunch() with the assembled payload.
 */
export async function executeCreativeTestLaunch(
  draft: CreativeLaunchDraft,
  options: {
    accessToken?: string;
    executionMode?: "manual_publish" | "guarded_publish";
  } = {}
): Promise<CreativeLaunchResult> {
  const { executionMode = "guarded_publish" } = options;

  // Resolve access token
  let accessToken = options.accessToken;
  if (!accessToken && executionMode === "guarded_publish") {
    // Try to load from Meta connection
    const connection = await prisma.metaConnection.findFirst({
      where: { connectionStatus: "active" },
      select: { accessToken: true },
    });
    accessToken = connection?.accessToken;
  }

  // Build the payload in the shape expected by attemptMetaLaunch
  const payload = {
    prepItemId: draft.generationRunId,
    clientAccountId: draft.clientAccountId,
    executionMode,
    isLaunchReady: true,
    payloadPreview: {
      adMessage: [draft.hook, draft.body].filter(Boolean).join("\n\n") || null,
      adHeadline: draft.hook || null,
      adDescription: draft.body || null,
      ctaType: draft.ctaType || "LEARN_MORE",
      destinationUrl: draft.destinationUrl || null,
    },
    validation: { passed: true },
    targetMapping: {
      targetCampaignExternalId: draft.targetCampaignExternalId,
      targetAdSetExternalId: draft.targetAdSetExternalId,
    },
  };

  try {
    const result = await attemptMetaLaunch({
      payload: payload as unknown as Parameters<typeof attemptMetaLaunch>[0]["payload"],
      accessToken,
      adAccountId: draft.externalAdAccountId,
    });

    return {
      success: result.success,
      mode: result.mode as "manual_publish" | "guarded_publish",
      message: result.message,
      metaCreativeId: result.metaCreativeId,
      metaAdId: result.metaAdId,
      errorCode: result.errorCode,
      errorDetail: result.errorDetail,
    };
  } catch (err) {
    return {
      success: false,
      mode: executionMode,
      message: err instanceof Error ? err.message : "Launch execution failed",
      errorCode: "EXECUTION_ERROR",
    };
  }
}

/**
 * Summarize a quick launch for display in lists.
 */
export function summarizeCreativeQuickLaunch(
  draft: CreativeLaunchDraft,
  launchResult?: CreativeLaunchResult
): CreativeQuickLaunchSummary {
  let approvedVariationType: "copy" | "image" | "both" | "none" = "none";
  if (draft.approvedCopyId && draft.approvedImageId) {
    approvedVariationType = "both";
  } else if (draft.approvedCopyId) {
    approvedVariationType = "copy";
  } else if (draft.approvedImageId) {
    approvedVariationType = "image";
  }

  return {
    generationRunId: draft.generationRunId,
    sourceLabel: draft.hook?.slice(0, 50) || draft.imageConceptTitle || "Variation",
    approvedVariationType,
    launchStatus: launchResult?.success
      ? "launched"
      : launchResult
        ? "launch_failed"
        : "draft",
    metaAdId: launchResult?.metaAdId,
    metaCreativeId: launchResult?.metaCreativeId,
    clientAccountId: draft.clientAccountId,
    createdAt: new Date().toISOString(),
  };
}
