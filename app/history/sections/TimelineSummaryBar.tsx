"use client";

// TimelineSummaryBar — summary stats for action history.

import type { ActionHistorySummary } from "../../../types/actionHistory";

function Stat({ label, value, accent, alwaysShow }: { label: string; value: number; accent?: string; alwaysShow?: boolean }) {
  if (!alwaysShow && value === 0) return null;
  return (
    <div className="rounded-lg bg-slate-800/50 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${accent ?? "text-slate-100"}`}>{value}</p>
    </div>
  );
}

export function TimelineSummaryBar({ summary }: { summary: ActionHistorySummary }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
      <Stat label="Total" value={summary.totalEntries} alwaysShow />
      <Stat label="Success" value={summary.successCount} accent="text-emerald-400" />
      <Stat label="Failed" value={summary.failedCount} accent="text-rose-400" />
      <Stat label="Blocked" value={summary.blockedCount} accent="text-amber-400" />
      <Stat label="Pending" value={summary.pendingCount} accent="text-sky-400" />
      <Stat label="Scale" value={summary.scaleActions} accent="text-violet-400" />
      <Stat label="Tests" value={summary.testActions} accent="text-cyan-400" />
      <Stat label="Creative" value={summary.creativeActions} accent="text-pink-400" />
      <Stat label="Outcomes" value={summary.outcomeRoutes} accent="text-indigo-400" />
    </div>
  );
}
