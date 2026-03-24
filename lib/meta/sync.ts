import { getConnectionForSync }                    from "./db";
import { fetchCampaigns, fetchAdSets, fetchAds, fetchInsights } from "./api";
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

export interface SyncSummary {
  status:            "completed" | "partial" | "failed" | "no_accounts";
  accountsProcessed: number;
  campaignsSynced:   number;
  adSetsSynced:      number;
  adsSynced:         number;
  creativesSynced:   number;
  insightRowsSynced: number;
  errors:            string[];
  startedAt:         string;
  completedAt:       string;
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
  timezone = "America/New_York"
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

  // Insights — last 7 days at ad level
  const { rows: rawInsights, since, until } = await fetchInsights(
    externalAdAccountId,
    accessToken,
    7,
    timezone
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
  timezone = "America/New_York"
): Promise<SyncSummary> {
  const startedAt = new Date();

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

  for (const account of adAccounts) {
    try {
      await syncAccount(
        account.externalAdAccountId,
        account.accessToken,
        workspaceId,
        counts,
        timezone
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${account.externalAdAccountId}: ${msg}`);
      console.error("[Meta sync]", account.externalAdAccountId, err);
    }
  }

  await completeSyncLog(
    syncLog.id,
    { accountsProcessed: adAccounts.length, ...counts },
    errors
  );

  const completedAt = new Date();
  return {
    status:            errors.length === 0 ? "completed" : "partial",
    accountsProcessed: adAccounts.length,
    ...counts,
    errors,
    startedAt:   startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
  };
}

// ── Workspace-wide orchestrator ───────────────────────────────────────────────

export async function runMetaSync(
  workspaceId: string | null = null
): Promise<SyncSummary> {
  const startedAt = new Date();

  const connection = await getConnectionForSync();

  if (!connection) {
    return {
      status:            "failed",
      accountsProcessed: 0,
      campaignsSynced:   0,
      adSetsSynced:      0,
      adsSynced:         0,
      creativesSynced:   0,
      insightRowsSynced: 0,
      errors:            ["No Meta connection found"],
      startedAt:         startedAt.toISOString(),
      completedAt:       new Date().toISOString(),
    };
  }

  const selected = connection.selectedAccounts.map((s) => ({
    externalAdAccountId: s.accessibleAdAccount.externalAdAccountId,
    accessToken:         connection.accessToken,
  }));

  if (selected.length === 0) {
    return {
      status:            "no_accounts",
      accountsProcessed: 0,
      campaignsSynced:   0,
      adSetsSynced:      0,
      adsSynced:         0,
      creativesSynced:   0,
      insightRowsSynced: 0,
      errors:            ["No ad accounts selected for sync"],
      startedAt:         startedAt.toISOString(),
      completedAt:       new Date().toISOString(),
    };
  }

  return runMetaSyncForAccounts(selected, connection.id, workspaceId);
}
