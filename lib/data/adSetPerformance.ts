import type { MetricSummary } from "../aggregations";

export interface AdSetPerformanceSummary extends MetricSummary {
  adSetId: string;
  campaignId: string;
}

// Sample ad-set-level performance (mirrors what aggregation would produce
// once we have adSetId on HourlyMetric rows).
export const adSetPerformance: AdSetPerformanceSummary[] = [
  {
    adSetId:    "adset_1",
    campaignId: "camp_1",
    spend:       420.30,
    impressions: 38_400,
    clicks:        748,
    conversions:    30,
    revenue:    1_890.00,
    cpa:           14.01,
    roas:           4.50
  },
  {
    adSetId:    "adset_2",
    campaignId: "camp_1",
    spend:       280.80,
    impressions: 27_100,
    clicks:        512,
    conversions:    15,
    revenue:      869.00,
    cpa:           18.72,
    roas:           3.09
  }
];
