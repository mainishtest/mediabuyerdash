import type { CommandCenterSummary } from "../../../lib/commandCenter/types";

function fmt(v: number, currency = "USD", decimals = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency,
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(v);
}

function fmtNum(v: number) {
  return new Intl.NumberFormat("en-US").format(v);
}

function Kpi({
  label, value, sub, accent, trend,
}: {
  label:   string;
  value:   string;
  sub?:    string;
  accent?: "success" | "warning" | "danger" | "neutral";
  trend?:  { direction: "up" | "down" | "flat"; label: string };
}) {
  const valClass =
    accent === "success" ? "text-emerald-300" :
    accent === "warning" ? "text-amber-300"   :
    accent === "danger"  ? "text-rose-300"    :
    "text-white";

  const trendColor =
    trend?.direction === "up"   ? "text-emerald-400" :
    trend?.direction === "down" ? "text-rose-400"    : "text-slate-500";
  const trendArrow =
    trend?.direction === "up" ? "▲" : trend?.direction === "down" ? "▼" : "→";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tracking-tight ${valClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      {trend && (
        <p className={`mt-1 text-xs font-medium ${trendColor}`}>
          {trendArrow} {trend.label}
        </p>
      )}
    </div>
  );
}

function AlertBadge({ count, label, variant }: { count: number; label: string; variant: "danger" | "warning" | "info" | "neutral" }) {
  const cls =
    variant === "danger"  ? "border-rose-800/50 bg-rose-950/60 text-rose-300"   :
    variant === "warning" ? "border-amber-800/50 bg-amber-950/60 text-amber-300" :
    variant === "info"    ? "border-sky-800/50 bg-sky-950/60 text-sky-300"       :
    "border-slate-700 bg-slate-800 text-slate-400";
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-3`} style={{}}>
      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{count}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}

export function SummaryBar({ summary }: { summary: CommandCenterSummary }) {
  const roasAccent =
    summary.overallRoas == null  ? "neutral" :
    summary.overallRoas >= 3     ? "success" :
    summary.overallRoas >= 1.5   ? "warning" : "danger";

  return (
    <div className="space-y-3">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label="Spend (30d)"
          value={fmt(summary.totalSpend)}
        />
        <Kpi
          label="CRM Revenue"
          value={fmt(summary.totalRevenue)}
          sub="7-day attribution"
        />
        <Kpi
          label="Overall ROAS"
          value={summary.overallRoas != null ? `${summary.overallRoas.toFixed(2)}x` : "—"}
          sub="Revenue ÷ Spend"
          accent={roasAccent}
        />
        <Kpi
          label="CPA"
          value={summary.overallCpa != null ? fmt(summary.overallCpa) : "—"}
          sub="Spend ÷ Orders"
        />
        <Kpi
          label="Orders"
          value={fmtNum(summary.totalOrders)}
          sub="CRM attributed"
        />
        <Kpi
          label="Active Clients"
          value={String(summary.activeClientsCount)}
        />
      </div>

      {/* Signal row */}
      <div className="flex flex-wrap items-center gap-2">
        <AlertBadge
          count={summary.unresolvedAlertsCount}
          label="unresolved alerts"
          variant={summary.unresolvedAlertsCount > 0 ? "danger" : "neutral"}
        />
        <AlertBadge
          count={summary.pendingApprovalsCount}
          label="pending approvals"
          variant={summary.pendingApprovalsCount > 0 ? "warning" : "neutral"}
        />
        <AlertBadge
          count={summary.activeExperimentsCount}
          label="active experiments"
          variant="info"
        />
        <AlertBadge
          count={summary.highPriorityCreativeIssues}
          label="creative actions"
          variant={summary.highPriorityCreativeIssues > 0 ? "warning" : "neutral"}
        />
        <AlertBadge
          count={summary.pacingRisksCount}
          label="pacing risks"
          variant={summary.pacingRisksCount > 0 ? "warning" : "neutral"}
        />
        <p className="ml-auto text-xs text-slate-600">
          Updated {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
