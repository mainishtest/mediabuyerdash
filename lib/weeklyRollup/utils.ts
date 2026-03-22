// ─── Weekly Rollup — Client-Safe Pure Utilities ──────────────────────────────
//
// NO Prisma imports. Safe for "use client" components.
// Formatting, labelling, and display helpers for the weekly rollup UI.

import type { WeeklyRollupSummary } from "../../types/weeklyRollup";

// ── Format helpers ──────────────────────────────────────────────────────────

export function fmtCurrency(val: number, decimals = 0): string {
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function fmtRoas(val: number | null): string {
  return val != null ? `${val.toFixed(2)}x` : "N/A";
}

export function fmtPct(val: number | null): string {
  if (val == null) return "N/A";
  const sign = val >= 0 ? "+" : "";
  return `${sign}${(val * 100).toFixed(1)}%`;
}

export function fmtLift(val: number | null): string {
  if (val == null) return "—";
  const sign = val >= 0 ? "+" : "";
  return `${sign}${(val * 100).toFixed(1)}%`;
}

// ── Priority styling ────────────────────────────────────────────────────────

export function priorityColor(priority: string): string {
  switch (priority) {
    case "high":   return "bg-rose-500/10 text-rose-400";
    case "medium": return "bg-amber-500/10 text-amber-400";
    case "low":    return "bg-slate-700/50 text-slate-400";
    default:       return "bg-slate-700/50 text-slate-400";
  }
}

export function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    scale:       "Scale",
    refresh:     "Creative Refresh",
    test:        "Follow-up Test",
    investigate: "Investigate",
    monitor:     "Monitor",
  };
  return map[category] ?? category;
}

export function categoryIcon(category: string): string {
  switch (category) {
    case "scale":       return "S";
    case "refresh":     return "R";
    case "test":        return "T";
    case "investigate": return "!";
    case "monitor":     return "M";
    default:            return "·";
  }
}

// ── Severity styling ────────────────────────────────────────────────────────

export function severityColor(severity: string): string {
  switch (severity) {
    case "high":   return "text-rose-400";
    case "medium": return "text-amber-400";
    case "low":    return "text-slate-400";
    default:       return "text-slate-400";
  }
}

// ── Confidence styling ──────────────────────────────────────────────────────

export function confidenceColor(confidence: string): string {
  switch (confidence) {
    case "high":   return "bg-emerald-500/10 text-emerald-400";
    case "medium": return "bg-sky-500/10 text-sky-400";
    case "low":    return "bg-slate-700/50 text-slate-400";
    default:       return "bg-slate-700/50 text-slate-400";
  }
}

// ── Summary sentence builder ────────────────────────────────────────────────

export function buildSummarySentence(s: WeeklyRollupSummary): string {
  const parts: string[] = [];
  parts.push(`${s.weekLabel}:`);
  parts.push(`${fmtCurrency(s.totalSpend)} spent, ${fmtCurrency(s.totalRevenue)} revenue, ${fmtRoas(s.blendedRoas)} ROAS.`);
  parts.push(s.topLineMessage);
  return parts.join(" ");
}
