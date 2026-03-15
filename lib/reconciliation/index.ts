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

// DB persistence helpers (ready, not yet wired to any page/route).
export {
  persistReconciliationMatches,
  persistReconciliationSummary,
} from "./persist";
