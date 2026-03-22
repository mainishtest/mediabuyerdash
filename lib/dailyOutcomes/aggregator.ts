// lib/dailyOutcomes/aggregator.ts
// Aggregates launched-test outcomes for daily operator surfacing.
//
// Queries CreativeOutcomeRouteRecord and builds structured highlights
// for the command center: winners, losers, scale opportunities, refresh needs.
//
// Reuses:
//   - CreativeOutcomeRouteRecord (via Prisma)
//   - CreativeTestResultRecord (for context)
//   - types/creativeOutcomeRouting.ts (route types)

import { prisma } from "../db";

// ---------------------------------------------------------------------------
// Types — operator-facing outcome items
// ---------------------------------------------------------------------------

export type OutcomeHighlightType =
  | "winner"
  | "loser"
  | "scale_opportunity"
  | "refresh_needed"
  | "retest_needed"
  | "monitoring";

export type OutcomeHighlight = {
  id:              string;
  type:            OutcomeHighlightType;
  title:           string;
  subtitle:        string;
  routeType:       string;
  readinessState:  string;
  outcome:         string | null;
  confidenceScore: number | null;
  primaryLift:     number | null;
  winningVariant:  string | null;
  clientAccountId: string;
  testResultId:    string;
  nextActionLabel: string;
  nextActionHint:  string;
  linkedWorkflow:  string | null;
  isBlocker:       boolean;
  href:            string;
  updatedAt:       string;
};

export type DailyOutcomeSummary = {
  totalOutcomes:      number;
  winnersCount:       number;
  losersCount:        number;
  scaleReadyCount:    number;
  refreshNeededCount: number;
  retestNeededCount:  number;
  monitoringCount:    number;
  pendingActionCount: number;
  highlights:         OutcomeHighlight[];
};

// ---------------------------------------------------------------------------
// Main aggregator
// ---------------------------------------------------------------------------

export async function buildDailyOutcomeSummary(opts: {
  clientAccountId?: string;
  limit?:           number;
}): Promise<DailyOutcomeSummary> {
  const db = prisma as Record<string, any>; // CreativeOutcomeRouteRecord uses dynamic model access

  const where: Record<string, unknown> = {};
  if (opts.clientAccountId) where.clientAccountId = opts.clientAccountId;

  // Load recent outcome routes (pending_action first, then by update time)
  const routes = await db.creativeOutcomeRouteRecord.findMany({
    where,
    orderBy: [
      { readinessState: "asc" }, // pending_action sorts first alphabetically
      { updatedAt: "desc" },
    ],
    take: opts.limit ?? 50,
  });

  const highlights: OutcomeHighlight[] = [];
  let winnersCount = 0;
  let losersCount = 0;
  let scaleReadyCount = 0;
  let refreshNeededCount = 0;
  let retestNeededCount = 0;
  let monitoringCount = 0;
  let pendingActionCount = 0;

  for (const r of routes) {
    const highlightType = classifyHighlight(r.routeType);
    const isBlocker = r.readinessState === "pending_action" &&
      (highlightType === "scale_opportunity" || highlightType === "refresh_needed");

    const highlight: OutcomeHighlight = {
      id:              r.id,
      type:            highlightType,
      title:           buildTitle(r),
      subtitle:        buildSubtitle(r),
      routeType:       r.routeType,
      readinessState:  r.readinessState,
      outcome:         r.outcome ?? null,
      confidenceScore: r.confidenceScore ?? null,
      primaryLift:     r.primaryLift ?? null,
      winningVariant:  r.winningVariant ?? null,
      clientAccountId: r.clientAccountId,
      testResultId:    r.testResultId,
      nextActionLabel: r.nextActionLabel ?? "View",
      nextActionHint:  r.nextActionHint ?? "",
      linkedWorkflow:  r.linkedWorkflow ?? null,
      isBlocker,
      href:            `/creative-lab/outcomes`,
      updatedAt:       r.updatedAt?.toISOString() ?? new Date().toISOString(),
    };

    highlights.push(highlight);

    // Counts
    if (r.readinessState === "pending_action") pendingActionCount++;
    switch (highlightType) {
      case "winner":            winnersCount++;       break;
      case "loser":             losersCount++;        break;
      case "scale_opportunity": scaleReadyCount++;    break;
      case "refresh_needed":    refreshNeededCount++; break;
      case "retest_needed":     retestNeededCount++;  break;
      case "monitoring":        monitoringCount++;    break;
    }
  }

  return {
    totalOutcomes: highlights.length,
    winnersCount,
    losersCount,
    scaleReadyCount,
    refreshNeededCount,
    retestNeededCount,
    monitoringCount,
    pendingActionCount,
    highlights,
  };
}

// ---------------------------------------------------------------------------
// Classify route type into highlight category
// ---------------------------------------------------------------------------

function classifyHighlight(routeType: string): OutcomeHighlightType {
  switch (routeType) {
    case "send_winner_to_scale_review": return "scale_opportunity";
    case "keep_winner_running":         return "winner";
    case "send_loser_to_creative_lab":  return "refresh_needed";
    case "send_mixed_result_to_follow_up_test": return "retest_needed";
    case "monitor_until_more_data":     return "monitoring";
    case "capture_learning_only":       return "loser";
    case "archive_creative_outcome":    return "loser";
    default:                            return "monitoring";
  }
}

// ---------------------------------------------------------------------------
// Build human-readable title
// ---------------------------------------------------------------------------

function buildTitle(r: {
  routeType: string;
  challengerVariantTitle?: string | null;
  controlCreativeName?: string | null;
}): string {
  const challenger = r.challengerVariantTitle ?? "Challenger";
  const control = r.controlCreativeName ?? "Control";

  switch (r.routeType) {
    case "send_winner_to_scale_review":
      return `Winner ready to scale: ${challenger}`;
    case "keep_winner_running":
      return `Winner running: ${challenger}`;
    case "send_loser_to_creative_lab":
      return `Needs refresh: ${challenger}`;
    case "send_mixed_result_to_follow_up_test":
      return `Retest needed: ${challenger} vs ${control}`;
    case "monitor_until_more_data":
      return `Monitoring: ${challenger} vs ${control}`;
    case "capture_learning_only":
      return `Learning captured: ${challenger}`;
    case "archive_creative_outcome":
      return `Archived: ${challenger}`;
    default:
      return `Outcome: ${challenger}`;
  }
}

// ---------------------------------------------------------------------------
// Build subtitle with lift and confidence
// ---------------------------------------------------------------------------

function buildSubtitle(r: {
  primaryLift?: number | null;
  confidenceScore?: number | null;
  primaryMetric?: string | null;
  campaignName?: string | null;
}): string {
  const parts: string[] = [];

  if (r.primaryLift != null) {
    const sign = r.primaryLift >= 0 ? "+" : "";
    parts.push(`${sign}${(r.primaryLift * 100).toFixed(1)}% lift`);
  }

  if (r.confidenceScore != null) {
    parts.push(`${Math.round(r.confidenceScore * 100)}% confidence`);
  }

  if (r.campaignName) {
    parts.push(r.campaignName);
  }

  return parts.join(" · ") || "Pending evaluation";
}
