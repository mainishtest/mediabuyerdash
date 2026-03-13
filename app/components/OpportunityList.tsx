"use client";

import { useState } from "react";
import type {
  OptimizationOpportunity,
  OptimizationAction,
  OptimizationPriority,
  EntityType
} from "../../lib/optimizationUtils";
import { formatCurrency, formatRoas } from "../../lib/metricUtils";

type FilterOption = "all" | EntityType;

type Props = {
  opportunities: OptimizationOpportunity[];
};

// --- Style helpers -----------------------------------------------------------

function actionStyle(action: OptimizationAction): string {
  switch (action) {
    case "scale":        return "bg-emerald-900/60 text-emerald-300";
    case "maintain":     return "bg-slate-800 text-slate-300";
    case "review":       return "bg-amber-900/60 text-amber-300";
    case "reduce_spend": return "bg-orange-900/60 text-orange-300";
    case "pause":        return "bg-rose-900/60 text-rose-300";
  }
}

function actionLabel(action: OptimizationAction): string {
  switch (action) {
    case "scale":        return "Scale";
    case "maintain":     return "Maintain";
    case "review":       return "Review";
    case "reduce_spend": return "Reduce Spend";
    case "pause":        return "Pause";
  }
}

function priorityStyle(priority: OptimizationPriority): string {
  switch (priority) {
    case "high":   return "bg-rose-900/40 text-rose-400";
    case "medium": return "bg-amber-900/40 text-amber-400";
    case "low":    return "bg-slate-800 text-slate-400";
  }
}

function entityTypeLabel(type: EntityType): string {
  switch (type) {
    case "campaign": return "Campaign";
    case "adSet":    return "Ad Set";
    case "ad":       return "Ad";
  }
}

// --- Filter tab config -------------------------------------------------------

const FILTER_TABS: { id: FilterOption; label: string }[] = [
  { id: "all",      label: "All" },
  { id: "campaign", label: "Campaigns" },
  { id: "adSet",    label: "Ad Sets" },
  { id: "ad",       label: "Ads" }
];

// --- Component ---------------------------------------------------------------

export function OpportunityList({ opportunities }: Props) {
  const [filter, setFilter] = useState<FilterOption>("all");

  const visible = filter === "all"
    ? opportunities
    : opportunities.filter((o) => o.entityType === filter);

  const countFor = (f: FilterOption) =>
    f === "all" ? opportunities.length : opportunities.filter((o) => o.entityType === f).length;

  return (
    <div>
      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filter === tab.id
                ? "bg-slate-700 text-slate-50"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {tab.label}{" "}
            <span className="ml-1 text-xs opacity-60">({countFor(tab.id)})</span>
          </button>
        ))}
      </div>

      {/* Opportunity rows */}
      {visible.length === 0 ? (
        <p className="rounded-xl border border-slate-800 bg-slate-900/60 px-6 py-8 text-sm text-slate-500">
          No optimization opportunities for this filter.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((opp) => (
            <div
              key={opp.recommendationId}
              className="rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 shadow-sm shadow-slate-900/40"
            >
              {/* Top row: name + badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-50">
                  {opp.entityName}
                </span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                  {entityTypeLabel(opp.entityType)}
                </span>
                {opp.parentCampaignName && (
                  <span className="text-xs text-slate-500">
                    via {opp.parentCampaignName}
                  </span>
                )}
                <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${actionStyle(opp.action)}`}>
                  {actionLabel(opp.action)}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyle(opp.priority)}`}>
                  {opp.priority} priority
                </span>
              </div>

              {/* Reason */}
              <p className="mt-2 text-xs text-slate-400">{opp.reason}</p>

              {/* Metrics row */}
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                <span>
                  ROAS{" "}
                  <span className={opp.actualRoas >= opp.roasGoalValue ? "text-emerald-400" : "text-rose-400"}>
                    {formatRoas(opp.actualRoas)}
                  </span>
                  {" "}/ goal {formatRoas(opp.roasGoalValue)}
                </span>
                <span>
                  CPA{" "}
                  <span className={opp.actualCpa <= opp.cpaGoalValue ? "text-emerald-400" : "text-rose-400"}>
                    {formatCurrency(opp.actualCpa)}
                  </span>
                  {" "}/ goal {formatCurrency(opp.cpaGoalValue)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
