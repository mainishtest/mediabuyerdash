"use client";

// app/creative-lab/results/CreativeTestResultCard.tsx
// Compact card for the test result list.
// Mobile: full-width, stacked — outcome badge → variant names → metrics
// Desktop: scannable row inside scrollable left col

import type { CreativeTestResult } from "../../../types/creativeTestResults";
import {
  TEST_TRACKING_STATE_LABEL,
  TEST_TRACKING_STATE_BG,
  TEST_TRACKING_STATE_COLOR,
  TEST_OUTCOME_LABEL,
  TEST_OUTCOME_COLOR,
  TEST_OUTCOME_BG,
} from "../../../types/creativeTestResults";

type Props = {
  result:     CreativeTestResult;
  isSelected: boolean;
  onSelect:   (id: string) => void;
};

export function CreativeTestResultCard({ result, isSelected, onSelect }: Props) {
  const { trackingState, outcome } = result;

  // Show outcome badge when available, tracking state otherwise
  const badgeLabel = outcome
    ? TEST_OUTCOME_LABEL[outcome]
    : TEST_TRACKING_STATE_LABEL[trackingState];
  const badgeBg    = outcome
    ? TEST_OUTCOME_BG[outcome]
    : TEST_TRACKING_STATE_BG[trackingState];
  const badgeColor = outcome
    ? TEST_OUTCOME_COLOR[outcome]
    : TEST_TRACKING_STATE_COLOR[trackingState];

  const challenger = result.challengerVariantTitle ?? "Challenger";
  const control    = result.controlCreativeName    ?? "Control";
  const lift       = result.comparison?.primaryLift;
  const liftStr    = lift != null ? ` ${lift > 0 ? "+" : ""}${(lift * 100).toFixed(1)}%` : "";
  const liftColor  = lift == null ? ""
    : outcome === "challenger_wins" ? "text-emerald-400"
    : outcome === "control_holds"   ? "text-rose-400"
    : "text-slate-400";

  return (
    <button
      type="button"
      onClick={() => onSelect(result.id)}
      className={`w-full rounded-xl border p-4 text-left transition-colors
        ${isSelected
          ? "border-indigo-600/60 bg-indigo-950/30"
          : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/60"
        }`}
    >
      {/* Header: name + outcome badge */}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-white">{result.name}</p>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeBg} ${badgeColor}`}>
          {badgeLabel}
        </span>
      </div>

      {/* Challenger vs Control */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
        <span className="rounded bg-emerald-950/40 border border-emerald-800/30 px-1.5 py-0.5 text-emerald-400">
          ◈ {challenger}
        </span>
        <span className="text-slate-600">vs</span>
        <span className="rounded bg-sky-950/40 border border-sky-800/30 px-1.5 py-0.5 text-sky-400">
          ◇ {control}
        </span>
      </div>

      {/* Campaign context */}
      {(result.campaignName || result.adSetName) && (
        <p className="mt-1.5 truncate text-xs text-slate-500">
          {result.campaignName ?? ""}
          {result.adSetName ? ` / ${result.adSetName}` : ""}
        </p>
      )}

      {/* Lift + metric pill */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
          {result.primaryMetric}
        </span>
        {liftStr && (
          <span className={`text-xs font-medium ${liftColor}`}>{liftStr}</span>
        )}
        {/* Evaluation window progress */}
        {result.evaluationWindow && !result.evaluationWindow.isComplete && (
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
            {result.evaluationWindow.progressPct}% of window
          </span>
        )}
        {result.confidence && (
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
            {result.confidence.label} conf.
          </span>
        )}
      </div>
    </button>
  );
}
