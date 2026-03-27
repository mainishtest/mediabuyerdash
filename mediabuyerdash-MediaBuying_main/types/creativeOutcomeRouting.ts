// types/creativeOutcomeRouting.ts
// Pure TypeScript types for the winner-loser routing and learning feedback layer.
// No imports from lib/ — types only.

import type { CreativeTestOutcome, CreativeTestConfidenceLevel } from "./creativeTestResults";

// ---------------------------------------------------------------------------
// Route types
// ---------------------------------------------------------------------------

export type CreativeOutcomeRouteType =
  | "send_winner_to_scale_review"
  | "keep_winner_running"
  | "send_loser_to_creative_lab"
  | "send_mixed_result_to_follow_up_test"
  | "monitor_until_more_data"
  | "archive_creative_outcome"
  | "capture_learning_only";

export type CreativeOutcomeReadinessState =
  | "pending_action"
  | "actioned"
  | "archived"
  | "learning_captured";

// ---------------------------------------------------------------------------
// Route decision components
// ---------------------------------------------------------------------------

export type CreativeOutcomeReason = {
  key:       string;
  label:     string;
  detail:    string;
  isBlocker: boolean; // if true, prevents autonomous scaling
};

export type CreativeNextAction = {
  label:            string;
  description:      string;
  destinationPath?: string; // e.g. "/creative-lab?briefId=xxx"
  requiresApproval: boolean;
  isDestructive:    boolean;
};

// ---------------------------------------------------------------------------
// Learning extraction
// ---------------------------------------------------------------------------

export type CreativeIterationLearning = {
  winningPattern:   string | null; // what drove success
  losingPattern:    string | null; // what caused failure
  iterationHints:   string[];      // specific suggestions for next creative
  briefAdjustments: string[];      // what to change in next brief
  avoidList:        string[];      // angles / patterns confirmed not to work
  applicableTo: {
    clientAccountId: string;
    briefIntent?:    string | null;
    draftType?:      string | null;
    campaignName?:   string | null;
  };
  extractionConfidence: "low" | "medium" | "high";
  sourceSummary:        string; // human-readable one-liner
};

export type CreativeIterationFeedback = {
  testResultId:      string;
  clientAccountId:   string;
  routeType:         CreativeOutcomeRouteType;
  learning:          CreativeIterationLearning;
  briefContextHints: Record<string, unknown>; // injected into next brief gen
  attachedAt:        string;
};

// ---------------------------------------------------------------------------
// Main entity
// ---------------------------------------------------------------------------

export type CreativeOutcomeRoute = {
  id:              string;
  clientAccountId: string;
  testResultId:    string;

  routeType:      CreativeOutcomeRouteType;
  readinessState: CreativeOutcomeReadinessState;

  // Source context (denormalised for self-contained display)
  outcome:        CreativeTestOutcome | null;
  confidenceLevel: CreativeTestConfidenceLevel | null;
  confidenceScore: number | null;
  primaryLift:    number | null;
  winningVariant: "control" | "challenger" | null;

  // Creative context
  challengerVariantTitle: string | null;
  controlCreativeName:    string | null;
  campaignName:           string | null;
  primaryMetric:          string | null;

  // Route decision
  reasons:         CreativeOutcomeReason[];
  evidence:        Record<string, unknown>;
  nextActionLabel: string;
  nextActionHint:  string;
  linkedWorkflow:  string | null;

  // Extracted learning
  learning:        CreativeIterationLearning | null;
  learningSummary: string | null;

  // Action state
  actionedAt: string | null;
  actionedBy: string | null;
  actionNote: string | null;
  archivedAt: string | null;

  // Back-links
  launchPlanId: string | null;
  experimentId: string | null;
  briefId:      string | null;
  variantId:    string | null;
  prepItemId:   string | null;

  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export type CreativeOutcomeRoutingSummary = {
  total:            number;
  pendingAction:    number;
  actioned:         number;
  archived:         number;
  learningCaptured: number;
  winnerRoutes:     number;
  loserRoutes:      number;
  mixedRoutes:      number;
  monitorRoutes:    number;
};

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export type CreateCreativeOutcomeRouteInput = {
  testResultId:    string;
  clientAccountId: string;
};

// ---------------------------------------------------------------------------
// Display constants
// ---------------------------------------------------------------------------

export const ROUTE_TYPE_LABEL: Record<CreativeOutcomeRouteType, string> = {
  send_winner_to_scale_review:       "Scale Review",
  keep_winner_running:               "Keep Running",
  send_loser_to_creative_lab:        "Iterate in Lab",
  send_mixed_result_to_follow_up_test: "Follow-Up Test",
  monitor_until_more_data:           "Monitor",
  archive_creative_outcome:          "Archived",
  capture_learning_only:             "Learning Only",
};

export const ROUTE_TYPE_COLOR: Record<CreativeOutcomeRouteType, string> = {
  send_winner_to_scale_review:       "text-emerald-400",
  keep_winner_running:               "text-sky-400",
  send_loser_to_creative_lab:        "text-amber-400",
  send_mixed_result_to_follow_up_test: "text-violet-400",
  monitor_until_more_data:           "text-slate-400",
  archive_creative_outcome:          "text-slate-500",
  capture_learning_only:             "text-indigo-400",
};

export const ROUTE_TYPE_BG: Record<CreativeOutcomeRouteType, string> = {
  send_winner_to_scale_review:       "bg-emerald-950/40 border-emerald-800/40",
  keep_winner_running:               "bg-sky-950/40 border-sky-800/40",
  send_loser_to_creative_lab:        "bg-amber-950/40 border-amber-800/40",
  send_mixed_result_to_follow_up_test: "bg-violet-950/40 border-violet-800/40",
  monitor_until_more_data:           "bg-slate-800/40 border-slate-700/40",
  archive_creative_outcome:          "bg-slate-900/40 border-slate-800/40",
  capture_learning_only:             "bg-indigo-950/40 border-indigo-800/40",
};

export const READINESS_STATE_LABEL: Record<CreativeOutcomeReadinessState, string> = {
  pending_action:    "Pending",
  actioned:          "Actioned",
  archived:          "Archived",
  learning_captured: "Learning Captured",
};

export const READINESS_STATE_COLOR: Record<CreativeOutcomeReadinessState, string> = {
  pending_action:    "text-amber-400",
  actioned:          "text-emerald-400",
  archived:          "text-slate-500",
  learning_captured: "text-indigo-400",
};
