// lib/meta/clientMetaService.ts
// Client-scoped Meta campaign data service.
// Queries synced campaigns/adsets/ads for all Meta ad accounts mapped to a client.

import { prisma } from "../db";

// ── Public types ──────────────────────────────────────────────────────────────

export type ClientMetaCampaignRow = {
  id:                  string;
  externalCampaignId:  string;
  externalAdAccountId: string;
  name:                string;
  status:              string;
  objective:           string | null;
  totalSpend:          number; // summed from insights (last 30 days)
  totalImpressions:    number;
  totalClicks:         number;
  updatedAt:           Date;
};

export type ClientMetaStats = {
  mappedAccountCount: number;
  campaignCount:      number;
  adSetCount:         number;
  adCount:            number;
  lastSyncAt:         Date | null;
};

export type ClientMetaData = {
  stats:      ClientMetaStats;
  campaigns:  ClientMetaCampaignRow[];
  /** false = no MetaSelectedAdAccount rows are mapped to this client */
  hasMapping: boolean;
  /** false = accounts are mapped but no campaigns have been synced yet */
  hasSynced:  boolean;
};

// ── Query ──────────────────────────────────────────────────────────────────────

/**
 * Returns all synced Meta campaign data scoped to a single client.
 * Data is sourced from MetaSyncedCampaign + MetaSyncedInsight (last 30 days).
 */
export async function getClientMetaData(
  clientId:    string,
  workspaceId?: string | null
): Promise<ClientMetaData> {
  // 1. Find selected accounts mapped to this client
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where: { clientAccountId: clientId },
    include: { accessibleAdAccount: true },
  });

  if (selectedAccounts.length === 0) {
    return {
      hasMapping: false,
      hasSynced:  false,
      stats: {
        mappedAccountCount: 0,
        campaignCount:      0,
        adSetCount:         0,
        adCount:            0,
        lastSyncAt:         null,
      },
      campaigns: [],
    };
  }

  const externalAdAccountIds = selectedAccounts.map(
    (a) => a.accessibleAdAccount.externalAdAccountId
  );

  // Workspace filter — include legacy rows where workspaceId is null
  const wsFilter = workspaceId
    ? { OR: [{ workspaceId }, { workspaceId: null as string | null }] }
    : {};

  const accountFilter = { externalAdAccountId: { in: externalAdAccountIds } };
  const baseWhere     = { ...accountFilter, ...wsFilter };

  // 2. Parallel fetch: campaigns, adset count, ad count
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString().slice(0, 10); // "YYYY-MM-DD"

  const [campaigns, adSetCount, adCount, insightGroups] = await Promise.all([
    prisma.metaSyncedCampaign.findMany({
      where:   baseWhere,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.metaSyncedAdSet.count({ where: baseWhere }),
    prisma.metaSyncedAd.count({ where: baseWhere }),
    // Aggregate insight spend/impressions/clicks per campaign (last 30 days)
    prisma.metaSyncedInsight.groupBy({
      by:    ["externalCampaignId"],
      where: {
        ...baseWhere,
        dateStart:          { gte: since },
        externalCampaignId: { not: "" },
      },
      _sum: {
        spend:       true,
        impressions: true,
        clicks:      true,
      },
    }),
  ]);

  const hasSynced = campaigns.length > 0;

  // 3. Find last sync timestamp from MetaSyncLog via connection
  const connections = await prisma.metaConnection.findMany({
    where: {
      selectedAccounts: {
        some: { clientAccountId: clientId },
      },
    },
    include: {
      syncLogs: {
        where:   { status: { in: ["completed", "partial"] } },
        orderBy: { completedAt: "desc" },
        take:    1,
      },
    },
  });

  let lastSyncAt: Date | null = null;
  for (const conn of connections) {
    const log = conn.syncLogs[0];
    if (log?.completedAt && (!lastSyncAt || log.completedAt > lastSyncAt)) {
      lastSyncAt = log.completedAt;
    }
  }

  // 4. Build spend map: externalCampaignId → aggregated metrics
  const insightMap = new Map<
    string,
    { spend: number; impressions: number; clicks: number }
  >();
  for (const row of insightGroups) {
    const s = row._sum as { spend?: number | null; impressions?: number | null; clicks?: number | null } | undefined;
    insightMap.set(row.externalCampaignId, {
      spend:       s?.spend       ?? 0,
      impressions: s?.impressions ?? 0,
      clicks:      s?.clicks      ?? 0,
    });
  }

  // 5. Build final campaign rows
  const campaignRows: ClientMetaCampaignRow[] = campaigns.map((c) => {
    const metrics = insightMap.get(c.externalCampaignId);
    return {
      id:                  c.id,
      externalCampaignId:  c.externalCampaignId,
      externalAdAccountId: c.externalAdAccountId,
      name:                c.name,
      status:              c.status,
      objective:           c.objective,
      totalSpend:          metrics?.spend       ?? 0,
      totalImpressions:    metrics?.impressions ?? 0,
      totalClicks:         metrics?.clicks      ?? 0,
      updatedAt:           c.updatedAt,
    };
  });

  return {
    hasMapping: true,
    hasSynced,
    stats: {
      mappedAccountCount: selectedAccounts.length,
      campaignCount:      campaigns.length,
      adSetCount,
      adCount,
      lastSyncAt,
    },
    campaigns: campaignRows,
  };
}
