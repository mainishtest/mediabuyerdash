import type { HourlyMetric } from "../types/media";

// --- Types -------------------------------------------------------------------

export interface MetricSummary {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  cpa: number;  // derived: spend / conversions (0 if no conversions)
  roas: number; // derived: revenue / spend (0 if no spend)
}

export interface AccountSummary extends MetricSummary {
  accountId: string;
}

export interface CampaignSummary extends MetricSummary {
  campaignId: string;
}

export interface DateSummary extends MetricSummary {
  date: string;
}

// --- Private helpers ---------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

function sumMetrics(metrics: HourlyMetric[]): MetricSummary {
  const spend       = metrics.reduce((s, m) => s + m.spend, 0);
  const impressions = metrics.reduce((s, m) => s + m.impressions, 0);
  const clicks      = metrics.reduce((s, m) => s + m.clicks, 0);
  const conversions = metrics.reduce((s, m) => s + m.conversions, 0);
  const revenue     = metrics.reduce((s, m) => s + m.revenue, 0);

  return {
    spend:       round2(spend),
    impressions,
    clicks,
    conversions,
    revenue:     round2(revenue),
    cpa:         conversions > 0 ? round2(spend / conversions) : 0,
    roas:        spend > 0 ? round2(revenue / spend) : 0
  };
}

// --- Public aggregation functions --------------------------------------------

export function aggregateByAccount(metrics: HourlyMetric[]): AccountSummary[] {
  const groups = groupBy(metrics, (m) => m.accountId);
  return Array.from(groups.entries()).map(([accountId, rows]) => ({
    accountId,
    ...sumMetrics(rows)
  }));
}

export function aggregateByCampaign(metrics: HourlyMetric[]): CampaignSummary[] {
  const groups = groupBy(metrics, (m) => m.campaignId);
  return Array.from(groups.entries()).map(([campaignId, rows]) => ({
    campaignId,
    ...sumMetrics(rows)
  }));
}

export function aggregateByDate(metrics: HourlyMetric[]): DateSummary[] {
  const groups = groupBy(metrics, (m) => m.date);
  return Array.from(groups.entries())
    .map(([date, rows]) => ({ date, ...sumMetrics(rows) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
