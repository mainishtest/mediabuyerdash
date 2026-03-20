// types/experiment.ts
// Typed models for closed-loop experiment results and winner detection.
//
// Design rules:
//   - CRM data (orders, revenue, ROAS, CPA) is always the source of truth.
//   - Attribution window is 7 days (enforced by evaluation window default).
//   - Winner detection is declarative — no autonomous mutations.
//   - Learnings are tagged for reuse by Creative Lab and brief generation.

// ---------------------------------------------------------------------------
// Outcome and status enumerations
// ---------------------------------------------------------------------------

export type ExperimentOutcome =
  | "insufficient_data"    // not enough spend or conversions to judge
  | "no_clear_winner"      // metrics within threshold, no meaningful difference
  | "challenger_wins"      // challenger beats control on primary metric
  | "control_holds"        // control maintains advantage over challenger
  | "mixed_result"         // primary and secondary metrics disagree
  | "failed_test"          // test failed for technical or data reasons
  | "archived";            // manually archived without conclusion

export type ExperimentStatus =
  | "active"               // test is running, window not complete
  | "evaluating"           // window complete, evaluation triggered
  | "completed"            // has a final result record
  | "archived"             // closed without conclusion
  | "failed";              // technical failure

export type ExperimentComparisonMode =
  | "simultaneous"         // control and challenger run in parallel
  | "sequential";          // before/after comparison within same creative slot

// ---------------------------------------------------------------------------
// Metric snapshot — performance of one variant in the evaluation window
// ---------------------------------------------------------------------------

export type ExperimentMetricSnapshot = {
  variantLabel: string;
  variantType: "control" | "challenger";
  windowStart: string;    // YYYY-MM-DD
  windowEnd: string;      // YYYY-MM-DD
  // Delivery metrics (Meta — operational)
  spend:       number;
  impressions: number;
  clicks:      number;
  ctr:         number;    // clicks / impressions
  cpm:         number;    // (spend / impressions) * 1000
  // Outcome metrics (CRM — source of truth, 7-day attribution)
  orders:  number;
  revenue: number;
  roas:    number;        // revenue / spend (CRM-derived)
  cpa:     number;        // spend / orders
  // Data quality signals
  dataSource: "crm_and_meta" | "meta_only" | "crm_estimated" | "incomplete";
  isComplete: boolean;
  missingFields: string[];
};

// ---------------------------------------------------------------------------
// Comparison — delta between control and challenger
// ---------------------------------------------------------------------------

export type ExperimentMetricDelta = {
  delta: number;         // absolute: challenger - control
  lift:  number;         // relative: (challenger - control) / control  (fraction)
};

export type ExperimentComparison = {
  primaryMetric:  string;
  primaryDelta:   ExperimentMetricDelta;
  secondaryDeltas: Record<string, ExperimentMetricDelta>;
  guardrailBreaches:         string[];
  isStatisticallyMeaningful: boolean;   // |lift| >= successThreshold
  confidenceNote:            string;
};

// ---------------------------------------------------------------------------
// Winner detection output
// ---------------------------------------------------------------------------

export type WinnerDetectionResult = {
  outcome:          ExperimentOutcome;
  winningVariant:   "control" | "challenger" | null;
  confidence:       number;          // 0–1, simple magnitude-based proxy
  primaryLift:      number;          // signed relative lift on primary metric
  outcomeReasons:   string[];        // human-readable explanations
  recommendedAction: string;
  recommendedNote:   string;
};

// ---------------------------------------------------------------------------
// Learning — reusable insight from a completed experiment
// ---------------------------------------------------------------------------

export type ExperimentLearning = {
  id:              string;
  experimentId:    string;
  clientAccountId: string;
  briefIntent:     string | null;
  draftType:       string | null;
  winningPattern:  string | null;
  outcomeLabel:    string;
  insightText:     string;
  detail:          Record<string, unknown>;
  usableForBriefs:  boolean;
  usableForScoring: boolean;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Evaluation window — tracks time-based progress
// ---------------------------------------------------------------------------

export type ExperimentEvaluationWindow = {
  windowDays:    number;
  startedAt:     string;
  endsAt:        string;
  isComplete:    boolean;
  daysRemaining: number;
  progressPct:   number;   // 0–100
};

// ---------------------------------------------------------------------------
// Experiment plan — the definition of the test
// ---------------------------------------------------------------------------

export type ExperimentPlan = {
  id:              string;
  clientAccountId: string;
  campaignId:      string | null;
  name:            string;
  description:     string | null;
  status:          ExperimentStatus;
  comparisonMode:  ExperimentComparisonMode;

  // Control
  controlCreativeId:        string | null;
  controlAdExternalId:      string | null;
  controlAdSetExternalId:   string | null;
  controlCampaignExternalId: string | null;
  controlLabel:             string;

  // Challenger
  challengerPrepItemId:       string | null;
  challengerAdExternalId:     string | null;
  challengerAdSetExternalId:  string | null;
  challengerCampaignExternalId: string | null;
  challengerLabel:            string;

  // Shared ad account
  externalAdAccountId: string | null;

  // Criteria
  primaryMetric:            string;
  secondaryMetrics:         string[];
  successThreshold:         number;
  minSpendPerVariant:       number;
  minConversionsPerVariant: number;
  evaluationWindowDays:     number;

  // Timeline
  startedAt:        string;
  evaluationEndsAt: string | null;
  completedAt:      string | null;
  createdAt:        string;
  updatedAt:        string;
};

// ---------------------------------------------------------------------------
// Experiment result — output of one evaluation run
// ---------------------------------------------------------------------------

export type ExperimentResult = {
  id:            string;
  experimentId:  string;
  outcome:       ExperimentOutcome;
  winningVariant: "control" | "challenger" | null;
  confidence:    number;

  controlSnapshot:    ExperimentMetricSnapshot | null;
  challengerSnapshot: ExperimentMetricSnapshot | null;
  comparison:         ExperimentComparison | null;

  primaryMetricDelta: number | null;
  primaryMetricLift:  number | null;
  guardrailBreaches:  string[];
  outcomeReasons:     string[];

  recommendedAction: string | null;
  recommendedNote:   string | null;
  learningSummary:   string | null;
  evaluatedAt:       string;
};

// ---------------------------------------------------------------------------
// Experiment with result + learnings — full view entity
// ---------------------------------------------------------------------------

export type ExperimentWithResult = ExperimentPlan & {
  result:           ExperimentResult | null;
  learnings:        ExperimentLearning[];
  evaluationWindow: ExperimentEvaluationWindow;
};

// ---------------------------------------------------------------------------
// Summary — aggregate counts for the experiments list
// ---------------------------------------------------------------------------

export type ExperimentListSummary = {
  total:         number;
  active:        number;
  completed:     number;
  challengerWins: number;
  controlHolds:  number;
  noWinner:      number;
  insufficient:  number;
};

// ---------------------------------------------------------------------------
// Display metadata
// ---------------------------------------------------------------------------

export const OUTCOME_LABEL: Record<ExperimentOutcome, string> = {
  insufficient_data: "Insufficient Data",
  no_clear_winner:   "No Clear Winner",
  challenger_wins:   "Challenger Wins",
  control_holds:     "Control Holds",
  mixed_result:      "Mixed Result",
  failed_test:       "Failed Test",
  archived:          "Archived",
};

export const OUTCOME_COLOR: Record<ExperimentOutcome, string> = {
  insufficient_data: "text-slate-400",
  no_clear_winner:   "text-amber-400",
  challenger_wins:   "text-emerald-400",
  control_holds:     "text-sky-400",
  mixed_result:      "text-amber-500",
  failed_test:       "text-rose-400",
  archived:          "text-slate-500",
};

export const OUTCOME_BG: Record<ExperimentOutcome, string> = {
  insufficient_data: "border-slate-700 bg-slate-900/40",
  no_clear_winner:   "border-amber-700/40 bg-amber-950/20",
  challenger_wins:   "border-emerald-700/40 bg-emerald-950/20",
  control_holds:     "border-sky-700/40 bg-sky-950/20",
  mixed_result:      "border-amber-700/40 bg-amber-950/20",
  failed_test:       "border-rose-800/40 bg-rose-950/20",
  archived:          "border-slate-800 bg-slate-900/30",
};

export const STATUS_LABEL: Record<ExperimentStatus, string> = {
  active:     "Active",
  evaluating: "Evaluating",
  completed:  "Completed",
  archived:   "Archived",
  failed:     "Failed",
};

export const PRIMARY_METRIC_LABEL: Record<string, string> = {
  roas_7d: "ROAS (7-day CRM)",
  cpa_7d:  "CPA (7-day CRM)",
  orders:  "Orders",
  revenue: "Revenue",
  ctr:     "CTR",
  cpm:     "CPM",
};
