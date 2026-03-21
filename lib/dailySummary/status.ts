// ─── Daily Summary — Decision Logic ──────────────────────────────────────────
//
// Pure functions. No DB calls, no side effects.
// Computes performance status, trend, action recommendations, and risk level
// from daily client metrics.

import type {
  ClientPerformanceStatus,
  ClientTrendDirection,
  ClientActionRecommendation,
  ClientRiskLevel,
  ClientScaleReadiness,
  DailyActionItem,
} from "../../types/dailySummary";

// ── Trend computation ───────────────────────────────────────────────────────

/**
 * Computes 3-day trend direction from ROAS values [day-3, day-2, day-1].
 * Returns "up" if day-1 > day-3 by ≥10%, "down" if <-10%, "flat" otherwise.
 */
export function computeClientTrend(roasValues: (number | null)[]): ClientTrendDirection {
  const valid = roasValues.filter((v): v is number => v !== null && v > 0);
  if (valid.length < 2) return "flat";
  const first = valid[0];
  const last = valid[valid.length - 1];
  const changePct = ((last - first) / first) * 100;
  if (changePct >= 10) return "up";
  if (changePct <= -10) return "down";
  return "flat";
}

// ── Performance status ──────────────────────────────────────────────────────

export type StatusInput = {
  roas:          number | null;
  roasGoal:      number | null;
  cpa:           number | null;
  cpaGoal:       number | null;
  trend:         ClientTrendDirection;
  alertCount:    number;
  hasStaleSync:  boolean;
};

/**
 * Determines client performance status based on goal performance and signals.
 *
 * - scaling:  ROAS ≥ goal×1.15 AND trend up/flat
 * - stable:   ROAS within ±15% of goal AND alerts < 2
 * - at_risk:  ROAS 70–85% of goal OR trend down with mediocre ROAS
 * - critical: ROAS < 70% of goal OR alertCount ≥ 2
 */
export function computeClientPerformanceStatus(input: StatusInput): ClientPerformanceStatus {
  const { roas, roasGoal, alertCount } = input;

  // Critical: high alert volume always overrides
  if (alertCount >= 2) return "critical";

  // No data or no goal — conservative stable
  if (roas === null || roasGoal === null || roasGoal <= 0) return "stable";

  const ratio = roas / roasGoal;

  if (ratio < 0.7) return "critical";
  if (ratio < 0.85) return "at_risk";
  if (ratio >= 1.15 && (input.trend === "up" || input.trend === "flat")) return "scaling";

  // Check CPA if available
  if (input.cpa !== null && input.cpaGoal !== null && input.cpaGoal > 0) {
    const cpaRatio = input.cpa / input.cpaGoal;
    if (cpaRatio > 1.3) return "at_risk";
  }

  // Trend-based downgrade from stable
  if (input.trend === "down" && ratio < 1.0) return "at_risk";

  return "stable";
}

// ── Risk level ──────────────────────────────────────────────────────────────

export function computeRiskLevel(status: ClientPerformanceStatus): ClientRiskLevel {
  switch (status) {
    case "critical": return "critical";
    case "at_risk":  return "high";
    case "stable":   return "low";
    case "scaling":  return "none";
  }
}

// ── Scale readiness ─────────────────────────────────────────────────────────

export function computeScaleReadiness(
  status: ClientPerformanceStatus,
  trend: ClientTrendDirection,
  hasStaleSync: boolean,
): ClientScaleReadiness {
  if (status === "scaling" && !hasStaleSync) return "ready";
  if (status === "stable" && trend === "up" && !hasStaleSync) return "possible";
  return "not_ready";
}

// ── Action recommendations ──────────────────────────────────────────────────

export function buildClientActionRecommendations(
  clientId: string,
  status: ClientPerformanceStatus,
): DailyActionItem[] {
  const decisionHref = `/clients/${clientId}/decision`;
  const testHref = `/creative-lab/launch?clientId=${clientId}`;

  switch (status) {
    case "scaling":
      return [
        { action: "scale", label: "Scale", href: decisionHref, variant: "primary" },
        { action: "monitor", label: "View Details", href: decisionHref, variant: "ghost" },
      ];
    case "stable":
      return [
        { action: "monitor", label: "Monitor", href: decisionHref, variant: "secondary" },
        { action: "monitor", label: "View Details", href: decisionHref, variant: "ghost" },
      ];
    case "at_risk":
      return [
        { action: "investigate", label: "Investigate", href: decisionHref, variant: "secondary" },
        { action: "create_test", label: "Create Test", href: testHref, variant: "ghost" },
      ];
    case "critical":
      return [
        { action: "fix_now", label: "Fix Now", href: decisionHref, variant: "danger" },
        { action: "investigate", label: "Pause / Review", href: decisionHref, variant: "secondary" },
      ];
  }
}

// ── Display helpers ─────────────────────────────────────────────────────────

export function statusLabel(status: ClientPerformanceStatus): string {
  const MAP: Record<ClientPerformanceStatus, string> = {
    scaling:  "Scaling",
    stable:   "Stable",
    at_risk:  "At Risk",
    critical: "Critical",
  };
  return MAP[status];
}

export function statusBadgeVariant(status: ClientPerformanceStatus): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "scaling":  return "success";
    case "stable":   return "neutral";
    case "at_risk":  return "warning";
    case "critical": return "danger";
  }
}

export function trendArrow(trend: ClientTrendDirection): string {
  switch (trend) {
    case "up":   return "↑";
    case "down": return "↓";
    case "flat": return "→";
  }
}

export function trendColor(trend: ClientTrendDirection): string {
  switch (trend) {
    case "up":   return "text-emerald-400";
    case "down": return "text-rose-400";
    case "flat": return "text-slate-500";
  }
}
