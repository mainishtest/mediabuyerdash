// ─────────────────────────────────────────────────────────────────────────────
// Quick Launch — Build and Validate Launch Drafts
// ─────────────────────────────────────────────────────────────────────────────
// Takes an approved candidate and builds a launch-ready draft with full
// guardrail evaluation. Reuses the existing publish-prep guardrails.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "../db";
import type {
  CreativeLaunchDraft,
  CreativeLaunchTarget,
  CreativeLaunchStatus,
  CreativeLaunchBlocker,
  CreativeLaunchGuardrail,
} from "../../types/quickReviewLaunch";

/**
 * Build a launch draft from a generation run with approved variations.
 */
export async function buildCreativeLaunchDraft(
  generationRunId: string,
  target?: Partial<CreativeLaunchTarget>
): Promise<CreativeLaunchDraft | null> {
  const run = await prisma.generationRun.findUnique({
    where: { id: generationRunId },
    include: {
      copyVariations: { where: { approvalStatus: "approved" } },
      imageVariations: { where: { approvalStatus: "approved" } },
    },
  });

  if (!run) return null;

  const approvedCopy = run.copyVariations[0];
  const approvedImage = run.imageVariations[0];

  if (!approvedCopy && !approvedImage) return null;

  return {
    generationRunId: run.id,
    clientAccountId: run.clientAccountId || "",
    approvedCopyId: approvedCopy?.id,
    approvedImageId: approvedImage?.id,

    // Target mapping
    targetCampaignExternalId: target?.targetCampaignExternalId,
    targetCampaignName: target?.targetCampaignName,
    targetAdSetExternalId: target?.targetAdSetExternalId,
    targetAdSetName: target?.targetAdSetName,
    externalAdAccountId: target?.externalAdAccountId,
    destinationUrl: target?.destinationUrl,
    ctaType: target?.ctaType,

    // Denormalized content for launch
    hook: approvedCopy?.hook,
    body: approvedCopy?.body,
    callToAction: approvedCopy?.callToAction,
    imageConceptTitle: approvedImage?.title,
  };
}

/**
 * Validate a launch draft and return readiness status with blockers.
 */
export function validateCreativeLaunchDraft(
  draft: CreativeLaunchDraft
): CreativeLaunchStatus {
  const blockers: CreativeLaunchBlocker[] = [];
  const guardrails: CreativeLaunchGuardrail[] = [];

  // Check: has approved content
  const hasContent = !!(draft.approvedCopyId || draft.approvedImageId);
  guardrails.push({
    name: "approved_content",
    passed: hasContent,
    required: true,
    reason: hasContent ? undefined : "No approved variation selected",
  });
  if (!hasContent) {
    blockers.push({
      type: "no_approved_content",
      label: "No approved copy or image variation",
      severity: "error",
    });
  }

  // Check: has client account
  const hasClient = !!draft.clientAccountId;
  guardrails.push({
    name: "client_account",
    passed: hasClient,
    required: true,
    reason: hasClient ? undefined : "Client account not set",
  });
  if (!hasClient) {
    blockers.push({
      type: "no_client",
      label: "Client account not linked",
      severity: "error",
    });
  }

  // Check: has Meta ad account
  const hasAdAccount = !!draft.externalAdAccountId;
  guardrails.push({
    name: "ad_account",
    passed: hasAdAccount,
    required: true,
    reason: hasAdAccount ? undefined : "Meta ad account not mapped",
  });
  if (!hasAdAccount) {
    blockers.push({
      type: "no_ad_account",
      label: "No Meta ad account selected",
      severity: "error",
    });
  }

  // Check: has target ad set
  const hasAdSet = !!draft.targetAdSetExternalId;
  guardrails.push({
    name: "target_ad_set",
    passed: hasAdSet,
    required: true,
    reason: hasAdSet ? undefined : "Target ad set not mapped",
  });
  if (!hasAdSet) {
    blockers.push({
      type: "no_ad_set",
      label: "No target ad set selected",
      severity: "error",
    });
  }

  // Check: has destination URL (warning only)
  const hasUrl = !!draft.destinationUrl;
  guardrails.push({
    name: "destination_url",
    passed: hasUrl,
    required: false,
    reason: hasUrl ? undefined : "Destination URL not set (may be required for some ad types)",
  });
  if (!hasUrl) {
    blockers.push({
      type: "no_destination_url",
      label: "Missing destination URL",
      severity: "warning",
    });
  }

  // Check: copy has body content
  if (draft.approvedCopyId && !draft.hook && !draft.body) {
    guardrails.push({
      name: "copy_content",
      passed: false,
      required: true,
      reason: "Approved copy has no hook or body text",
    });
    blockers.push({
      type: "empty_copy",
      label: "Copy variation has no content",
      severity: "error",
    });
  }

  const requiredFailures = guardrails.filter((g) => g.required && !g.passed);
  const canLaunch = requiredFailures.length === 0;

  let status: CreativeLaunchStatus["status"];
  if (canLaunch) {
    status = "ready_for_launch";
  } else if (blockers.some((b) => b.severity === "error")) {
    status = "blocked";
  } else {
    status = "draft";
  }

  return { status, blockers, canLaunch };
}

/**
 * Load the Meta ad account and campaigns for a client to populate target dropdowns.
 */
export async function loadClientMetaTargets(clientAccountId: string): Promise<{
  adAccountId?: string;
  campaigns: { externalId: string; name: string }[];
  adSets: { externalId: string; name: string; campaignId: string }[];
}> {
  try {
    // Find the Meta ad account linked to this client
    const selectedAccount = await prisma.metaSelectedAdAccount.findFirst({
      where: { clientAccountId },
      include: {
        accessibleAdAccount: true,
      },
    });

    if (!selectedAccount) {
      return { campaigns: [], adSets: [] };
    }

    const adAccountId = selectedAccount.accessibleAdAccount.externalAdAccountId;

    // Load synced campaigns and ad sets
    const [campaigns, adSets] = await Promise.all([
      prisma.metaSyncedCampaign.findMany({
        where: { externalAdAccountId: adAccountId },
        select: { externalCampaignId: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.metaSyncedAdSet.findMany({
        where: { externalAdAccountId: adAccountId },
        select: { externalAdSetId: true, name: true, externalCampaignId: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      adAccountId,
      campaigns: campaigns.map((c) => ({
        externalId: c.externalCampaignId,
        name: c.name,
      })),
      adSets: adSets.map((a) => ({
        externalId: a.externalAdSetId,
        name: a.name,
        campaignId: a.externalCampaignId,
      })),
    };
  } catch {
    return { campaigns: [], adSets: [] };
  }
}
