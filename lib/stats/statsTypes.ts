// lib/stats/statsTypes.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared types for the Stats feature — Meta Ads Manager-style hierarchical view.
//
// These types define the API contract between the backend service and the
// frontend table component. Every row at every level (campaign, adset, ad)
// shares the same shape so the frontend can render them uniformly.
// ─────────────────────────────────────────────────────────────────────────────

/** Hierarchy levels in the Meta ad account structure. */
export type StatsLevel = "campaign" | "adset" | "ad";

/**
 * How revenue was attributed to this row.
 *
 * - "crm"        → Direct CRM match (campaign level via utmCampaign name match)
 * - "utmContent" → UTM content matched to ad ID or ad name
 * - "spendShare" → Spend-proportional fallback (no direct UTM match found)
 * - "none"       → No revenue data available for this row
 */
export type RevenueSource = "crm" | "utmContent" | "spendShare" | "none";

/**
 * A single row in the Stats table — identical shape at all hierarchy levels.
 *
 * Metric computation rules (from lib/creativePerformance/metrics.ts):
 *   CTR  = clicks / impressions * 100  → 0 when impressions = 0
 *   CPC  = spend / clicks              → null when clicks = 0
 *   CPM  = spend / impressions * 1000  → null when impressions = 0
 *   ROAS = revenue / spend             → 0 when spend = 0
 *   CPA  = spend / orders              → null when orders = 0
 */
export interface StatsRow {
  // ── Identity ──────────────────────────────────────────────────────────────
  id: string;                    // Internal DB id (cuid)
  externalId: string;            // Meta external ID (campaign/adset/ad)
  parentExternalId: string;      // Parent's external ID ("" for campaigns)
  name: string;                  // Entity name from Meta
  status: string;                // "ACTIVE" | "PAUSED" | etc.
  level: StatsLevel;             // Which hierarchy level this row represents

  // ── Delivery metrics (source: Meta via MetaSyncedInsight) ─────────────────
  spend: number;
  impressions: number;
  clicks: number;

  // ── Computed delivery metrics ─────────────────────────────────────────────
  ctr: number;                   // Click-through rate (%)
  cpm: number | null;            // Cost per thousand impressions ($)
  cpc: number | null;            // Cost per click ($)

  // ── Revenue metrics (source: CRM / Shopify — source of truth) ─────────────
  revenue: number;               // Attributed CRM revenue ($)
  orders: number;                // Attributed order count (fractional at sub-campaign)
  roas: number;                  // Return on ad spend (revenue / spend)
  cpa: number | null;            // Cost per acquisition (spend / orders)

  // ── Attribution metadata ──────────────────────────────────────────────────
  revenueSource: RevenueSource;  // How revenue was attributed to this row

  // ── Hierarchy ─────────────────────────────────────────────────────────────
  childCount: number;            // Number of direct children (for expand indicator)
}

/** Aggregate totals for the current view (rounded to 2 decimal places). */
export interface StatsTotals {
  spend: number;
  impressions: number;
  clicks: number;
  revenue: number;
  orders: number;
}

/** Standard API response for level-based queries. */
export interface StatsApiResponse {
  rows: StatsRow[];
  totals: StatsTotals;
}

/**
 * Deep search response — returns matched rows at all levels plus their
 * ancestor chain so the frontend can auto-expand the hierarchy to show matches.
 */
export interface StatsSearchResult {
  campaigns: StatsRow[];
  adSets: StatsRow[];
  ads: StatsRow[];
  /** Map of child externalId → array of ancestor externalIds (campaign, then adset). */
  ancestorMap: Record<string, string[]>;
}

/** Input filter parameters for the Stats API. */
export interface StatsFilters {
  level: StatsLevel;
  parentId?: string;
  startDate: string;             // YYYY-MM-DD (in account timezone)
  endDate: string;               // YYYY-MM-DD (in account timezone)
  activeOnly?: boolean;
  search?: string;
}
