import type { MetricSummary } from "../aggregations";

export interface AdPerformanceSummary extends MetricSummary {
  adId: string;
  adSetId: string;
  campaignId: string;
}

// Sample ad-level performance summaries.
export const adPerformance: AdPerformanceSummary[] = [
  {
    adId:        "ad_1",
    adSetId:     "adset_1",
    campaignId:  "camp_1",
    spend:        420.30,
    impressions:  38_400,
    clicks:          748,
    conversions:      34,
    revenue:     1_890.00,
    cpa:            12.36,
    roas:            4.50
  },
  {
    adId:        "ad_2",
    adSetId:     "adset_2",
    campaignId:  "camp_1",
    spend:        280.80,
    impressions:  27_100,
    clicks:          512,
    conversions:      12,
    revenue:       750.00,
    cpa:            23.40,
    roas:            2.67
  }
];
