// lib/reconciliation/index.ts
// Public API for the reconciliation engine.
// Import from this file rather than individual modules.

export {
  DEFAULT_ATTRIBUTION_WINDOW_DAYS,
  normalizeUtmValue,
  buildReconciliationMatchKey,
  buildPartialMatchKey,
  calculateEvaluatedCpa,
  calculateEvaluatedRoas,
} from "./utils";

export { reconcileMetaRowsWithShopifyOrders } from "./matchEngine";

export { summarizeReconciliationResults } from "./summarize";

// DB persistence helpers.
export {
  persistReconciliationMatches,
  persistReconciliationSummary,
  persistCampaignPerformance,
  loadCampaignPerformance,
} from "./persist";

// Per-campaign attribution and roll-up (4 named functions).
export {
  matchOrdersToCampaigns,
  attributeOrdersToCampaigns,
  aggregateCampaignRevenue,
  calculateCampaignPerformance,
} from "./campaignPerformance";
export type {
  OrderRecord,
  MetaCampaignSpend,
  AttributedOrder,
  CampaignRevenueAggregate,
  CampaignPerformanceRow,
} from "./campaignPerformance";
