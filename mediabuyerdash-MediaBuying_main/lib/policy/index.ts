// lib/policy/index.ts
// Public exports for the Action Safety Policy layer.
//
// Import from "../../lib/policy" (or "../lib/policy") in consuming modules.

// Types
export type {
  AutonomyMode,
  ActionType,
  ActionSafetyScope,
  ActionPermissionState,
  ActionSafetyReason,
  ActionSafetyDecision,
  ActionSafetyPolicyRecord,
  ActionConstraint,
  PolicyEvaluationContext,
  ActionSafetySummary,
  ConstraintSummary,
  UpsertPolicyInput,
} from "./types";

// Defaults and constants
export {
  ALL_ACTION_TYPES,
  AUTO_EXECUTE_ELIGIBLE,
  NEVER_AUTO_EXECUTE,
  AUTONOMY_MODE_LABELS,
  AUTONOMY_MODE_DESCRIPTIONS,
  ACTION_TYPE_LABELS,
  ACTION_TYPE_RISK,
  AUTONOMY_MODE_ORDER,
  isMoreRestrictive,
  buildSystemDefaultPolicy,
  DEFAULT_BUDGET_DECREASE_CONSTRAINTS,
  DEFAULT_PAUSE_CONSTRAINTS,
} from "./defaults";

// Core evaluation
export {
  evaluateActionSafetyPolicy,
  resolveAutonomyModeForScope,
  buildActionSafetyDecision,
  computePermissionState,
} from "./evaluate";

// Permission summaries
export {
  buildActionSafetySummary,
  buildActionSafetySummaryFromPolicies,
  getEffectiveActionPermissions,
  summarizeActionConstraints,
  isActionPermitted,
  requiresApproval,
  isAutoExecutable,
} from "./permissions";

// DB access
export {
  loadPoliciesForContext,
  loadWorkspacePolicies,
  loadScopePolicy,
  upsertScopePolicy,
  deactivateScopePolicy,
} from "./persist";
