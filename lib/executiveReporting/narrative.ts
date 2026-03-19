// ─── Executive Reporting — Narrative Generator ────────────────────────────────
//
// Pure function — no DB calls, no AI required. Converts assembled summary data
// into 7 sentence-form answers that answer the key executive questions.
// Upgrade path: replace this function with an LLM call without touching
// the aggregation layer.

import type {
  ExecutiveNarrativeSection,
  ExecutiveTrendSummary,
  ExecutiveExperimentSummary,
  ExecutiveCreativeSummary,
  ExecutiveApprovalSummary,
  ExecutiveImpactSummary,
} from "./types";

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

function fmtDateRange(from: string, to: string): string {
  const f = new Date(from + "T00:00:00");
  const t = new Date(to   + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${f.toLocaleDateString("en-US", opts)} – ${t.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

function pct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n !== 1 ? "s" : ""}`;
}

// ── Main narrative builder ────────────────────────────────────────────────────

export function buildExecutiveNarrative(params: {
  dateRange:   { from: string; to: string };
  clientName:  string | null;
  trend:       ExecutiveTrendSummary;
  comparison:  ExecutiveTrendSummary | null;
  experiments: ExecutiveExperimentSummary;
  creative:    ExecutiveCreativeSummary;
  approvals:   ExecutiveApprovalSummary;
  impact:      ExecutiveImpactSummary;
}): ExecutiveNarrativeSection {
  const { dateRange, clientName, trend, comparison, experiments, creative, approvals, impact } = params;
  const prefix = clientName ? `${clientName}: ` : "";

  // ── Headline ──────────────────────────────────────────────────────────────
  const healthLabel =
    !trend.hasSpendData           ? "limited data this period" :
    trend.overallRoas === null    ? "spend tracked, revenue attribution pending" :
    trend.overallRoas >= 4        ? "excellent performance" :
    trend.overallRoas >= 2.5      ? "strong performance" :
    trend.overallRoas >= 1.5      ? "solid performance" :
    trend.overallRoas >= 1        ? "mixed performance"  :
                                    "performance below breakeven";

  const headline = `${prefix}${fmtDateRange(dateRange.from, dateRange.to)} — ${healthLabel}`;

  // ── What happened ─────────────────────────────────────────────────────────
  let whatHappened: string;
  if (!trend.hasSpendData) {
    whatHappened = "No spend data found for this period. Ensure Meta sync has run and the date range is correct.";
  } else {
    const roasTxt =
      trend.overallRoas !== null ? `${trend.overallRoas.toFixed(2)}x ROAS` : "ROAS not yet available";
    const cpaTxt =
      trend.overallCpa !== null ? ` Average CPA of ${fmtCurrency(trend.overallCpa)}.` : "";
    const ordersTxt =
      trend.totalOrders > 0
        ? ` ${trend.totalOrders.toLocaleString()} orders attributed via 7-day window.`
        : "";
    whatHappened =
      `Total spend was ${fmtCurrency(trend.totalSpend)}, generating ${fmtCurrency(trend.totalRevenue)} ` +
      `in CRM-attributed revenue (${roasTxt}).${cpaTxt}${ordersTxt}`;
  }

  // ── What changed ──────────────────────────────────────────────────────────
  let whatChanged: string;
  if (!comparison || !comparison.hasSpendData) {
    whatChanged = "No prior-period data to compare against. Select a date range with comparison enabled to see trends.";
  } else {
    const parts: string[] = [];
    const sDelta = pct(trend.totalSpend, comparison.totalSpend);
    const rDelta = pct(trend.totalRevenue, comparison.totalRevenue);
    const roasDelta =
      trend.overallRoas && comparison.overallRoas
        ? pct(trend.overallRoas, comparison.overallRoas)
        : null;

    if (sDelta !== null) {
      parts.push(
        Math.abs(sDelta) < 2
          ? "Spend was flat vs prior period"
          : `Spend ${sDelta > 0 ? "up" : "down"} ${Math.abs(sDelta).toFixed(0)}% vs prior period`
      );
    }
    if (rDelta !== null) {
      parts.push(
        Math.abs(rDelta) < 2
          ? "revenue flat"
          : `revenue ${rDelta > 0 ? "up" : "down"} ${Math.abs(rDelta).toFixed(0)}%`
      );
    }
    if (roasDelta !== null) {
      parts.push(
        Math.abs(roasDelta) < 2
          ? "ROAS stable"
          : `ROAS ${roasDelta > 0 ? "improved" : "declined"} ${Math.abs(roasDelta).toFixed(0)}%`
      );
    }
    whatChanged = parts.length > 0
      ? parts.join("; ").replace(/^./, (c) => c.toUpperCase()) + "."
      : "No significant changes vs prior period.";
  }

  // ── What worked ───────────────────────────────────────────────────────────
  const worked: string[] = [];
  if (experiments.winnersCount > 0)
    worked.push(`${plural(experiments.winnersCount, "experiment")} declared a winner`);
  if (creative.variantsLaunched > 0)
    worked.push(`${plural(creative.variantsLaunched, "creative variant")} launched to Meta`);
  if (approvals.executedThisPeriod > 0)
    worked.push(`${plural(approvals.executedThisPeriod, "automation action")} executed successfully`);
  if (trend.hasSpendData && trend.overallRoas !== null && trend.overallRoas >= 2.5)
    worked.push(`ROAS at ${trend.overallRoas.toFixed(2)}x — above healthy threshold`);
  const whatWorked = worked.length > 0
    ? worked.join("; ") + "."
    : "No standout wins identified this period.";

  // ── What underperformed ───────────────────────────────────────────────────
  const under: string[] = [];
  if (impact.unresolvedAlertsCount > 0)
    under.push(`${plural(impact.unresolvedAlertsCount, "unresolved alert")} still open`);
  if (impact.pacingRisksCount > 0)
    under.push(`${plural(impact.pacingRisksCount, "client")} with pacing risks`);
  if (experiments.noWinnerCount > 0)
    under.push(`${plural(experiments.noWinnerCount, "experiment")} with no clear winner`);
  if (trend.hasSpendData && trend.overallRoas !== null && trend.overallRoas < 1)
    under.push(`Overall ROAS below breakeven at ${trend.overallRoas.toFixed(2)}x`);
  if (impact.guardrailBlocksCount > 0)
    under.push(`${plural(impact.guardrailBlocksCount, "automation action")} blocked by guardrails`);
  const whatUnderperformed = under.length > 0
    ? under.join("; ") + "."
    : "No significant underperformance signals detected.";

  // ── Actions taken ─────────────────────────────────────────────────────────
  const actions: string[] = [];
  if (approvals.approvedThisPeriod > 0)
    actions.push(`${plural(approvals.approvedThisPeriod, "proposal")} approved`);
  if (approvals.rejectedThisPeriod > 0)
    actions.push(`${plural(approvals.rejectedThisPeriod, "proposal")} rejected`);
  if (impact.autoExecutionsThisPeriod > 0)
    actions.push(
      `${plural(impact.autoExecutionsThisPeriod, "auto-execution")} attempted ` +
      `(${impact.autoExecutionSuccessCount} successful)`
    );
  if (creative.variantsApproved > 0)
    actions.push(`${plural(creative.variantsApproved, "creative variant")} approved for launch`);
  const actionsTaken = actions.length > 0
    ? actions.join("; ") + "."
    : "No automated or manual actions recorded this period.";

  // ── What's next ───────────────────────────────────────────────────────────
  const next: string[] = [];
  if (approvals.pendingCount > 0)
    next.push(`${plural(approvals.pendingCount, "approval")} awaiting decision`);
  if (experiments.activeCount > 0)
    next.push(`${plural(experiments.activeCount, "experiment")} still running`);
  const readyToLaunch = creative.variantsApproved - creative.variantsLaunched;
  if (readyToLaunch > 0)
    next.push(`${plural(readyToLaunch, "creative variant")} approved and ready to launch`);
  if (impact.unresolvedAlertsCount > 0)
    next.push(`${plural(impact.unresolvedAlertsCount, "open alert")} to resolve`);
  const whatsNext = next.length > 0
    ? next.join("; ") + "."
    : "No immediate next steps identified.";

  return {
    headline,
    whatHappened,
    whatChanged,
    whatWorked,
    whatUnderperformed,
    actionsTaken,
    whatsNext,
  };
}
