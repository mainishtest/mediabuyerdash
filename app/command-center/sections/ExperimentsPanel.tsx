import Link from "next/link";
import type { CommandCenterExperimentItem } from "../../../lib/commandCenter/types";

const OUTCOME_LABEL: Record<string, string> = {
  challenger_wins:   "Challenger wins",
  control_holds:     "Control holds",
  no_clear_winner:   "No clear winner",
  insufficient_data: "Insufficient data",
  mixed_result:      "Mixed result",
  failed_test:       "Failed",
};

const STATUS_BADGE: Record<string, string> = {
  active:     "border-emerald-800/50 bg-emerald-950/60 text-emerald-300",
  evaluating: "border-sky-800/50 bg-sky-950/60 text-sky-300",
  completed:  "border-slate-700 bg-slate-800 text-slate-400",
};

const OUTCOME_BADGE: Record<string, string> = {
  challenger_wins:   "border-emerald-800/50 bg-emerald-950/60 text-emerald-300",
  control_holds:     "border-sky-800/50 bg-sky-950/60 text-sky-300",
  no_clear_winner:   "border-slate-700 bg-slate-800 text-slate-400",
  insufficient_data: "border-amber-800/50 bg-amber-950/60 text-amber-300",
  mixed_result:      "border-slate-700 bg-slate-800 text-slate-400",
  failed_test:       "border-rose-800/50 bg-rose-950/60 text-rose-300",
};

function ExperimentRow({ item }: { item: CommandCenterExperimentItem }) {
  const statusBadge  = STATUS_BADGE[item.status]   ?? "border-slate-700 bg-slate-800 text-slate-400";
  const outcomeBadge = item.outcome ? (OUTCOME_BADGE[item.outcome] ?? "border-slate-700 bg-slate-800 text-slate-400") : null;

  return (
    <div className="flex items-start gap-3 border-b border-slate-800/60 px-4 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge}`}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </span>
          {outcomeBadge && item.outcome && (
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${outcomeBadge}`}>
              {OUTCOME_LABEL[item.outcome] ?? item.outcome}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm font-medium text-slate-200">{item.name}</p>
        {item.recommendedAction ? (
          <p className="mt-0.5 text-xs text-emerald-400">{item.recommendedAction}</p>
        ) : (
          <p className="mt-0.5 text-xs text-slate-500">Running {item.daysRunning}d — awaiting evaluation</p>
        )}
      </div>
      <Link
        href={item.href}
        className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5
                   text-xs font-medium text-slate-300 transition-colors
                   hover:border-sky-600 hover:bg-sky-900/30 hover:text-sky-300"
      >
        Open
      </Link>
    </div>
  );
}

export function ExperimentsPanel({ experiments }: { experiments: CommandCenterExperimentItem[] }) {
  if (experiments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <p className="text-3xl">⚗</p>
        <p className="mt-2 text-sm font-medium text-slate-300">No active experiments</p>
        <p className="mt-1 text-xs text-slate-500">
          Start an experiment in the Experiments module to track creative tests here.
        </p>
        <Link
          href="/experiments"
          className="mt-3 rounded-lg border border-slate-700 px-3 py-1.5
                     text-xs text-slate-400 hover:border-slate-600 hover:text-slate-200"
        >
          Go to Experiments
        </Link>
      </div>
    );
  }

  // Surface winner-declared items first
  const sorted = [...experiments].sort((a, b) => {
    const aWinner = a.outcome === "challenger_wins" || a.outcome === "control_holds" ? 0 : 1;
    const bWinner = b.outcome === "challenger_wins" || b.outcome === "control_holds" ? 0 : 1;
    return aWinner - bWinner;
  });

  return (
    <div>
      {sorted.slice(0, 6).map((e) => (
        <ExperimentRow key={e.id} item={e} />
      ))}
      {experiments.length > 6 && (
        <div className="border-t border-slate-800/60 px-4 py-3">
          <Link href="/experiments" className="text-xs text-emerald-400 hover:text-emerald-300">
            View all {experiments.length} experiments →
          </Link>
        </div>
      )}
    </div>
  );
}
