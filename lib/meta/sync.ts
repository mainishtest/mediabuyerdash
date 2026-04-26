import { getConnectionForSync }                    from "./db";
import { fetchCampaigns, fetchAdSets, fetchAds, fetchAdCreatives, fetchInsights } from "./api";
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
  timezone = "America/New_York",
  insightDayRange = 7
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

  // Fetch creatives directly from the adcreatives endpoint.
  // The embedded creative{body,...} on ads often returns null for body/object_story_spec.
  // The direct endpoint reliably returns the full ad text and image data.
  const rawDirectCreatives = await fetchAdCreatives(externalAdAccountId, accessToken);
  const directCreativeMap = new Map(rawDirectCreatives.map((c) => [c.id, c]));

  // Merge: use direct fetch data, fall back to embedded creative data from ads
  const embeddedCreatives = rawAds
    .filter((a) => a.creative?.id)
    .map((a) => a.creative!);

  const mergedCreatives = embeddedCreatives.map((embedded) => {
    const direct = directCreativeMap.get(embedded.id);
    if (!direct) return embedded;
    // Prefer direct fetch fields (they're more complete), fall back to embedded
    return {
      ...embedded,
      body:               direct.body               ?? embedded.body,
      title:              direct.title              ?? embedded.title,
      call_to_action_type: direct.call_to_action_type ?? embedded.call_to_action_type,
      image_url:          direct.image_url          ?? embedded.image_url,
      thumbnail_url:      direct.thumbnail_url      ?? embedded.thumbnail_url,
      object_story_spec:  direct.object_story_spec  ?? embedded.object_story_spec,
    };
  });

  // Also include creatives from direct fetch that weren't in any ad (rare but possible)
  for (const direct of rawDirectCreatives) {
    if (!embeddedCreatives.some((e) => e.id === direct.id)) {
      mergedCreatives.push(direct);
    }
  }

  const mappedCreatives = mergedCreatives.map((c) => mapCreative(c, workspaceId));
  counts.creativesSynced += await upsertCreatives(mappedCreatives);

  // Insights — configurable day range (2 for cron, 7 for full/manual sync)
  // Only replace if we got data — prevents deleting good data on partial/failed syncs
  const { rows: rawInsights, since, until } = await fetchInsights(
    externalAdAccountId,
    accessToken,
    insightDayRange,
    timezone
  );
  const mappedInsights = rawInsights.map((r) =>
    mapInsight(r, externalAdAccountId, workspaceId)
  );
  if (mappedInsights.length > 0) {
    counts.insightRowsSynced += await replaceInsights(
      externalAdAccountId,
      since,
      until,
      mappedInsights
    );
  }
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
  timezone = "America/New_York",
  insightDayRange = 7
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

  for (let i = 0; i < adAccounts.length; i++) {
    const account = adAccounts[i];
    try {
      await syncAccount(
        account.externalAdAccountId,
        account.accessToken,
        workspaceId,
        counts,
        timezone,
        insightDayRange
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${account.externalAdAccountId}: ${msg}`);
      console.error("[Meta sync]", account.externalAdAccountId, err);
    }
    // Brief pause between accounts to avoid hitting Meta's per-account rate limits
    if (i < adAccounts.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
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
  workspaceId: string | null = null,
  insightDayRange = 2
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

  // Cron sync: only fetch 2 days of insights (today + yesterday) to reduce
  // API calls and avoid Meta's per-account rate limit (error 80004).
  // Full 7-day backfill happens via manual sync or client-scoped sync.
  return runMetaSyncForAccounts(selected, connection.id, workspaceId, "America/New_York", insightDayRange);
}
