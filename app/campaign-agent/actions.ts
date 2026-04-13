"use server";

// Campaign Agent — Server Actions
//
// Orchestrates the intent → data → draft pipeline.
// Each step is a separate action so the UI can show progress.
// Enhanced with AgentJob persistence, risk modes, and account context.

import { parseCampaignIntent } from "../../lib/campaignAgent/intentParser";
import { resolveIntentData } from "../../lib/campaignAgent/dataRetrieval";
import { buildCampaignDraft } from "../../lib/campaignAgent/draftBuilder";
import type { CampaignDraft, CampaignIntent, IntentData } from "../../lib/campaignAgent/types";
import type { RiskMode } from "../../lib/agentFramework/types";
import { getConnectionForSync } from "../../lib/meta/db";
import { launchMetaCampaignFlow, type LaunchPayload } from "../../lib/meta/launch";
import { prisma } from "../../lib/db";
import { revalidatePath } from "next/cache";
import {
  createAgentJob,
  updateJobStatus,
  completeJob,
  createStep,
  startStep,
  completeStep,
  failStep,
} from "../../lib/agentFramework/executor";
import { getAccountPerformanceSnapshot } from "../../lib/agentFramework/dataAccess";

// ── Step 1: Parse intent ─────────────────────────────────────────────────────

export interface ParseResult {
  ok: boolean;
  intent?: CampaignIntent;
  error?: string;
}

export async function parseIntentAction(prompt: string, riskMode?: RiskMode): Promise<ParseResult> {
  try {
    const intent = await parseCampaignIntent(prompt, { riskMode });
    return { ok: true, intent };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to parse intent" };
  }
}

// ── Step 2: Resolve data + build draft ───────────────────────────────────────

export interface DraftResult {
  ok: boolean;
  draft?: CampaignDraft;
  jobId?: string;
  error?: string;
}

export async function buildDraftAction(intent: CampaignIntent): Promise<DraftResult> {
  try {
    const data = await resolveIntentData(intent);
    const draft = buildCampaignDraft(intent, data);
    return { ok: true, draft };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to build draft" };
  }
}

// ── Combined: parse + resolve + build (with AgentJob tracking) ──────────────

export async function planCampaignAction(
  prompt: string,
  riskMode: RiskMode = "balanced"
): Promise<DraftResult> {
  const startTime = Date.now();
  const steps = [
    createStep("parse_intent", "Parse campaign intent from prompt"),
    createStep("collect_account_data", "Collect account performance data"),
    createStep("resolve_data", "Resolve creatives, audience, and connections"),
    createStep("build_draft", "Assemble campaign draft with reasoning"),
    createStep("preflight", "Run preflight validation checks"),
  ];

  // Create AgentJob record
  const jobId = await createAgentJob({
    agentType: "launch",
    trigger: "user_prompt",
    riskMode,
    prompt,
    approvalRequired: true,
  });

  try {
    await updateJobStatus(jobId, "collecting_data");

    // Step 1: Get account context (if available)
    steps[1] = startStep(steps[1]);
    let accountSnapshot = null;
    try {
      const connection = await getConnectionForSync();
      if (connection && connection.selectedAccounts.length > 0) {
        const adAccountId = connection.selectedAccounts[0].accessibleAdAccount.externalAdAccountId;
        accountSnapshot = await getAccountPerformanceSnapshot(adAccountId, 7);
      }
    } catch {
      // Non-fatal: proceed without account context
    }
    steps[1] = completeStep(steps[1]);

    // Step 2: Parse intent with account context
    steps[0] = startStep(steps[0]);
    await updateJobStatus(jobId, "analyzing");
    const intent = await parseCampaignIntent(prompt, { riskMode, accountSnapshot });
    steps[0] = completeStep(steps[0]);

    // Step 3: Resolve data
    steps[2] = startStep(steps[2]);
    const data = await resolveIntentData(intent);
    steps[2] = completeStep(steps[2]);

    // Step 4: Build draft with account context
    steps[3] = startStep(steps[3]);
    await updateJobStatus(jobId, "generating_recommendations");
    const draft = buildCampaignDraft(intent, data, accountSnapshot);
    steps[3] = completeStep(steps[3]);

    // Step 5: Preflight (already run inside buildCampaignDraft)
    steps[4] = startStep(steps[4]);
    steps[4] = completeStep(steps[4]);

    const durationMs = Date.now() - startTime;

    // Persist completed job
    await completeJob(jobId, {
      status: "awaiting_review",
      recommendations: [],
      draft: draft as unknown as Record<string, unknown>,
      summary: `Campaign draft "${draft.campaignName}" ready for review. ${draft.preflightResults.filter((c) => c.status === "pass").length}/${draft.preflightResults.length} preflight checks passed.`,
      dataSourcesUsed: ["MetaSyncedInsight", "ReconciliationResult", "CreativeAsset", "MetaSyncedAd", "MetaSyncedCreative"],
      steps,
      warnings: draft.reasoning.warnings,
      errors: [],
      durationMs,
    });

    return { ok: true, draft, jobId };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    await completeJob(jobId, {
      status: "failed",
      recommendations: [],
      summary: `Failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      dataSourcesUsed: [],
      steps: steps.map((s) => (s.status === "running" ? failStep(s) : s)),
      warnings: [],
      errors: [err instanceof Error ? err.message : "Failed to plan campaign"],
      durationMs,
    });
    return { ok: false, error: err instanceof Error ? err.message : "Failed to plan campaign", jobId };
  }
}

// ── Step 3: Launch approved draft ────────────────────────────────────────────

export interface LaunchDraftResult {
  ok: boolean;
  campaignId?: string;
  adSetId?: string;
  adId?: string;
  errors?: Array<{ message: string }>;
}

export async function launchApprovedDraftAction(draft: CampaignDraft): Promise<LaunchDraftResult> {
  if (draft.status !== "approved") {
    return { ok: false, errors: [{ message: "Draft must be approved before launching" }] };
  }

  const connection = await getConnectionForSync();
  if (!connection) {
    return { ok: false, errors: [{ message: "No Meta connection found" }] };
  }

  if (!draft.adAccount) {
    return { ok: false, errors: [{ message: "No ad account selected" }] };
  }

  const firstAd = draft.ads[0];
  if (!firstAd) {
    return { ok: false, errors: [{ message: "No ads in the draft" }] };
  }

  const payload: LaunchPayload = {
    campaignName: draft.campaignName,
    objective: draft.objective as LaunchPayload["objective"],
    specialAdCategories: draft.specialAdCategories as LaunchPayload["specialAdCategories"],
    campaignStatus: draft.launchMode === "active" ? "ACTIVE" : "PAUSED",
    adSetName: draft.adSetName,
    optimizationGoal: draft.optimizationGoal as LaunchPayload["optimizationGoal"],
    billingEvent: "IMPRESSIONS",
    dailyBudget: draft.dailyBudget,
    startTime: draft.startDate ? new Date(draft.startDate).toISOString() : undefined,
    endTime: draft.endDate ? new Date(draft.endDate).toISOString() : undefined,
    targeting: {
      geo_locations: {
        countries: draft.targeting.targeting.locations,
      },
      age_min: draft.targeting.targeting.ageMin,
      age_max: draft.targeting.targeting.ageMax,
      genders: draft.targeting.targeting.gender === "all" ? undefined : [draft.targeting.targeting.gender === "male" ? 1 : 2],
      ...(draft.targeting.targeting.advantagePlus ? { advantage_audience: 1 } : {}),
    },
    pixelId: draft.pixel?.id,
    conversionEvent: draft.conversionEvent ?? undefined,
    pageId: draft.page?.id ?? "",
    // First ad fields (backwards compatibility)
    primaryText: firstAd.primaryText,
    headline: firstAd.headline,
    ctaType: firstAd.ctaType,
    destinationUrl: firstAd.destinationUrl,
    mediaUrl: firstAd.creative.url ?? undefined,
    mediaType: firstAd.creative.type,
    adName: firstAd.adName,
    adStatus: draft.launchMode === "active" ? "ACTIVE" : "PAUSED",
    // All ads from the draft
    ads: draft.ads.map((ad) => ({
      adName: ad.adName,
      primaryText: ad.primaryText,
      headline: ad.headline,
      ctaType: ad.ctaType,
      destinationUrl: ad.destinationUrl,
      mediaUrl: ad.creative.url ?? undefined,
      mediaType: ad.creative.type as "image" | "video" | undefined,
    })),
    adAccountId: draft.adAccount.externalId,
    accessToken: connection.accessToken,
  };

  const launch = await prisma.campaignLaunch.create({
    data: {
      status: "launching",
      externalAdAccountId: draft.adAccount.externalId,
      campaignName: draft.campaignName,
      adSetName: draft.adSetName,
      adName: firstAd.adName,
      objective: draft.objective,
      dailyBudget: draft.dailyBudget,
      destinationUrl: firstAd.destinationUrl,
      primaryText: firstAd.primaryText,
      headline: firstAd.headline,
      ctaType: firstAd.ctaType,
      pageId: draft.page?.id ?? null,
      pixelId: draft.pixel?.id ?? null,
      conversionEvent: draft.conversionEvent,
      targetingSnapshot: JSON.stringify(draft.targeting),
      launchPayload: JSON.stringify({ ...payload, accessToken: "[REDACTED]" }),
    },
  });

  const result = await launchMetaCampaignFlow(payload);

  await prisma.campaignLaunch.update({
    where: { id: launch.id },
    data: {
      status: result.status === "success" ? "success" : "failed",
      externalCampaignId: result.campaignId ?? null,
      externalAdSetId: result.adSetId ?? null,
      externalCreativeId: result.creativeId ?? null,
      externalAdId: result.adId ?? null,
      launchResult: JSON.stringify(result),
      errorMessages: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      launchedAt: new Date(),
    },
  });

  revalidatePath("/campaign-agent");
  revalidatePath("/launch");

  if (result.status === "success") {
    return { ok: true, campaignId: result.campaignId, adSetId: result.adSetId, adId: result.adId };
  }

  return { ok: false, errors: result.errors.map((e) => ({ message: e.message })) };
}
