import type { PortfolioControlSummary } from "../../../../lib/portfolioControls/types";

function StatPill({
  label,
  value,
  variant = "neutral",
  subtext,
}: {
  label:    string;
  value:    number | string;
  variant?: "danger" | "warning" | "success" | "neutral" | "info" | "violet";
  subtext?: string;
}) {
  const cls =
    variant === "danger"  ? "border-rose-800/50 bg-rose-950/60 text-rose-200"          :
    variant === "warning" ? "border-amber-800/50 bg-amber-950/60 text-amber-200"       :
    variant === "success" ? "border-emerald-800/50 bg-emerald-950/60 text-emerald-200" :
    variant === "info"    ? "border-sky-800/50 bg-sky-950/60 text-sky-200"             :
    variant === "violet"  ? "border-violet-800/50 bg-violet-950/60 text-violet-200"    :
    "border-slate-700 bg-slate-800/60 text-slate-300";

  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${cls}`}>
      <p className="text-xl font-bold leading-none tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs opacity-70">{label}</p>
      {subtext && <p className="mt-0.5 text-xs opacity-50">{subtext}</p>}
    </div>
  );
}

export function ControlSummaryBar({
  summary,
}: {
  summary: PortfolioControlSummary;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <StatPill
        label="Pending Approvals"
        value={summary.totalPendingApprovals}
        variant={summary.criticalAgingApprovals > 0 ? "danger" : summary.overdueApprovals > 0 ? "warning" : "neutral"}
        subtext={summary.criticalAgingApprovals > 0 ? `${summary.criticalAgingApprovals} critical (>48h)` : undefined}
      />
      <StatPill
        label="Active Stops"
        value={summary.totalActiveStops}
        variant={summary.totalActiveStops > 0 ? "danger" : "neutral"}
        subtext={summary.globalStopsActive > 0 ? `${summary.globalStopsActive} global` : undefined}
      />
      <StatPill
        label="Active Overrides"
        value={summary.totalActiveOverrides}
        variant={summary.totalActiveOverrides > 0 ? "warning" : "neutral"}
      />
      <StatPill
        label="Accounts w/ Blockers"
        value={summary.accountsWithBlockers}
        variant={summary.accountsWithBlockers > 0 ? "danger" : "success"}
      />
      <StatPill
        label="Accounts Ready"
        value={summary.accountsReady}
        variant={summary.accountsReady > 0 ? "success" : "neutral"}
        subtext={`of ${summary.totalClients} total`}
      />
      <StatPill
        label="Auto-Exec Enabled"
        value={summary.accountsAutoExecEnabled}
        variant="info"
        subtext={`of ${summary.totalClients} clients`}
      />
    </div>
  );
}
