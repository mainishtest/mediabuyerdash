import type {
  Campaign,
  AdSet,
  Ad,
  Creative,
  DailyMetric,
  HourlyMetric
} from "../types/media";

// Each selector accepts the full data array plus a filter value.
// Pure functions — no global state, easy to use with any data source later.

export function getCampaignsByAccountId(
  campaigns: Campaign[],
  accountId: string
): Campaign[] {
  return campaigns.filter((c) => c.accountId === accountId);
}

export function getAdSetsByCampaignId(
  adSets: AdSet[],
  campaignId: string
): AdSet[] {
  return adSets.filter((a) => a.campaignId === campaignId);
}

export function getAdsByAdSetId(ads: Ad[], adSetId: string): Ad[] {
  return ads.filter((a) => a.adSetId === adSetId);
}

export function getCreativeById(
  creatives: Creative[],
  creativeId: string
): Creative | undefined {
  return creatives.find((c) => c.id === creativeId);
}

export function getHourlyMetricsByCampaignId(
  metrics: HourlyMetric[],
  campaignId: string
): HourlyMetric[] {
  return metrics.filter((m) => m.campaignId === campaignId);
}

export function getDailyMetricsByCampaignId(
  metrics: DailyMetric[],
  campaignId: string
): DailyMetric[] {
  return metrics.filter((m) => m.campaignId === campaignId);
}
