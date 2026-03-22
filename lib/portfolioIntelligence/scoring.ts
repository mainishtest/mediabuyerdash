// ─── Portfolio Intelligence — Priority Scoring ───────────────────────────────
//
// Pure functions. No DB access.
// Computes an explainable priority score (0–100) from account-level signals.
// Every factor contributing to the score is tracked and visible in the UI.

import type {
  PortfolioPriorityScore,
  PortfolioPriorityFactor,
  PortfolioPriorityCategory,
} from "../../types/portfolioIntelligence";

// ── Score inputs ────────────────────────────────────────────────────────────

export type ScoringInput = {
  // Performance
  status:          string;   // "scaling"|"stable"|"at_risk"|"critical"|"insufficient_data"
  trend:           string;   // "up"|"flat"|"down"
  roas:            number | null;
  roasGoal:        number | null;
  scaleReadiness:  string;   // "ready"|"possible"|"not_ready"
  // Signals
  alertCount:      number;
  highAlertCount:  number;
  hasStaleSync:    boolean;
  hasBlockedAction: boolean;
  hasPendingTest:  boolean;
  hasWinner:       boolean;
  hasLoser:        boolean;
  // Governance
  hasEmergencyStop: boolean;
  isRestricted:    boolean;
};

// ── Main scorer ─────────────────────────────────────────────────────────────

export function computePortfolioPriorityScore(input: ScoringInput): PortfolioPriorityScore {
  const factors: PortfolioPriorityFactor[] = [];
  let total = 0;

  // Status factor (0–30 pts)
  const statusWeight =
    input.status === "critical" ? 30 :
    input.status === "at_risk"  ? 20 :
    input.status === "stable"   ? 5  :
    input.status === "scaling"  ? 10 :  // scale-ready needs attention too
    0;
  if (statusWeight > 0) {
    factors.push({
      label: `Performance: ${input.status}`,
      weight: statusWeight,
      direction: input.status === "critical" || input.status === "at_risk" ? "negative" : "neutral",
    });
    total += statusWeight;
  }

  // Trend factor (0–15 pts)
  if (input.trend === "down") {
    factors.push({ label: "Declining trend", weight: 15, direction: "negative" });
    total += 15;
  } else if (input.trend === "up" && input.scaleReadiness === "ready") {
    factors.push({ label: "Upward trend + scale ready", weight: 12, direction: "positive" });
    total += 12;
  }

  // Scale readiness (0–15 pts)
  if (input.scaleReadiness === "ready") {
    factors.push({ label: "Scale ready", weight: 15, direction: "positive" });
    total += 15;
  }

  // Alert severity (0–15 pts)
  if (input.highAlertCount >= 3) {
    factors.push({ label: `${input.highAlertCount} high-severity alerts`, weight: 15, direction: "negative" });
    total += 15;
  } else if (input.highAlertCount >= 1) {
    factors.push({ label: `${input.highAlertCount} high-severity alert(s)`, weight: 8, direction: "negative" });
    total += 8;
  } else if (input.alertCount >= 3) {
    factors.push({ label: `${input.alertCount} alerts`, weight: 5, direction: "negative" });
    total += 5;
  }

  // Blocked action (0–10 pts)
  if (input.hasBlockedAction) {
    factors.push({ label: "Blocked action requires attention", weight: 10, direction: "negative" });
    total += 10;
  }

  // Emergency stop / restricted (0–10 pts)
  if (input.hasEmergencyStop) {
    factors.push({ label: "Emergency stop active", weight: 10, direction: "negative" });
    total += 10;
  } else if (input.isRestricted) {
    factors.push({ label: "Restricted automation mode", weight: 5, direction: "negative" });
    total += 5;
  }

  // Stale sync (0–5 pts)
  if (input.hasStaleSync) {
    factors.push({ label: "Stale data sync", weight: 5, direction: "negative" });
    total += 5;
  }

  // Winner available (0–8 pts)
  if (input.hasWinner) {
    factors.push({ label: "Winner ready for action", weight: 8, direction: "positive" });
    total += 8;
  }

  // Loser detected (0–5 pts)
  if (input.hasLoser) {
    factors.push({ label: "Loser detected — refresh needed", weight: 5, direction: "negative" });
    total += 5;
  }

  // Test pending (0–5 pts)
  if (input.hasPendingTest) {
    factors.push({ label: "Test needs follow-up", weight: 5, direction: "neutral" });
    total += 5;
  }

  // Cap at 100
  total = Math.min(100, total);

  return { total, factors };
}

// ── Category determination ──────────────────────────────────────────────────

export function determineCategory(input: ScoringInput): PortfolioPriorityCategory {
  // Emergency / critical → investigate now
  if (input.hasEmergencyStop || input.status === "critical") return "investigate_now";
  if (input.hasBlockedAction) return "blocked_action";

  // Scale opportunity
  if (input.scaleReadiness === "ready" && input.trend !== "down") return "scale_now";

  // Declining → investigate
  if (input.status === "at_risk" && input.trend === "down") return "investigate_now";

  // Creative refresh / test
  if (input.hasLoser) return "refresh_needed";
  if (input.hasPendingTest) return "test_needed";

  // At risk but not declining → monitor closely
  if (input.status === "at_risk") return "monitor";

  return "monitor";
}

// ── Category labels ─────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<PortfolioPriorityCategory, string> = {
  scale_now:        "Scale Now",
  investigate_now:  "Investigate Now",
  refresh_needed:   "Refresh Needed",
  test_needed:      "Test Needed",
  blocked_action:   "Blocked Action",
  monitor:          "Monitor",
};

export const CATEGORY_VARIANTS: Record<PortfolioPriorityCategory, string> = {
  scale_now:        "border-emerald-800/50 bg-emerald-950/60 text-emerald-300",
  investigate_now:  "border-rose-800/50 bg-rose-950/60 text-rose-300",
  refresh_needed:   "border-amber-800/50 bg-amber-950/60 text-amber-300",
  test_needed:      "border-sky-800/50 bg-sky-950/60 text-sky-300",
  blocked_action:   "border-orange-800/50 bg-orange-950/60 text-orange-300",
  monitor:          "border-slate-700 bg-slate-800 text-slate-400",
};
