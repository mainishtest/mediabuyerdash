"use client";

// RollupSummaryBar — KPI bar for the weekly strategy rollup.

import type { WeeklyRollupSummary } from "../../../types/weeklyRollup";
import { fmtCurrency, fmtRoas }    from "../../../lib/weeklyRollup/utils";

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-lg bg-slate-800/50 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accent ?? "text-slate-100"}`}>{value}</p>
    </div>
  );
}

export function RollupSummaryBar({ summary }: { summary: WeeklyRollupSummary }) {
  return (
    <div className="space-y-4">
      {/* Top-line message */}
      <div className="rounded-lg bg-slate-800 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{summary.weekLabel}</p>
        <p className="mt-1 text-sm font-medium text-slate-100">{summary.topLineMessage}</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Spend" value={fmtCurrency(summary.totalSpend)} />
        <Stat label="Revenue" value={fmtCurrency(summary.totalRevenue)} />
        <Stat label="ROAS" value={fmtRoas(summary.blendedRoas)} accent={
          summary.blendedRoas != null && summary.blendedRoas >= 2 ? "text-emerald-400" :
          summary.blendedRoas != null && summary.blendedRoas < 1 ? "text-rose-400" : "text-slate-100"
        } />
        <Stat label="Winners" value={summary.winnersCount} accent="text-emerald-400" />
        <Stat label="Losers" value={summary.losersCount} accent={summary.losersCount > 0 ? "text-amber-400" : "text-slate-100"} />
        <Stat label="Actions" value={summary.actionsThisWeek} />
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {summary.scaleOpportunities > 0 && (
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            {summary.scaleOpportunities} scale {summary.scaleOpportunities === 1 ? "opportunity" : "opportunities"}
          </span>
        )}
        {summary.declineSignals > 0 && (
          <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-400">
            {summary.declineSignals} declining
          </span>
        )}
        {summary.experimentsRun > 0 && (
          <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-400">
            {summary.experimentsRun} experiments
          </span>
        )}
        {summary.patternsFound > 0 && (
          <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-400">
            {summary.patternsFound} patterns
          </span>
        )}
        {summary.nextStepsCount > 0 && (
          <span className="rounded-full bg-slate-700/50 px-3 py-1 text-xs font-medium text-slate-400">
            {summary.nextStepsCount} next steps
          </span>
        )}
      </div>
    </div>
  );
}
