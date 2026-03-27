// Meta Sync Contract Types
//
// These types define the shape of data the app expects to receive from the
// Meta Ads API in the future. They are intentionally distinct from both the
// raw platform types (types/rawPlatform.ts) and the internal domain types
// (types/media.ts) so the sync contract can evolve independently.
//
// Field names follow Meta API conventions (camelCase with "external" prefix
// for IDs) rather than snake_case raw format, making them cleaner to work
// with once real OAuth + API clients are in place.

// ── Entity payloads ───────────────────────────────────────────────────────────

export interface MetaSyncAccountPayload {
  externalAccountId: string;     // Meta format: act_XXXXXXX
  name:              string;
  currency:          string;
  timezone:          string;
  businessName?:     string;
  accountStatus:     "ACTIVE" | "DISABLED" | "UNSETTLED";
}

export interface MetaSyncCampaignPayload {
  externalCampaignId: string;
  externalAccountId:  string;
  name:               string;
  objective:          string;    // CONVERSIONS | LINK_CLICKS | REACH | BRAND_AWARENESS
  status:             string;    // ACTIVE | PAUSED | ARCHIVED
  dailyBudget:        number;    // in account currency (dollars, not cents)
  createdTime:        string;    // ISO datetime
}

export interface MetaSyncAdSetPayload {
  externalAdSetId:    string;
  externalCampaignId: string;
  name:               string;
  targeting:          string;    // human-readable targeting description
  dailyBudget:        number;
  status:             string;
  startTime:          string;    // ISO datetime
}

export interface MetaSyncAdPayload {
  externalAdId:       string;
  externalAdSetId:    string;
  externalCreativeId: string;
  name:               string;
  status:             string;
  createdTime:        string;
}

export interface MetaSyncCreativePayload {
  externalCreativeId: string;
  name:               string;
  type:               "IMAGE" | "VIDEO" | "CAROUSEL";
  headline:           string;
  body:               string;
  callToAction:       string;    // LEARN_MORE | SHOP_NOW | SIGN_UP | GET_QUOTE etc.
  createdTime:        string;
}

export interface MetaSyncHourlyMetricPayload {
  externalAccountId:  string;
  externalCampaignId: string;
  externalAdSetId?:   string;
  externalAdId?:      string;
  date:               string;    // YYYY-MM-DD
  hour:               number;    // 0–23
  spend:              number;    // dollars
  impressions:        number;
  clicks:             number;
  conversions:        number;    // results / purchases
  revenue:            number;    // attributed purchase value
  utmCampaign?:       string;
  utmContent?:        string;
  utmTerm?:           string;
  utmSource?:         string;
  utmMedium?:         string;
}

// ── Full sync batch ───────────────────────────────────────────────────────────

// All entity arrays together in one batch — the top-level payload shape
// returned by a sync run (or mock data file).
export interface MetaSyncPayload {
  accounts:      MetaSyncAccountPayload[];
  campaigns:     MetaSyncCampaignPayload[];
  adSets:        MetaSyncAdSetPayload[];
  ads:           MetaSyncAdPayload[];
  creatives:     MetaSyncCreativePayload[];
  hourlyMetrics: MetaSyncHourlyMetricPayload[];
}

// ── Sync job tracking ─────────────────────────────────────────────────────────

export type MetaSyncJobStatus =
  | "idle"
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type MetaSyncType =
  | "full"       // all entity types
  | "metrics"    // hourly metrics only
  | "structure"; // accounts + campaigns + ad sets + ads only

// Internal record used to track the state of a sync attempt.
// In production this would be persisted in the database.
export interface MetaSyncJob {
  id:                  string;
  connectionId:        string;         // FK → MetaConnection.id
  selectedAdAccountId: string;         // act_XXXXXXX
  syncType:            MetaSyncType;
  status:              MetaSyncJobStatus;
  startedAt:           string | null;  // ISO datetime
  completedAt:         string | null;
  errorMessage:        string | null;
}

// ── Sync result summary ───────────────────────────────────────────────────────

// Returned by the sync orchestrator after a run completes.
export interface MetaSyncSummary {
  jobId:             string;
  status:            MetaSyncJobStatus;
  accountsProcessed: number;
  campaignsProcessed: number;
  adSetsProcessed:   number;
  adsProcessed:      number;
  creativesProcessed: number;
  metricsProcessed:  number;
  errorsCount:       number;
  startedAt:         string;
  completedAt:       string;
  durationMs:        number;
  errors:            string[];
}
