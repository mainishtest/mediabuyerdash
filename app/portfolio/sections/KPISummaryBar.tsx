import type { PortfolioSummary } from "../../../lib/portfolio/types";

function fmt(n: number, currency = "USD") {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

type KPICardProps = {
  label:    string;
  value:    string;
  sub?:     string;
  variant?: "default" | "danger" | "warning" | "success";
};

function KPICard({ label, value, sub, variant = "default" }: KPICardProps) {
  const valueColor =
    variant === "danger"  ? "text-rose-400"    :
    variant === "warning" ? "text-amber-400"   :
    variant === "success" ? "text-emerald-400" :
    "text-white";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-semibold tracking-tight ${valueColor}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function KPISummaryBar({ summary }: { summary: PortfolioSummary }) {
  const roasStr = summary.portfolioRoas !== null
    ? `${summary.portfolioRoas.toFixed(2)}x`
    : "—";
  const cpaStr = summary.portfolioCpa !== null
    ? fmt(summary.portfolioCpa)
    : "—";

  const atRiskVariant   = summary.accountsAtRisk > 0           ? "danger"  : "default";
  const approvalsVariant = summary.accountsWithUrgentApprovals > 0 ? "warning" : "default";
  const stopVariant      = summary.accountsUnderEmergencyStop > 0  ? "danger"  : "default";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      <KPICard
        label="Total Spend"
        value={fmt(summary.totalSpend)}
        sub={`${summary.dateRange.from} – ${summary.dateRange.to}`}
      />
      <KPICard
        label="CRM Revenue"
        value={fmt(summary.totalRevenue)}
        sub="7-day attribution"
      />
      <KPICard
        label="Portfolio ROAS"
        value={roasStr}
        variant={summary.portfolioRoas !== null && summary.portfolioRoas >= 2 ? "success" : "default"}
      />
      <KPICard
        label="Portfolio CPA"
        value={cpaStr}
      />
      <KPICard
        label="Accounts at Risk"
        value={String(summary.accountsAtRisk)}
        sub={`of ${summary.totalClients} total`}
        variant={atRiskVariant}
      />
      <KPICard
        label="Urgent Approvals"
        value={String(summary.accountsWithUrgentApprovals)}
        sub={`${summary.pendingApprovalsCount} pending total`}
        variant={approvalsVariant}
      />
      <KPICard
        label="Emergency Stops"
        value={String(summary.accountsUnderEmergencyStop)}
        sub={`${summary.accountsUnderRestrictedMode} restricted`}
        variant={stopVariant}
      />
      <KPICard
        label="Active Experiments"
        value={String(summary.activeExperimentsCount)}
        sub={`${summary.unresolvedAlertsCount} open alerts`}
      />
    </div>
  );
}
