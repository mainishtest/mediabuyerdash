// lib/creativePerformance/index.ts
// Public API for the creative performance layer.
//
// Import from here — do not import from sub-modules directly in app code.

export type {
  CreativePerformanceRow,
  CreativePerformanceMetrics,
  CreativeAttributionMethod,
  CreativeAttributionResult,
  CreativePerformanceQuery,
  CreativePerformanceSummary,
} from "./types";

export { getCreativePerformance }          from "./query";
export { aggregateCreativePerformance,
         buildCreativePerformanceSummary } from "./aggregation";
export { computeCreativeMetrics,
         safeDivide,
         round2,
         round4 }                          from "./metrics";
export { toTimezoneDate,
         dateRangeToUtc,
         attributeOrdersToAds }            from "./attribution";
