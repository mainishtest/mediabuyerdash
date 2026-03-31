// lib/stats/statsTypes.ts
// Shared types for the Stats feature — Meta Ads Manager-style hierarchical view.

export type StatsLevel = "campaign" | "adset" | "ad";

export type RevenueSource =
  | "crm"          // Direct CRM attribution (campaign level via utmCampaign)
  | "utmContent"   // UTM content match to ad ID or ad name
  | "spendShare"   // Spend-proportional fallback distribution
  | "none";        // No revenue data available

export interface StatsRow {
  id: string;
  externalId: string;
  parentExternalId: string;
  name: string;
  status: string;
  level: StatsLevel;

  // Delivery metrics (Meta)
  spend: number;
  impressions: number;
  clicks: number;

  // Computed delivery metrics
  ctr: number;          // (clicks/impressions)*100; 0 when impressions=0
  cpm: number | null;   // (spend/impressions)*1000; null when impressions=0
  cpc: number | null;   // spend/clicks; null when clicks=0

  // Revenue metrics (CRM-attributed)
  revenue: number;
  orders: number;       // fractional at sub-campaign levels (spend-share)
  roas: number;         // revenue/spend; 0 when spend=0
  cpa: number | null;   // spend/orders; null when orders=0

  // Attribution provenance
  revenueSource: RevenueSource;

  // For expand indicator
  childCount: number;
}

export interface StatsTotals {
  spend: number;
  impressions: number;
  clicks: number;
  revenue: number;
  orders: number;
}

export interface StatsApiResponse {
  rows: StatsRow[];
  totals: StatsTotals;
}

// Deep search returns rows with their ancestor chain for hierarchy preservation
export interface StatsSearchResult {
  campaigns: StatsRow[];
  adSets: StatsRow[];
  ads: StatsRow[];
  // Map of child externalId -> parent externalId for auto-expand
  ancestorMap: Record<string, string[]>;
}

export interface StatsFilters {
  level: StatsLevel;
  parentId?: string;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  activeOnly?: boolean;
  search?: string;
}
