// lib/creativePerformance/query.ts
// Main data loader for the creative performance layer.
//
// getCreativePerformance() is the single public entry point.
// It loads all required data from the DB, runs attribution, computes
// derived metrics, and returns a sorted CreativePerformanceRow[].
//
// Architecture:
//   DB load (parallel)
//     → build ad/campaign/creative lookup maps
//     → aggregate Meta insights by ad
//     → build daily spend indexes for attribution
//     → load CRM orders per client (timezone-aware)
//     → attributeOrdersToAds()
//     → computeCreativeMetrics() per ad
//     → sort by spend desc

import { prisma }                  from "../db";
import type { CreativePerformanceRow, CreativePerformanceQuery } from "./types";
import { computeCreativeMetrics }  from "./metrics";
import {
  getCampaignGoalsForCampaigns,
  getClientGoalsForClients,
}                                  from "../goals/service";
import {
  resolveGoalForCreative,
  getGoalSource,
}                                  from "../goals/resolve";
import {
  attributeOrdersToAds,
  dateRangeToUtc,
  toTimezoneDate,
  type OrderForAttribution,
  type AdForAttribution,
}                                  from "./attribution";
import { evaluatePerformance }     from "../evaluation/evaluate";

// ---------------------------------------------------------------------------
// getCreativePerformance
// ---------------------------------------------------------------------------

export async function getCreativePerformance(
  query: CreativePerformanceQuery
): Promise<CreativePerformanceRow[]> {
  const {
    workspaceId,
    clientAccountId,
    campaignId,
    dateFrom,
    dateTo,
    windowDays = 7,
  } = query;

  // ── 1. Resolve clients ────────────────────────────────────────────────────
  const clients = await prisma.clientAccount.findMany({
    where: {
      ...(workspaceId      ? { workspaceId }      : {}),
      ...(clientAccountId  ? { id: clientAccountId } : {}),
    },
    select: { id: true, name: true, timezone: true },
  });

  if (clients.length === 0) return [];

  const clientIds = clients.map(c => c.id);
  const clientMap = new Map(clients.map(c => [c.id, c]));

  // ── 2. Resolve ad accounts for these clients ──────────────────────────────
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where: { clientAccountId: { in: clientIds } },
    include: {
      accessibleAdAccount: { select: { externalAdAccountId: true } },
    },
  });

  const adAccountToClient = new Map<string, string>();
  for (const sa of selectedAccounts) {
    const extId = sa.accessibleAdAccount?.externalAdAccountId;
    if (extId && sa.clientAccountId) {
      adAccountToClient.set(extId, sa.clientAccountId);
    }
  }

  const adAccountIds = [...new Set(
    selectedAccounts
      .map(sa => sa.accessibleAdAccount?.externalAdAccountId)
      .filter((id): id is string => !!id)
  )];

  if (adAccountIds.length === 0) return [];

  // ── 3. Load ads, ad sets, campaigns, creatives in parallel ───────────────
  const wsFilter       = workspaceId ? { workspaceId } : {};
  const campaignFilter = campaignId  ? { externalCampaignId: campaignId } : {};

  const [syncedAds, syncedAdSets, syncedCampaigns, syncedCreatives] = await Promise.all([
    prisma.metaSyncedAd.findMany({
      where: {
        ...wsFilter,
        externalAdAccountId: { in: adAccountIds },
        ...campaignFilter,
      },
      select: {
        externalAdId:        true,
        externalCreativeId:  true,
        externalAdSetId:     true,
        externalCampaignId:  true,
        externalAdAccountId: true,
        name:                true,
      },
    }),

    prisma.metaSyncedAdSet.findMany({
      where: { externalAdAccountId: { in: adAccountIds } },
      select: { externalAdSetId: true, name: true },
    }),

    prisma.metaSyncedCampaign.findMany({
      where: { ...wsFilter, ...campaignFilter },
      select: { externalCampaignId: true, name: true },
    }),

    prisma.metaSyncedCreative.findMany({
      where: wsFilter,
      select: {
        externalCreativeId: true,
        name:               true,
        body:               true,
        callToAction:       true,
        thumbnailUrl:       true,
        imageUrl:           true,
      },
    }),
  ]);

  if (syncedAds.length === 0) return [];

  // ── 4. Load ad-level insight rows ────────────────────────────────────────
  const adIds = syncedAds.map(a => a.externalAdId);

  const insightRows = await prisma.metaSyncedInsight.findMany({
    where: {
      externalAdAccountId: { in: adAccountIds },
      level:               "ad",
      externalAdId:        { in: adIds },
      dateStart:           { gte: dateFrom, lte: dateTo },
    },
    select: {
      externalAdId:        true,
      externalCampaignId:  true,
      externalAdAccountId: true,
      dateStart:           true,
      spend:               true,
      impressions:         true,
      clicks:              true,
    },
  });

  // ── 5. Aggregate insight rows into per-ad totals and daily spend indexes ──
  // adAggMetrics: adId → { spend, impressions, clicks }
  const adAggMetrics = new Map<string, { spend: number; impressions: number; clicks: number }>();
  // adDailySpend: adId → date → spend
  const adDailySpend = new Map<string, Map<string, number>>();
  // campaignDailySpend: campaignId → date → spend (built from ad-level data)
  const campaignDailySpend = new Map<string, Map<string, number>>();

  for (const row of insightRows) {
    const spend       = row.spend       ?? 0;
    const impressions = row.impressions ?? 0;
    const clicks      = row.clicks      ?? 0;
    const date        = row.dateStart;

    // Ad aggregate
    const agg = adAggMetrics.get(row.externalAdId) ?? { spend: 0, impressions: 0, clicks: 0 };
    agg.spend       += spend;
    agg.impressions += impressions;
    agg.clicks      += clicks;
    adAggMetrics.set(row.externalAdId, agg);

    // Ad daily spend index
    if (!adDailySpend.has(row.externalAdId)) adDailySpend.set(row.externalAdId, new Map());
    const adDay = adDailySpend.get(row.externalAdId)!;
    adDay.set(date, (adDay.get(date) ?? 0) + spend);

    // Campaign daily spend index
    if (!campaignDailySpend.has(row.externalCampaignId)) campaignDailySpend.set(row.externalCampaignId, new Map());
    const camDay = campaignDailySpend.get(row.externalCampaignId)!;
    camDay.set(date, (camDay.get(date) ?? 0) + spend);
  }

  // ── 6. Load CRM orders per client (timezone-aware) ────────────────────────
  const allOrders: OrderForAttribution[] = [];

  for (const client of clients) {
    const timezone = client.timezone || "America/New_York";
    const { startUtc, endUtc } = dateRangeToUtc(dateFrom, dateTo, timezone);

    const orders = await prisma.shopifyOrder.findMany({
      where: {
        clientAccountId: client.id,
        orderCreatedAt:  { gte: startUtc, lte: endUtc },
      },
      select: {
        id:             true,
        orderCreatedAt: true,
        totalPrice:     true,
        utmCampaign:    true,
        utmContent:     true,
        clientAccountId: true,
      },
    });

    for (const o of orders) {
      allOrders.push({
        id:              o.id,
        clientAccountId: o.clientAccountId!,
        date:            toTimezoneDate(o.orderCreatedAt, timezone),
        revenue:         o.totalPrice ?? 0,
        utmCampaign:     o.utmCampaign  ?? undefined,
        utmContent:      o.utmContent   ?? undefined,
      });
    }
  }

  // ── 7. Build lookup maps ──────────────────────────────────────────────────
  const adSetMap      = new Map(syncedAdSets.map(s => [s.externalAdSetId, s.name]));
  const campaignMap   = new Map(syncedCampaigns.map(c => [c.externalCampaignId, c.name]));
  const creativeMap   = new Map(syncedCreatives.map(c => [c.externalCreativeId, c]));
  const adMap         = new Map(syncedAds.map(a => [a.externalAdId, a]));

  // ── 7b. Load goals for goal resolution ────────────────────────────────────
  const uniqueCampaignIds = [...new Set(syncedAds.map(a => a.externalCampaignId))];
  const [campaignGoalMap, clientGoalMap] = await Promise.all([
    getCampaignGoalsForCampaigns(uniqueCampaignIds),
    getClientGoalsForClients(clientIds),
  ]);

  const adsForAttribution: AdForAttribution[] = syncedAds.map(a => ({
    externalAdId:        a.externalAdId,
    externalCampaignId:  a.externalCampaignId,
    externalAdAccountId: a.externalAdAccountId,
    name:                a.name,
  }));

  // ── 8. Attribute CRM orders to ads ───────────────────────────────────────
  const attributionResults = attributeOrdersToAds(
    allOrders,
    adsForAttribution,
    adDailySpend,
    campaignDailySpend,
    campaignMap,
    windowDays
  );

  // ── 9. Aggregate attribution results per ad ───────────────────────────────
  type AdRevenue = {
    revenue:     number;
    conversions: number;
    utmMatch:    number;
    windowMatch: number;
    unattributed: number;
  };
  const adRevenue = new Map<string, AdRevenue>();

  for (const result of attributionResults) {
    if (!result.adId) continue;  // unattributed — not counted against any ad

    const r = adRevenue.get(result.adId) ?? { revenue: 0, conversions: 0, utmMatch: 0, windowMatch: 0, unattributed: 0 };
    r.revenue     += result.revenue;
    r.conversions += result.conversions;

    if (result.attributionMethod === "utm_content_id" || result.attributionMethod === "utm_content_name") {
      r.utmMatch += result.conversions;
    } else if (result.attributionMethod === "utm_campaign_window") {
      r.windowMatch += result.conversions;
    }

    adRevenue.set(result.adId, r);
  }

  // Count unattributed conversions (for summary)
  const totalUnattributed = attributionResults
    .filter(r => r.attributionMethod === "unattributed")
    .reduce((s, r) => s + r.conversions, 0);

  // ── 10. Build CreativePerformanceRow[] ────────────────────────────────────
  const rows: CreativePerformanceRow[] = [];

  for (const [adId, agg] of adAggMetrics) {
    // Skip rows with no delivery at all
    if (agg.spend === 0 && agg.impressions === 0 && agg.clicks === 0) continue;

    const ad = adMap.get(adId);
    if (!ad) continue;

    const clientId = adAccountToClient.get(ad.externalAdAccountId);
    if (!clientId) continue;

    const client = clientMap.get(clientId);
    if (!client) continue;

    const rev         = adRevenue.get(adId);
    const creativeRec = ad.externalCreativeId ? creativeMap.get(ad.externalCreativeId) : undefined;

    const rawMetrics = {
      spend:       agg.spend,
      impressions: agg.impressions,
      clicks:      agg.clicks,
      conversions: rev?.conversions ?? 0,
      revenue:     rev?.revenue     ?? 0,
    };

    const metrics = computeCreativeMetrics(rawMetrics);

    // Resolve goal for this creative (inherits from campaign → client → system default)
    const campaignGoal  = campaignGoalMap.get(ad.externalCampaignId) ?? null;
    const clientGoal    = clientGoalMap.get(clientId)                ?? null;
    const resolvedGoal  = resolveGoalForCreative(campaignGoal, clientGoal);
    const goalSource    = getGoalSource(campaignGoal, clientGoal);

    const evaluation = evaluatePerformance({
      spend:       metrics.spend,
      impressions: metrics.impressions,
      clicks:      metrics.clicks,
      conversions: metrics.conversions,
      revenue:     metrics.revenue,
      ctr:         metrics.ctr,
      cvr:         metrics.cvr,
      roas:        metrics.roas,
      cpa:         metrics.cpa,
      resolvedGoal,
    });

    rows.push({
      adId,
      adName:          ad.name,
      adSetId:         ad.externalAdSetId,
      adSetName:       adSetMap.get(ad.externalAdSetId) ?? ad.externalAdSetId,
      campaignId:      ad.externalCampaignId,
      campaignName:    campaignMap.get(ad.externalCampaignId) ?? ad.externalCampaignId,
      clientAccountId: clientId,
      clientName:      client.name,
      adAccountId:     ad.externalAdAccountId,
      timezone:        client.timezone || "America/New_York",
      creativeId:      ad.externalCreativeId ?? null,
      creativeName:    creativeRec?.name         ?? null,
      thumbnailUrl:    creativeRec?.thumbnailUrl  ?? creativeRec?.imageUrl ?? null,
      adCopy:          creativeRec?.body          ?? null,
      callToAction:    creativeRec?.callToAction  ?? null,
      dateFrom,
      dateTo,
      ...metrics,
      utmMatchedConversions:    rev?.utmMatch    ?? 0,
      windowMatchedConversions: rev?.windowMatch ?? 0,
      unattributedConversions:  totalUnattributed,
      attributionWindowDays:    windowDays,
      resolvedGoal,
      goalSource,
      evaluation,
    });
  }

  // Sort by spend descending — highest-spend ads first for buyer review.
  return rows.sort((a, b) => b.spend - a.spend);
}
