import Link from "next/link";
import type { PortfolioOpportunityItem } from "../../../lib/portfolio/types";
import { priorityBadgeClass, opportunityTypeLabel } from "../../../lib/portfolio/health";

function EmptyOpportunities() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-5 py-6 text-center">
      <p className="text-sm font-medium text-slate-400">No opportunities surfaced</p>
      <p className="mt-1 text-xs text-slate-600">
        Opportunities appear when accounts have experiment winners, strong ROAS, or ready creatives.
      </p>
    </div>
  );
}

export function OpportunitiesPanel({ opportunities }: { opportunities: PortfolioOpportunityItem[] }) {
  if (opportunities.length === 0) return <EmptyOpportunities />;

  return (
    <div className="space-y-2">
      {opportunities.map((opp) => (
        <Link
          key={opp.id}
          href={opp.href}
          className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3
                     transition-colors hover:border-slate-700 hover:bg-slate-900/60"
        >
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityBadgeClass(opp.priority)}`}>
                {opp.priority.charAt(0).toUpperCase() + opp.priority.slice(1)}
              </span>
              <span className="rounded border border-emerald-800/40 bg-emerald-950/40 px-1.5 py-0.5 text-xs text-emerald-400">
                {opportunityTypeLabel(opp.opportunityType)}
              </span>
              <span className="text-xs text-slate-500">{opp.clientName}</span>
            </div>
            <p className="mt-1.5 text-sm font-medium text-white">{opp.title}</p>
            <p className="mt-0.5 text-xs text-slate-400">{opp.description}</p>
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
