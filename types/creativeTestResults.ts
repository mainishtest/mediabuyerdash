// types/creativeTestResults.ts
// Typed models for Creative Performance Results Ingestion and Test Outcome Tracking.
//
// Design rules:
//   - Pure TypeScript — no imports from lib/ to avoid circular deps.
//   - CRM data (ROAS/CPA) is the source of truth. Attribution window is 7 days.
//   - Outcome detection is declarative — no autonomous mutations.
//   - Lifecycle links explicitly wire results back to source creative drafts.
//   - Reuses ExperimentRecord for raw evaluation; adds creative-lab-centric context.

// ---------------------------------------------------------------------------
// Tracking state lifecycle
// ---------------------------------------------------------------------------

export type CreativeTestTrackingState =
  | "pending_launch" // launch plan exists but experiment not yet active
  | "active"         // experiment running, evaluation window not yet complete
  | "evaluating"     // window complete, awaiting ingestion and evaluation
  | "completed"      // has a final outcome
  | "stale"          // data is outdated or experiment was abandoned
  | "blocked";       // missing mapping or data — cannot proceed

// ---------------------------------------------------------------------------
// Outcome values
// ---------------------------------------------------------------------------

export type CreativeTestOutcome =
  | "in_progress"      // test is active, window not yet complete
  | "insufficient_data"  // data volume too low to conclude
  | "no_clear_winner"    // lift within threshold — no meaningful difference
  | "challenger_wins"    // challenger beats control on primary metric
  | "control_holds"      // control outperforms challenger
  | "mixed_result"       // primary and secondary metrics disagree
  | "failed_test"        // no delivery data or technical failure
  | "archived";          // closed without conclusion

// ---------------------------------------------------------------------------
// Metric snapshot — performance of one variant over the evaluation window
// ---------------------------------------------------------------------------

export type CreativeTestMetricSnapshot = {
  role:         "control" | "challenger";
  label:        string;
  creativeName: string | null;
  creativeId:   string | null;
  adExternalId: string | null;
  // Window
  windowStart:  string;   // YYYY-MM-DD
  windowEnd:    string;   // YYYY-MM-DD
  // Delivery (Meta — operational)
  spend:        number;
  impressions:  number;
  clicks:       number;
  ctr:          number;
  cpm:          number;
  // Business outcomes (CRM — source of truth, 7-day attribution)
  orders:       number;
  revenue:      number;
  roas:         number;
  cpa:          number;
  // Data quality
  dataSource:   "crm_and_meta" | "meta_only" | "crm_estimated" | "incomplete";
  isComplete:   boolean;
  missingFields: string[];
};

// ---------------------------------------------------------------------------
// Comparison — delta between control and challenger
// ---------------------------------------------------------------------------

export type CreativeTestComparison = {
  primaryMetric:   string;
  primaryDelta:    number;    // absolute: challenger - control
  primaryLift:     number;    // relative: (challenger - control) / control
  secondaryDeltas: Record<string, { delta: number; lift: number }>;
  guardrailBreaches:           string[];
  isStatisticallyMeaningful:   boolean;
  confidenceNote:              string;
};

// ---------------------------------------------------------------------------
// Evaluation window — time-based progress
// ---------------------------------------------------------------------------

export type CreativeTestEvaluationWindow = {
  windowDays:     number;
  startedAt:      string;   // YYYY-MM-DD
  endsAt:         string;   // YYYY-MM-DD
  isComplete:     boolean;
  daysRemaining:  number;
  progressPct:    number;   // 0–100
};

// ---------------------------------------------------------------------------
// Outcome reason — structured explanation of the outcome
// ---------------------------------------------------------------------------

export type CreativeTestOutcomeReason = {
  key:         string;
  label:       string;
  description: string;
};

// ---------------------------------------------------------------------------
// Confidence — structured output with level label and rationale
// ---------------------------------------------------------------------------

export type CreativeTestConfidenceLevel = "low" | "medium" | "high" | "very_high";

export type CreativeTestConfidence = {
  score:           number;   // 0–1
  level:           CreativeTestConfidenceLevel;
  label:           string;
  rationale:       string;
  isWindowComplete: boolean;
};

// ---------------------------------------------------------------------------
// Lifecycle result link — attaches a test result to source creative entities
// ---------------------------------------------------------------------------

export type CreativeLifecycleResultLink = {
  testResultId:  string;
  clientAccountId: string;
  // Back-links into creative lifecycle
  prepItemId:    string | null;  // PublishPrepRecord.id
  briefId:       string | null;
  variantId:     string | null;
  launchPlanId:  string | null;  // ExperimentLaunchPlanRecord.id
  experimentId:  string | null;  // ExperimentRecord.id
  // Outcome context
  outcome:        CreativeTestOutcome | null;
  winningRole:    "control" | "challenger" | null;
  confidence:     number | null;
  primaryLift:    number | null;
  attachedAt:     string;
};

// ---------------------------------------------------------------------------
// Main entity — one per creative test
// ---------------------------------------------------------------------------

export type CreativeTestResult = {
  id:              string;
  clientAccountId: string;
  name:            string;
  trackingState:   CreativeTestTrackingState;
  outcome:         CreativeTestOutcome | null;  // null until first ingestion

  // Source links
  launchPlanId:  string | null;  // ExperimentLaunchPlanRecord.id
  experimentId:  string | null;  // ExperimentRecord.id (set when launched)
  prepItemId:    string | null;  // PublishPrepRecord.id
  briefId:       string | null;

  // Creative context
  controlCreativeId:       string | null;
  controlCreativeName:     string | null;
  controlAdExternalId:     string | null;
  challengerVariantTitle:  string | null;
  challengerAdExternalId:  string | null;
  clientName:              string | null;
  campaignName:            string | null;
  adSetName:               string | null;
  externalAdAccountId:     string | null;
  targetCampaignExternalId: string | null;
  targetAdSetExternalId:   string | null;

  // Success criteria
  primaryMetric:            string;
  successThreshold:         number;
  evaluationWindowDays:     number;
  minSpendPerVariant:       number;
  minConversionsPerVariant: number;

  // Ingested performance data
  controlSnapshot:    CreativeTestMetricSnapshot | null;
  challengerSnapshot: CreativeTestMetricSnapshot | null;

  // Evaluation outputs
  comparison:       CreativeTestComparison | null;
  confidence:       CreativeTestConfidence | null;
  winningVariant:   "control" | "challenger" | null;
  outcomeReasons:   CreativeTestOutcomeReason[];
  guardrailBreaches: string[];

  // Evaluation window
  evaluationWindow: CreativeTestEvaluationWindow | null;

  // Recommended next action
  recommendedNextStep: string | null;

  // Lifecycle attachment
  lifecycleLink: CreativeLifecycleResultLink | null;

  // Review state
  markedForReview: boolean;
  archivedAt:      string | null;

  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Summary — aggregate counts for the results queue
// ---------------------------------------------------------------------------

export type CreativeTestResultSummary = {
  total:          number;
  pendingLaunch:  number;
  active:         number;
  evaluating:     number;
  completed:      number;
  stale:          number;
  blocked:        number;
  challengerWins: number;
  controlHolds:   number;
  noWinner:       number;
};

// ---------------------------------------------------------------------------
// Input for creating a new test result
// ---------------------------------------------------------------------------

export type CreateCreativeTestResultInput = {
  clientAccountId: string;
  name:            string;
  launchPlanId?:   string | null;
  experimentId?:   string | null;
  prepItemId?:     string | null;
  briefId?:        string | null;
  // Creative context
  controlCreativeId?:        string | null;
  controlCreativeName?:      string | null;
  controlAdExternalId?:      string | null;
  challengerVariantTitle?:   string | null;
  challengerAdExternalId?:   string | null;
  clientName?:               string | null;
  campaignName?:             string | null;
  adSetName?:                string | null;
  externalAdAccountId?:      string | null;
  targetCampaignExternalId?: string | null;
  targetAdSetExternalId?:    string | null;
  // Criteria
  primaryMetric?:             string;
  successThreshold?:          number;
  evaluationWindowDays?:      number;
  minSpendPerVariant?:        number;
  minConversionsPerVariant?:  number;
};

// ---------------------------------------------------------------------------
// Display metadata
// ---------------------------------------------------------------------------

export const TEST_TRACKING_STATE_LABEL: Record<CreativeTestTrackingState, string> = {
  pending_launch: "Pending Launch",
  active:         "Active",
  evaluating:     "Evaluating",
  completed:      "Completed",
  stale:          "Stale",
  blocked:        "Blocked",
};

export const TEST_TRACKING_STATE_COLOR: Record<CreativeTestTrackingState, string> = {
  pending_launch: "text-slate-400",
  active:         "text-sky-400",
  evaluating:     "text-amber-400",
  completed:      "text-emerald-400",
  stale:          "text-slate-500",
  blocked:        "text-rose-400",
};

export const TEST_TRACKING_STATE_BG: Record<CreativeTestTrackingState, string> = {
  pending_launch: "border-slate-700 bg-slate-800",
  active:         "border-sky-700/40 bg-sky-950/20",
  evaluating:     "border-amber-700/40 bg-amber-950/20",
  completed:      "border-emerald-700/40 bg-emerald-950/20",
  stale:          "border-slate-800 bg-slate-900/40",
  blocked:        "border-rose-800/40 bg-rose-950/20",
};

export const TEST_OUTCOME_LABEL: Record<CreativeTestOutcome, string> = {
  in_progress:       "In Progress",
  insufficient_data: "Insufficient Data",
  no_clear_winner:   "No Clear Winner",
  challenger_wins:   "Challenger Wins",
  control_holds:     "Control Holds",
  mixed_result:      "Mixed Result",
  failed_test:       "Failed Test",
  archived:          "Archived",
};

export const TEST_OUTCOME_COLOR: Record<CreativeTestOutcome, string> = {
  in_progress:       "text-sky-400",
  insufficient_data: "text-slate-400",
  no_clear_winner:   "text-amber-400",
  challenger_wins:   "text-emerald-400",
  control_holds:     "text-sky-400",
  mixed_result:      "text-amber-500",
  failed_test:       "text-rose-400",
  archived:          "text-slate-500",
};

export const TEST_OUTCOME_BG: Record<CreativeTestOutcome, string> = {
  in_progress:       "border-sky-700/40 bg-sky-950/20",
  insufficient_data: "border-slate-700 bg-slate-900/40",
  no_clear_winner:   "border-amber-700/40 bg-amber-950/20",
  challenger_wins:   "border-emerald-700/40 bg-emerald-950/20",
  control_holds:     "border-sky-700/40 bg-sky-950/20",
  mixed_result:      "border-amber-700/40 bg-amber-950/20",
  failed_test:       "border-rose-800/40 bg-rose-950/20",
  archived:          "border-slate-800 bg-slate-900/30",
};

export const CONFIDENCE_LEVEL_LABEL: Record<CreativeTestConfidenceLevel, string> = {
  low:       "Low",
  medium:    "Medium",
  high:      "High",
  very_high: "Very High",
};

export const CONFIDENCE_LEVEL_COLOR: Record<CreativeTestConfidenceLevel, string> = {
  low:       "text-rose-400",
  medium:    "text-amber-400",
  high:      "text-emerald-400",
  very_high: "text-emerald-300",
};
