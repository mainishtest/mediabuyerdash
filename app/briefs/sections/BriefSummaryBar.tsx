"use client";

// BriefSummaryBar — KPI bar for the daily morning brief.
// Shows spend, revenue, ROAS, CPA, and status counts.

import type { DailyBriefSummary } from "../../../types/dailyBrief";

function fmtCurrency(val: number): string {
  return `$${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtRoas(val: number | null): string {
  return val != null ? `${val.toFixed(2)}x` : "N/A";
}

function fmtCpa(val: number | null): string {
  return val != null ? `$${val.toFixed(2)}` : "N/A";
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-slate-800/50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accent ?? "text-slate-100"}`}>{value}</p>
    </div>
  );
}

export function BriefSummaryBar({ summary }: { summary: DailyBriefSummary }) {
  return (
    <div className="space-y-4">
      {/* Top-line message */}
      <div className="rounded-lg bg-slate-800 px-4 py-3">
        <p className="text-sm font-medium text-slate-100">{summary.topLineMessage}</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Spend" value={fmtCurrency(summary.totalSpend)} />
        <StatCard label="Revenue" value={fmtCurrency(summary.totalRevenue)} />
        <StatCard label="ROAS" value={fmtRoas(summary.blendedRoas)} accent={
          summary.blendedRoas != null && summary.blendedRoas >= 2 ? "text-emerald-400" :
          summary.blendedRoas != null && summary.blendedRoas < 1 ? "text-rose-400" :
          "text-slate-100"
        } />
        <StatCard label="CPA" value={fmtCpa(summary.blendedCpa)} />
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {summary.accountsAtRisk > 0 && (
          <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-400">
            {summary.accountsAtRisk} at risk
          </span>
        )}
        {summary.accountsScaling > 0 && (
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            {summary.accountsScaling} scaling
          </span>
        )}
        {summary.winnersCount > 0 && (
          <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-400">
            {summary.winnersCount} winners
          </span>
        )}
        {summary.losersCount > 0 && (
          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
            {summary.losersCount} need refresh
          </span>
        )}
        {summary.blockedCount > 0 && (
          <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-400">
            {summary.blockedCount} blocked
          </span>
        )}
        <span className="rounded-full bg-slate-700/50 px-3 py-1 text-xs font-medium text-slate-400">
          {summary.totalAccounts} accounts
        </span>
      </div>
    </div>
  );
}
