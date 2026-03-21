// ─── Client Decision — Action Recommendations ───────────────────────────────
//
// Pure functions. No DB calls.
// Builds recommended actions based on changes, drivers, and current state.

import type {
  DaySnapshot,
  ClientChangeSignal,
  ClientPerformanceDriver,
  ClientRecommendedAction,
  ClientIssue,
  ClientOpportunity,
} from "../../types/clientDecision";

// ── Action builder ──────────────────────────────────────────────────────────

export function buildClientActionRecommendations(params: {
  clientId:    string;
  yesterday:   DaySnapshot;
  roasGoal:    number | null;
  cpaGoal:     number | null;
  changes:     ClientChangeSignal[];
  drivers:     ClientPerformanceDriver[];
  issues:      ClientIssue[];
}): ClientRecommendedAction[] {
  const { clientId, yesterday, roasGoal, changes, drivers, issues } = params;
  const actions: ClientRecommendedAction[] = [];
  const clientHref = `/clients/${clientId}`;
  const testHref   = `/creative-lab/launch?clientId=${clientId}`;
  const labHref    = `/creative-lab?clientId=${clientId}`;

  const hasHighIssues = issues.some((i) => i.severity === "critical" || i.severity === "high");
  const hasFatigue = drivers.some((d) => d.type === "creative_fatigue" || d.type === "frequency_high");
  const hasRoasDrop = drivers.some((d) => d.type === "roas_drop" && d.severity === "high");
  const hasCpaSpike = drivers.some((d) => d.type === "cpa_spike" && d.severity === "high");
  const isScaling = yesterday.roas !== null && roasGoal !== null && roasGoal > 0
    && yesterday.roas >= roasGoal * 1.15;
  const isLosingBadly = yesterday.roas !== null && roasGoal !== null && roasGoal > 0
    && yesterday.roas < roasGoal * 0.7;

  // Critical: Fix now
  if (isLosingBadly || hasHighIssues) {
    actions.push({
      action: "pause_losers",
      label: "Pause Losers",
      description: "Pause underperforming campaigns to stop bleeding spend.",
      href: `${clientHref}/campaigns`,
      variant: "danger",
      priority: "high",
    });
  }

  // Fatigue detected → refresh creatives
  if (hasFatigue) {
    actions.push({
      action: "refresh_creatives",
      label: "Refresh Creatives",
      description: "Creative fatigue detected. Generate new variants to restore performance.",
      href: labHref,
      variant: "primary",
      priority: "high",
    });
  }

  // ROAS drop or CPA spike → investigate + create test
  if (hasRoasDrop || hasCpaSpike) {
    actions.push({
      action: "create_test",
      label: "Create Test",
      description: "Set up an A/B test to find a better performing creative or audience.",
      href: testHref,
      variant: "secondary",
      priority: "high",
    });
  }

  // Scaling → scale winners
  if (isScaling) {
    actions.push({
      action: "scale_winners",
      label: "Scale Winners",
      description: "ROAS is above goal. Consider increasing budget on top campaigns.",
      href: `${clientHref}/campaigns`,
      variant: "primary",
      priority: "high",
    });
  }

  // General: investigate if there are moderate issues
  if (drivers.some((d) => d.severity === "medium") && !hasHighIssues && !isScaling) {
    actions.push({
      action: "investigate",
      label: "Investigate",
      description: "Review campaign details to understand performance shifts.",
      href: `${clientHref}/campaigns`,
      variant: "secondary",
      priority: "medium",
    });
  }

  // No goals → set them
  if (roasGoal === null && params.cpaGoal === null) {
    actions.push({
      action: "review_goals",
      label: "Set Goals",
      description: "No ROAS or CPA goals configured. Set targets to enable status tracking.",
      href: `${clientHref}/settings`,
      variant: "secondary",
      priority: "medium",
    });
  }

  // Default: monitor
  if (actions.length === 0) {
    actions.push({
      action: "monitor",
      label: "Monitor",
      description: "Performance is stable. Continue monitoring.",
      href: clientHref,
      variant: "ghost",
      priority: "low",
    });
  }

  return actions;
}

// ── Issues builder ──────────────────────────────────────────────────────────

export function buildClientIssues(params: {
  clientId:    string;
  alertRows:   { id: string; severity: string; summary: string; alertType: string }[];
  drivers:     ClientPerformanceDriver[];
}): ClientIssue[] {
  const issues: ClientIssue[] = [];

  // From alerts
  for (const alert of params.alertRows) {
    issues.push({
      id:          alert.id,
      title:       alert.summary,
      description: `${alert.alertType.replace(/_/g, " ")} — severity: ${alert.severity}`,
      severity:    alert.severity === "high" ? "high" : "medium",
      source:      "alert",
      href:        "/alerts",
    });
  }

  // From high-severity drivers not already captured by alerts
  for (const driver of params.drivers.filter((d) => d.severity === "high")) {
    const alreadyCaptured = issues.some((i) => i.title.toLowerCase().includes(driver.type.replace(/_/g, " ")));
    if (!alreadyCaptured) {
      issues.push({
        id:          `driver-${driver.type}`,
        title:       driver.title,
        description: driver.description,
        severity:    "high",
        source:      "evaluation",
      });
    }
  }

  // Sort: critical/high first
  const SEV: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  issues.sort((a, b) => (SEV[a.severity] ?? 3) - (SEV[b.severity] ?? 3));

  return issues.slice(0, 8);
}

// ── Opportunities builder ───────────────────────────────────────────────────

export function buildClientOpportunities(params: {
  clientId:    string;
  yesterday:   DaySnapshot;
  roasGoal:    number | null;
  changes:     ClientChangeSignal[];
}): ClientOpportunity[] {
  const ops: ClientOpportunity[] = [];
  const { clientId, yesterday, roasGoal, changes } = params;

  // Strong ROAS above goal
  if (yesterday.roas !== null && roasGoal !== null && roasGoal > 0 && yesterday.roas > roasGoal * 1.15) {
    ops.push({
      id:          "roas-above-goal",
      title:       `ROAS ${yesterday.roas.toFixed(2)}x (above ${roasGoal.toFixed(1)}x goal)`,
      description: "Performance is strong. Consider scaling budget to capture more volume.",
      priority:    "high",
      href:        `/clients/${clientId}/campaigns`,
    });
  }

  // Revenue trending up
  const revChange = changes.find((c) => c.metric === "revenue" && c.direction === "improved" && c.severity !== "minor");
  if (revChange) {
    ops.push({
      id:          "revenue-up",
      title:       `Revenue up ${Math.abs(revChange.deltaPct).toFixed(0)}%`,
      description: `Revenue increased from $${fmtNum(revChange.priorDay)} to $${fmtNum(revChange.yesterday)}.`,
      priority:    "medium",
    });
  }

  return ops;
}

function fmtNum(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}
