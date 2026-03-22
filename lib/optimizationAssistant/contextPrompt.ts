// ─── Optimization Assistant — Context Prompt Builder ─────────────────────────
//
// Pure function. Converts an OptimizationAssistantContext into a compact text
// summary for use in LLM prompts. Target: < 1500 tokens.

import type { OptimizationAssistantContext } from "./types";

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function buildContextPrompt(ctx: OptimizationAssistantContext): string {
  const lines: string[] = [];

  // ── Header ─────────────────────────────────────────────────────────────────
  lines.push(`## Media Buying Dashboard — Operational Context`);
  lines.push(`Date range: ${ctx.dateFrom} to ${ctx.dateTo}`);
  if (ctx.clientName) lines.push(`Client filter: ${ctx.clientName}`);
  lines.push(`Context assembled: ${ctx.assembledAt}`);
  lines.push("");

  // ── Account summary ────────────────────────────────────────────────────────
  lines.push(`## Account Summary`);
  lines.push(`- Spend: ${fmtCurrency(ctx.summary.totalSpend)}`);
  lines.push(`- CRM revenue: ${fmtCurrency(ctx.summary.totalRevenue)}`);
  if (ctx.summary.overallRoas !== null)
    lines.push(`- Overall ROAS: ${ctx.summary.overallRoas.toFixed(2)}× (CRM source of truth, 7-day attribution)`);
  if (ctx.summary.overallCpa !== null)
    lines.push(`- Overall CPA: ${fmtCurrency(ctx.summary.overallCpa)}`);
  lines.push(`- Active clients: ${ctx.summary.activeClientsCount}`);
  lines.push(`- Open alerts: ${ctx.summary.openAlerts}`);
  lines.push(`- Pending approvals: ${ctx.summary.pendingApprovals}`);
  lines.push(`- Active experiments: ${ctx.summary.activeExperiments}`);
  lines.push(`- Pacing risks: ${ctx.summary.pacingRisksCount}`);
  lines.push("");

  // ── KPI cards with deltas ──────────────────────────────────────────────────
  if (ctx.kpis.length > 0) {
    lines.push(`## KPI Trends`);
    ctx.kpis.slice(0, 6).forEach((k) => {
      const delta = k.deltaLabel ? ` (${k.deltaLabel} vs prior period)` : "";
      lines.push(`- ${k.label}: ${k.value}${delta}`);
    });
    lines.push("");
  }

  // ── Executive narrative ────────────────────────────────────────────────────
  if (ctx.narrative) {
    lines.push(`## Period Narrative`);
    lines.push(`Headline: ${ctx.narrative.headline}`);
    lines.push(`What happened: ${ctx.narrative.whatHappened}`);
    lines.push(`What changed: ${ctx.narrative.whatChanged}`);
    lines.push(`What worked: ${ctx.narrative.whatWorked}`);
    lines.push(`What underperformed: ${ctx.narrative.whatUnderperformed}`);
    lines.push(`Actions taken: ${ctx.narrative.actionsTaken}`);
    lines.push(`What's next: ${ctx.narrative.whatsNext}`);
    lines.push("");
  }

  // ── Top priorities ─────────────────────────────────────────────────────────
  if (ctx.topPriorities.length > 0) {
    lines.push(`## Top Priorities`);
    ctx.topPriorities.slice(0, 5).forEach((p) => {
      lines.push(`- [${p.priority.toUpperCase()}] ${p.title}: ${p.subtitle}${p.clientName ? ` (${p.clientName})` : ""}`);
    });
    lines.push("");
  }

  // ── Alerts ────────────────────────────────────────────────────────────────
  if (ctx.alerts.length > 0) {
    lines.push(`## Active Alerts`);
    ctx.alerts.slice(0, 5).forEach((a) => {
      lines.push(`- [${a.severity}] ${a.alertType.replace(/_/g, " ")} — ${a.clientName}: ${a.body.slice(0, 100)}`);
    });
    lines.push("");
  }

  // ── Pending approvals ──────────────────────────────────────────────────────
  if (ctx.approvals.length > 0) {
    lines.push(`## Pending Approvals`);
    ctx.approvals.slice(0, 4).forEach((a) => {
      lines.push(`- ${a.clientName}: ${a.actionType.replace(/_/g, " ")} — ${a.rationale.slice(0, 100)}`);
    });
    lines.push("");
  }

  // ── Experiments ────────────────────────────────────────────────────────────
  if (ctx.experiments.length > 0) {
    lines.push(`## Experiments`);
    ctx.experiments.slice(0, 4).forEach((e) => {
      const outcome = e.outcome ? `outcome: ${e.outcome}` : `running ${e.daysRunning} days`;
      lines.push(`- ${e.name} (${e.status}) — ${outcome}`);
      if (e.winningVariant) lines.push(`  Winner: ${e.winningVariant}`);
    });
    lines.push("");
  }

  // ── Pacing risks ──────────────────────────────────────────────────────────
  const riskyPacing = ctx.pacingItems.filter((p) => p.status !== "on_pacing");
  if (riskyPacing.length > 0) {
    lines.push(`## Pacing Risks`);
    riskyPacing.slice(0, 4).forEach((p) => {
      lines.push(`- ${p.clientName}: ${p.pacingPct.toFixed(0)}% paced — ${p.status.replace(/_/g, " ")}`);
    });
    lines.push("");
  }

  // ── Outcome routing ──────────────────────────────────────────────────────
  if (ctx.outcomeWinnersCount > 0 || ctx.outcomeLosersCount > 0 || ctx.outcomeScaleReadyCount > 0) {
    lines.push(`## Outcome Routing`);
    lines.push(`- Winners: ${ctx.outcomeWinnersCount}`);
    lines.push(`- Losers: ${ctx.outcomeLosersCount}`);
    lines.push(`- Scale-ready: ${ctx.outcomeScaleReadyCount}`);
    lines.push(`- Refresh needed: ${ctx.outcomeRefreshNeededCount}`);
    lines.push("");
  }

  // ── Recent actions ──────────────────────────────────────────────────────
  if (ctx.recentActionsCount > 0) {
    lines.push(`## Recent Actions (24h)`);
    lines.push(`- Total: ${ctx.recentActionsCount}`);
    if (ctx.recentActionsFailedCount > 0) lines.push(`- Failed: ${ctx.recentActionsFailedCount}`);
    if (ctx.recentActionsBlockedCount > 0) lines.push(`- Blocked: ${ctx.recentActionsBlockedCount}`);
    lines.push("");
  }

  // ── Learning memory ────────────────────────────────────────────────────────
  if (ctx.learnings.length > 0) {
    lines.push(`## Learning Memory`);
    lines.push(ctx.learningSummary);
    ctx.learnings
      .filter((l) => l.confidence === "high")
      .slice(0, 4)
      .forEach((l) => {
        lines.push(`- [${l.category.replace(/_/g, " ")}] ${l.insightText.slice(0, 120)}`);
      });
    lines.push("");
  }

  // ── Data warnings ─────────────────────────────────────────────────────────
  if (ctx.dataWarnings.length > 0) {
    lines.push(`## Data Caveats`);
    ctx.dataWarnings.forEach((w) => lines.push(`- ${w}`));
    lines.push("");
  }

  return lines.join("\n");
}
