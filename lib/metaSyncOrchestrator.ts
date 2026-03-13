// Meta Sync Orchestrator
//
// Accepts a MetaSyncPayload, runs mapping, optionally persists to the
// database via Prisma, and returns a MetaSyncSummary.
//
// Two entry points are exported:
//   runMockSync(payload)    — maps only, no DB writes, safe to call client-side
//   runMockSyncWithPersist  — maps + upserts into Prisma, server-side only
//
// Keeping them in this one file lets the UI call the lightweight version
// while a future server action or API route calls the persistent version.

import type { MetaSyncPayload, MetaSyncJob, MetaSyncSummary } from "../types/metaSync";
import {
  mapAllSyncAccounts,
  mapAllSyncCampaigns,
  mapAllSyncAdSets,
  mapAllSyncAds,
  mapAllSyncCreatives,
  mapAllSyncHourlyMetrics,
  type MappedClientAccount,
  type MappedCampaign,
  type MappedAdSet,
  type MappedAd,
  type MappedCreative,
  type MappedUTMPerformanceRow
} from "./metaSyncMappers";

// ── Mapped result batch ────────────────────────────────────────────────────────

export interface MetaSyncMappedBatch {
  accounts:      MappedClientAccount[];
  campaigns:     MappedCampaign[];
  adSets:        MappedAdSet[];
  ads:           MappedAd[];
  creatives:     MappedCreative[];
  hourlyMetrics: MappedUTMPerformanceRow[];
}

// ── Private helpers ───────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function mapPayload(payload: MetaSyncPayload): MetaSyncMappedBatch {
  const campaignNames = new Map(
    payload.campaigns.map((c) => [c.externalCampaignId, c.name])
  );
  const adSetNames = new Map(
    payload.adSets.map((a) => [a.externalAdSetId, a.name])
  );
  const adNames = new Map(
    payload.ads.map((a) => [a.externalAdId, a.name])
  );

  return {
    accounts:      mapAllSyncAccounts(payload.accounts),
    campaigns:     mapAllSyncCampaigns(payload.campaigns),
    adSets:        mapAllSyncAdSets(payload.adSets),
    ads:           mapAllSyncAds(payload.ads),
    creatives:     mapAllSyncCreatives(payload.creatives),
    hourlyMetrics: mapAllSyncHourlyMetrics(
                     payload.hourlyMetrics,
                     campaignNames,
                     adSetNames,
                     adNames
                   )
  };
}

function buildSummary(
  job:     MetaSyncJob,
  batch:   MetaSyncMappedBatch,
  errors:  string[],
  startMs: number
): MetaSyncSummary {
  const completedAt = nowIso();
  return {
    jobId:              job.id,
    status:             errors.length === 0 ? "completed" : "failed",
    accountsProcessed:  batch.accounts.length,
    campaignsProcessed: batch.campaigns.length,
    adSetsProcessed:    batch.adSets.length,
    adsProcessed:       batch.ads.length,
    creativesProcessed: batch.creatives.length,
    metricsProcessed:   batch.hourlyMetrics.length,
    errorsCount:        errors.length,
    startedAt:          job.startedAt ?? nowIso(),
    completedAt,
    durationMs:         Date.now() - startMs,
    errors
  };
}

// ── Public: map-only (no DB) ──────────────────────────────────────────────────

export type MockSyncResult = {
  job:     MetaSyncJob;
  batch:   MetaSyncMappedBatch;
  summary: MetaSyncSummary;
};

export function runMockSync(
  payload: MetaSyncPayload,
  job: MetaSyncJob
): MockSyncResult {
  const startMs = Date.now();
  const errors: string[] = [];

  let batch: MetaSyncMappedBatch;
  try {
    batch = mapPayload(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Mapping failed: ${msg}`);
    batch = {
      accounts: [], campaigns: [], adSets: [],
      ads: [], creatives: [], hourlyMetrics: []
    };
  }

  const summary = buildSummary(job, batch, errors, startMs);
  return { job, batch, summary };
}

// ── Public: map + persist (server-side only) ───────────────────────────────────

// Dynamically importing the Prisma client here (rather than at module top)
// keeps this file importable in client components that only call runMockSync.
export async function runMockSyncWithPersist(
  payload: MetaSyncPayload,
  job:     MetaSyncJob
): Promise<MockSyncResult> {
  const startMs  = Date.now();
  const errors:  string[] = [];

  let batch: MetaSyncMappedBatch;
  try {
    batch = mapPayload(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Mapping failed: ${msg}`);
    batch = {
      accounts: [], campaigns: [], adSets: [],
      ads: [], creatives: [], hourlyMetrics: []
    };
    return { job, batch, summary: buildSummary(job, batch, errors, startMs) };
  }

  const { prisma } = await import("./db");

  // Persist in dependency order: accounts → campaigns → (creatives ∥ adSets) → ads → metrics
  try {
    for (const a of batch.accounts) {
      await prisma.clientAccount.upsert({
        where:  { id: a.id },
        update: { name: a.name, currency: a.currency, timezone: a.timezone },
        create: a
      });
    }
  } catch (e) {
    errors.push(`accounts: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    for (const c of batch.campaigns) {
      await prisma.campaign.upsert({
        where:  { id: c.id },
        update: { name: c.name, status: c.status, dailyBudget: c.dailyBudget },
        create: c
      });
    }
  } catch (e) {
    errors.push(`campaigns: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    for (const cr of batch.creatives) {
      await prisma.creative.upsert({
        where:  { id: cr.id },
        update: { name: cr.name, headline: cr.headline, body: cr.body },
        create: cr
      });
    }
  } catch (e) {
    errors.push(`creatives: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    for (const as of batch.adSets) {
      await prisma.adSet.upsert({
        where:  { id: as.id },
        update: { name: as.name, status: as.status, dailyBudget: as.dailyBudget },
        create: as
      });
    }
  } catch (e) {
    errors.push(`adSets: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    for (const ad of batch.ads) {
      await prisma.ad.upsert({
        where:  { id: ad.id },
        update: { name: ad.name, status: ad.status },
        create: ad
      });
    }
  } catch (e) {
    errors.push(`ads: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    for (const m of batch.hourlyMetrics) {
      await prisma.uTMPerformanceRow.upsert({
        where:  { id: m.id },
        update: {
          spend:       m.spend,
          impressions: m.impressions,
          clicks:      m.clicks,
          conversions: m.conversions,
          revenue:     m.revenue,
          cpa:         m.cpa,
          roas:        m.roas
        },
        create: m
      });
    }
  } catch (e) {
    errors.push(`hourlyMetrics: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { job, batch, summary: buildSummary(job, batch, errors, startMs) };
}
