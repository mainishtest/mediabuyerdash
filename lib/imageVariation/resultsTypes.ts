// lib/imageVariation/resultsTypes.ts
// Pure TypeScript models for Image Variation Results Ingestion
// and Asset-Level Outcome Tracking.
//
// Design rules:
//   - No imports from lib/ — avoids circular deps.
//   - Wraps existing experiment evaluation types for image variation context.
//   - CRM is source of truth for ROAS/CPA — 7-day attribution enforced.

// ---------------------------------------------------------------------------
// Outcome — mirrors ExperimentOutcome for image variation tests
// ---------------------------------------------------------------------------

export type ImageVariationTestOutcome =
  | "insufficient_data"
  | "in_progress"
  | "no_clear_winner"
  | "challenger_wins"
  | "control_holds"
  | "mixed_result"
  | "failed_test"
  | "archived";

export const IMAGE_VARIATION_OUTCOME_LABEL: Record<ImageVariationTestOutcome, string> = {
  insufficient_data: "Insufficient Data",
  in_progress:       "In Progress",
  no_clear_winner:   "No Clear Winner",
  challenger_wins:   "Challenger Wins",
  control_holds:     "Control Holds",
  mixed_result:      "Mixed Result",
  failed_test:       "Failed Test",
  archived:          "Archived",
};

export const IMAGE_VARIATION_OUTCOME_COLOR: Record<ImageVariationTestOutcome, string> = {
  insufficient_data: "text-slate-400",
  in_progress:       "text-sky-400",
  no_clear_winner:   "text-amber-400",
  challenger_wins:   "text-emerald-400",
  control_holds:     "text-rose-400",
  mixed_result:      "text-amber-400",
  failed_test:       "text-rose-400",
  archived:          "text-slate-500",
};

export const IMAGE_VARIATION_OUTCOME_BG: Record<ImageVariationTestOutcome, string> = {
  insufficient_data: "border-slate-700 bg-slate-800/40",
  in_progress:       "border-sky-700/40 bg-sky-950/20",
  no_clear_winner:   "border-amber-700/40 bg-amber-950/20",
  challenger_wins:   "border-emerald-700/40 bg-emerald-950/20",
  control_holds:     "border-rose-800/40 bg-rose-950/20",
  mixed_result:      "border-amber-700/40 bg-amber-950/20",
  failed_test:       "border-rose-800/40 bg-rose-950/20",
  archived:          "border-slate-700 bg-slate-900/40",
};

// ---------------------------------------------------------------------------
// Tracking state — lifecycle state of the test
// ---------------------------------------------------------------------------

export type ImageVariationTrackingState =
  | "pending_launch"
  | "active"
  | "evaluating"
  | "completed"
  | "stale"
  | "blocked";

export const IMAGE_VARIATION_TRACKING_LABEL: Record<ImageVariationTrackingState, string> = {
  pending_launch: "Pending Launch",
  active:         "Active",
  evaluating:     "Evaluating",
  completed:      "Completed",
  stale:          "Stale",
  blocked:        "Blocked",
};

// ---------------------------------------------------------------------------
// Metric snapshot — performance data for one variant
// ---------------------------------------------------------------------------

export type ImageVariationMetricSnapshot = {
  variantLabel:  string;
  variantType:   "control" | "challenger";
  windowStart:   string;
  windowEnd:     string;
  spend:         number;
  impressions:   number;
  clicks:        number;
  ctr:           number;
  cpm:           number;
  orders:        number;
  revenue:       number;
  roas:          number;
  cpa:           number;
  dataSource:    "crm_and_meta" | "meta_only" | "crm_estimated" | "incomplete";
  isComplete:    boolean;
};

// ---------------------------------------------------------------------------
// Test comparison — control vs challenger deltas
// ---------------------------------------------------------------------------

export type ImageVariationTestComparison = {
  primaryMetric:     string;
  primaryDelta:      number;
  primaryLift:       number;
  secondaryDeltas:   Record<string, { delta: number; lift: number }>;
  guardrailBreaches: string[];
  isMeaningful:      boolean;
};

// ---------------------------------------------------------------------------
// Evaluation window — time-based progress
// ---------------------------------------------------------------------------

export type ImageVariationEvaluationWindow = {
  windowDays:     number;
  startedAt:      string;
  endsAt:         string;
  isComplete:     boolean;
  daysRemaining:  number;
  progressPct:    number;
};

// ---------------------------------------------------------------------------
// Outcome confidence — how confident is the result
// ---------------------------------------------------------------------------

export type ImageVariationOutcomeConfidence = {
  value:     number;   // 0–1
  level:     "low" | "medium" | "high";
  reasons:   string[];
};

// ---------------------------------------------------------------------------
// Outcome reason — why the outcome was classified this way
// ---------------------------------------------------------------------------

export type ImageVariationOutcomeReason = {
  reason:   string;
  severity: "info" | "warning" | "blocking";
};

// ---------------------------------------------------------------------------
// Test result — complete result for one image variation experiment
// ---------------------------------------------------------------------------

export type ImageVariationTestResult = {
  planId:            string;
  planName:          string;
  outcome:           ImageVariationTestOutcome;
  trackingState:     ImageVariationTrackingState;
  confidence:        ImageVariationOutcomeConfidence;
  controlSnapshot:   ImageVariationMetricSnapshot | null;
  challengerSnapshot: ImageVariationMetricSnapshot | null;
  comparison:        ImageVariationTestComparison | null;
  evaluationWindow:  ImageVariationEvaluationWindow | null;
  outcomeReasons:    string[];
  recommendedAction: string;
  recommendedNote:   string;
  // Source linkage
  sourceRequestId:        string | null;
  sourceCandidateId:      string | null;
  sourceCreativeId:       string | null;
  clientAccountId:        string;
  campaignId:             string | null;
  variationIntent:        string | null;
  evaluatedAt:            string;
};

// ---------------------------------------------------------------------------
// Result summary — aggregate stats across all tracked tests
// ---------------------------------------------------------------------------

export type ImageVariationResultSummary = {
  totalTests:         number;
  inProgress:         number;
  completed:          number;
  challengerWins:     number;
  controlHolds:       number;
  noClearWinner:      number;
  insufficientData:   number;
  failedTests:        number;
  averageConfidence:  number;
};

// ---------------------------------------------------------------------------
// Lifecycle result link — connects result back to the image variation lifecycle
// ---------------------------------------------------------------------------

export type ImageVariationLifecycleResultLink = {
  candidateId:    string;
  requestId:      string;
  planId:         string;
  outcome:        ImageVariationTestOutcome;
  confidence:     number;
  primaryLift:    number;
  linkedAt:       string;
};
