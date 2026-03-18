// lib/campaignPerformance/aggregator.ts
// Builds CampaignPerformanceSnapshot[] for a client by joining:
//   - MetaSyncedCampaign + MetaSyncedInsight  → delivery metrics (spend)
//   - ShopifyOrder                            → CRM revenue + orders (source of truth)
//   - MetaCampaignGoal                        → explicit campaign-level goal targets
//   - ClientGoalDefaults                      → fallback goals when no explicit goal set
//
// MEASUREMENT POLICY: evaluatedRoas and evaluatedCpa use CRM figures only.
// GOAL RESOLUTION ORDER: explicit goal → client default → no goal
// (centralised in lib/campaignGoals/resolveGoal.ts)

import { prisma } from "../db";
import { evaluateCampaignAgainstGoals } from "./evaluator";
import { summarizeCampaignRecommendation } from "./recommendations";
import { resolveGoal } from "../campaignGoals/resolveGoal";
import type { CampaignPerformanceSnapshot, CampaignHealthStatus } from "./types";

export async function buildCampaignPerformanceSnapshots(
  clientId:  string,
  startDate?: string,   // YYYY-MM-DD inclusive; defaults to all-time
  endDate?:   string,   // YYYY-MM-DD inclusive; defaults to today
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

  // ── 3–6. Parallel fetch ──────────────────────────────────────────────────────

  // Build date filters for insight and order queries
  const insightDateFilter = startDate || endDate
    ? {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate   ? { lte: endDate   } : {}),
      }
    : undefined;

  const orderDateFilter = startDate || endDate
    ? {
        ...(startDate ? { gte: new Date(startDate + "T00:00:00.000Z") } : {}),
        ...(endDate   ? { lte: new Date(endDate   + "T23:59:59.999Z") } : {}),
      }
    : undefined;

  const [insightAggs, shopifyOrders, campaignGoals, clientDefaults] = await Promise.all([
    // 3. Spend aggregated by campaign from insight rows
    prisma.metaSyncedInsight.groupBy({
      by:    ["externalCampaignId"],
      where: {
        externalAdAccountId: { in: externalAdAccountIds },
        ...(insightDateFilter ? { dateStart: insightDateFilter } : {}),
      },
      _sum:  { spend: true },
    }),

    // 4. Shopify orders for this client (CRM source of truth)
    prisma.shopifyOrder.findMany({
      where: {
        clientAccountId: clientId,
        ...(orderDateFilter ? { orderCreatedAt: orderDateFilter } : {}),
      },
      select: { utmCampaign: true, totalPrice: true },
    }),

    // 5. Explicit campaign goals
    prisma.metaCampaignGoal.findMany({
      where: { externalCampaignId: { in: externalCampaignIds } },
    }),

    // 6. Client-level default goals (fallback)
    prisma.clientGoalDefaults.findUnique({
      where: { clientAccountId: clientId },
    }),
  ]);

  // ── Build lookup maps ────────────────────────────────────────────────────────

  const spendById: Record<string, number> = Object.fromEntries(
    insightAggs.map((r) => [r.externalCampaignId, r._sum.spend ?? 0])
  );

  const crmByName: Record<string, { revenue: number; orders: number }> = {};
  for (const order of shopifyOrders) {
    const key = (order.utmCampaign ?? "").toLowerCase().trim();
    if (!key) continue;
    crmByName[key] ??= { revenue: 0, orders: 0 };
    crmByName[key].revenue += order.totalPrice;
    crmByName[key].orders  += 1;
  }

  const explicitGoalsById = new Map(
    campaignGoals.map((g) => [g.externalCampaignId, g])
  );

  // ── Build a snapshot for every synced campaign ────────────────────────────────
  return metaCampaigns.map((mc): CampaignPerformanceSnapshot => {
    const metaSpend = spendById[mc.externalCampaignId] ?? 0;
    const nameKey   = mc.name.toLowerCase().trim();
    const crm       = crmByName[nameKey] ?? { revenue: 0, orders: 0 };

    const evaluatedRoas = metaSpend > 0 ? crm.revenue / metaSpend : 0;
    const evaluatedCpa  = crm.orders > 0 ? metaSpend / crm.orders  : 0;

    // Centralised goal resolution: explicit → client default → none
    const resolved = resolveGoal(
      explicitGoalsById.get(mc.externalCampaignId) ?? null,
      clientDefaults
    );

    const hasGoal    = resolved !== null;
    const goalSource = resolved?.goalSource ?? "none";

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
        roasGoalValue: resolved!.roasGoalValue,
        roasGoalType:  resolved!.roasGoalType,
        cpaGoalValue:  resolved!.cpaGoalValue,
        cpaGoalType:   resolved!.cpaGoalType,
      });
      healthStatus  = ev.healthStatus;
      meetsRoasGoal = ev.meetsRoasGoal;
      meetsCpaGoal  = ev.meetsCpaGoal;
    }

    const recommendation = summarizeCampaignRecommendation(
      healthStatus,
      meetsRoasGoal,
      meetsCpaGoal,
      {
        evaluatedRoas,
        evaluatedCpa,
        roasGoalValue: resolved?.roasGoalValue ?? null,
        cpaGoalValue:  resolved?.cpaGoalValue  ?? null,
      }
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
      roasGoalValue:      resolved?.roasGoalValue ?? null,
      roasGoalType:       resolved?.roasGoalType  ?? null,
      cpaGoalValue:       resolved?.cpaGoalValue  ?? null,
      cpaGoalType:        resolved?.cpaGoalType   ?? null,
      meetsRoasGoal,
      meetsCpaGoal,
      healthStatus,
      recommendation,
      hasGoal,
      goalSource,
      dataWindowDays: 7,
    };
  });
}
