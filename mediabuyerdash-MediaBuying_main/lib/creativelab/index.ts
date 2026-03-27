// lib/creativelab/index.ts
// Public surface area for the Creative Lab domain module.

// ---------------------------------------------------------------------------
// Performance evaluation (real Meta sync data → CRM-verified metrics)
// ---------------------------------------------------------------------------

export type {
  CreativeEvaluationStatus,
  CreativePerformanceSnapshot,
  CreativeDiagnostic,
  CreativeOpportunityType,
  CreativeOpportunity,
} from "./types";

export {
  loadCreativePerformanceData,
  buildCreativePerformanceSnapshots,
  evaluateCreative,
  // diagnoseCreative is exported with an alias to prevent collision with
  // the mock-data diagnoseCreative in lib/creativeDiagnosisUtils.ts
  diagnoseCreative as diagnoseCreativePerformance,
} from "./performance";

// ---------------------------------------------------------------------------
// Workflow foundation (queue, state model, priority derivation)
// ---------------------------------------------------------------------------

export type { BuildCreativeLabItemOpts } from "./workflowUtils";

export {
  buildCreativeLabItem,
  deriveCreativeLabPriority,
  groupCreativeLabItems,
  summarizeCreativeLab,
  normalizeCreativeLabStatus,
  attachCreativePerformanceContext,
  applyCreativeLabFilters,
} from "./workflowUtils";
