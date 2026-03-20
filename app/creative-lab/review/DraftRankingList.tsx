"use client";

// app/creative-lab/review/DraftRankingList.tsx
// Compact ranked list of all scored variants for the left/top navigation column.
// Clicking a row focuses the full scorecard in the detail panel.

import type { CreativeDraftRanking } from "../../../types/creativeScoring";
import {
  READINESS_COLOR,
  READINESS_LABEL,
  RISK_COLOR,
}                                    from "../../../types/creativeScoring";

type Props = {
  rankings:   CreativeDraftRanking[];
  selectedId: string | null;
  onSelect:   (variantId: string) => void;
};

export function DraftRankingList({ rankings, selectedId, onSelect }: Props) {
  if (rankings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center">
        <p className="text-sm text-slate-500">No variants scored yet</p>
        <p className="mt-1 text-xs text-slate-600">
          Click &ldquo;Score Drafts&rdquo; to evaluate all generated variants.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {rankings.map((r) => {
        const isSelected = selectedId === r.variantId;
        const readiness  = READINESS_COLOR[r.scorecard.approvalReadiness];
        const riskColor  = RISK_COLOR[r.scorecard.riskLevel];

        // Score color
        const scoreColor = r.scorecard.totalScore >= 72 ? "text-emerald-400"
          : r.scorecard.totalScore >= 55 ? "text-sky-400"
          : r.scorecard.totalScore >= 35 ? "text-amber-400"
          : "text-rose-400";

        return (
          <button
            key={r.variantId}
            onClick={() => onSelect(r.variantId)}
            className={`w-full rounded-xl border px-3.5 py-3 text-left transition-all
              ${isSelected
                ? "border-indigo-600/60 bg-indigo-950/30 ring-1 ring-indigo-600/40"
                : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/40"
              }`}
          >
            <div className="flex items-start gap-3">
              {/* Rank + score */}
              <div className="shrink-0 text-center">
                <p className="text-xs text-slate-600">#{r.rank}</p>
                <p className={`text-sm font-bold tabular-nums ${scoreColor}`}>
                  {r.scorecard.totalScore}
                </p>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-slate-200">
                  {r.scorecard.variantTitle}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className={`text-xs font-medium ${readiness}`}>
                    {READINESS_LABEL[r.scorecard.approvalReadiness].replace("Ready for ", "")}
                  </span>
                  <span className={`text-xs ${riskColor}`}>
                    {r.scorecard.riskLevel} risk
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-600 leading-relaxed">
                  {r.rankReason}
                </p>
              </div>

              {/* Variant type pill */}
              <span className="shrink-0 self-start rounded-md bg-slate-800 px-1.5 py-0.5 text-xs text-slate-600">
                {r.scorecard.variantType}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
