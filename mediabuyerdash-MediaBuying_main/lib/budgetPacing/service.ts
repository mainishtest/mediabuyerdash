// lib/budgetPacing/service.ts
// Database layer for budget pacing: target CRUD + snapshot building.
//
// Spend source: MetaSyncedInsight — same source as the campaign performance
// aggregator, filtered to the current calendar month by dateStart.
//
// Budget targets are stored in BudgetPacingTarget:
//   campaignId = null  → client-level target
//   campaignId = set   → campaign-level target (externalCampaignId)
//
// Application-level upsert (findFirst + update/create) is used because
// PostgreSQL treats NULLs as distinct in unique indexes, making @@unique
// on a nullable column unsafe for compound lookups.

import { prisma } from "../db";
import {
  buildBudgetPacingSnapshot,
  getCurrentMonthDateStrings,
} from "./calculations";
import type {
  BudgetPacingSnapshot,
  ClientPacingSummary,
} from "./types";

// ── Input types ───────────────────────────────────────────────────────────────

export interface BudgetTargetInput {
  monthlyBudget: number;
  dailyBudget?:  number | null;
}

// ── Budget target CRUD ────────────────────────────────────────────────────────

export async function getClientBudgetTarget(clientId: string) {
  return prisma.budgetPacingTarget.findFirst({
    where: { clientAccountId: clientId, campaignId: null },
  });
}

export async function getCampaignBudgetTarget(
  clientId:   string,
  campaignId: string
) {
  return prisma.budgetPacingTarget.findFirst({
    where: { clientAccountId: clientId, campaignId },
  });
}

export async function getAllBudgetTargets(clientId: string) {
  return prisma.budgetPacingTarget.findMany({
    where: { clientAccountId: clientId },
    orderBy: { createdAt: "asc" },
  });
}

export async function upsertClientBudgetTarget(
  clientId: string,
  input:    BudgetTargetInput
) {
  const existing = await getClientBudgetTarget(clientId);
  if (existing) {
    return prisma.budgetPacingTarget.update({
      where: { id: existing.id },
      data: {
        monthlyBudget: input.monthlyBudget,
        dailyBudget:   input.dailyBudget ?? null,
        updatedAt:     new Date(),
      },
    });
  }
  return prisma.budgetPacingTarget.create({
    data: {
      clientAccountId: clientId,
      campaignId:      null,
      monthlyBudget:   input.monthlyBudget,
      dailyBudget:     input.dailyBudget ?? null,
    },
  });
}

export async function upsertCampaignBudgetTarget(
  clientId:   string,
  campaignId: string,
  input:      BudgetTargetInput
) {
  const existing = await getCampaignBudgetTarget(clientId, campaignId);
  if (existing) {
    return prisma.budgetPacingTarget.update({
      where: { id: existing.id },
      data: {
        monthlyBudget: input.monthlyBudget,
        dailyBudget:   input.dailyBudget ?? null,
        updatedAt:     new Date(),
      },
    });
  }
  return prisma.budgetPacingTarget.create({
    data: {
      clientAccountId: clientId,
      campaignId,
      monthlyBudget:   input.monthlyBudget,
      dailyBudget:     input.dailyBudget ?? null,
    },
  });
}

// ── Spend helpers ─────────────────────────────────────────────────────────────

/**
 * Returns spend totals for the current month, keyed by externalCampaignId.
 * Filters MetaSyncedInsight by dateStart within the current calendar month.
 */
async function getMonthlySpendByCampaign(
  externalAdAccountIds: string[]
): Promise<Map<string, number>> {
  if (externalAdAccountIds.length === 0) return new Map();

  const { fromDate, toDate } = getCurrentMonthDateStrings();

  const rows = await prisma.metaSyncedInsight.groupBy({
    by:    ["externalCampaignId"],
    where: {
      externalAdAccountId: { in: externalAdAccountIds },
      dateStart:           { gte: fromDate, lte: toDate },
    },
    _sum: { spend: true },
  });

  return new Map(
    rows.map((r) => [r.externalCampaignId, r._sum.spend ?? 0])
  );
}

/**
 * Resolves externalAdAccountIds for a client.
 */
async function getAdAccountIds(clientId: string): Promise<string[]> {
  const selected = await prisma.metaSelectedAdAccount.findMany({
    where:   { clientAccountId: clientId },
    include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
  });
  return selected.map((a) => a.accessibleAdAccount.externalAdAccountId);
}

// ── Snapshot builders ─────────────────────────────────────────────────────────

/**
 * Builds a client-level pacing snapshot.
 * Client spend = sum of all campaign spend for the month.
 */
export async function buildClientPacingSnapshot(
  clientId:   string,
  clientName: string
): Promise<BudgetPacingSnapshot> {
  const [adAccountIds, clientTarget] = await Promise.all([
    getAdAccountIds(clientId),
    getClientBudgetTarget(clientId),
  ]);

  const spendMap   = await getMonthlySpendByCampaign(adAccountIds);
  const spendTotal = Array.from(spendMap.values()).reduce((a, b) => a + b, 0);

  return buildBudgetPacingSnapshot({
    entityType:      "client",
    entityId:        clientId,
    entityName:      clientName,
    clientAccountId: clientId,
    monthlyBudget:   clientTarget?.monthlyBudget ?? null,
    dailyBudget:     clientTarget?.dailyBudget   ?? null,
    spendToDate:     spendTotal,
  });
}

/**
 * Builds campaign-level pacing snapshots for campaigns that have budget targets.
 */
export async function buildCampaignPacingSnapshots(
  clientId: string
): Promise<BudgetPacingSnapshot[]> {
  const [adAccountIds, targets] = await Promise.all([
    getAdAccountIds(clientId),
    prisma.budgetPacingTarget.findMany({
      where: { clientAccountId: clientId, campaignId: { not: null } },
    }),
  ]);

  if (targets.length === 0) return [];

  const spendMap = await getMonthlySpendByCampaign(adAccountIds);

  // Fetch campaign names for display
  const campaignIds = targets.map((t) => t.campaignId!);
  const campaigns   = await prisma.metaSyncedCampaign.findMany({
    where:  { externalCampaignId: { in: campaignIds } },
    select: { externalCampaignId: true, name: true },
  });
  const nameById = new Map(campaigns.map((c) => [c.externalCampaignId, c.name]));

  return targets.map((t) => {
    const campaignId = t.campaignId!;
    return buildBudgetPacingSnapshot({
      entityType:      "campaign",
      entityId:        campaignId,
      entityName:      nameById.get(campaignId) ?? campaignId,
      clientAccountId: clientId,
      monthlyBudget:   t.monthlyBudget,
      dailyBudget:     t.dailyBudget ?? null,
      spendToDate:     spendMap.get(campaignId) ?? 0,
    });
  });
}

/**
 * Builds pacing summaries for all clients in a workspace.
 * Used by the /pacing page and the Operations risk section.
 */
export async function buildAllClientsPacingSummaries(
  workspaceId: string | null
): Promise<ClientPacingSummary[]> {
  const clients = await prisma.clientAccount.findMany({
    where:   workspaceId ? { workspaceId } : {},
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (clients.length === 0) return [];

  // Load all budget targets at once
  const allTargets = await prisma.budgetPacingTarget.findMany({
    where: { clientAccountId: { in: clients.map((c) => c.id) } },
  });

  // Map: clientId → client-level target (campaignId = null)
  const clientTargetMap = new Map(
    allTargets
      .filter((t) => t.campaignId === null)
      .map((t) => [t.clientAccountId, t])
  );

  // Map: clientId → campaign targets
  const campaignTargetsByClient = new Map<string, typeof allTargets>();
  for (const t of allTargets.filter((t) => t.campaignId !== null)) {
    const arr = campaignTargetsByClient.get(t.clientAccountId) ?? [];
    arr.push(t);
    campaignTargetsByClient.set(t.clientAccountId, arr);
  }

  // Get all ad account IDs across all clients
  const allSelected = await prisma.metaSelectedAdAccount.findMany({
    where:   { clientAccountId: { in: clients.map((c) => c.id) } },
    include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
  });

  // Map: clientId → adAccountIds (skip rows with null clientAccountId)
  const adAccountsByClient = new Map<string, string[]>();
  for (const sel of allSelected) {
    if (!sel.clientAccountId) continue;
    const arr = adAccountsByClient.get(sel.clientAccountId) ?? [];
    arr.push(sel.accessibleAdAccount.externalAdAccountId);
    adAccountsByClient.set(sel.clientAccountId, arr);
  }

  const allAdAccountIds = [...new Set(allSelected.map((s) => s.accessibleAdAccount.externalAdAccountId))];

  // Single spend query across all ad accounts for the current month
  const { fromDate, toDate } = getCurrentMonthDateStrings();
  const insightAggs = allAdAccountIds.length > 0
    ? await prisma.metaSyncedInsight.groupBy({
        by:    ["externalAdAccountId", "externalCampaignId"],
        where: {
          externalAdAccountId: { in: allAdAccountIds },
          dateStart:           { gte: fromDate, lte: toDate },
        },
        _sum:  { spend: true },
      })
    : [];

  // Map: adAccountId → set of campaignIds → spend
  const spendByAdAndCampaign = new Map<string, Map<string, number>>();
  for (const row of insightAggs) {
    const byAccount = spendByAdAndCampaign.get(row.externalAdAccountId) ?? new Map();
    byAccount.set(row.externalCampaignId, (byAccount.get(row.externalCampaignId) ?? 0) + (row._sum.spend ?? 0));
    spendByAdAndCampaign.set(row.externalAdAccountId, byAccount);
  }

  // Fetch all campaign names for campaign-level targets
  const allCampaignIds = allTargets
    .filter((t) => t.campaignId !== null)
    .map((t) => t.campaignId!);
  const allCampaigns = allCampaignIds.length > 0
    ? await prisma.metaSyncedCampaign.findMany({
        where:  { externalCampaignId: { in: allCampaignIds } },
        select: { externalCampaignId: true, name: true },
      })
    : [];
  const campaignNameById = new Map(allCampaigns.map((c) => [c.externalCampaignId, c.name]));

  // Build per-client summaries
  return clients.map((client): ClientPacingSummary => {
    const adAccountIds    = adAccountsByClient.get(client.id) ?? [];
    const clientTarget    = clientTargetMap.get(client.id) ?? null;
    const campaignTargets = campaignTargetsByClient.get(client.id) ?? [];

    // Sum all campaign spend for this client's ad accounts
    let totalClientSpend = 0;
    for (const adId of adAccountIds) {
      const byAccount = spendByAdAndCampaign.get(adId);
      if (!byAccount) continue;
      for (const spend of byAccount.values()) totalClientSpend += spend;
    }

    const clientSnapshot = buildBudgetPacingSnapshot({
      entityType:      "client",
      entityId:        client.id,
      entityName:      client.name,
      clientAccountId: client.id,
      monthlyBudget:   clientTarget?.monthlyBudget ?? null,
      dailyBudget:     clientTarget?.dailyBudget   ?? null,
      spendToDate:     totalClientSpend,
    });

    const campaignSnapshots = campaignTargets.map((t) => {
      const cid = t.campaignId!;
      // Find spend for this campaign across client's ad accounts
      let campSpend = 0;
      for (const adId of adAccountIds) {
        campSpend += spendByAdAndCampaign.get(adId)?.get(cid) ?? 0;
      }
      return buildBudgetPacingSnapshot({
        entityType:      "campaign",
        entityId:        cid,
        entityName:      campaignNameById.get(cid) ?? cid,
        clientAccountId: client.id,
        monthlyBudget:   t.monthlyBudget,
        dailyBudget:     t.dailyBudget ?? null,
        spendToDate:     campSpend,
      });
    });

    return { clientId: client.id, clientName: client.name, clientSnapshot, campaignSnapshots };
  });
}

/**
 * Returns the worst-pacing client snapshots for the Operations page risk section.
 * Sorted by deviation from target (over_pacing first, then under_pacing, most severe first).
 */
export async function loadTopPacingRisks(
  workspaceId: string | null,
  limit = 5
): Promise<BudgetPacingSnapshot[]> {
  const summaries = await buildAllClientsPacingSummaries(workspaceId);

  const risky = summaries
    .map((s) => s.clientSnapshot)
    .filter((s) => s.pacingStatus === "over_pacing" || s.pacingStatus === "under_pacing")
    .sort((a, b) => {
      // Sort by distance from 100% pacing, most severe first
      const deviationA = Math.abs(a.pacingPercent - 100);
      const deviationB = Math.abs(b.pacingPercent - 100);
      return deviationB - deviationA;
    });

  return risky.slice(0, limit);
}
