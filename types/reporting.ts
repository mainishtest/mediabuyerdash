// UTM-aware reporting types.
// Kept separate from types/media.ts (ad hierarchy), types/integrations.ts
// (connection models), and types/metaConnection.ts (OAuth flow) so each layer
// can evolve at its own pace.

// --- Dimensions and filters --------------------------------------------------

// Every supported filter / grouping axis in the reporting UI.
export type ReportingDimension =
  | "campaignName"
  | "adSetName"
  | "adName"
  | "utm_campaign"
  | "utm_content"
  | "utm_term"
  | "utm_source"
  | "utm_medium";

// A single option for a dropdown filter (label shown to user, value matched against data).
export interface FilterOption {
  label: string;
  value: string;
}

// The full filter state for the reporting UI.
// null means "no filter applied" for that dimension.
export interface ReportingFilterState {
  campaignName: string | null;
  adSetName:    string | null;
  adName:       string | null;
  utm_campaign: string | null;
  utm_content:  string | null;
  utm_term:     string | null;
}

// --- Reporting rows ----------------------------------------------------------

// A denormalized, reporting-friendly row that joins entity names, UTM fields,
// and performance metrics into a single flat object.
// This is what gets displayed in tables and filtered/grouped in the UI.
// In production these rows would come from a DB query joining campaigns,
// ad sets, ads, metrics, and UTM attribution records.
export interface UTMPerformanceRow {
  id:              string;
  date:            string;          // ISO date
  clientAccountId: string;
  // Ad hierarchy (IDs + human-readable names for display)
  campaignId:      string;
  campaignName:    string;
  adSetId:         string;
  adSetName:       string;
  adId:            string;
  adName:          string;
  // UTM fields (snake_case matching actual URL parameter names)
  utm_campaign?:   string;
  utm_content?:    string;
  utm_term?:       string;
  utm_source?:     string;
  utm_medium?:     string;
  // Performance metrics
  spend:           number;
  impressions:     number;
  clicks:          number;
  conversions:     number;
  revenue:         number;
  cpa:             number;   // derived: spend / conversions
  roas:            number;   // derived: revenue / spend
}

// --- Summary -----------------------------------------------------------------

// Computed from whatever set of rows is currently visible after filtering.
export interface ReportingSummary {
  rowCount:         number;
  totalSpend:       number;
  totalConversions: number;
  totalRevenue:     number;
  avgCpa:           number;
  avgRoas:          number;
}
