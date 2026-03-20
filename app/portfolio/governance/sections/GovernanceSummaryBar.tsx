import type { PortfolioGovernanceSummary } from "../../../../lib/portfolioGovernance/types";

function StatPill({
  label,
  value,
  variant = "neutral",
}: {
  label:    string;
  value:    number | string;
  variant?: "danger" | "warning" | "success" | "neutral" | "info";
}) {
  const cls =
    variant === "danger"  ? "border-rose-800/50 bg-rose-950/60 text-rose-200"      :
    variant === "warning" ? "border-amber-800/50 bg-amber-950/60 text-amber-200"   :
    variant === "success" ? "border-emerald-800/50 bg-emerald-950/60 text-emerald-200" :
    variant === "info"    ? "border-sky-800/50 bg-sky-950/60 text-sky-200"         :
    "border-slate-700 bg-slate-800/60 text-slate-300";

  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${cls}`}>
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="mt-0.5 text-xs text-current opacity-70">{label}</p>
    </div>
  );
}

export function GovernanceSummaryBar({
  summary,
}: {
  summary: PortfolioGovernanceSummary;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <StatPill
        label="Total Opportunities"
        value={summary.totalOpportunities}
        variant={summary.criticalOpportunities > 0 ? "warning" : "success"}
      />
      <StatPill
        label="Critical Risks"
        value={summary.criticalRisks}
        variant={summary.criticalRisks > 0 ? "danger" : "success"}
      />
      <StatPill
        label="Ready to Act"
        value={summary.readyOpportunities}
        variant={summary.readyOpportunities > 0 ? "success" : "neutral"}
      />
      <StatPill
        label="Blocked Items"
        value={summary.blockedItems}
        variant={summary.blockedItems > 0 ? "danger" : "neutral"}
      />
      <StatPill
        label="Budget Items"
        value={summary.budgetGovernanceItems}
        variant="info"
      />
      <StatPill
        label="Accounts w/ Blockers"
        value={summary.accountsWithBlockers}
        variant={summary.accountsWithBlockers > 0 ? "warning" : "neutral"}
      />
    </div>
  );
}
