// Raw types represent the shape of data arriving from an external ad platform
// (e.g. the Meta Ads API). Field names, casing, and value formats intentionally
// differ from internal domain models to make the adapter layer meaningful.

export interface RawAccount {
  external_id: string;
  account_name: string;
  platform_type: string;
  currency_code: string;
  timezone_name: string;
  created_time: string; // ISO datetime "YYYY-MM-DDTHH:mm:ssZ"
}

export interface RawCampaign {
  external_id: string;
  account_external_id: string;
  campaign_name: string;
  campaign_objective: string; // "CONVERSIONS" | "LINK_CLICKS" | "REACH" | "BRAND_AWARENESS"
  campaign_status: string;    // "ACTIVE" | "PAUSED" | "ARCHIVED"
  daily_budget_cents: number; // budget in smallest currency unit (cents)
  created_time: string;
}

export interface RawAdSet {
  external_id: string;
  campaign_external_id: string;
  adset_name: string;
  targeting_description: string;
  daily_budget_cents: number;
  adset_status: string;
  start_time: string;
}

export interface RawAd {
  external_id: string;
  adset_external_id: string;
  creative_external_id: string;
  ad_name: string;
  ad_status: string;
  created_time: string;
}

export interface RawCreative {
  external_id: string;
  creative_name: string;
  creative_type: string; // "IMAGE" | "VIDEO" | "CAROUSEL"
  headline_text: string;
  body_text: string;
  cta_type: string;      // "LEARN_MORE" | "SHOP_NOW" | "SIGN_UP" etc.
  created_time: string;
}

export interface RawHourlyMetric {
  external_id: string;
  account_external_id: string;
  campaign_external_id: string;
  date_start: string;       // "YYYY-MM-DD"
  hour_of_day: number;      // 0–23
  spend_amount: number;     // dollars (platform returns as float)
  impression_count: number;
  link_clicks: number;
  result_count: number;     // conversions / results
  purchase_value: number;   // attributed revenue in dollars
}
