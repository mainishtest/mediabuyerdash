"use client";

import { useState } from "react";
import Link from "next/link";
import type { PortfolioRisk } from "../../../../lib/portfolioGovernance/types";
import {
  governancePriorityBadgeClass,
  readinessBadgeClass,
  readinessLabel,
  riskCategoryLabel,
  explainPortfolioPriority,
} from "../../../../lib/portfolioGovernance/scoring";

function EmptyState() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-5 py-6 text-center">
      <p className="text-sm font-medium text-emerald-400">No risks match current filters</p>
      <p className="mt-1 text-xs text-slate-600">
        All accounts are within acceptable operating parameters.
      </p>
    </div>
  );
}

function RiskCard({ risk }: { risk: PortfolioRisk }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 transition-colors hover:border-slate-700 hover:bg-slate-900/60">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${governancePriorityBadgeClass(risk.priorityScore.tier)}`}>
          {risk.priorityScore.tier.charAt(0).toUpperCase() + risk.priorityScore.tier.slice(1)}
        </span>
        <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
          {riskCategoryLabel(risk.category)}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-xs ${readinessBadgeClass(risk.readiness)}`}>
          {readinessLabel(risk.readiness)}
        </span>
        <span className="text-xs text-slate-500">{risk.clientName}</span>
        <span className="ml-auto text-xs text-slate-600">Score {risk.priorityScore.score}</span>
      </div>

      {/* Title + description */}
      <p className="mt-1.5 text-sm font-medium text-white">{risk.title}</p>
      <p className="mt-0.5 text-xs text-slate-400">{risk.description}</p>

      {/* Recommended next action */}
      <div className="mt-2 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2">
        <p className="text-xs font-medium text-amber-400">Recommended action</p>
        <p className="mt-0.5 text-xs text-amber-300">{risk.recommendedNextAction}</p>
      </div>

      {/* Blockers */}
      {risk.blockers.length > 0 && (
        <div className="mt-2 rounded-lg border border-rose-900/40 bg-rose-950/20 px-3 py-2">
          <p className="text-xs font-medium text-rose-400">Blockers</p>
          <ul className="mt-0.5 space-y-0.5">
            {risk.blockers.map((b, i) => (
              <li key={i} className="text-xs text-rose-300">• {b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Expandable reasons */}
      {risk.supportingReasons.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {expanded ? "▲ Hide reasons" : "▼ Show supporting reasons"}
          </button>
          {expanded && (
            <ul className="mt-1.5 space-y-1">
              {risk.supportingReasons.map((r, i) => (
                <li key={i} className="text-xs text-slate-400">• {r}</li>
              ))}
              <li className="text-xs text-slate-600 italic">{explainPortfolioPriority(risk.priorityScore)}</li>
            </ul>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={risk.links.account}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
        >
          Open Account
        </Link>
        <Link
          href={risk.links.commandCenter}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
        >
          Open Command Center
        </Link>
        {risk.links.approvalQueue && (
          <Link
            href={risk.links.approvalQueue}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
          >
            Open Approval Queue
          </Link>
        )}
        {risk.links.governanceControls && (
          <Link
            href={risk.links.governanceControls}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
          >
            Open Governance Controls
          </Link>
        )}
      </div>
    </div>
  );
}

export function RisksPanel({ risks }: { risks: PortfolioRisk[] }) {
  if (risks.length === 0) return <EmptyState />;

  return (
    <div className="space-y-2">
      {risks.map((risk) => (
        <RiskCard key={risk.id} risk={risk} />
      ))}
    </div>
  );
}
