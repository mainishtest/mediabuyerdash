// types/outcomeActions.ts
// Typed models for the automated scale and loser-handling recommendation layer.
//
// Design rules:
//   - Recommendations are read-only output — they never mutate campaigns.
//   - Approval always routes through the existing automation approval workflow.
//   - Plans (scale / loser / follow-up) are structured context, not execution orders.
//   - Readiness gates prevent premature or low-confidence action proposals.

// ---------------------------------------------------------------------------
// Core enumerations
// ---------------------------------------------------------------------------

export type OutcomeActionType =
  | "scale_winner_budget"         // increase budget for the winning creative
  | "duplicate_winner_to_new_test" // clone winner into a fresh A/B test
  | "keep_winner_running"          // leave current winner in place, monitor
  | "pause_loser_candidate"        // flag loser for pause review
  | "reduce_loser_budget"          // propose a budget reduction for the loser
  | "send_loser_to_creative_lab"   // return the losing variant for creative refresh
  | "launch_follow_up_experiment"  // plan the next iteration test
  | "monitor_only";                // no immediate action, keep watching

export type OutcomeActionPriority = "low" | "medium" | "high" | "urgent";

export type ActionReadinessState =
  | "not_ready"           // missing data, no outcome, or confidence too low
  | "review_required"     // preliminary — needs operator review before approval
  | "ready_for_approval"  // all checks passed — can be submitted for approval
  | "approval_blocked"    // blockers prevent approval until resolved
  | "ready_for_execution"; // (future) fully approved and ready — not used yet

export type OutcomeActionReason =
  | "high_confidence_winner"
  | "low_confidence_result"
  | "insufficient_spend"
  | "insufficient_conversions"
  | "poor_roas_economics"
  | "strong_roas_signal"
  | "weak_roas_signal"
  | "mixed_signals"
  | "test_failed_no_data"
  | "control_maintained_advantage"
  | "evaluation_window_complete"
  | "evaluation_window_incomplete"
  | "challenger_showed_lift"
  | "loser_has_material_spend";

// ---------------------------------------------------------------------------
// Scale plan — what scaling the winner would look like
// ---------------------------------------------------------------------------

export type ScalePlan = {
  targetVariant:              "control" | "challenger";
  currentSpend:               number;
  suggestedBudgetMultiplier:  number;     // e.g. 1.5 = 50% increase
  suggestedDailyBudgetNote:   string;     // human-readable note, not an execution order
  scaleRationale:             string;
  safetyChecks:               string[];   // what to verify before scaling
  requiredApprovals:          string[];   // approval steps needed
  automationActionType:       string;     // maps to increase_budget in automation layer
};

// ---------------------------------------------------------------------------
// Loser handling plan — what to do with the underperforming variant
// ---------------------------------------------------------------------------

export type LoserHandlingPlan = {
  targetVariant:   "control" | "challenger";
  currentSpend:    number;
  currentRoas:     number;
  suggestedAction: "pause_review" | "reduce_budget" | "send_to_lab";
  actionRationale: string;
  safeguards:      string[];
  briefLabLink:    string | null;   // pre-built URL to Creative Lab
};

// ---------------------------------------------------------------------------
// Follow-up experiment plan — next iteration direction
// ---------------------------------------------------------------------------

export type FollowUpExperimentPlan = {
  suggestedDirection:   string;   // human-readable creative direction
  suggestedBriefIntent: string;   // matches CreativeBrief.intent
  suggestedDraftType:   string;   // matches CreativeBrief.draftType
  controlVariantChoice: "keep_current_winner" | "use_challenger" | "start_fresh";
  rationale:            string;
};

// ---------------------------------------------------------------------------
// Main recommendation entity
// ---------------------------------------------------------------------------

export type OutcomeActionRecommendation = {
  id:           string;          // deterministic: `${experimentId}_${actionType}`
  experimentId: string;
  actionType:   OutcomeActionType;
  priority:     OutcomeActionPriority;
  readiness:    ActionReadinessState;

  title:     string;
  rationale: string;
  reasons:   OutcomeActionReason[];
  blockers:  string[];

  // Structured plans — only one relevant per action type
  scalePlan:          ScalePlan | null;
  loserHandlingPlan:  LoserHandlingPlan | null;
  followUpPlan:       FollowUpExperimentPlan | null;

  // Related entity for deep-link navigation
  relatedEntityType: "campaign" | "creative" | "experiment" | "brief" | "publish_prep" | null;
  relatedEntityId:   string | null;
  relatedEntityName: string | null;

  // When approved, which automation action type to propose
  automationActionType: string | null;

  generatedAt: string;
};

// ---------------------------------------------------------------------------
// Summary — aggregate counts for the actions dashboard
// ---------------------------------------------------------------------------

export type OutcomeActionSummary = {
  experimentId: string;
  experimentName: string;
  outcome:      string;
  totalActions: number;
  urgentCount:  number;
  highCount:    number;
  readyForApproval: number;
  blockedCount: number;
  topActionType: OutcomeActionType | null;
  topPriority:   OutcomeActionPriority | null;
};

// ---------------------------------------------------------------------------
// Display metadata
// ---------------------------------------------------------------------------

export const ACTION_TYPE_LABEL: Record<OutcomeActionType, string> = {
  scale_winner_budget:          "Scale Winner Budget",
  duplicate_winner_to_new_test: "Duplicate Winner to New Test",
  keep_winner_running:          "Keep Winner Running",
  pause_loser_candidate:        "Review Loser for Pause",
  reduce_loser_budget:          "Reduce Loser Budget",
  send_loser_to_creative_lab:   "Send Loser to Creative Lab",
  launch_follow_up_experiment:  "Launch Follow-up Experiment",
  monitor_only:                 "Monitor Only",
};

export const ACTION_PRIORITY_LABEL: Record<OutcomeActionPriority, string> = {
  low:    "Low",
  medium: "Medium",
  high:   "High",
  urgent: "Urgent",
};

export const ACTION_PRIORITY_COLOR: Record<OutcomeActionPriority, string> = {
  low:    "text-slate-400",
  medium: "text-amber-400",
  high:   "text-orange-400",
  urgent: "text-rose-400",
};

export const ACTION_PRIORITY_BG: Record<OutcomeActionPriority, string> = {
  low:    "border-slate-700 bg-slate-900/40",
  medium: "border-amber-700/40 bg-amber-950/20",
  high:   "border-orange-700/40 bg-orange-950/20",
  urgent: "border-rose-700/50 bg-rose-950/25",
};

export const READINESS_LABEL: Record<ActionReadinessState, string> = {
  not_ready:           "Not Ready",
  review_required:     "Review Required",
  ready_for_approval:  "Ready for Approval",
  approval_blocked:    "Approval Blocked",
  ready_for_execution: "Ready for Execution",
};

export const READINESS_COLOR: Record<ActionReadinessState, string> = {
  not_ready:           "text-slate-500",
  review_required:     "text-amber-400",
  ready_for_approval:  "text-emerald-400",
  approval_blocked:    "text-rose-400",
  ready_for_execution: "text-emerald-300",
};
