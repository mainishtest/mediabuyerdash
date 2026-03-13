// Adapter functions transform raw platform data into internal normalized models.
// Each public function maps one raw entity to one internal entity.
// Private helpers handle all the translation details (status, objective, etc.).

import type {
  RawAccount,
  RawCampaign,
  RawAdSet,
  RawAd,
  RawCreative,
  RawHourlyMetric
} from "../types/rawPlatform";

import type {
  ClientAccount,
  Campaign,
  AdSet,
  Ad,
  Creative,
  HourlyMetric,
  Weekday
} from "../types/media";

// --- Private helpers ---------------------------------------------------------

function mapStatus(platformStatus: string): "active" | "paused" | "archived" {
  const map: Record<string, "active" | "paused" | "archived"> = {
    ACTIVE: "active",
    PAUSED: "paused",
    ARCHIVED: "archived"
  };
  return map[platformStatus.toUpperCase()] ?? "paused";
}

function mapObjective(obj: string): Campaign["objective"] {
  const map: Record<string, Campaign["objective"]> = {
    CONVERSIONS:     "conversions",
    LINK_CLICKS:     "traffic",
    REACH:           "reach",
    BRAND_AWARENESS: "brand_awareness"
  };
  return map[obj.toUpperCase()] ?? "traffic";
}

function mapCreativeType(type: string): Creative["type"] {
  const map: Record<string, Creative["type"]> = {
    IMAGE:    "image",
    VIDEO:    "video",
    CAROUSEL: "carousel"
  };
  return map[type.toUpperCase()] ?? "image";
}

function mapCallToAction(cta: string): string {
  const map: Record<string, string> = {
    LEARN_MORE: "Learn More",
    SHOP_NOW:   "Shop Now",
    SIGN_UP:    "Sign Up",
    GET_QUOTE:  "Get Quote",
    CONTACT_US: "Contact Us",
    DOWNLOAD:   "Download"
  };
  return map[cta.toUpperCase()] ?? cta;
}

function getWeekday(dateStr: string): Weekday {
  const days: Weekday[] = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
  ];
  const date = new Date(`${dateStr}T12:00:00Z`);
  return days[date.getUTCDay()];
}

function centsToDollars(cents: number): number {
  return cents / 100;
}

function toDateString(isoDatetime: string): string {
  return isoDatetime.slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// --- Public mapping functions ------------------------------------------------

export function mapRawAccountToClientAccount(raw: RawAccount): ClientAccount {
  return {
    id:        raw.external_id,
    name:      raw.account_name,
    platform:  "facebook",
    currency:  raw.currency_code,
    timezone:  raw.timezone_name,
    createdAt: toDateString(raw.created_time)
  };
}

export function mapRawCampaignToCampaign(raw: RawCampaign): Campaign {
  return {
    id:            raw.external_id,
    accountId:     raw.account_external_id,
    name:          raw.campaign_name,
    objective:     mapObjective(raw.campaign_objective),
    status:        mapStatus(raw.campaign_status),
    dailyBudget:   centsToDollars(raw.daily_budget_cents),
    createdAt:     toDateString(raw.created_time),
    // Goals are configured post-ingestion; use safe defaults when mapping raw data
    roasGoalType:  "high",
    roasGoalValue: 2.0,
    cpaGoalType:   "low",
    cpaGoalValue:  25.00
  };
}

export function mapRawAdSetToAdSet(raw: RawAdSet): AdSet {
  return {
    id:          raw.external_id,
    campaignId:  raw.campaign_external_id,
    name:        raw.adset_name,
    targeting:   raw.targeting_description,
    dailyBudget: centsToDollars(raw.daily_budget_cents),
    status:      mapStatus(raw.adset_status),
    startDate:   toDateString(raw.start_time)
  };
}

export function mapRawAdToAd(raw: RawAd): Ad {
  return {
    id:         raw.external_id,
    adSetId:    raw.adset_external_id,
    creativeId: raw.creative_external_id,
    name:       raw.ad_name,
    status:     mapStatus(raw.ad_status),
    createdAt:  toDateString(raw.created_time)
  };
}

export function mapRawCreativeToCreative(raw: RawCreative): Creative {
  return {
    id:           raw.external_id,
    name:         raw.creative_name,
    type:         mapCreativeType(raw.creative_type),
    headline:     raw.headline_text,
    body:         raw.body_text,
    callToAction: mapCallToAction(raw.cta_type),
    createdAt:    toDateString(raw.created_time)
  };
}

export function mapRawHourlyMetricToHourlyMetric(
  raw: RawHourlyMetric
): HourlyMetric {
  const cpa  = raw.result_count > 0  ? raw.spend_amount   / raw.result_count  : 0;
  const roas = raw.spend_amount  > 0  ? raw.purchase_value / raw.spend_amount  : 0;

  return {
    id:          raw.external_id,
    accountId:   raw.account_external_id,
    campaignId:  raw.campaign_external_id,
    date:        raw.date_start,
    weekday:     getWeekday(raw.date_start),
    hour:        raw.hour_of_day,
    spend:       raw.spend_amount,
    impressions: raw.impression_count,
    clicks:      raw.link_clicks,
    conversions: raw.result_count,
    revenue:     raw.purchase_value,
    cpa:         round2(cpa),
    roas:        round2(roas)
  };
}

// --- Batch convenience wrappers ----------------------------------------------

export function mapAllRawAccounts(raws: RawAccount[]): ClientAccount[] {
  return raws.map(mapRawAccountToClientAccount);
}

export function mapAllRawCampaigns(raws: RawCampaign[]): Campaign[] {
  return raws.map(mapRawCampaignToCampaign);
}

export function mapAllRawAdSets(raws: RawAdSet[]): AdSet[] {
  return raws.map(mapRawAdSetToAdSet);
}

export function mapAllRawAds(raws: RawAd[]): Ad[] {
  return raws.map(mapRawAdToAd);
}

export function mapAllRawCreatives(raws: RawCreative[]): Creative[] {
  return raws.map(mapRawCreativeToCreative);
}

export function mapAllRawHourlyMetrics(raws: RawHourlyMetric[]): HourlyMetric[] {
  return raws.map(mapRawHourlyMetricToHourlyMetric);
}
