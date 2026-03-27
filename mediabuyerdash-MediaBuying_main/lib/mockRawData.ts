// Mock raw platform payload — simulates data arriving from the Meta Ads API.
// Field names and formats match RawPlatform types, not internal models.
// Replace this file with a real fetch when live ingestion is added.

import type {
  RawAccount,
  RawCampaign,
  RawAdSet,
  RawAd,
  RawCreative,
  RawHourlyMetric
} from "../types/rawPlatform";

export const mockRawAccounts: RawAccount[] = [
  {
    external_id: "act_ext_001",
    account_name: "Agency Main Account",
    platform_type: "facebook",
    currency_code: "USD",
    timezone_name: "America/New_York",
    created_time: "2024-03-01T00:00:00Z"
  }
];

export const mockRawCampaigns: RawCampaign[] = [
  {
    external_id: "camp_ext_001",
    account_external_id: "act_ext_001",
    campaign_name: "Spring Prospecting 2024",
    campaign_objective: "CONVERSIONS",
    campaign_status: "ACTIVE",
    daily_budget_cents: 15000,
    created_time: "2024-03-01T00:00:00Z"
  },
  {
    external_id: "camp_ext_002",
    account_external_id: "act_ext_001",
    campaign_name: "Spring Retargeting 2024",
    campaign_objective: "LINK_CLICKS",
    campaign_status: "PAUSED",
    daily_budget_cents: 8000,
    created_time: "2024-03-02T00:00:00Z"
  }
];

export const mockRawAdSets: RawAdSet[] = [
  {
    external_id: "adset_ext_001",
    campaign_external_id: "camp_ext_001",
    adset_name: "US Broad 25-54",
    targeting_description: "US, ages 25–54, broad audience",
    daily_budget_cents: 7500,
    adset_status: "ACTIVE",
    start_time: "2024-03-01T00:00:00Z"
  },
  {
    external_id: "adset_ext_002",
    campaign_external_id: "camp_ext_001",
    adset_name: "US Interest Health",
    targeting_description: "US, ages 25–44, health and wellness interests",
    daily_budget_cents: 7500,
    adset_status: "ACTIVE",
    start_time: "2024-03-01T00:00:00Z"
  }
];

export const mockRawAds: RawAd[] = [
  {
    external_id: "ad_ext_001",
    adset_external_id: "adset_ext_001",
    creative_external_id: "cr_ext_001",
    ad_name: "Spring Video Ad - Broad",
    ad_status: "ACTIVE",
    created_time: "2024-03-01T00:00:00Z"
  },
  {
    external_id: "ad_ext_002",
    adset_external_id: "adset_ext_002",
    creative_external_id: "cr_ext_002",
    ad_name: "Spring Image Ad - Health",
    ad_status: "ACTIVE",
    created_time: "2024-03-01T00:00:00Z"
  }
];

export const mockRawCreatives: RawCreative[] = [
  {
    external_id: "cr_ext_001",
    creative_name: "Spring Video v1",
    creative_type: "VIDEO",
    headline_text: "See Real Results This Spring",
    body_text: "Thousands of customers trust us for better outcomes every season.",
    cta_type: "LEARN_MORE",
    created_time: "2024-03-01T00:00:00Z"
  },
  {
    external_id: "cr_ext_002",
    creative_name: "Spring Image v1",
    creative_type: "IMAGE",
    headline_text: "Spring Into Action",
    body_text: "Limited time offer. Don't miss out on our best deals.",
    cta_type: "SHOP_NOW",
    created_time: "2024-03-01T00:00:00Z"
  }
];

export const mockRawHourlyMetrics: RawHourlyMetric[] = [
  {
    external_id: "hm_ext_001",
    account_external_id: "act_ext_001",
    campaign_external_id: "camp_ext_001",
    date_start: "2024-03-04",
    hour_of_day: 8,
    spend_amount: 19.40,
    impression_count: 1920,
    link_clicks: 38,
    result_count: 2,
    purchase_value: 124.00
  },
  {
    external_id: "hm_ext_002",
    account_external_id: "act_ext_001",
    campaign_external_id: "camp_ext_001",
    date_start: "2024-03-04",
    hour_of_day: 10,
    spend_amount: 27.80,
    impression_count: 2650,
    link_clicks: 53,
    result_count: 2,
    purchase_value: 136.00
  },
  {
    external_id: "hm_ext_003",
    account_external_id: "act_ext_001",
    campaign_external_id: "camp_ext_001",
    date_start: "2024-03-04",
    hour_of_day: 15,
    spend_amount: 42.10,
    impression_count: 3580,
    link_clicks: 62,
    result_count: 1,
    purchase_value: 68.00
  }
];
