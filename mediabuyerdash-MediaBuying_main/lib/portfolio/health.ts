// ─── Portfolio — Health Scoring ───────────────────────────────────────────────
//
// Pure functions only. No DB calls, no imports from lib modules with DB deps.
// Computes health scores, labels, and display helpers for portfolio items.

import type {
  PortfolioHealthLabel,
  PortfolioPriority,
  PortfolioPacingStatus,
  PortfolioAutonomyMode,
} from "./types";

// ── Input ─────────────────────────────────────────────────────────────────────

export type HealthScoreInput = {
  hasEmergencyStop:   boolean;
  isRestricted:       boolean;
  highAlertCount:     number;
  hasOverdueApproval: boolean; // oldest approval pending > 48 hours
  pacingStatus:       PortfolioPacingStatus;
  pacingPct:          number | null;
  hasStaleSync:       boolean;
  roas:               number | null;
  roasGoal:           number | null;
};

// ── Score computation (0–100) ─────────────────────────────────────────────────

export function computeHealthScore(input: HealthScoreInput): number {
  let score = 75; // baseline — falls in "healthy" territory before signals

  // Blocking governance states (large deductions first)
  if (input.hasEmergencyStop)        score -= 40;
  if (input.isRestricted)            score -= 15;

  // Alert signals
  if      (input.highAlertCount >= 3) score -= 20;
  else if (input.highAlertCount >= 1) score -= 10;

  // Overdue approvals
  if (input.hasOverdueApproval)      score -= 15;

  // Stale data
  if (input.hasStaleSync)            score -= 12;

  // Pacing risk
  const pct = input.pacingPct;
  if (pct !== null) {
    if      (pct < 60 || pct > 130)  score -= 15;
    else if (pct < 85 || pct > 115)  score -= 8;
  }

  // ROAS vs goal (positive and negative signals)
  if (input.roas !== null && input.roasGoal !== null && input.roasGoal > 0) {
    if      (input.roas > input.roasGoal * 1.3)  score += 15;
    else if (input.roas > input.roasGoal)         score += 10;
    else if (input.roas < input.roasGoal * 0.7)  score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

// ── Label from score ──────────────────────────────────────────────────────────

export function healthLabel(score: number): PortfolioHealthLabel {
  if (score <= 35) return "critical";
  if (score <= 55) return "at_risk";
  if (score <= 70) return "needs_attention";
  if (score <= 85) return "healthy";
  return "strong";
}

// ── Priority from label ────────────────────────────────────────────────────────

export function healthPriority(label: PortfolioHealthLabel): PortfolioPriority {
  if (label === "critical")        return "critical";
  if (label === "at_risk")         return "high";
  if (label === "needs_attention") return "medium";
  return "low";
}

// ── Combined scorer ────────────────────────────────────────────────────────────

export function scoreHealth(input: HealthScoreInput): {
  score:    number;
  label:    PortfolioHealthLabel;
  priority: PortfolioPriority;
} {
  const score = computeHealthScore(input);
  const label = healthLabel(score);
  return { score, label, priority: healthPriority(label) };
}

// ── Display helpers ────────────────────────────────────────────────────────────

export function healthLabelDisplay(label: PortfolioHealthLabel): string {
  const MAP: Record<PortfolioHealthLabel, string> = {
    critical:        "Critical",
    at_risk:         "At Risk",
    needs_attention: "Needs Attention",
    healthy:         "Healthy",
    strong:          "Strong",
  };
  return MAP[label];
}

export function healthBadgeClass(label: PortfolioHealthLabel): string {
  if (label === "critical")        return "border-rose-800/50 bg-rose-950/60 text-rose-300";
  if (label === "at_risk")         return "border-amber-800/50 bg-amber-950/60 text-amber-300";
  if (label === "needs_attention") return "border-sky-800/50 bg-sky-950/60 text-sky-300";
  if (label === "healthy")         return "border-emerald-800/50 bg-emerald-950/60 text-emerald-300";
  return "border-violet-800/50 bg-violet-950/60 text-violet-300"; // strong
}

export function healthBorderClass(label: PortfolioHealthLabel): string {
  if (label === "critical")        return "border-l-rose-600";
  if (label === "at_risk")         return "border-l-amber-500";
  if (label === "needs_attention") return "border-l-sky-500";
  if (label === "healthy")         return "border-l-emerald-600";
  return "border-l-violet-500"; // strong
}

export function autonomyModeDisplay(mode: PortfolioAutonomyMode | string | null): string {
  if (!mode) return "Not set";
  const MAP: Record<string, string> = {
    recommend_only:       "Recommend Only",
    prepare_only:         "Prepare Only",
    approval_required:    "Approval Required",
    guarded_auto_execute: "Guarded Auto-Execute",
    restricted:           "Restricted",
  };
  return MAP[mode] ?? mode.replace(/_/g, " ");
}

export function priorityBadgeClass(priority: PortfolioPriority): string {
  if (priority === "critical") return "border-rose-800/50 bg-rose-950/60 text-rose-300";
  if (priority === "high")     return "border-amber-800/50 bg-amber-950/60 text-amber-300";
  if (priority === "medium")   return "border-sky-800/50 bg-sky-950/60 text-sky-300";
  return "border-slate-700 bg-slate-800 text-slate-400";
}

export function riskTypeLabel(riskType: string): string {
  const MAP: Record<string, string> = {
    emergency_stop:  "Emergency Stop",
    high_alert:      "High Alert",
    critical_pacing: "Critical Pacing",
    approval_overdue: "Overdue Approval",
    stale_sync:      "Stale Sync",
    goal_miss:       "Goal Miss",
    restricted_mode: "Restricted",
  };
  return MAP[riskType] ?? riskType.replace(/_/g, " ");
}

export function opportunityTypeLabel(type: string): string {
  const MAP: Record<string, string> = {
    experiment_winner: "Experiment Winner",
    strong_roas:       "Strong ROAS",
    under_budget:      "Under Budget",
    creative_ready:    "Creative Ready",
    goal_ahead:        "Ahead of Goal",
  };
  return MAP[type] ?? type.replace(/_/g, " ");
}
