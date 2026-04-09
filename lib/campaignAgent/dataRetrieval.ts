// Campaign Agent — Data Retrieval
//
// Fetches performance data, creatives, audiences, and account defaults
// based on the parsed intent. All reads, no writes.

import { prisma } from "../db";
import { getConnectionForSync } from "../meta/db";
import type {
  CampaignIntent,
  PerformingAd,
  ResolvedCreative,
  ResolvedAudience,
  IntentData,
} from "./types";

// ── Top performing ads ───────────────────────────────────────────────────────

export async function getTopPerformingAds(
  lookbackDays: number,
  metric: string,
  count: number,
  brandFilter?: string | null
): Promise<PerformingAd[]> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - lookbackDays);
  const since = sinceDate.toISOString().slice(0, 10);

  // Aggregate insights by ad over the lookback window
  const insights = await prisma.metaSyncedInsight.groupBy({
    by: ["externalAdId"],
    where: {
      level: "ad",
      dateStart: { gte: since },
      externalAdId: { not: "" },
    },
    _sum: {
      spend: true,
      impressions: true,
      clicks: true,
    },
    orderBy: {
      _sum: {
        spend: metric === "spend" || metric === "roas" ? "desc" : undefined,
        clicks: metric === "ctr" || metric === "cpa" ? "desc" : undefined,
        impressions: metric === "impressions" ? "desc" : undefined,
      },
    },
    take: 100, // Get more than needed, we'll filter/rank
  });

  // Enrich with ad metadata
  const adIds = insights.map((i) => i.externalAdId);
  const ads = await prisma.metaSyncedAd.findMany({
    where: { externalAdId: { in: adIds } },
  });
  const adMap = new Map(ads.map((a) => [a.externalAdId, a]));

  // Get campaign names
  const campaignIds = [...new Set(ads.map((a) => a.externalCampaignId))];
  const campaigns = await prisma.metaSyncedCampaign.findMany({
    where: { externalCampaignId: { in: campaignIds } },
  });
  const campaignMap = new Map(campaigns.map((c) => [c.externalCampaignId, c.name]));

  // Build ranked list
  let ranked: PerformingAd[] = insights
    .map((i, idx) => {
      const ad = adMap.get(i.externalAdId);
      const spend = i._sum.spend ?? 0;
      const impressions = i._sum.impressions ?? 0;
      const clicks = i._sum.clicks ?? 0;
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;

      return {
        id: i.externalAdId,
        name: ad?.name ?? `Ad ${i.externalAdId}`,
        campaignName: campaignMap.get(ad?.externalCampaignId ?? "") ?? "Unknown",
        spend,
        impressions,
        clicks,
        ctr: Math.round(ctr * 100) / 100,
        cpm: Math.round(cpm * 100) / 100,
        rank: idx + 1,
        reasonSelected: "",
      };
    })
    .filter((a) => a.spend > 0); // Only ads with actual spend

  // Filter by brand/product name if specified
  if (brandFilter) {
    const filter = brandFilter.toLowerCase();
    const filtered = ranked.filter(
      (a) => a.name.toLowerCase().includes(filter) || a.campaignName.toLowerCase().includes(filter)
    );
    if (filtered.length > 0) ranked = filtered;
  }

  // Sort by chosen metric
  switch (metric) {
    case "ctr":
      ranked.sort((a, b) => b.ctr - a.ctr);
      break;
    case "cpm":
      ranked.sort((a, b) => a.cpm - b.cpm); // lower is better
      break;
    case "spend":
      ranked.sort((a, b) => b.spend - a.spend);
      break;
    default: // roas, conversions — fall back to spend efficiency
      ranked.sort((a, b) => b.spend - a.spend);
  }

  // Re-rank and annotate
  return ranked.slice(0, count).map((a, i) => ({
    ...a,
    rank: i + 1,
    reasonSelected: `Ranked #${i + 1} by ${metric} over the last ${lookbackDays} days (${formatMetric(metric, a)})`,
  }));
}

function formatMetric(metric: string, ad: PerformingAd): string {
  switch (metric) {
    case "ctr": return `${ad.ctr}% CTR`;
    case "cpm": return `$${ad.cpm} CPM`;
    case "spend": return `$${ad.spend.toFixed(2)} spend`;
    default: return `$${ad.spend.toFixed(2)} spend`;
  }
}

// ── Resolve creatives from intent ────────────────────────────────────────────

async function resolveCreativesFromPerformance(
  performingAds: PerformingAd[]
): Promise<ResolvedCreative[]> {
  // Try to match performing ads to synced creatives
  const adIds = performingAds.map((a) => a.id);
  const syncedAds = await prisma.metaSyncedAd.findMany({
    where: { externalAdId: { in: adIds } },
  });

  const creativeIds = syncedAds
    .map((a) => a.externalCreativeId)
    .filter((id): id is string => id != null);
  const syncedCreatives = await prisma.metaSyncedCreative.findMany({
    where: { externalCreativeId: { in: creativeIds } },
  });
  const creativeMap = new Map(syncedCreatives.map((c) => [c.externalCreativeId, c]));

  return performingAds.map((ad) => {
    const syncedAd = syncedAds.find((a) => a.externalAdId === ad.id);
    const creative = syncedAd?.externalCreativeId
      ? creativeMap.get(syncedAd.externalCreativeId)
      : null;

    return {
      id: ad.id,
      name: creative?.name ?? ad.name,
      type: "image" as const, // default; Meta API doesn't easily distinguish
      url: creative?.imageUrl ?? null,
      thumbnailUrl: creative?.thumbnailUrl ?? null,
      source: "meta_synced" as const,
      performanceData: ad,
    };
  });
}

async function resolveCreativesFromAssets(
  brandFilter: string | null,
  count: number
): Promise<ResolvedCreative[]> {
  const assets = await prisma.creativeAsset.findMany({
    where: {
      status: { in: ["ready", "in_use"] },
      type: { in: ["image", "video"] },
      ...(brandFilter ? { name: { contains: brandFilter, mode: "insensitive" as const } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: count,
  });

  return assets.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as "image" | "video",
    url: a.url,
    thumbnailUrl: a.thumbnailUrl,
    source: "internal_asset" as const,
  }));
}

// ── Resolve audience ─────────────────────────────────────────────────────────

export function resolveAudienceRules(intent: CampaignIntent): ResolvedAudience {
  const exclusionDescriptions: string[] = [];

  for (const rule of intent.audience.excludeRules) {
    switch (rule.toLowerCase()) {
      case "purchasers":
      case "buyers":
      case "customers":
        exclusionDescriptions.push("Exclude past purchasers (requires custom audience setup in Meta)");
        break;
      case "existing_customers":
        exclusionDescriptions.push("Exclude existing customers");
        break;
      default:
        exclusionDescriptions.push(`Exclude: ${rule}`);
    }
  }

  let audienceDescription = "";
  if (intent.campaignType === "retargeting") {
    audienceDescription = "Retargeting audience: website visitors and engaged users";
    if (exclusionDescriptions.length > 0) {
      audienceDescription += `, excluding ${intent.audience.excludeRules.join(", ")}`;
    }
  } else if (intent.campaignType === "prospecting") {
    audienceDescription = "Prospecting audience: new potential customers";
  } else if (intent.campaignType === "broad") {
    audienceDescription = "Broad targeting with Advantage+ optimization";
  } else {
    audienceDescription = `Custom audience in ${intent.audience.locations.join(", ")}`;
  }

  return {
    targeting: {
      locations: intent.audience.locations.length > 0 ? intent.audience.locations : ["US"],
      ageMin: intent.audience.ageMin ?? 18,
      ageMax: intent.audience.ageMax ?? 65,
      gender: intent.audience.gender ?? "all",
      advantagePlus: intent.audience.advantagePlus,
    },
    exclusions: exclusionDescriptions,
    audienceDescription,
  };
}

// ── Master data resolver ─────────────────────────────────────────────────────

export async function resolveIntentData(intent: CampaignIntent): Promise<IntentData> {
  const warnings: string[] = [];

  // 1. Get Meta connection defaults
  const connection = await getConnectionForSync();
  let adAccount = null;
  let page = null;
  let pixel = null;

  if (connection && connection.selectedAccounts.length > 0) {
    const first = connection.selectedAccounts[0];
    adAccount = {
      id: first.id,
      externalId: first.accessibleAdAccount.externalAdAccountId,
      name: first.accessibleAdAccount.accountName,
      currency: first.accessibleAdAccount.currency,
    };
  } else {
    warnings.push("No Meta ad account connected. You'll need to connect one before launching.");
  }

  // 2. Resolve creatives
  let creatives: ResolvedCreative[] = [];
  let performanceSnapshot: PerformingAd[] = [];
  const count = intent.creativeSelection.count ?? 3;

  if (intent.creativeSelection.strategy === "top_performing") {
    const lookback = intent.creativeSelection.lookbackDays ?? 30;
    const metric = intent.creativeSelection.metric ?? "roas";
    performanceSnapshot = await getTopPerformingAds(lookback, metric, count, intent.brandOrProduct);
    creatives = await resolveCreativesFromPerformance(performanceSnapshot);

    if (creatives.length === 0) {
      warnings.push(`No ads with performance data found in the last ${lookback} days. Falling back to internal assets.`);
      creatives = await resolveCreativesFromAssets(intent.brandOrProduct, count);
    }
    if (creatives.length < count) {
      warnings.push(`Only found ${creatives.length} of ${count} requested creatives.`);
    }
  } else if (intent.creativeSelection.strategy === "by_name") {
    creatives = await resolveCreativesFromAssets(intent.creativeSelection.nameFilter, count);
  } else {
    creatives = await resolveCreativesFromAssets(intent.brandOrProduct, count);
  }

  // 3. Resolve audience
  const audience = resolveAudienceRules(intent);

  return {
    creatives,
    audience,
    adAccount,
    page,
    pixel,
    performanceSnapshot,
    dataWarnings: warnings,
  };
}
