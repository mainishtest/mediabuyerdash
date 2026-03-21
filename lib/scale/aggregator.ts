// ─── Scale Workflow — Aggregator ──────────────────────────────────────────────
//
// Server-side data fetcher that assembles ScaleDetectionInput from DB data,
// then delegates to the pure detection logic in detect.ts.

import { prisma } from "../db";
import { buildScaleRecommendation, type ScaleDetectionInput } from "./detect";
import type { ScaleRecommendation, ScalePlan, ScaleApprovalState } from "../../types/scale";

// ── Date helpers ────────────────────────────────────────────────────────────

function dateStr(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10);
}

// ── Fetch scale recommendation for a campaign ───────────────────────────────

export async function getScaleRecommendation(
  clientAccountId: string,
  externalCampaignId: string,
): Promise<ScaleRecommendation> {
  const day1 = dateStr(1);
  const day3 = dateStr(3);

  // Parallel fetch
  const [reconRows, goalDefaults, stops] = await Promise.all([
    // 3-day reconciled performance for this campaign
    prisma.reconciledCampaignPerformance.findMany({
      where: {
        clientAccountId,
        externalCampaignId,
        dateFrom: { gte: day3 },
        dateTo:   { lte: day1 },
      },
      select: {
        metaSpend:         true,
        attributedRevenue: true,
        attributedOrders:  true,
      },
    }),

    // Client goals
    prisma.clientGoalDefaults.findFirst({
      where:  { clientAccountId },
      select: {
        targetRoas:           true,
        targetCpa:            true,
        defaultRoasGoalValue: true,
        defaultCpaGoalValue:  true,
      },
    }),

    // Check emergency stops
    prisma.governanceStop.findMany({
      where: {
        isActive: true,
        OR: [
          { scope: "global" },
          { scope: "client", scopeId: clientAccountId },
        ],
      },
      select: { id: true },
    }),
  ]);

  // Aggregate 3-day totals
  let totalSpend = 0, totalRevenue = 0, totalOrders = 0;
  for (const r of reconRows) {
    totalSpend   += r.metaSpend;
    totalRevenue += r.attributedRevenue;
    totalOrders  += r.attributedOrders;
  }

  const days = Math.max(reconRows.length, 1);
  const avgSpend3d = totalSpend / days;
  const avgRoas3d = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const avgCpa3d = totalOrders > 0 ? totalSpend / totalOrders : null;

  // Resolve goals
  const roasGoal = goalDefaults?.targetRoas ?? goalDefaults?.defaultRoasGoalValue ?? null;
  const cpaGoal  = goalDefaults?.targetCpa  ?? goalDefaults?.defaultCpaGoalValue  ?? null;

  const detectionInput: ScaleDetectionInput = {
    avgRoas3d,
    avgCpa3d,
    avgSpend3d,
    totalOrders3d:    totalOrders,
    currentDailySpend: avgSpend3d,
    roasGoal,
    cpaGoal,
    hasEmergencyStop: stops.length > 0,
    isRestricted:     false,
  };

  return buildScaleRecommendation(detectionInput);
}

// ── Build and persist a scale plan ──────────────────────────────────────────

export async function submitScalePlan(params: {
  clientAccountId:    string;
  clientName:         string;
  campaignId:         string;
  externalCampaignId: string;
  campaignName:       string;
  increasePct:        number;
  strategy:           "increase_budget" | "duplicate_adset";
  recommendation:     ScaleRecommendation;
  userId:             string | null;
  workspaceId:        string | null;
}): Promise<{ actionId: string }> {
  const projected = params.recommendation.currentDailySpend * (1 + params.increasePct / 100);

  // Persist as a proposed automation action (routes into governance queue)
  const action = await prisma.proposedAutomationAction.create({
    data: {
      workspaceId:     params.workspaceId,
      clientAccountId: params.clientAccountId,
      clientName:      params.clientName,
      actionType:      "increase_budget",
      status:          "proposed",
      priority:        "high",
      entityType:      "campaign",
      entityId:        params.externalCampaignId,
      entityName:      params.campaignName,
      rationale:       params.recommendation.reasoning,
      supportingData:  JSON.stringify({
        strategy:          params.strategy,
        increasePct:       params.increasePct,
        currentDailySpend: params.recommendation.currentDailySpend,
        projectedDailySpend: projected,
        avgRoas3d:         params.recommendation.guardrails.find(g => g.metric === "roas")?.actual ?? "—",
        confidence:        params.recommendation.confidence,
        guardrailsPassed:  params.recommendation.guardrails.filter(g => g.status === "pass").length,
        guardrailsTotal:   params.recommendation.guardrails.length,
      }),
      deduplicationKey: `${params.clientAccountId}:increase_budget:${params.externalCampaignId}`,
      expiresAt:        new Date(Date.now() + 48 * 3600e3), // 48h expiry
    },
  });

  return { actionId: action.id };
}
