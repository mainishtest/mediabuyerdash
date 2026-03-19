"use client";

// app/experiments/ExperimentCard.tsx
// Compact card for an experiment in the list panel.
// Shows: outcome badge, name, variant labels, primary metric delta, status.

import type {
  ExperimentWithResult,
}                          from "../../types/experiment";
import {
  OUTCOME_LABEL,
  OUTCOME_COLOR,
  STATUS_LABEL,
}                          from "../../types/experiment";

type Props = {
  experiment: ExperimentWithResult;
  isSelected: boolean;
  onSelect:   (id: string) => void;
};

export function ExperimentCard({ experiment, isSelected, onSelect }: Props) {
  const result   = experiment.result;
  const outcome  = result?.outcome;
  const lift     = result?.primaryMetricLift;
  const liftPct  = lift !== null && lift !== undefined ? (lift * 100).toFixed(1) : null;
  const liftSign = lift !== null && lift !== undefined ? (lift > 0 ? "+" : "") : "";

  const outcomeColor = outcome ? OUTCOME_COLOR[outcome] : "text-slate-500";
  const outcomeText  = outcome ? OUTCOME_LABEL[outcome] : "Awaiting evaluation";

  const winnerBadge = result?.winningVariant === "challenger"
    ? experiment.challengerLabel
    : result?.winningVariant === "control"
      ? experiment.controlLabel
      : null;

  return (
    <button
      onClick={() => onSelect(experiment.id)}
      className={`w-full rounded-xl border p-4 text-left transition-all
        ${isSelected
          ? "border-indigo-600/60 bg-indigo-950/30 ring-1 ring-indigo-600/40"
          : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/40"
        }`}
    >
      {/* Top row: outcome + status */}
      <div className="flex items-start justify-between gap-2">
        <span className={`text-xs font-semibold ${outcomeColor}`}>{outcomeText}</span>
        <span className="shrink-0 rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
          {STATUS_LABEL[experiment.status]}
        </span>
      </div>

      {/* Name */}
      <p className="mt-1.5 truncate text-sm font-medium text-slate-100">{experiment.name}</p>

      {/* Variant labels */}
      <p className="mt-0.5 text-xs text-slate-600">
        {experiment.controlLabel} vs {experiment.challengerLabel}
      </p>

      {/* Winner + lift */}
      {winnerBadge && liftPct && (
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-md bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-400">
            {winnerBadge} won
          </span>
          <span className={`text-xs font-medium ${(lift ?? 0) > 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {liftSign}{liftPct}% on {experiment.primaryMetric.replace("_", " ")}
          </span>
        </div>
      )}

      {/* Evaluation window progress */}
      <div className="mt-2.5">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs text-slate-700">Evaluation window</span>
          <span className={`text-xs ${experiment.evaluationWindow.isComplete ? "text-slate-500" : "text-slate-600"}`}>
            {experiment.evaluationWindow.isComplete
              ? "Complete"
              : `${experiment.evaluationWindow.progressPct}% — ${experiment.evaluationWindow.daysRemaining}d left`
            }
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-slate-800">
          <div
            className={`h-1 rounded-full transition-all ${experiment.evaluationWindow.isComplete ? "bg-emerald-600" : "bg-indigo-600"}`}
            style={{ width: `${experiment.evaluationWindow.progressPct}%` }}
          />
        </div>
      </div>

      {/* Learnings count */}
      {experiment.learnings.length > 0 && (
        <p className="mt-2 text-xs text-slate-700">
          {experiment.learnings.length} learning{experiment.learnings.length !== 1 ? "s" : ""} captured
        </p>
      )}
    </button>
  );
}
