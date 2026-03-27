// lib/meta/metaImportStatus.ts
// Read-only diagnostic query for the full Meta import pipeline for a client.
// Checks every stage: connection → selection → client mapping → sync → DB counts → dashboard.
// Used by MetaImportDebugPanel to show exactly where the chain is broken.

import { prisma } from "../db";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MetaImportStatusAccount {
  id:                  string;  // MetaSelectedAdAccount.id
  externalAdAccountId: string;
  accountName:         string;
  clientAccountId:     string | null;
}

export interface MetaImportStatusLastSync {
  id:               string;
  status:           string;
  campaignsSynced:  number;
  adSetsSynced:     number;
  adsSynced:        number;
  insightRows:      number;
  errorMessages:    string | null;
  startedAt:        string; // ISO string
  completedAt:      string | null;
}

export interface MetaImportStatus {
  // Stage 1: workspace Meta connection
  connectionOk:     boolean;
  connectionId:     string | null;
  connectionStatus: string | null;
  userDisplayName:  string | null;

  // Stage 2: ad accounts available in workspace
  accessibleCount:  number;

  // Stage 3: accounts marked as selected
  selectedAccounts: MetaImportStatusAccount[];

  // Stage 4: accounts mapped to THIS client
  mappedAccounts:   Array<{ externalAdAccountId: string; accountName: string }>;

  // Stage 5: last sync log
  lastSync:         MetaImportStatusLastSync | null;

  // Stage 6: rows in DB for this client's accounts
  syncedCampaigns:  number;
  syncedAdSets:     number;
  syncedAds:        number;
  syncedInsights:   number;

  // Stage 7: dashboard query outcome
  dashboardHasMapping: boolean;
  dashboardHasSynced:  boolean;
}

// ── Query ──────────────────────────────────────────────────────────────────────

export async function getMetaImportStatus(
  clientId:     string,
  workspaceId?: string | null
): Promise<MetaImportStatus> {
  // Load connection with all selected accounts + last sync log
  const connection = await prisma.metaConnection.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      accessibleAccounts: { select: { id: true } },
      selectedAccounts: {
        include: { accessibleAdAccount: { select: { externalAdAccountId: true, accountName: true } } },
      },
      syncLogs: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });

  const connectionOk = connection?.connectionStatus === "active";

  const selectedAccounts: MetaImportStatusAccount[] = (connection?.selectedAccounts ?? []).map((a) => ({
    id:                  a.id,
    externalAdAccountId: a.accessibleAdAccount.externalAdAccountId,
    accountName:         a.accessibleAdAccount.accountName,
    clientAccountId:     a.clientAccountId,
  }));

  const mappedAccounts = selectedAccounts
    .filter((a) => a.clientAccountId === clientId)
    .map((a) => ({
      externalAdAccountId: a.externalAdAccountId,
      accountName:         a.accountName,
    }));

  const lastSyncLogRaw = connection?.syncLogs[0] ?? null;
  const lastSync: MetaImportStatusLastSync | null = lastSyncLogRaw
    ? {
        id:               lastSyncLogRaw.id,
        status:           lastSyncLogRaw.status,
        campaignsSynced:  lastSyncLogRaw.campaignsSynced,
        adSetsSynced:     lastSyncLogRaw.adSetsSynced,
        adsSynced:        lastSyncLogRaw.adsSynced,
        insightRows:      lastSyncLogRaw.insightRowsSynced,
        errorMessages:    lastSyncLogRaw.errorMessages,
        startedAt:        lastSyncLogRaw.startedAt.toISOString(),
        completedAt:      lastSyncLogRaw.completedAt?.toISOString() ?? null,
      }
    : null;

  // Synced entity counts filtered to this client's mapped accounts
  const externalAdAccountIds = mappedAccounts.map((a) => a.externalAdAccountId);

  const wsFilter = workspaceId
    ? { OR: [{ workspaceId }, { workspaceId: null as string | null }] }
    : {};
  const accountFilter = externalAdAccountIds.length > 0
    ? { externalAdAccountId: { in: externalAdAccountIds } }
    : { id: "NO_MATCH_INTENTIONAL" };

  const baseWhere = { ...accountFilter, ...wsFilter };

  const [syncedCampaigns, syncedAdSets, syncedAds, syncedInsights] =
    externalAdAccountIds.length > 0
      ? await Promise.all([
          prisma.metaSyncedCampaign.count({ where: baseWhere }),
          prisma.metaSyncedAdSet.count({   where: baseWhere }),
          prisma.metaSyncedAd.count({      where: baseWhere }),
          prisma.metaSyncedInsight.count({ where: baseWhere }),
        ])
      : [0, 0, 0, 0];

  return {
    connectionOk,
    connectionId:     connection?.id ?? null,
    connectionStatus: connection?.connectionStatus ?? null,
    userDisplayName:  connection?.userDisplayName ?? null,

    accessibleCount:  connection?.accessibleAccounts.length ?? 0,
    selectedAccounts,
    mappedAccounts,
    lastSync,

    syncedCampaigns,
    syncedAdSets,
    syncedAds,
    syncedInsights,

    dashboardHasMapping: mappedAccounts.length > 0,
    dashboardHasSynced:  syncedCampaigns > 0,
  };
}
