// ─── Command Center — Priority Engine ────────────────────────────────────────
//
// Converts raw signal types into CommandCenterPriority levels and produces the
// unified "Today's Priorities" queue. All logic is pure (no DB calls).

import type {
  CommandCenterPriority,
  CommandCenterPriorityCard,
  CommandCenterAlertItem,
  CommandCenterApprovalItem,
  CommandCenterExperimentItem,
  CommandCenterCreativeItem,
  CommandCenterPacingItem,
} from "./types";

// ── Priority weights for sorting ──────────────────────────────────────────────

const PRIORITY_WEIGHT: Record<CommandCenterPriority, number> = {
  critical: 4,
  high:     3,
  medium:   2,
  low:      1,
};

export function comparePriority(a: CommandCenterPriority, b: CommandCenterPriority): number {
  return PRIORITY_WEIGHT[b] - PRIORITY_WEIGHT[a];
}

// ── Alert → priority ──────────────────────────────────────────────────────────

export function alertPriority(severity: "low" | "medium" | "high"): CommandCenterPriority {
  if (severity === "high")   return "critical";
  if (severity === "medium") return "high";
  return "medium";
}

// ── Approval → priority ───────────────────────────────────────────────────────

export function approvalPriority(
  dbPriority: string,
  proposedAt: string
): CommandCenterPriority {
  const hoursPending = (Date.now() - new Date(proposedAt).getTime()) / (1000 * 60 * 60);
  if (hoursPending >= 48 || dbPriority === "high") return "critical";
  if (hoursPending >= 24 || dbPriority === "medium") return "high";
  return "medium";
}

// ── Experiment → priority ─────────────────────────────────────────────────────

export function experimentPriority(
  status: string,
  hasResult: boolean,
  outcome: string | null
): CommandCenterPriority {
  // Winner found and action not yet taken → high priority
  if (hasResult && (outcome === "challenger_wins" || outcome === "control_holds")) return "high";
  // Active, no result yet → medium
  if (status === "active" || status === "evaluating") return "medium";
  return "low";
}

// ── Pacing → priority ─────────────────────────────────────────────────────────

export function pacingPriority(
  pacingPct: number,
  status: "under_pacing" | "over_pacing" | "on_pacing"
): CommandCenterPriority {
  if (status === "over_pacing"  && pacingPct > 130) return "critical";
  if (status === "over_pacing")                     return "high";
  if (status === "under_pacing" && pacingPct < 60)  return "critical";
  if (status === "under_pacing")                    return "high";
  return "medium";
}

// ── Creative → priority ───────────────────────────────────────────────────────

export function creativePriority(
  direction: "ready_to_publish" | "awaiting_review" | "in_progress"
): CommandCenterPriority {
  if (direction === "ready_to_publish") return "high";
  if (direction === "awaiting_review")  return "medium";
  return "low";
}

// ── Build unified priority queue ──────────────────────────────────────────────

type PriorityInput = {
  alertItems:     CommandCenterAlertItem[];
  approvals:      CommandCenterApprovalItem[];
  experiments:    CommandCenterExperimentItem[];
  creativeItems:  CommandCenterCreativeItem[];
  pacingItems:    CommandCenterPacingItem[];
};

export function buildPriorityCards(input: PriorityInput, maxCards = 20): CommandCenterPriorityCard[] {
  const cards: CommandCenterPriorityCard[] = [];

  // Alerts
  for (const a of input.alertItems) {
    const priority = alertPriority(a.severity);
    cards.push({
      id:         `alert-${a.id}`,
      type:       "alert",
      priority,
      title:      a.title,
      subtitle:   a.body.slice(0, 90) + (a.body.length > 90 ? "…" : ""),
      href:       a.href,
      clientName: a.clientName,
    });
  }

  // Approvals
  for (const ap of input.approvals) {
    const priority = approvalPriority(ap.priority, ap.proposedAt);
    cards.push({
      id:         `approval-${ap.id}`,
      type:       "approval",
      priority,
      title:      ap.title,
      subtitle:   ap.rationale.slice(0, 90) + (ap.rationale.length > 90 ? "…" : ""),
      href:       ap.href,
      clientName: ap.clientName,
    });
  }

  // Experiments with a declared winner
  for (const e of input.experiments) {
    const priority = experimentPriority(e.status, e.hasResult, e.outcome);
    if (priority === "low") continue;
    const subtitle =
      e.outcome === "challenger_wins" ? `Challenger wins — ${e.recommendedAction ?? "review result"}` :
      e.outcome === "control_holds"   ? `Control holds — ${e.recommendedAction ?? "review result"}` :
      `Running ${e.daysRunning}d — awaiting result`;
    cards.push({
      id:         `exp-${e.id}`,
      type:       "experiment",
      priority,
      title:      e.name,
      subtitle,
      href:       e.href,
    });
  }

  // Creative items
  for (const c of input.creativeItems) {
    const priority = creativePriority(c.direction);
    if (priority === "low") continue;
    const subtitle =
      c.direction === "ready_to_publish" ? "Approved — ready to publish to Meta" :
      c.direction === "awaiting_review"  ? "Needs review before publish" :
      "Draft in progress";
    cards.push({
      id:         `creative-${c.id}`,
      type:       "creative",
      priority,
      title:      c.title,
      subtitle,
      href:       c.href,
      clientName: c.clientName,
    });
  }

  // Pacing risks
  for (const p of input.pacingItems) {
    const priority = pacingPriority(p.pacingPct, p.status);
    const label =
      p.status === "over_pacing"  ? `${Math.round(p.pacingPct)}% of expected — over pacing` :
                                    `${Math.round(p.pacingPct)}% of expected — under pacing`;
    cards.push({
      id:         `pacing-${p.id}`,
      type:       "pacing",
      priority,
      title:      `${p.clientName} — pacing risk`,
      subtitle:   label,
      href:       p.href,
      clientName: p.clientName,
    });
  }

  // Sort: priority desc, then by type (alert > approval > experiment > creative > pacing)
  const TYPE_ORDER: Record<string, number> = {
    alert: 0, approval: 1, experiment: 2, creative: 3, pacing: 4, blocker: 5,
  };

  cards.sort((a, b) => {
    const pd = comparePriority(a.priority, b.priority);
    if (pd !== 0) return pd;
    return (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9);
  });

  return cards.slice(0, maxCards);
}

// ── Label helpers ─────────────────────────────────────────────────────────────

export function priorityLabel(p: CommandCenterPriority): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export function priorityBadgeClass(p: CommandCenterPriority): string {
  if (p === "critical") return "border-rose-800/50 bg-rose-950/60 text-rose-300";
  if (p === "high")     return "border-amber-800/50 bg-amber-950/60 text-amber-300";
  if (p === "medium")   return "border-sky-800/50 bg-sky-950/60 text-sky-300";
  return "border-slate-700 bg-slate-800 text-slate-400";
}

export function formatAlertType(alertType: string): string {
  const LABELS: Record<string, string> = {
    roas_drop:            "ROAS Drop",
    cpa_spike:            "CPA Spike",
    spend_drop:           "Spend Drop",
    spend_spike:          "Spend Spike",
    stale_sync:           "Stale Sync",
    no_data:              "No Data",
    campaign_below_goal:  "Below Goal",
    campaign_above_goal:  "Above Goal",
    integration_failure:  "Integration Failure",
    // Proactive triggers
    scale_ready:               "Scale Ready",
    winner_detected:           "Winner Detected",
    loser_detected:            "Loser Detected",
    creative_fatigue_detected: "Creative Fatigue",
    follow_up_test_needed:     "Follow-Up Test",
    action_blocked:            "Action Blocked",
    trust_state_warning:       "Trust Warning",
    sync_health_issue:         "Sync Issue",
  };
  return LABELS[alertType] ?? alertType.replace(/_/g, " ");
}

export function formatActionType(actionType: string): string {
  const LABELS: Record<string, string> = {
    pause_campaign:    "Pause Campaign",
    reduce_budget:     "Reduce Budget",
    increase_budget:   "Increase Budget",
    review_creative:   "Review Creative",
    refresh_creative:  "Refresh Creative",
    run_sync:          "Run Sync",
    investigate_client: "Investigate Client",
  };
  return LABELS[actionType] ?? actionType.replace(/_/g, " ");
}
