// ─── Weekly Learning & Strategy Rollup — Typed Models ────────────────────────
//
// Account-level weekly rollup that summarises:
//   what won, what lost, what patterns emerged, what to do next week
//
// Reuses:
//   LearningMemoryEntry, LearningPattern (learning memory)
//   OutcomeHighlight (daily outcomes)
//   ActionHistorySummary (action history)
//   ClientDailySummary  (executive summary)
//
// All next-step recommendations are evidence-backed with explicit links.

import type { LearningConfidence } from "../lib/learningMemory/types";

// ── Evidence link — proof that backs a claim ────────────────────────────────

export type WeeklyRollupEvidenceLink = {
  entityType: "experiment" | "campaign" | "creative" | "outcome" | "learning" | "action";
  entityId:   string;
  label:      string;
  href:       string;
};

// ── Winner summary ──────────────────────────────────────────────────────────

export type WeeklyWinnerSummary = {
  id:           string;
  title:        string;
  subtitle:     string;             // lift + confidence + campaign
  lift:         number | null;      // decimal, e.g. 0.15 = +15%
  confidence:   number | null;      // 0–1
  clientName:   string;
  scaleReady:   boolean;
  evidence:     WeeklyRollupEvidenceLink[];
  href:         string;
};

// ── Loser summary ───────────────────────────────────────────────────────────

export type WeeklyLoserSummary = {
  id:           string;
  title:        string;
  subtitle:     string;
  lift:         number | null;
  confidence:   number | null;
  clientName:   string;
  refreshQueued: boolean;
  evidence:     WeeklyRollupEvidenceLink[];
  href:         string;
};

// ── Experiment summary ──────────────────────────────────────────────────────

export type WeeklyExperimentSummary = {
  id:               string;
  name:             string;
  status:           string;
  outcome:          string | null;    // "challenger_wins" | "control_wins" | "no_winner" | null
  winningVariant:   string | null;
  clientName:       string;
  daysRunning:      number;
  insightText:      string | null;    // from ExperimentLearningRecord
  evidence:         WeeklyRollupEvidenceLink[];
  href:             string;
};

// ── Creative pattern ────────────────────────────────────────────────────────

export type WeeklyCreativePattern = {
  id:           string;
  patternLabel: string;
  category:     string;
  occurrences:  number;
  confidence:   LearningConfidence;
  exampleInsight: string;
  clientNames:  string[];
  evidence:     WeeklyRollupEvidenceLink[];
};

// ── Scale opportunity ───────────────────────────────────────────────────────

export type WeeklyScaleOpportunity = {
  id:           string;
  clientName:   string;
  reason:       string;             // "ROAS above goal", "Winner ready to scale"
  currentRoas:  number | null;
  roasGoal:     number | null;
  spend:        number;
  evidence:     WeeklyRollupEvidenceLink[];
  href:         string;
};

// ── Decline signal ──────────────────────────────────────────────────────────

export type WeeklyDeclineSignal = {
  id:           string;
  clientName:   string;
  signal:       string;             // "ROAS trending down", "CPA rising"
  severity:     "low" | "medium" | "high";
  evidence:     WeeklyRollupEvidenceLink[];
  href:         string;
};

// ── Next step (evidence-backed) ─────────────────────────────────────────────

export type WeeklyNextStep = {
  id:           string;
  label:        string;             // "Scale Brand X budget"
  description:  string;             // why this makes sense
  priority:     "high" | "medium" | "low";
  category:     "scale" | "refresh" | "test" | "investigate" | "monitor";
  clientName:   string;
  evidence:     WeeklyRollupEvidenceLink[];
  href:         string;
};

// ── Summary ─────────────────────────────────────────────────────────────────

export type WeeklyRollupSummary = {
  weekLabel:         string;        // "Mar 15–21, 2026"
  totalSpend:        number;
  totalRevenue:      number;
  blendedRoas:       number | null;
  blendedCpa:        number | null;
  winnersCount:      number;
  losersCount:       number;
  experimentsRun:    number;
  patternsFound:     number;
  scaleOpportunities: number;
  declineSignals:    number;
  nextStepsCount:    number;
  actionsThisWeek:   number;
  topLineMessage:    string;        // "3 winners to scale, 2 accounts declining"
};

// ── Full rollup ─────────────────────────────────────────────────────────────

export type WeeklyStrategyRollup = {
  id:               string;
  weekStart:        string;         // YYYY-MM-DD (Monday)
  weekEnd:          string;         // YYYY-MM-DD (Sunday)
  generatedAt:      string;         // ISO datetime
  workspaceId:      string | null;
  summary:          WeeklyRollupSummary;
  winners:          WeeklyWinnerSummary[];
  losers:           WeeklyLoserSummary[];
  experiments:      WeeklyExperimentSummary[];
  creativePatterns: WeeklyCreativePattern[];
  scaleOpportunities: WeeklyScaleOpportunity[];
  declineSignals:   WeeklyDeclineSignal[];
  nextSteps:        WeeklyNextStep[];
  // Edge cases
  isSparse:         boolean;        // very little activity this week
  trustMessage:     string | null;  // data quality note if relevant
};
