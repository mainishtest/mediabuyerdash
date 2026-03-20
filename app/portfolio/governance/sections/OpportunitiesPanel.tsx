"use client";

import { useState } from "react";
import Link from "next/link";
import type { PortfolioOpportunity } from "../../../../lib/portfolioGovernance/types";
import {
  governancePriorityBadgeClass,
  readinessBadgeClass,
  readinessLabel,
  opportunityCategoryLabel,
  explainPortfolioPriority,
} from "../../../../lib/portfolioGovernance/scoring";

function EmptyState() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-5 py-6 text-center">
      <p className="text-sm font-medium text-emerald-400">No opportunities match current filters</p>
      <p className="mt-1 text-xs text-slate-600">Adjust filters or check back when new signals appear.</p>
    </div>
  );
}

function OpportunityCard({ opp }: { opp: PortfolioOpportunity }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 transition-colors hover:border-slate-700 hover:bg-slate-900/60">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${governancePriorityBadgeClass(opp.priorityScore.tier)}`}>
          {opp.priorityScore.tier.charAt(0).toUpperCase() + opp.priorityScore.tier.slice(1)}
        </span>
        <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
          {opportunityCategoryLabel(opp.category)}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-xs ${readinessBadgeClass(opp.readiness)}`}>
          {readinessLabel(opp.readiness)}
        </span>
        <span className="text-xs text-slate-500">{opp.clientName}</span>
        <span className="ml-auto text-xs text-slate-600">Score {opp.priorityScore.score}</span>
      </div>

      {/* Title + description */}
      <p className="mt-1.5 text-sm font-medium text-white">{opp.title}</p>
      <p className="mt-0.5 text-xs text-slate-400">{opp.description}</p>

      {/* Recommended next action */}
      <div className="mt-2 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2">
        <p className="text-xs font-medium text-emerald-400">Next action</p>
        <p className="mt-0.5 text-xs text-emerald-300">{opp.recommendedNextAction}</p>
      </div>

      {/* Blockers */}
      {opp.blockers.length > 0 && (
        <div className="mt-2 rounded-lg border border-rose-900/40 bg-rose-950/20 px-3 py-2">
          <p className="text-xs font-medium text-rose-400">Blockers</p>
          <ul className="mt-0.5 space-y-0.5">
            {opp.blockers.map((b, i) => (
              <li key={i} className="text-xs text-rose-300">• {b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Expandable reasons */}
      {opp.supportingReasons.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {expanded ? "▲ Hide reasons" : "▼ Show supporting reasons"}
          </button>
          {expanded && (
            <ul className="mt-1.5 space-y-1">
              {opp.supportingReasons.map((r, i) => (
                <li key={i} className="text-xs text-slate-400">• {r}</li>
              ))}
              <li className="text-xs text-slate-600 italic">{explainPortfolioPriority(opp.priorityScore)}</li>
            </ul>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={opp.links.commandCenter}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
        >
          Open Command Center
        </Link>
        <Link
          href={opp.links.account}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
        >
          Open Account
        </Link>
        {opp.links.experiment && (
          <Link
            href={opp.links.experiment}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
          >
            Open Experiment
          </Link>
        )}
        {opp.links.creativeLab && (
          <Link
            href={opp.links.creativeLab}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
          >
            Open Creative Lab
          </Link>
        )}
        {opp.links.approvalQueue && (
          <Link
            href={opp.links.approvalQueue}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
          >
            Open Approval Queue
          </Link>
        )}
      </div>
    </div>
  );
}

export function OpportunitiesPanel({
  opportunities,
}: {
  opportunities: PortfolioOpportunity[];
}) {
  if (opportunities.length === 0) return <EmptyState />;

  return (
    <div className="space-y-2">
      {opportunities.map((opp) => (
        <OpportunityCard key={opp.id} opp={opp} />
      ))}
    </div>
  );
}
