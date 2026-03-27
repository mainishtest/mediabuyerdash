import Link from "next/link";
import type { PortfolioRiskItem } from "../../../lib/portfolio/types";
import { priorityBadgeClass, riskTypeLabel } from "../../../lib/portfolio/health";

function EmptyRisks() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-5 py-6 text-center">
      <p className="text-sm font-medium text-emerald-400">No active risks</p>
      <p className="mt-1 text-xs text-slate-600">
        All accounts are within normal operating parameters.
      </p>
    </div>
  );
}

export function RisksPanel({ risks }: { risks: PortfolioRiskItem[] }) {
  if (risks.length === 0) return <EmptyRisks />;

  return (
    <div className="space-y-2">
      {risks.map((risk) => (
        <Link
          key={risk.id}
          href={risk.href}
          className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3
                     transition-colors hover:border-slate-700 hover:bg-slate-900/60"
        >
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityBadgeClass(risk.priority)}`}>
                {risk.priority.charAt(0).toUpperCase() + risk.priority.slice(1)}
              </span>
              <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
                {riskTypeLabel(risk.riskType)}
              </span>
              <span className="text-xs text-slate-500">{risk.clientName}</span>
            </div>
            <p className="mt-1.5 text-sm font-medium text-white">{risk.title}</p>
            <p className="mt-0.5 text-xs text-slate-400">{risk.description}</p>
          </div>
          <svg
            className="mt-1 h-4 w-4 shrink-0 text-slate-600"
            viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      ))}
    </div>
  );
}
