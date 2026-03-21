// ─── Client Decision — Detection Logic ───────────────────────────────────────
//
// Pure functions. No DB calls.
// Detects what changed (day-over-day deltas) and why (performance drivers).

import type {
  DaySnapshot,
  ClientChangeSignal,
  ChangeMetric,
  ChangeDirection,
  ChangeSeverity,
  ClientPerformanceDriver,
  DriverType,
} from "../../types/clientDecision";

// ── Change detection ────────────────────────────────────────────────────────

/**
 * Detects day-over-day changes across key metrics.
 * Returns signals sorted by severity (major first).
 */
export function detectClientChanges(
  yesterday: DaySnapshot,
  priorDay: DaySnapshot,
): ClientChangeSignal[] {
  const signals: ClientChangeSignal[] = [];

  // Only detect changes when both days have data
  if (priorDay.spend <= 0 && yesterday.spend <= 0) return signals;

  // ROAS change
  if (yesterday.roas !== null && priorDay.roas !== null && priorDay.roas > 0) {
    const deltaPct = ((yesterday.roas - priorDay.roas) / priorDay.roas) * 100;
    signals.push(buildChangeSignal("roas", "ROAS", yesterday.roas, priorDay.roas, deltaPct,
      `${fmtRoas(priorDay.roas)} → ${fmtRoas(yesterday.roas)}`));
  }

  // CPA change (inverted: decrease = improvement)
  if (yesterday.cpa !== null && priorDay.cpa !== null && priorDay.cpa > 0) {
    const deltaPct = ((yesterday.cpa - priorDay.cpa) / priorDay.cpa) * 100;
    signals.push(buildChangeSignal("cpa", "CPA", yesterday.cpa, priorDay.cpa, deltaPct,
      `$${priorDay.cpa.toFixed(2)} → $${yesterday.cpa.toFixed(2)}`, true));
  }

  // Spend change
  if (priorDay.spend > 0) {
    const deltaPct = ((yesterday.spend - priorDay.spend) / priorDay.spend) * 100;
    signals.push(buildChangeSignal("spend", "Spend", yesterday.spend, priorDay.spend, deltaPct,
      `$${fmtNum(priorDay.spend)} → $${fmtNum(yesterday.spend)}`));
  }

  // Revenue change
  if (priorDay.revenue > 0) {
    const deltaPct = ((yesterday.revenue - priorDay.revenue) / priorDay.revenue) * 100;
    signals.push(buildChangeSignal("revenue", "Revenue", yesterday.revenue, priorDay.revenue, deltaPct,
      `$${fmtNum(priorDay.revenue)} → $${fmtNum(yesterday.revenue)}`));
  }

  // Orders change
  if (priorDay.orders > 0) {
    const deltaPct = ((yesterday.orders - priorDay.orders) / priorDay.orders) * 100;
    signals.push(buildChangeSignal("orders", "Orders", yesterday.orders, priorDay.orders, deltaPct,
      `${priorDay.orders} → ${yesterday.orders}`));
  }

  // Sort: major first, then moderate, then minor
  const SEV_ORDER: Record<ChangeSeverity, number> = { major: 0, moderate: 1, minor: 2 };
  signals.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);

  return signals;
}

function buildChangeSignal(
  metric: ChangeMetric,
  label: string,
  yesterday: number,
  priorDay: number,
  deltaPct: number,
  displayValue: string,
  invertDirection = false,
): ClientChangeSignal {
  const absDelta = Math.abs(deltaPct);
  const severity: ChangeSeverity =
    absDelta >= 25 ? "major" :
    absDelta >= 10 ? "moderate" : "minor";

  let direction: ChangeDirection;
  if (absDelta < 5) {
    direction = "flat";
  } else if (invertDirection) {
    // For CPA: increase = declined, decrease = improved
    direction = deltaPct > 0 ? "declined" : "improved";
  } else {
    direction = deltaPct > 0 ? "improved" : "declined";
  }

  return { metric, label, direction, severity, yesterday, priorDay, deltaPct, displayValue };
}

// ── Performance drivers (why it changed) ─────────────────────────────────────

export type DriverDetectionInput = {
  yesterday:     DaySnapshot;
  priorDay:      DaySnapshot;
  roasGoal:      number | null;
  cpaGoal:       number | null;
  alertSummaries: string[];   // summaries from open AlertEvents
  alertSeverities: string[];  // severities of open alerts
};

/**
 * Detects performance drivers — the "why" behind changes.
 * Returns drivers sorted by severity.
 */
export function detectPerformanceDrivers(input: DriverDetectionInput): ClientPerformanceDriver[] {
  const drivers: ClientPerformanceDriver[] = [];
  const { yesterday, priorDay, roasGoal, cpaGoal } = input;

  // Spend change driver
  if (priorDay.spend > 0) {
    const spendChange = ((yesterday.spend - priorDay.spend) / priorDay.spend) * 100;
    if (Math.abs(spendChange) >= 30) {
      const dir = spendChange > 0 ? "increase" : "decrease";
      drivers.push({
        type: "spend_change",
        title: `Significant spend ${dir}`,
        description: `Spend ${dir}d ${Math.abs(spendChange).toFixed(0)}% day-over-day ($${fmtNum(priorDay.spend)} → $${fmtNum(yesterday.spend)}). This directly affects revenue volume and CPA.`,
        severity: Math.abs(spendChange) >= 50 ? "high" : "medium",
      });
    }
  }

  // ROAS drop driver
  if (yesterday.roas !== null && priorDay.roas !== null && priorDay.roas > 0) {
    const roasChange = ((yesterday.roas - priorDay.roas) / priorDay.roas) * 100;
    if (roasChange <= -20) {
      drivers.push({
        type: "roas_drop",
        title: "ROAS dropped significantly",
        description: `ROAS fell ${Math.abs(roasChange).toFixed(0)}% (${fmtRoas(priorDay.roas)} → ${fmtRoas(yesterday.roas)}). Revenue efficiency is declining relative to spend.`,
        severity: roasChange <= -30 ? "high" : "medium",
      });
    }
  }

  // CPA spike driver
  if (yesterday.cpa !== null && priorDay.cpa !== null && priorDay.cpa > 0) {
    const cpaChange = ((yesterday.cpa - priorDay.cpa) / priorDay.cpa) * 100;
    if (cpaChange >= 20) {
      drivers.push({
        type: "cpa_spike",
        title: "CPA increased sharply",
        description: `CPA rose ${cpaChange.toFixed(0)}% ($${priorDay.cpa.toFixed(2)} → $${yesterday.cpa.toFixed(2)}). Cost per acquisition is growing, possibly due to audience saturation or creative fatigue.`,
        severity: cpaChange >= 40 ? "high" : "medium",
      });
    }
  }

  // Conversion drop driver
  if (priorDay.orders > 0) {
    const orderChange = ((yesterday.orders - priorDay.orders) / priorDay.orders) * 100;
    if (orderChange <= -25) {
      drivers.push({
        type: "conversion_drop",
        title: "Conversions dropped",
        description: `Orders fell ${Math.abs(orderChange).toFixed(0)}% (${priorDay.orders} → ${yesterday.orders}). May indicate landing page issues, audience fatigue, or tracking problems.`,
        severity: orderChange <= -40 ? "high" : "medium",
      });
    }
  }

  // Goal miss driver
  if (roasGoal !== null && roasGoal > 0 && yesterday.roas !== null) {
    const ratio = yesterday.roas / roasGoal;
    if (ratio < 0.7) {
      drivers.push({
        type: "goal_miss",
        title: "ROAS significantly below goal",
        description: `Yesterday's ROAS (${fmtRoas(yesterday.roas)}) is ${((1 - ratio) * 100).toFixed(0)}% below the ${fmtRoas(roasGoal)} goal. Immediate action recommended.`,
        severity: "high",
      });
    } else if (ratio < 0.9) {
      drivers.push({
        type: "goal_miss",
        title: "ROAS below goal",
        description: `Yesterday's ROAS (${fmtRoas(yesterday.roas)}) is ${((1 - ratio) * 100).toFixed(0)}% below the ${fmtRoas(roasGoal)} goal.`,
        severity: "medium",
      });
    }
  }

  if (cpaGoal !== null && cpaGoal > 0 && yesterday.cpa !== null) {
    const ratio = yesterday.cpa / cpaGoal;
    if (ratio > 1.3) {
      drivers.push({
        type: "goal_miss",
        title: "CPA significantly above goal",
        description: `Yesterday's CPA ($${yesterday.cpa.toFixed(2)}) is ${((ratio - 1) * 100).toFixed(0)}% above the $${cpaGoal.toFixed(2)} goal.`,
        severity: "high",
      });
    }
  }

  // Surface alert-based drivers
  for (let i = 0; i < input.alertSummaries.length && i < 3; i++) {
    const severity = input.alertSeverities[i] === "high" ? "high" : "medium";
    drivers.push({
      type: alertTypeToDriverType(input.alertSummaries[i]),
      title: input.alertSummaries[i],
      description: "Detected by the anomaly detection system. Review alerts for details.",
      severity,
    });
  }

  // Sort: high first
  const SEV: Record<string, number> = { high: 0, medium: 1, low: 2 };
  drivers.sort((a, b) => (SEV[a.severity] ?? 2) - (SEV[b.severity] ?? 2));

  return drivers;
}

function alertTypeToDriverType(summary: string): DriverType {
  const lower = summary.toLowerCase();
  if (lower.includes("roas"))      return "roas_drop";
  if (lower.includes("cpa"))       return "cpa_spike";
  if (lower.includes("spend"))     return "spend_change";
  if (lower.includes("fatigue"))   return "creative_fatigue";
  if (lower.includes("frequency")) return "frequency_high";
  if (lower.includes("ctr"))       return "ctr_drop";
  return "roas_drop";
}

// ── Formatting helpers ──────────────────────────────────────────────────────

function fmtRoas(v: number): string {
  return `${v.toFixed(2)}x`;
}

function fmtNum(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}
