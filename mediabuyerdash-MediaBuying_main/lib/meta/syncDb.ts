import { prisma } from "../db";
import type {
  MappedCampaign,
  MappedAdSet,
  MappedAd,
  MappedCreative,
  MappedInsight,
} from "./mappers";

// ── Sync log ──────────────────────────────────────────────────────────────────

export async function createSyncLog(metaConnectionId: string) {
  return prisma.metaSyncLog.create({
    data: { metaConnectionId, status: "running" },
  });
}

export async function completeSyncLog(
  id: string,
  counts: {
    accountsProcessed: number;
    campaignsSynced:   number;
    adSetsSynced:      number;
    adsSynced:         number;
    creativesSynced:   number;
    insightRowsSynced: number;
  },
  errors: string[]
) {
  return prisma.metaSyncLog.update({
    where: { id },
    data: {
      ...counts,
      status:        errors.length === 0 ? "completed" : "partial",
      errorMessages: errors.length > 0 ? JSON.stringify(errors) : null,
      completedAt:   new Date(),
    },
  });
}

export async function getLatestSyncLog(metaConnectionId: string) {
  return prisma.metaSyncLog.findFirst({
    where:   { metaConnectionId },
    orderBy: { startedAt: "desc" },
  });
}

// ── Upsert helpers ────────────────────────────────────────────────────────────

export async function upsertCampaigns(
  campaigns: MappedCampaign[]
): Promise<number> {
  for (const c of campaigns) {
    await prisma.metaSyncedCampaign.upsert({
      where:  { externalCampaignId: c.externalCampaignId },
      create: c,
      update: {
        workspaceId:   c.workspaceId,  // backfill if previously null
        name:          c.name,
        status:        c.status,
        objective:     c.objective,
        buyingType:    c.buyingType,
        metaUpdatedAt: c.metaUpdatedAt,
      },
    });
  }
  return campaigns.length;
}

export async function upsertAdSets(adSets: MappedAdSet[]): Promise<number> {
  for (const a of adSets) {
    await prisma.metaSyncedAdSet.upsert({
      where:  { externalAdSetId: a.externalAdSetId },
      create: a,
      update: {
        workspaceId:   a.workspaceId,
        name:          a.name,
        status:        a.status,
        metaUpdatedAt: a.metaUpdatedAt,
      },
    });
  }
  return adSets.length;
}

export async function upsertAds(ads: MappedAd[]): Promise<number> {
  for (const a of ads) {
    await prisma.metaSyncedAd.upsert({
      where:  { externalAdId: a.externalAdId },
      create: a,
      update: {
        workspaceId:        a.workspaceId,
        name:               a.name,
        status:             a.status,
        externalCreativeId: a.externalCreativeId,
        metaUpdatedAt:      a.metaUpdatedAt,
      },
    });
  }
  return ads.length;
}

export async function upsertCreatives(
  creatives: MappedCreative[]
): Promise<number> {
  const unique = [
    ...new Map(creatives.map((c) => [c.externalCreativeId, c])).values(),
  ];
  for (const c of unique) {
    await prisma.metaSyncedCreative.upsert({
      where:  { externalCreativeId: c.externalCreativeId },
      create: c,
      update: {
        workspaceId:  c.workspaceId,
        name:         c.name,
        title:        c.title,
        body:         c.body,
        callToAction: c.callToAction,
        imageUrl:     c.imageUrl,
        thumbnailUrl: c.thumbnailUrl,
      },
    });
  }
  return unique.length;
}

/**
 * Deletes existing insight rows for the account within the date window and
 * bulk-inserts the new set. Faster than per-row upserts for large insight sets.
 */
export async function replaceInsights(
  externalAdAccountId: string,
  since: string,
  until: string,
  insights: MappedInsight[]
): Promise<number> {
  await prisma.metaSyncedInsight.deleteMany({
    where: {
      externalAdAccountId,
      dateStart: { gte: since, lte: until },
    },
  });

  if (insights.length > 0) {
    await prisma.metaSyncedInsight.createMany({ data: insights });
  }
  return insights.length;
}

// ── Summary query ─────────────────────────────────────────────────────────────

/**
 * Returns entity counts and recent rows for the given ad account IDs.
 * Optionally scoped by workspaceId for multi-workspace safety.
 */
export async function getSyncedDataSummary(
  externalAdAccountIds: string[],
  workspaceId?: string | null
) {
  // When workspaceId is provided, include it to prevent cross-workspace data leaks.
  // The OR clause handles legacy rows that pre-date workspaceId being populated.
  const buildWhere = (extra?: object) => ({
    externalAdAccountId: { in: externalAdAccountIds },
    ...(workspaceId
      ? { OR: [{ workspaceId }, { workspaceId: null }] }
      : {}),
    ...extra,
  });

  const [
    campaignCount, adSetCount, adCount, creativeCount, insightCount,
    topCampaigns, topAdSets, topAds, topInsights,
  ] = await Promise.all([
    prisma.metaSyncedCampaign.count({ where: buildWhere() }),
    prisma.metaSyncedAdSet.count({ where: buildWhere() }),
    prisma.metaSyncedAd.count({ where: buildWhere() }),
    // creatives are deduped globally; scope them by workspaceId if set
    workspaceId
      ? prisma.metaSyncedCreative.count({ where: { OR: [{ workspaceId }, { workspaceId: null }] } })
      : prisma.metaSyncedCreative.count(),
    prisma.metaSyncedInsight.count({ where: buildWhere() }),
    prisma.metaSyncedCampaign.findMany({
      where:   buildWhere(),
      take:    20,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.metaSyncedAdSet.findMany({
      where:   buildWhere(),
      take:    20,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.metaSyncedAd.findMany({
      where:   buildWhere(),
      take:    20,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.metaSyncedInsight.findMany({
      where:   buildWhere(),
      take:    20,
      orderBy: { spend: "desc" },
    }),
  ]);

  return {
    campaignCount, adSetCount, adCount, creativeCount, insightCount,
    topCampaigns, topAdSets, topAds, topInsights,
  };
}
