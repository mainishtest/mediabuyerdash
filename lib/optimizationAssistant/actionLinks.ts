// ─── Optimization Assistant — Action Links ────────────────────────────────────
//
// Pure function. Builds workflow navigation links based on intent and context.
// All links point to existing routes — no new pages created here.

import type {
  OptimizationAssistantContext,
  OptimizationAssistantIntent,
  OptimizationAssistantActionLink,
  OptimizationAssistantEntityReference,
} from "./types";

// ── Entity reference builder ──────────────────────────────────────────────────

export function buildOptimizationAssistantEntityReferences(
  ctx: OptimizationAssistantContext,
  intent: OptimizationAssistantIntent
): OptimizationAssistantEntityReference[] {
  const entities: OptimizationAssistantEntityReference[] = [];

  if (intent === "identify_pending_approvals" || intent === "recommend_next_actions" || intent === "find_highest_priority_issue" || intent === "summarize_today" || intent === "summarize_blockers") {
    ctx.approvals.slice(0, 3).forEach((a) => {
      entities.push({ type: "approval", id: a.id, label: `${a.clientName}: ${a.actionType.replace(/_/g, " ")}`, href: "/automation" });
    });
  }

  if (intent === "summarize_experiment_status" || intent === "summarize_recent_tests" || intent === "explain_winner" || intent === "explain_loser" || intent === "summarize_week") {
    ctx.experiments.slice(0, 3).forEach((e) => {
      entities.push({ type: "experiment", id: e.id, label: e.name, href: e.href });
    });
  }

  if (intent === "explain_performance_drop" || intent === "identify_goal_risk" || intent === "find_accounts_at_risk") {
    ctx.alerts.slice(0, 3).forEach((a) => {
      entities.push({ type: "alert", id: a.id, label: `${a.clientName}: ${a.alertType.replace(/_/g, " ")}`, href: a.href });
    });
  }

  if (intent === "identify_goal_risk" || intent === "find_highest_priority_issue") {
    ctx.pacingItems
      .filter((p) => p.status !== "on_pacing")
      .slice(0, 2)
      .forEach((p) => {
        entities.push({ type: "pacing", id: p.id, label: `${p.clientName} — ${p.pacingPct.toFixed(0)}% paced`, href: p.href });
      });
  }

  if (intent === "summarize_creative_fatigue" || intent === "recommend_next_actions") {
    ctx.creativeItems
      .filter((c) => c.direction === "ready_to_publish")
      .slice(0, 2)
      .forEach((c) => {
        entities.push({ type: "creative", id: c.id, label: c.title, href: c.href });
      });
  }

  // Deduplicate by id
  const seen = new Set<string>();
  return entities.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  }).slice(0, 6);
}

// ── Action links ──────────────────────────────────────────────────────────────

const ALWAYS_PRESENT: OptimizationAssistantActionLink[] = [
  { label: "Open Command Center", href: "/command-center", icon: "⌘", description: "See all priorities across clients" },
];

export function buildOptimizationAssistantActionLinks(
  ctx: OptimizationAssistantContext,
  intent: OptimizationAssistantIntent
): OptimizationAssistantActionLink[] {
  const links: OptimizationAssistantActionLink[] = [];
  const clientParam = ctx.clientId ? `?clientId=${ctx.clientId}` : "";

  switch (intent) {
    case "summarize_today":
      links.push(
        { label: "Morning Brief", href: "/briefs", icon: "◈", description: "Full daily morning brief" },
        { label: "Command Center", href: `/command-center${clientParam}`, icon: "⌘", description: "All priorities in one view" },
        { label: "Action History", href: "/history", icon: "◎", description: "Recent actions taken" },
      );
      break;

    case "summarize_account_state":
      links.push(
        { label: "Executive report", href: `/reports/executive${clientParam}`, icon: "◈", description: "Full period report with trends" },
        { label: "Reconciliation", href: "/reconciliation", icon: "◎", description: "CRM reconciliation data" },
      );
      break;

    case "summarize_week":
      links.push(
        { label: "Weekly Rollup", href: "/weekly", icon: "◈", description: "Full weekly strategy rollup" },
        { label: "Learning Memory", href: "/insights/memory", icon: "◇", description: "Patterns captured this week" },
        { label: "Action History", href: "/history", icon: "◎", description: "Week's actions timeline" },
      );
      break;

    case "explain_performance_drop":
      links.push(
        { label: "Open alerts", href: "/alerts", icon: "⚠", description: "Review all active alerts" },
        { label: "Pacing dashboard", href: "/pacing", icon: "◐", description: "Check budget pacing" },
        { label: "Optimization", href: `/optimization${clientParam}`, icon: "◈", description: "Campaign-level optimization" },
      );
      break;

    case "identify_goal_risk":
      links.push(
        { label: "Pacing dashboard", href: "/pacing", icon: "◐", description: "Budget pacing overview" },
        { label: "Optimization", href: `/optimization${clientParam}`, icon: "◈", description: "Campaign-level recommendations" },
      );
      break;

    case "recommend_next_actions":
      links.push(
        { label: "Approval queue", href: "/automation", icon: "✓", description: "Review pending automation approvals" },
        { label: "Command Center", href: `/command-center${clientParam}`, icon: "⌘", description: "All priorities in one view" },
        { label: "Optimization", href: `/optimization${clientParam}`, icon: "◈", description: "Campaign recommendations" },
      );
      break;

    case "explain_winner":
    case "explain_loser":
      links.push(
        { label: "Executive report", href: `/reports/executive${clientParam}`, icon: "◈", description: "Period summary with experiments" },
        { label: "Experiments", href: "/experiments", icon: "⊡", description: "All experiment outcomes" },
        { label: "Learning memory", href: "/insights/memory", icon: "◇", description: "Captured patterns and winners" },
      );
      break;

    case "find_scale_candidates":
      links.push(
        { label: "Optimization", href: `/optimization${clientParam}`, icon: "◈", description: "Campaign-level scale recommendations" },
        { label: "Outcome Routing", href: "/creative-lab/outcomes", icon: "◇", description: "Winners ready to scale" },
        { label: "Command Center", href: `/command-center${clientParam}`, icon: "⌘", description: "Scale-ready highlights" },
      );
      break;

    case "find_accounts_at_risk":
      links.push(
        { label: "Open alerts", href: "/alerts", icon: "⚠", description: "Review all active alerts" },
        { label: "Pacing dashboard", href: "/pacing", icon: "◐", description: "Check budget pacing risks" },
        { label: "Daily Dashboard", href: "/home", icon: "◈", description: "Client status overview" },
      );
      break;

    case "summarize_blockers":
      links.push(
        { label: "Action History", href: "/history", icon: "◎", description: "Failed and blocked actions" },
        { label: "Approval queue", href: "/automation", icon: "✓", description: "Pending automation approvals" },
        { label: "Open alerts", href: "/alerts", icon: "⚠", description: "Active alert events" },
      );
      break;

    case "summarize_recent_tests":
      links.push(
        { label: "Test Results", href: "/creative-lab/results", icon: "⊡", description: "All test result details" },
        { label: "Outcome Routing", href: "/creative-lab/outcomes", icon: "◇", description: "Winner/loser routing" },
        { label: "Experiment Launch", href: "/creative-lab/launch", icon: "↗", description: "Launch new experiments" },
      );
      break;

    case "summarize_creative_fatigue":
      links.push(
        { label: "Creative Lab", href: "/creative-lab", icon: "◇", description: "Review and generate creatives" },
        { label: "Creative fatigue", href: "/creative-fatigue", icon: "◐", description: "Fatigue signals by creative" },
        { label: "Refresh queue", href: "/creative-lab/refresh-queue", icon: "↺", description: "Creatives flagged for refresh" },
      );
      break;

    case "summarize_experiment_status":
      links.push(
        { label: "Experiments", href: "/experiments", icon: "⊡", description: "All experiment plans and results" },
        { label: "Learning memory", href: "/insights/memory", icon: "◇", description: "Experiment learnings captured" },
      );
      break;

    case "identify_pending_approvals":
      links.push(
        { label: "Approval queue", href: "/automation", icon: "✓", description: "Review and approve pending actions" },
        { label: "Command Center", href: `/command-center${clientParam}`, icon: "⌘", description: "All pending items in one view" },
      );
      break;

    case "find_highest_priority_issue":
    default:
      links.push(
        { label: "Command Center", href: `/command-center${clientParam}`, icon: "⌘", description: "All priorities across clients" },
        { label: "Approval queue", href: "/automation", icon: "✓", description: "Pending automation approvals" },
        { label: "Open alerts", href: "/alerts", icon: "⚠", description: "Active alert events" },
      );
  }

  // Always add command center if not already present
  const hasCommandCenter = links.some((l) => l.href.startsWith("/command-center"));
  if (!hasCommandCenter) {
    links.push(...ALWAYS_PRESENT);
  }

  return links.slice(0, 5);
}
