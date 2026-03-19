// ─── Optimization Assistant — Evidence Extractor ─────────────────────────────
//
// Pure function. Extracts the most relevant evidence items from the assembled
// context for a given intent. No I/O. Returns at most 8 evidence items.

import type { OptimizationAssistantContext, OptimizationAssistantEvidence, OptimizationAssistantIntent } from "./types";

function fmt(n: number, prefix = ""): string {
  return `${prefix}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function fmtCurrency(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

// ── Core evidence builders ────────────────────────────────────────────────────

function kpiEvidence(ctx: OptimizationAssistantContext): OptimizationAssistantEvidence[] {
  const items: OptimizationAssistantEvidence[] = [];
  const s = ctx.summary;

  if (s.totalSpend > 0)
    items.push({ label: "Total spend", value: fmtCurrency(s.totalSpend), source: "CRM reconciliation", direction: "neutral" });
  if (s.totalRevenue > 0)
    items.push({ label: "CRM revenue", value: fmtCurrency(s.totalRevenue), source: "CRM reconciliation", direction: "neutral" });
  if (s.overallRoas !== null)
    items.push({ label: "Overall ROAS", value: `${s.overallRoas.toFixed(2)}×`, source: "CRM reconciliation", direction: s.overallRoas >= 1.5 ? "positive" : "negative" });
  if (s.overallCpa !== null)
    items.push({ label: "Overall CPA", value: fmtCurrency(s.overallCpa), source: "CRM reconciliation", direction: "neutral" });

  return items;
}

function alertEvidence(ctx: OptimizationAssistantContext): OptimizationAssistantEvidence[] {
  return ctx.alerts.slice(0, 3).map((a) => ({
    label: a.alertType.replace(/_/g, " "),
    value: a.body.slice(0, 80),
    source: `Alert — ${a.clientName}`,
    direction: "negative" as const,
  }));
}

function approvalEvidence(ctx: OptimizationAssistantContext): OptimizationAssistantEvidence[] {
  return ctx.approvals.slice(0, 3).map((a) => ({
    label: a.actionType.replace(/_/g, " "),
    value: a.rationale.slice(0, 80),
    source: `Pending approval — ${a.clientName}`,
    direction: "neutral" as const,
  }));
}

function experimentEvidence(ctx: OptimizationAssistantContext): OptimizationAssistantEvidence[] {
  return ctx.experiments.slice(0, 4).map((e) => ({
    label: e.name,
    value: e.outcome ? `Outcome: ${e.outcome}` : `Running ${e.daysRunning}d`,
    source: `Experiment`,
    direction: e.outcome === "winner_found" ? "positive" : e.outcome === "no_winner" ? "neutral" : "neutral",
  }));
}

function pacingEvidence(ctx: OptimizationAssistantContext): OptimizationAssistantEvidence[] {
  return ctx.pacingItems
    .filter((p) => p.status !== "on_pacing")
    .slice(0, 3)
    .map((p) => ({
      label: p.clientName,
      value: `${p.pacingPct.toFixed(0)}% paced — ${p.status.replace(/_/g, " ")}`,
      source: "Budget pacing",
      direction: p.status === "over_pacing" ? "negative" : "negative",
    }));
}

function kpiDeltaEvidence(ctx: OptimizationAssistantContext): OptimizationAssistantEvidence[] {
  return ctx.kpis
    .filter((k) => k.deltaDirection !== null && k.deltaDirection !== "flat" && k.delta !== null && Math.abs(k.delta ?? 0) > 0)
    .slice(0, 4)
    .map((k) => ({
      label: k.label,
      value: k.deltaLabel ? `${k.value} (${k.deltaLabel})` : k.value,
      source: "KPI trends",
      direction: (k.deltaPositive === true ? "positive" : k.deltaPositive === false ? "negative" : "neutral") as "positive" | "negative" | "neutral",
    }));
}

function creativeEvidence(ctx: OptimizationAssistantContext): OptimizationAssistantEvidence[] {
  const readyCount = ctx.creativeItems.filter((c) => c.direction === "ready_to_publish").length;
  const awaitingCount = ctx.creativeItems.filter((c) => c.direction === "awaiting_review").length;
  const items: OptimizationAssistantEvidence[] = [];
  if (readyCount > 0) items.push({ label: "Ready to publish", value: `${readyCount} creative${readyCount !== 1 ? "s" : ""}`, source: "Creative Lab", direction: "positive" });
  if (awaitingCount > 0) items.push({ label: "Awaiting review", value: `${awaitingCount} creative${awaitingCount !== 1 ? "s" : ""}`, source: "Creative Lab", direction: "neutral" });
  return items;
}

function learningEvidence(ctx: OptimizationAssistantContext): OptimizationAssistantEvidence[] {
  return ctx.learnings
    .filter((l) => l.confidence === "high")
    .slice(0, 3)
    .map((l) => ({
      label: l.category.replace(/_/g, " "),
      value: l.insightText.slice(0, 80),
      source: `Learning — ${l.confidence} confidence`,
      direction: l.category.includes("poor") || l.category.includes("fatigue") ? "negative" : "positive",
    }));
}

// ── Intent-based dispatcher ───────────────────────────────────────────────────

export function summarizeAssistantEvidence(
  ctx: OptimizationAssistantContext,
  intent: OptimizationAssistantIntent
): OptimizationAssistantEvidence[] {
  const all: OptimizationAssistantEvidence[] = [];

  switch (intent) {
    case "summarize_account_state":
      all.push(...kpiEvidence(ctx), ...kpiDeltaEvidence(ctx));
      break;
    case "explain_performance_drop":
      all.push(...kpiDeltaEvidence(ctx), ...alertEvidence(ctx), ...pacingEvidence(ctx));
      break;
    case "identify_goal_risk":
      all.push(...pacingEvidence(ctx), ...kpiDeltaEvidence(ctx), ...kpiEvidence(ctx));
      break;
    case "recommend_next_actions":
      all.push(...kpiEvidence(ctx), ...alertEvidence(ctx), ...approvalEvidence(ctx));
      break;
    case "explain_winner":
      all.push(...learningEvidence(ctx), ...experimentEvidence(ctx), ...kpiEvidence(ctx));
      break;
    case "explain_loser":
      all.push(...alertEvidence(ctx), ...kpiDeltaEvidence(ctx), ...pacingEvidence(ctx));
      break;
    case "summarize_creative_fatigue":
      all.push(...creativeEvidence(ctx), ...learningEvidence(ctx));
      break;
    case "summarize_experiment_status":
      all.push(...experimentEvidence(ctx), ...learningEvidence(ctx));
      break;
    case "identify_pending_approvals":
      all.push(...approvalEvidence(ctx), ...alertEvidence(ctx));
      break;
    case "find_highest_priority_issue":
    default:
      all.push(...kpiEvidence(ctx), ...alertEvidence(ctx), ...approvalEvidence(ctx), ...pacingEvidence(ctx));
  }

  // Deduplicate by label and cap at 8
  const seen = new Set<string>();
  return all.filter((e) => {
    if (seen.has(e.label)) return false;
    seen.add(e.label);
    return true;
  }).slice(0, 8);
}
