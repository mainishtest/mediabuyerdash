// lib/campaignPerformance/aggregator.ts
// Builds CampaignPerformanceSnapshot[] for a client by joining:
//   - MetaSyncedCampaign + MetaSyncedInsight  → delivery metrics (spend)
//   - ShopifyOrder                            → CRM revenue + orders (source of truth)
//   - MetaCampaignGoal                        → goal targets (direct link by externalCampaignId)
//
// MEASUREMENT POLICY: evaluatedRoas and evaluatedCpa use CRM figures only.
// Meta data provides spend; Shopify provides the revenue and order count.
//
// GOAL LINKING: Goals are read from MetaCampaignGoal (direct FK on externalCampaignId).
// This replaces the previous name-based join through internal Campaign records.

import { prisma } from "../db";
import { evaluateCampaignAgainstGoals } from "./evaluator";
import { summarizeCampaignRecommendation } from "./recommendations";
import type { CampaignPerformanceSnapshot, CampaignHealthStatus } from "./types";

export async function buildCampaignPerformanceSnapshots(
  clientId: string
): Promise<CampaignPerformanceSnapshot[]> {
  // ── 1. Client's mapped Meta ad account IDs ───────────────────────────────────
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where:   { clientAccountId: clientId },
    include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
  });

  const externalAdAccountIds = selectedAccounts.map(
    (a) => a.accessibleAdAccount.externalAdAccountId
  );

  if (externalAdAccountIds.length === 0) return [];

  // ── 2. Synced campaigns for this client's ad accounts ────────────────────────
  const metaCampaigns = await prisma.metaSyncedCampaign.findMany({
    where: { externalAdAccountId: { in: externalAdAccountIds } },
  });

  if (metaCampaigns.length === 0) return [];

  const externalCampaignIds = metaCampaigns.map((c) => c.externalCampaignId);

  // ── 3–5. Parallel fetch ──────────────────────────────────────────────────────
  const [insightAggs, shopifyOrders, campaignGoals] = await Promise.all([
    // 3. Spend aggregated by campaign from insight rows
    prisma.metaSyncedInsight.groupBy({
      by:    ["externalCampaignId"],
      where: { externalAdAccountId: { in: externalAdAccountIds } },
      _sum:  { spend: true },
    }),

    // 4. Shopify orders for this client (CRM source of truth)
    prisma.shopifyOrder.findMany({
      where:  { clientAccountId: clientId },
      select: { utmCampaign: true, totalPrice: true },
    }),

    // 5. Goals — direct lookup via MetaCampaignGoal (no name matching needed)
    prisma.metaCampaignGoal.findMany({
      where: { externalCampaignId: { in: externalCampaignIds } },
    }),
  ]);

  // ── Build lookup maps ────────────────────────────────────────────────────────

  // Spend by externalCampaignId
  const spendById: Record<string, number> = Object.fromEntries(
    insightAggs.map((r) => [r.externalCampaignId, r._sum.spend ?? 0])
  );

  // CRM aggregation by normalized campaign name (utmCampaign → revenue + orders)
  const crmByName: Record<string, { revenue: number; orders: number }> = {};
  for (const order of shopifyOrders) {
    const key = (order.utmCampaign ?? "").toLowerCase().trim();
    if (!key) continue;
    crmByName[key] ??= { revenue: 0, orders: 0 };
    crmByName[key].revenue += order.totalPrice;
    crmByName[key].orders  += 1;
  }

  // Goals by externalCampaignId (direct, reliable link)
  type GoalRow = {
    roasGoalType:  string;
    roasGoalValue: number;
    cpaGoalType:   string;
    cpaGoalValue:  number;
  };
  const goalsById: Record<string, GoalRow> = Object.fromEntries(
    campaignGoals.map((g) => [g.externalCampaignId, g])
  );

  // ── Build a snapshot for every synced campaign ────────────────────────────────
  return metaCampaigns.map((mc): CampaignPerformanceSnapshot => {
    const metaSpend = spendById[mc.externalCampaignId] ?? 0;
    const nameKey   = mc.name.toLowerCase().trim();
    const crm       = crmByName[nameKey] ?? { revenue: 0, orders: 0 };
    const goal      = goalsById[mc.externalCampaignId] ?? null;

    // CRM-sourced metrics (product rule: CRM is source of truth for ROAS/CPA)
    const evaluatedRoas = metaSpend > 0 ? crm.revenue / metaSpend : 0;
    const evaluatedCpa  = crm.orders > 0 ? metaSpend / crm.orders  : 0;

    const hasGoal = goal !== null;

    // Determine health status before calling evaluator
    let healthStatus:  CampaignHealthStatus = "no_data";
    let meetsRoasGoal = false;
    let meetsCpaGoal  = false;

    if (!hasGoal) {
      healthStatus = "no_goal";
    } else if (metaSpend === 0) {
      healthStatus = "stale";
    } else {
      const ev = evaluateCampaignAgainstGoals({
        evaluatedRoas,
        evaluatedCpa,
        roasGoalValue: goal.roasGoalValue,
        roasGoalType:  goal.roasGoalType as "high" | "low",
        cpaGoalValue:  goal.cpaGoalValue,
        cpaGoalType:   goal.cpaGoalType  as "high" | "low",
      });
      healthStatus  = ev.healthStatus;
      meetsRoasGoal = ev.meetsRoasGoal;
      meetsCpaGoal  = ev.meetsCpaGoal;
    }

    const partial = {
      evaluatedRoas,
      evaluatedCpa,
      roasGoalValue: goal?.roasGoalValue ?? null,
      cpaGoalValue:  goal?.cpaGoalValue  ?? null,
    };

    const recommendation = summarizeCampaignRecommendation(
      healthStatus,
      meetsRoasGoal,
      meetsCpaGoal,
      partial
    );

    return {
      clientAccountId:    clientId,
      campaignId:         mc.id,
      externalCampaignId: mc.externalCampaignId,
      campaignName:       mc.name,
      campaignStatus:     mc.status,
      metaSpend,
      crmRevenue:         crm.revenue,
      crmOrders:          crm.orders,
      evaluatedCpa,
      evaluatedRoas,
      roasGoalValue:      goal?.roasGoalValue ?? null,
      roasGoalType:       (goal?.roasGoalType ?? null) as "high" | "low" | null,
      cpaGoalValue:       goal?.cpaGoalValue  ?? null,
      cpaGoalType:        (goal?.cpaGoalType  ?? null) as "high" | "low" | null,
      meetsRoasGoal,
      meetsCpaGoal,
      healthStatus,
      recommendation,
      hasGoal,
      dataWindowDays: 7,
    };
  });
}
