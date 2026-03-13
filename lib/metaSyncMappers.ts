// Meta Sync Mappers
//
// Pure functions that convert MetaSync* payload types (types/metaSync.ts) into
// the Prisma-compatible create-input shapes for each entity.
//
// These functions are deliberately separate from:
//   - lib/adapters.ts  (maps the older snake_case RawPlatform types)
//   - lib/db.ts        (Prisma client access)
//   - sync orchestration (lib/metaSyncOrchestrator.ts)
//
// That separation means this file can be tested in isolation and the Prisma
// schema can evolve without touching orchestration logic.

import type {
  MetaSyncAccountPayload,
  MetaSyncCampaignPayload,
  MetaSyncAdSetPayload,
  MetaSyncAdPayload,
  MetaSyncCreativePayload,
  MetaSyncHourlyMetricPayload
} from "../types/metaSync";

// ── Internal types returned by mappers ────────────────────────────────────────
// These mirror the Prisma model "create" shapes so the orchestrator can hand
// them directly to prisma.<model>.upsert() without further transformation.

export interface MappedClientAccount {
  id:       string;
  name:     string;
  platform: string;
  currency: string;
  timezone: string;
}

export interface MappedCampaign {
  id:          string;
  accountId:   string;
  name:        string;
  objective:   string;
  status:      string;
  dailyBudget: number;
}

export interface MappedAdSet {
  id:          string;
  campaignId:  string;
  name:        string;
  targeting:   string;
  dailyBudget: number;
  status:      string;
  startDate:   string;
}

export interface MappedAd {
  id:         string;
  adSetId:    string;
  creativeId: string;
  name:       string;
  status:     string;
}

export interface MappedCreative {
  id:           string;
  name:         string;
  type:         string;
  headline:     string;
  body:         string;
  callToAction: string;
}

export interface MappedUTMPerformanceRow {
  id:              string;
  clientAccountId: string;
  date:            string;
  hour?:           number | null;
  campaignId:      string;
  campaignName:    string;
  adSetId:         string | null;
  adSetName:       string | null;
  adId:            string | null;
  adName:          string | null;
  utmCampaign:     string | null;
  utmContent:      string | null;
  utmTerm:         string | null;
  utmSource:       string | null;
  utmMedium:       string | null;
  spend:           number;
  impressions:     number;
  clicks:          number;
  conversions:     number;
  revenue:         number;
  cpa:             number;
  roas:            number;
}

// ── Private helpers ───────────────────────────────────────────────────────────

function normalizeStatus(status: string): string {
  const s = status.toUpperCase();
  if (s === "ACTIVE")   return "active";
  if (s === "PAUSED")   return "paused";
  if (s === "ARCHIVED") return "archived";
  return "paused";
}

function normalizeObjective(objective: string): string {
  const map: Record<string, string> = {
    CONVERSIONS:     "conversions",
    LINK_CLICKS:     "traffic",
    REACH:           "reach",
    BRAND_AWARENESS: "brand_awareness"
  };
  return map[objective.toUpperCase()] ?? "traffic";
}

function normalizeCreativeType(type: string): string {
  const map: Record<string, string> = {
    IMAGE:    "image",
    VIDEO:    "video",
    CAROUSEL: "carousel"
  };
  return map[type.toUpperCase()] ?? "image";
}

function normalizeCallToAction(cta: string): string {
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

function toDateString(isoDatetime: string): string {
  return isoDatetime.slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Deterministic row ID derived from the composite dimensions so upserting the
// same sync payload twice is idempotent.
function metricRowId(
  accountId: string,
  campaignId: string,
  date: string,
  hour: number,
  adSetId?: string,
  adId?: string
): string {
  return `utm_sync_${accountId}_${campaignId}_${adSetId ?? "x"}_${adId ?? "x"}_${date}_h${hour}`;
}

// ── Public mapping functions ──────────────────────────────────────────────────

export function mapSyncAccount(p: MetaSyncAccountPayload): MappedClientAccount {
  return {
    id:       p.externalAccountId,
    name:     p.name,
    platform: "facebook",
    currency: p.currency,
    timezone: p.timezone
  };
}

export function mapSyncCampaign(p: MetaSyncCampaignPayload): MappedCampaign {
  return {
    id:          p.externalCampaignId,
    accountId:   p.externalAccountId,
    name:        p.name,
    objective:   normalizeObjective(p.objective),
    status:      normalizeStatus(p.status),
    dailyBudget: p.dailyBudget
  };
}

export function mapSyncAdSet(p: MetaSyncAdSetPayload): MappedAdSet {
  return {
    id:          p.externalAdSetId,
    campaignId:  p.externalCampaignId,
    name:        p.name,
    targeting:   p.targeting,
    dailyBudget: p.dailyBudget,
    status:      normalizeStatus(p.status),
    startDate:   toDateString(p.startTime)
  };
}

export function mapSyncAd(p: MetaSyncAdPayload): MappedAd {
  return {
    id:         p.externalAdId,
    adSetId:    p.externalAdSetId,
    creativeId: p.externalCreativeId,
    name:       p.name,
    status:     normalizeStatus(p.status)
  };
}

export function mapSyncCreative(p: MetaSyncCreativePayload): MappedCreative {
  return {
    id:           p.externalCreativeId,
    name:         p.name,
    type:         normalizeCreativeType(p.type),
    headline:     p.headline,
    body:         p.body,
    callToAction: normalizeCallToAction(p.callToAction)
  };
}

export function mapSyncHourlyMetric(
  p: MetaSyncHourlyMetricPayload,
  campaignName: string,
  adSetName: string | null,
  adName: string | null
): MappedUTMPerformanceRow {
  const cpa  = p.conversions > 0 ? round2(p.spend / p.conversions) : 0;
  const roas = p.spend > 0       ? round2(p.revenue / p.spend)     : 0;

  return {
    id:              metricRowId(
                       p.externalAccountId,
                       p.externalCampaignId,
                       p.date,
                       p.hour,
                       p.externalAdSetId,
                       p.externalAdId
                     ),
    clientAccountId: p.externalAccountId,
    date:            p.date,
    campaignId:      p.externalCampaignId,
    campaignName,
    adSetId:         p.externalAdSetId   ?? null,
    adSetName,
    adId:            p.externalAdId      ?? null,
    adName,
    utmCampaign:     p.utmCampaign       ?? null,
    utmContent:      p.utmContent        ?? null,
    utmTerm:         p.utmTerm           ?? null,
    utmSource:       p.utmSource         ?? null,
    utmMedium:       p.utmMedium         ?? null,
    spend:           p.spend,
    impressions:     p.impressions,
    clicks:          p.clicks,
    conversions:     p.conversions,
    revenue:         p.revenue,
    cpa,
    roas
  };
}

// ── Batch wrappers ────────────────────────────────────────────────────────────

export function mapAllSyncAccounts(
  payloads: MetaSyncAccountPayload[]
): MappedClientAccount[] {
  return payloads.map(mapSyncAccount);
}

export function mapAllSyncCampaigns(
  payloads: MetaSyncCampaignPayload[]
): MappedCampaign[] {
  return payloads.map(mapSyncCampaign);
}

export function mapAllSyncAdSets(
  payloads: MetaSyncAdSetPayload[]
): MappedAdSet[] {
  return payloads.map(mapSyncAdSet);
}

export function mapAllSyncAds(
  payloads: MetaSyncAdPayload[]
): MappedAd[] {
  return payloads.map(mapSyncAd);
}

export function mapAllSyncCreatives(
  payloads: MetaSyncCreativePayload[]
): MappedCreative[] {
  return payloads.map(mapSyncCreative);
}

// Hourly metrics need name lookups; the orchestrator builds the lookup maps
// and calls this batch helper.
export function mapAllSyncHourlyMetrics(
  payloads:      MetaSyncHourlyMetricPayload[],
  campaignNames: Map<string, string>,
  adSetNames:    Map<string, string>,
  adNames:       Map<string, string>
): MappedUTMPerformanceRow[] {
  return payloads.map((p) =>
    mapSyncHourlyMetric(
      p,
      campaignNames.get(p.externalCampaignId) ?? p.externalCampaignId,
      p.externalAdSetId ? (adSetNames.get(p.externalAdSetId) ?? null) : null,
      p.externalAdId    ? (adNames.get(p.externalAdId)       ?? null) : null
    )
  );
}
