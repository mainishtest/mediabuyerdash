// ─── Executive Reporting — KPI Card Builder ───────────────────────────────────
//
// Pure functions only — no DB calls. Converts trend summaries, experiment
// outcomes, and creative/approval counts into formatted ExecutiveKpiCard[]
// with deltas, sparklines, and semantic colour variants.

import type {
  ExecutiveKpiCard,
  ExecutiveTrendSummary,
  ExecutiveExperimentSummary,
  ExecutiveCreativeSummary,
  ExecutiveApprovalSummary,
  KpiVariant,
} from "./types";

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtCurrency(v: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency,
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function fmtDelta(raw: number, fmt: (v: number) => string, direction: "up" | "down" | "flat"): string {
  if (direction === "flat") return "—";
  return `${raw >= 0 ? "+" : ""}${fmt(Math.abs(raw))}`;
}

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function roasVariant(roas: number | null): KpiVariant {
  if (roas === null) return "neutral";
  if (roas >= 3)    return "success";
  if (roas >= 1.5)  return "warning";
  return "danger";
}

function direction(delta: number | null): "up" | "down" | "flat" {
  if (delta === null || Math.abs(delta) < 0.5) return "flat";
  return delta > 0 ? "up" : "down";
}

// ── Build KPI cards ───────────────────────────────────────────────────────────

export function buildExecutiveKpiCards(
  trend:       ExecutiveTrendSummary,
  comparison:  ExecutiveTrendSummary | null,
  experiments: ExecutiveExperimentSummary,
  creative:    ExecutiveCreativeSummary,
  approvals:   ExecutiveApprovalSummary,
): ExecutiveKpiCard[] {
  // Spend
  const spendDeltaPct = comparison ? pctDelta(trend.totalSpend, comparison.totalSpend) : null;
  const spendDir      = direction(spendDeltaPct);
  const cards: ExecutiveKpiCard[] = [];

  cards.push({
    id:            "spend",
    label:         "Total Spend",
    value:         fmtCurrency(trend.totalSpend),
    rawValue:      trend.totalSpend,
    delta:         spendDeltaPct,
    deltaLabel:    spendDeltaPct !== null ? fmtPct(spendDeltaPct) : null,
    deltaDirection: spendDir,
    deltaPositive: null, // spend is neutral — higher or lower depends on context
    sparkline:     trend.byDay.map((d) => d.spend),
    variant:       "neutral",
    description:   "Meta delivery spend. CRM revenue is source of truth.",
  });

  // CRM Revenue
  const revDeltaPct = comparison ? pctDelta(trend.totalRevenue, comparison.totalRevenue) : null;
  const revDir      = direction(revDeltaPct);
  cards.push({
    id:            "revenue",
    label:         "CRM Revenue",
    value:         fmtCurrency(trend.totalRevenue),
    rawValue:      trend.totalRevenue,
    delta:         revDeltaPct,
    deltaLabel:    revDeltaPct !== null ? fmtPct(revDeltaPct) : null,
    deltaDirection: revDir,
    deltaPositive: true,
    sparkline:     trend.byDay.map((d) => d.revenue),
    variant:       revDir === "up" ? "success" : revDir === "down" ? "warning" : "neutral",
    description:   "CRM-attributed revenue with 7-day attribution window.",
  });

  // ROAS
  const roas         = trend.overallRoas;
  const roasPrev     = comparison?.overallRoas ?? null;
  const roasDeltaPct = roas && roasPrev ? pctDelta(roas, roasPrev) : null;
  const roasDir      = direction(roasDeltaPct);
  cards.push({
    id:            "roas",
    label:         "ROAS",
    value:         roas !== null ? `${roas.toFixed(2)}x` : "—",
    rawValue:      roas,
    delta:         roasDeltaPct,
    deltaLabel:    roasDeltaPct !== null ? fmtPct(roasDeltaPct) : null,
    deltaDirection: roasDir,
    deltaPositive: true,
    sparkline:     trend.byDay.map((d) => d.roas ?? 0),
    variant:       roasVariant(roas),
    description:   "CRM Revenue ÷ Meta Spend. 7-day attribution window.",
  });

  // CPA
  const cpa      = trend.overallCpa;
  const cpaPrev  = comparison?.overallCpa ?? null;
  const cpaDelta = cpa && cpaPrev ? pctDelta(cpa, cpaPrev) : null;
  const cpaDir   = direction(cpaDelta);
  const cpaVariant: KpiVariant =
    cpa === null       ? "neutral" :
    cpaDir === "down"  ? "success" :   // CPA down = good
    cpaDir === "up"    ? "warning" : "neutral";
  cards.push({
    id:            "cpa",
    label:         "CPA",
    value:         cpa !== null ? fmtCurrency(cpa) : "—",
    rawValue:      cpa,
    delta:         cpaDelta,
    deltaLabel:    cpaDelta !== null ? fmtPct(cpaDelta) : null,
    deltaDirection: cpaDir,
    deltaPositive: false, // lower CPA is better
    sparkline:     [],
    variant:       cpaVariant,
    description:   "Meta Spend ÷ CRM Orders.",
  });

  // Active tests
  cards.push({
    id:            "active_tests",
    label:         "Active Tests",
    value:         String(experiments.activeCount),
    rawValue:      experiments.activeCount,
    delta:         null,
    deltaLabel:    null,
    deltaDirection: null,
    deltaPositive: null,
    sparkline:     [],
    variant:       "neutral",
    description:   "Experiments currently running (active or evaluating).",
  });

  // Winners this period
  const winnersVariant: KpiVariant =
    experiments.winnersCount > 0 ? "success" : "neutral";
  cards.push({
    id:            "winners",
    label:         "Winners",
    value:         String(experiments.winnersCount),
    rawValue:      experiments.winnersCount,
    delta:         null,
    deltaLabel:    null,
    deltaDirection: null,
    deltaPositive: null,
    sparkline:     [],
    variant:       winnersVariant,
    description:   "Experiments with a declared challenger or control winner.",
  });

  // Creatives launched
  cards.push({
    id:            "creatives_launched",
    label:         "Creatives Launched",
    value:         String(creative.variantsLaunched),
    rawValue:      creative.variantsLaunched,
    delta:         null,
    deltaLabel:    null,
    deltaDirection: null,
    deltaPositive: null,
    sparkline:     [],
    variant:       creative.variantsLaunched > 0 ? "success" : "neutral",
    description:   "Variants published to Meta via the Creative Lab workflow.",
  });

  // Approvals pending
  cards.push({
    id:            "approvals_pending",
    label:         "Pending Approvals",
    value:         String(approvals.pendingCount),
    rawValue:      approvals.pendingCount,
    delta:         null,
    deltaLabel:    null,
    deltaDirection: null,
    deltaPositive: null,
    sparkline:     [],
    variant:       approvals.pendingCount > 0 ? "warning" : "neutral",
    description:   "Automation proposals awaiting approval.",
  });

  return cards;
}
