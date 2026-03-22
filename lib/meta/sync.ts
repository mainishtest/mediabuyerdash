import { prisma }                                  from "../db";
import { getConnectionForSync }                    from "./db";
import { fetchCampaigns, fetchAdSets, fetchAds, fetchInsights, isTokenError } from "./api";
import { mapCampaign, mapAdSet, mapAd, mapCreative, mapInsight } from "./mappers";
import {
  createSyncLog,
  completeSyncLog,
  upsertCampaigns,
  upsertAdSets,
  upsertAds,
  upsertCreatives,
  replaceInsights,
} from "./syncDb";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SyncMode = "recent" | "daily_full";

export interface SyncSummary {
  status:            "completed" | "partial" | "failed" | "no_accounts" | "token_expired";
  accountsProcessed: number;
  campaignsSynced:   number;
  adSetsSynced:      number;
  adsSynced:         number;
  creativesSynced:   number;
  insightRowsSynced: number;
  errors:            string[];
  startedAt:         string;
  completedAt:       string;
  mode:              SyncMode;
}

// ── Per-account sync ──────────────────────────────────────────────────────────

async function syncAccount(
  externalAdAccountId: string,
  accessToken: string,
  workspaceId: string | null,
  counts: {
    campaignsSynced:   number;
    adSetsSynced:      number;
    adsSynced:         number;
    creativesSynced:   number;
    insightRowsSynced: number;
  },
  dayRange = 7
): Promise<void> {
  // Campaigns
  const rawCampaigns = await fetchCampaigns(externalAdAccountId, accessToken);
  const mappedCampaigns = rawCampaigns.map((c) =>
    mapCampaign(c, externalAdAccountId, workspaceId)
  );
  counts.campaignsSynced += await upsertCampaigns(mappedCampaigns);

  // Ad sets
  const rawAdSets = await fetchAdSets(externalAdAccountId, accessToken);
  const mappedAdSets = rawAdSets.map((a) =>
    mapAdSet(a, externalAdAccountId, workspaceId)
  );
  counts.adSetsSynced += await upsertAdSets(mappedAdSets);

  // Ads (with embedded creative data)
  const rawAds = await fetchAds(externalAdAccountId, accessToken);
  const mappedAds = rawAds.map((a) => mapAd(a, externalAdAccountId, workspaceId));
  counts.adsSynced += await upsertAds(mappedAds);

  // Creatives extracted from ad responses
  const rawCreatives = rawAds
    .filter((a) => a.creative?.id)
    .map((a) => a.creative!);
  const mappedCreatives = rawCreatives.map((c) => mapCreative(c, workspaceId));
  counts.creativesSynced += await upsertCreatives(mappedCreatives);

  // Insights — configurable day range (7 for recent, 30 for daily full)
  const { rows: rawInsights, since, until } = await fetchInsights(
    externalAdAccountId,
    accessToken,
    dayRange
  );
  const mappedInsights = rawInsights.map((r) =>
    mapInsight(r, externalAdAccountId, workspaceId)
  );
  counts.insightRowsSynced += await replaceInsights(
    externalAdAccountId,
    since,
    until,
    mappedInsights
  );
}

// ── Client-scoped orchestrator (exported for use by clientSync module) ────────

/**
 * Sync a specific set of ad accounts using a known connection.
 * Used by the client-scoped sync orchestrator to sync only the accounts
 * mapped to a given client.
 */
export async function runMetaSyncForAccounts(
  adAccounts: Array<{ externalAdAccountId: string; accessToken: string }>,
  connectionId: string,
  workspaceId: string | null = null,
  mode: SyncMode = "recent"
): Promise<SyncSummary> {
  const startedAt = new Date();
  const dayRange = mode === "daily_full" ? 30 : 7;

  if (adAccounts.length === 0) {
    return {
      status:            "no_accounts",
      accountsProcessed: 0,
      campaignsSynced:   0,
      adSetsSynced:      0,
      adsSynced:         0,
      creativesSynced:   0,
      insightRowsSynced: 0,
      errors:            ["No ad accounts provided for sync"],
      startedAt:         startedAt.toISOString(),
      completedAt:       new Date().toISOString(),
      mode,
    };
  }

  const syncLog = await createSyncLog(connectionId);

  const counts = {
    campaignsSynced:   0,
    adSetsSynced:      0,
    adsSynced:         0,
    creativesSynced:   0,
    insightRowsSynced: 0,
  };
  const errors: string[] = [];
  let hasTokenError = false;

  for (const account of adAccounts) {
    try {
      await syncAccount(
        account.externalAdAccountId,
        account.accessToken,
        workspaceId,
        counts,
        dayRange
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${account.externalAdAccountId}: ${msg}`);
      console.error("[Meta sync]", account.externalAdAccountId, err);

      // If token is expired/invalid, mark connection and stop processing
      if (err instanceof Error && (err as Error & { isTokenError?: boolean }).isTokenError) {
        hasTokenError = true;
        await markConnectionTokenExpired(connectionId);
        break; // Don't try remaining accounts with a bad token
      }
    }
  }

  await completeSyncLog(
    syncLog.id,
    { accountsProcessed: adAccounts.length, ...counts },
    errors
  );

  const completedAt = new Date();
  let status: SyncSummary["status"];
  if (hasTokenError) status = "token_expired";
  else if (errors.length === 0) status = "completed";
  else status = "partial";

  return {
    status,
    accountsProcessed: adAccounts.length,
    ...counts,
    errors,
    startedAt:   startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    mode,
  };
}

/** Mark connection token as expired so UI can surface reconnection prompt. */
async function markConnectionTokenExpired(connectionId: string): Promise<void> {
  try {
    await prisma.metaConnection.update({
      where: { id: connectionId },
      data:  { connectionStatus: "expired" },
    });
    console.warn("[Meta sync] Token expired, connection marked for reconnection");
  } catch (err) {
    console.error("[Meta sync] Failed to mark connection as token_expired", err);
  }
}

// ── Workspace-wide orchestrator ───────────────────────────────────────────────

export async function runMetaSync(
  workspaceId: string | null = null,
  mode: SyncMode = "recent"
): Promise<SyncSummary> {
  const startedAt = new Date();

  const connection = await getConnectionForSync();
  const emptySummary = (status: SyncSummary["status"], errors: string[]): SyncSummary => ({
    status,
    accountsProcessed: 0,
    campaignsSynced:   0,
    adSetsSynced:      0,
    adsSynced:         0,
    creativesSynced:   0,
    insightRowsSynced: 0,
    errors,
    startedAt:         startedAt.toISOString(),
    completedAt:       new Date().toISOString(),
    mode,
  });

  if (!connection) {
    return emptySummary("failed", ["No Meta connection found"]);
  }

  // Check token expiry before attempting sync
  if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
    console.warn("[Meta sync] Token expired, skipping sync");
    await markConnectionTokenExpired(connection.id);
    return emptySummary("token_expired", ["Meta access token has expired. Reconnect to resume syncing."]);
  }

  // Check connection status
  if (connection.connectionStatus === "expired") {
    return emptySummary("token_expired", ["Meta access token is invalid. Reconnect to resume syncing."]);
  }

  const selected = connection.selectedAccounts.map((s) => ({
    externalAdAccountId: s.accessibleAdAccount.externalAdAccountId,
    accessToken:         connection.accessToken,
  }));

  if (selected.length === 0) {
    return emptySummary("no_accounts", ["No ad accounts selected for sync"]);
  }

  console.log(`[Meta sync] Starting ${mode} sync for ${selected.length} account(s)`);
  return runMetaSyncForAccounts(selected, connection.id, workspaceId, mode);
}
