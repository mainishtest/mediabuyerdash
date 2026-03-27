// Integration and reconciliation domain types.
// Kept separate from types/media.ts (the ad-hierarchy domain) so each
// concern can evolve independently.

// --- Shared ------------------------------------------------------------------

export type IntegrationPlatform = "meta" | "shopify" | "konnective";
export type ConnectionStatus    = "connected" | "disconnected" | "pending" | "error";

// Generic record for any connected external platform.
export interface IntegrationConnection {
  id:                 string;
  platform:           IntegrationPlatform;
  label:              string;
  status:             ConnectionStatus;
  accountIdentifier?: string;  // e.g., ad account ID, store URL
  connectedAt?:       string;  // ISO date when last connected
}

// --- Meta / Facebook ---------------------------------------------------------

// Represents a Meta ad account that is accessible via a connected Facebook user.
// isSelected tracks whether the agency has added it to this dashboard.
export interface MetaAdAccountConnection {
  id:            string;  // e.g., "act_111111" — Meta's format
  name:          string;
  currency:      string;
  timezone:      string;
  businessName?: string;
  isSelected:    boolean;
}

// --- CRM connections ---------------------------------------------------------

export interface CRMConnection {
  id:           string;
  platform:     "shopify" | "konnective";
  label:        string;
  status:       ConnectionStatus;
  storeUrl?:    string;    // Shopify store URL
  apiEndpoint?: string;    // Konnective or generic API endpoint
  connectedAt?: string;
}

// --- UTM attribution ---------------------------------------------------------

// Normalised UTM fields tied to a reporting row.
// These come from CRM/analytics sources and can be joined to internal
// campaign/ad set/ad entities via optional FK fields.
export interface UTMAttribution {
  id:           string;
  date:         string;
  utmSource?:   string;
  utmMedium?:   string;
  utmCampaign?: string;
  utmContent?:  string;
  utmTerm?:     string;
  campaignId?:  string;   // FK → Campaign.id
  adSetId?:     string;   // FK → AdSet.id
  adId?:        string;   // FK → Ad.id
  sessions:     number;
  orders:       number;
  revenue:      number;
}

// --- CRM performance metrics -------------------------------------------------

// Source-of-truth sales / revenue rows from a CRM system.
// These represent what actually happened in the store / order system,
// which may differ from what Meta reports.
export interface CRMPerformanceMetric {
  id:               string;
  date:             string;
  source:           "shopify" | "konnective";
  utmCampaign?:     string;
  utmContent?:      string;
  campaignId?:      string;
  orders:           number;
  revenue:          number;
  averageOrderValue: number;
  refunds:          number;
  netRevenue:       number;
}

// --- Reconciliation ----------------------------------------------------------

// Compares Meta-reported metrics against CRM-reported metrics at the
// campaign + date level (keyed by utm_campaign for cross-platform matching).
// revenueDeltaPct and discrepancyFlag are derived on creation.
export interface ReconciliationRecord {
  id:               string;
  date:             string;
  campaignId:       string;
  campaignName:     string;
  utmCampaign?:     string;
  // Meta-reported
  metaSpend:        number;
  metaConversions:  number;
  metaRevenue:      number;   // Meta attributed revenue
  metaRoas:         number;
  // CRM-reported
  crmOrders:        number;
  crmRevenue:       number;   // Actual revenue from CRM
  crmRoas:          number;   // crmRevenue / metaSpend
  // Derived
  revenueDelta:     number;   // crmRevenue − metaRevenue
  revenueDeltaPct:  number;   // delta as % of metaRevenue
  discrepancyFlag:  boolean;  // true when |delta| > 20 % of metaRevenue
}
