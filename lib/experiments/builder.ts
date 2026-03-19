// lib/experiments/builder.ts
// Pure functions for assembling experiment plans and evaluation window state.
// No DB access — all inputs passed explicitly.

import type {
  ExperimentPlan,
  ExperimentEvaluationWindow,
  ExperimentMetricSnapshot,
  ExperimentComparisonMode,
  ExperimentStatus,
} from "../../types/experiment";

// ---------------------------------------------------------------------------
// Build evaluation window from plan timestamps
// ---------------------------------------------------------------------------

export function buildEvaluationWindow(
  startedAt:        string,
  windowDays:       number,
  evaluationEndsAt: string | null,
): ExperimentEvaluationWindow {
  const start   = new Date(startedAt);
  const endsAt  = evaluationEndsAt
    ? new Date(evaluationEndsAt)
    : new Date(start.getTime() + windowDays * 86_400_000);

  const now          = new Date();
  const isComplete   = now >= endsAt;
  const msRemaining  = Math.max(0, endsAt.getTime() - now.getTime());
  const daysRemaining = Math.ceil(msRemaining / 86_400_000);
  const totalMs      = endsAt.getTime() - start.getTime();
  const elapsedMs    = Math.min(now.getTime() - start.getTime(), totalMs);
  const progressPct  = Math.round((elapsedMs / totalMs) * 100);

  return {
    windowDays,
    startedAt:     start.toISOString().split("T")[0],
    endsAt:        endsAt.toISOString().split("T")[0],
    isComplete,
    daysRemaining,
    progressPct:   Math.max(0, Math.min(100, progressPct)),
  };
}

// ---------------------------------------------------------------------------
// Build a blank metric snapshot (placeholder before data is loaded)
// ---------------------------------------------------------------------------

export function buildEmptySnapshot(
  variantLabel: string,
  variantType:  "control" | "challenger",
  windowStart:  string,
  windowEnd:    string,
): ExperimentMetricSnapshot {
  return {
    variantLabel,
    variantType,
    windowStart,
    windowEnd,
    spend:       0,
    impressions: 0,
    clicks:      0,
    ctr:         0,
    cpm:         0,
    orders:      0,
    revenue:     0,
    roas:        0,
    cpa:         0,
    dataSource:  "incomplete",
    isComplete:  false,
    missingFields: ["spend", "impressions", "orders", "revenue"],
  };
}

// ---------------------------------------------------------------------------
// Compute derived fields on a raw snapshot
// ---------------------------------------------------------------------------

export function finaliseSnapshot(
  partial: Omit<ExperimentMetricSnapshot, "ctr" | "cpm" | "roas" | "cpa" | "dataSource" | "isComplete" | "missingFields">,
): ExperimentMetricSnapshot {
  const { spend, impressions, clicks, orders, revenue } = partial;

  const ctr  = impressions > 0 ? clicks / impressions : 0;
  const cpm  = impressions > 0 ? (spend / impressions) * 1_000 : 0;
  const roas = spend > 0 ? revenue / spend : 0;
  const cpa  = orders > 0 ? spend / orders : 0;

  const missingFields: string[] = [];
  if (spend === 0)       missingFields.push("spend");
  if (impressions === 0) missingFields.push("impressions");
  if (orders === 0)      missingFields.push("orders");
  if (revenue === 0)     missingFields.push("revenue");

  const hasMeta = spend > 0 && impressions > 0;
  const hasCrm  = orders > 0 && revenue > 0;

  const dataSource: ExperimentMetricSnapshot["dataSource"] = hasMeta && hasCrm
    ? "crm_and_meta"
    : hasMeta
      ? "meta_only"
      : hasCrm
        ? "crm_estimated"
        : "incomplete";

  return {
    ...partial,
    ctr,
    cpm,
    roas,
    cpa,
    dataSource,
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

// ---------------------------------------------------------------------------
// Build the evaluation date window strings from a plan
// ---------------------------------------------------------------------------

export function buildWindowDates(plan: Pick<ExperimentPlan, "startedAt" | "evaluationWindowDays">) {
  const start = new Date(plan.startedAt);
  const end   = new Date(start.getTime() + plan.evaluationWindowDays * 86_400_000);
  return {
    windowStart: start.toISOString().split("T")[0],
    windowEnd:   end.toISOString().split("T")[0],
  };
}
