import type { UTMPerformanceRow } from "../../types/reporting";

// Denormalized UTM performance rows — what you'd get from joining
// campaign/ad-set/ad entities with UTM attribution and hourly metrics.
// Two campaigns × three creative/ad-set combos × five dates = 10 rows,
// with enough variation to make filtering demonstrably useful.
export const utmPerformanceRows: UTMPerformanceRow[] = [
  // ── Prospecting Q1 / US - Broad / Video V1 ─────────────────────────────
  {
    id: "utr_1",  date: "2024-03-01",
    clientAccountId: "act_1",
    campaignId: "camp_1", campaignName: "Prospecting Q1",
    adSetId: "adset_1",   adSetName:    "US - Broad",
    adId:    "ad_1",      adName:       "Video V1 - Broad",
    utm_campaign: "prospecting-q1",
    utm_content:  "video-v1-broad",
    utm_term:     "broad",
    utm_source:   "facebook",
    utm_medium:   "cpc",
    spend: 140.20, impressions: 12_400, clicks: 248,
    conversions: 10, revenue: 630.00, cpa: 14.02, roas: 4.49
  },
  // ── Prospecting Q1 / US - Interest / Static V1 ─────────────────────────
  {
    id: "utr_2",  date: "2024-03-01",
    clientAccountId: "act_1",
    campaignId: "camp_1", campaignName: "Prospecting Q1",
    adSetId: "adset_2",   adSetName:    "US - Interest Targeting",
    adId:    "ad_2",      adName:       "Static V1 - Interest",
    utm_campaign: "prospecting-q1",
    utm_content:  "static-v1-interest",
    utm_term:     "fitness-interest",
    utm_source:   "facebook",
    utm_medium:   "cpc",
    spend: 92.50, impressions: 8_100, clicks: 152,
    conversions: 5, revenue: 287.50, cpa: 18.50, roas: 3.11
  },
  // ── Retargeting Q1 / US - Retargeting Core / Carousel V1 ───────────────
  {
    id: "utr_3",  date: "2024-03-01",
    clientAccountId: "act_1",
    campaignId: "camp_2", campaignName: "Retargeting Q1",
    adSetId: "adset_3",   adSetName:    "US - Retargeting Core",
    adId:    "ad_3",      adName:       "Carousel V1 - Retargeting",
    utm_campaign: "retargeting-q1",
    utm_content:  "carousel-v1-retargeting",
    utm_term:     "retargeting-core",
    utm_source:   "facebook",
    utm_medium:   "cpc",
    spend: 58.40, impressions: 4_200, clicks: 114,
    conversions: 6, revenue: 342.00, cpa: 9.73, roas: 5.86
  },
  // ── Day 2 ──────────────────────────────────────────────────────────────
  {
    id: "utr_4",  date: "2024-03-02",
    clientAccountId: "act_1",
    campaignId: "camp_1", campaignName: "Prospecting Q1",
    adSetId: "adset_1",   adSetName:    "US - Broad",
    adId:    "ad_1",      adName:       "Video V1 - Broad",
    utm_campaign: "prospecting-q1",
    utm_content:  "video-v1-broad",
    utm_term:     "broad",
    utm_source:   "facebook",
    utm_medium:   "cpc",
    spend: 152.80, impressions: 13_200, clicks: 264,
    conversions: 11, revenue: 693.00, cpa: 13.89, roas: 4.53
  },
  {
    id: "utr_5",  date: "2024-03-02",
    clientAccountId: "act_1",
    campaignId: "camp_2", campaignName: "Retargeting Q1",
    adSetId: "adset_3",   adSetName:    "US - Retargeting Core",
    adId:    "ad_3",      adName:       "Carousel V1 - Retargeting",
    utm_campaign: "retargeting-q1",
    utm_content:  "carousel-v1-retargeting",
    utm_term:     "retargeting-core",
    utm_source:   "facebook",
    utm_medium:   "cpc",
    spend: 61.20, impressions: 4_500, clicks: 122,
    conversions: 7, revenue: 420.00, cpa: 8.74, roas: 6.86
  },
  // ── Day 3 ──────────────────────────────────────────────────────────────
  {
    id: "utr_6",  date: "2024-03-03",
    clientAccountId: "act_1",
    campaignId: "camp_1", campaignName: "Prospecting Q1",
    adSetId: "adset_1",   adSetName:    "US - Broad",
    adId:    "ad_1",      adName:       "Video V1 - Broad",
    utm_campaign: "prospecting-q1",
    utm_content:  "video-v1-broad",
    utm_term:     "broad",
    utm_source:   "facebook",
    utm_medium:   "cpc",
    spend: 138.60, impressions: 11_800, clicks: 236,
    conversions: 9, revenue: 558.00, cpa: 15.40, roas: 4.03
  },
  {
    id: "utr_7",  date: "2024-03-03",
    clientAccountId: "act_1",
    campaignId: "camp_1", campaignName: "Prospecting Q1",
    adSetId: "adset_2",   adSetName:    "US - Interest Targeting",
    adId:    "ad_2",      adName:       "Static V1 - Interest",
    utm_campaign: "prospecting-q1",
    utm_content:  "static-v1-interest",
    utm_term:     "fitness-interest",
    utm_source:   "facebook",
    utm_medium:   "cpc",
    spend: 88.90, impressions: 7_600, clicks: 142,
    conversions: 4, revenue: 220.00, cpa: 22.23, roas: 2.47
  },
  // ── Day 4 ──────────────────────────────────────────────────────────────
  {
    id: "utr_8",  date: "2024-03-04",
    clientAccountId: "act_1",
    campaignId: "camp_2", campaignName: "Retargeting Q1",
    adSetId: "adset_3",   adSetName:    "US - Retargeting Core",
    adId:    "ad_3",      adName:       "Carousel V1 - Retargeting",
    utm_campaign: "retargeting-q1",
    utm_content:  "carousel-v1-retargeting",
    utm_term:     "retargeting-core",
    utm_source:   "facebook",
    utm_medium:   "cpc",
    spend: 55.70, impressions: 4_000, clicks: 108,
    conversions: 5, revenue: 287.50, cpa: 11.14, roas: 5.16
  },
  // ── Day 5 ──────────────────────────────────────────────────────────────
  {
    id: "utr_9",  date: "2024-03-05",
    clientAccountId: "act_1",
    campaignId: "camp_1", campaignName: "Prospecting Q1",
    adSetId: "adset_1",   adSetName:    "US - Broad",
    adId:    "ad_1",      adName:       "Video V1 - Broad",
    utm_campaign: "prospecting-q1",
    utm_content:  "video-v1-broad",
    utm_term:     "broad",
    utm_source:   "facebook",
    utm_medium:   "cpc",
    spend: 161.40, impressions: 14_100, clicks: 282,
    conversions: 12, revenue: 756.00, cpa: 13.45, roas: 4.68
  },
  {
    id: "utr_10", date: "2024-03-05",
    clientAccountId: "act_1",
    campaignId: "camp_2", campaignName: "Retargeting Q1",
    adSetId: "adset_3",   adSetName:    "US - Retargeting Core",
    adId:    "ad_3",      adName:       "Carousel V1 - Retargeting",
    utm_campaign: "retargeting-q1",
    utm_content:  "carousel-v1-retargeting",
    utm_term:     "retargeting-core",
    utm_source:   "facebook",
    utm_medium:   "cpc",
    spend: 63.80, impressions: 4_700, clicks: 130,
    conversions: 7, revenue: 406.00, cpa: 9.11, roas: 6.36
  }
];
