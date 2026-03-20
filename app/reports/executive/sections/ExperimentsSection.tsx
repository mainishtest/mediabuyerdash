import type { ExecutiveExperimentSummary, ExecutiveExperimentItem } from "../../../../lib/executiveReporting/types";

const OUTCOME_LABEL: Record<string, string> = {
  challenger_wins:   "Challenger wins",
  control_holds:     "Control holds",
  no_clear_winner:   "No clear winner",
  insufficient_data: "Insufficient data",
  mixed_result:      "Mixed result",
  failed_test:       "Failed",
};

const OUTCOME_BADGE: Record<string, string> = {
  challenger_wins:   "border-emerald-800/50 bg-emerald-950/60 text-emerald-300",
  control_holds:     "border-sky-800/50 bg-sky-950/60 text-sky-300",
  no_clear_winner:   "border-slate-700 bg-slate-800 text-slate-400",
  insufficient_data: "border-amber-800/50 bg-amber-950/60 text-amber-300",
  mixed_result:      "border-slate-700 bg-slate-800 text-slate-400",
  failed_test:       "border-rose-800/50 bg-rose-950/60 text-rose-300",
};

const STATUS_BADGE: Record<string, string> = {
  active:     "border-emerald-800/50 bg-emerald-950/60 text-emerald-300",
  evaluating: "border-sky-800/50 bg-sky-950/60 text-sky-300",
  completed:  "border-slate-700 bg-slate-800 text-slate-400",
};

// ── Summary chips ─────────────────────────────────────────────────────────────

function SummaryChips({ experiments }: { experiments: ExecutiveExperimentSummary }) {
  const chips = [
    { label: "Active",    value: experiments.activeCount,          variant: "info"    },
    { label: "Winners",   value: experiments.winnersCount,         variant: "success" },
    { label: "No winner", value: experiments.noWinnerCount,        variant: "neutral" },
    { label: "Insuff.",   value: experiments.insufficientDataCount, variant: "warning" },
  ] as const;

  const CHIP_CLS = {
    success: "border-emerald-800/50 bg-emerald-950/60 text-emerald-300",
    warning: "border-amber-800/50 bg-amber-950/60 text-amber-300",
    info:    "border-sky-800/50 bg-sky-950/60 text-sky-300",
    neutral: "border-slate-700 bg-slate-800 text-slate-400",
  };

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <div
          key={c.label}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${CHIP_CLS[c.variant]}`}
        >
          <span className="text-sm font-semibold">{c.value}</span>
          <span className="text-xs">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Experiment row ────────────────────────────────────────────────────────────

function ExperimentRow({ item }: { item: ExecutiveExperimentItem }) {
  const statusBadge  = STATUS_BADGE[item.status]   ?? "border-slate-700 bg-slate-800 text-slate-400";
  const outcomeBadge = item.outcome ? (OUTCOME_BADGE[item.outcome] ?? "border-slate-700 bg-slate-800 text-slate-400") : null;

  return (
    <div className="border-b border-slate-800/60 py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge}`}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </span>
        {outcomeBadge && item.outcome && (
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${outcomeBadge}`}>
            {OUTCOME_LABEL[item.outcome] ?? item.outcome}
          </span>
        )}
        {item.primaryMetricLift !== null && (
          <span className="text-xs text-slate-500">
            {item.primaryMetricLift >= 0 ? "+" : ""}{(item.primaryMetricLift * 100).toFixed(1)}% lift
          </span>
        )}
      </div>
      <p className="mt-1 text-sm font-medium text-slate-200">{item.name}</p>
      {item.recommendedAction ? (
        <p className="mt-0.5 text-xs text-emerald-400">{item.recommendedAction}</p>
      ) : (
        <p className="mt-0.5 text-xs text-slate-500">
          Running {item.daysRunning}d{item.status === "evaluating" ? " — evaluating" : ""}
        </p>
      )}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export function ExperimentsSection({ experiments }: { experiments: ExecutiveExperimentSummary }) {
  // Surface winner items first
  const sorted = [...experiments.items].sort((a, b) => {
    const aWin = a.outcome === "challenger_wins" || a.outcome === "control_holds" ? 0 : 1;
    const bWin = b.outcome === "challenger_wins" || b.outcome === "control_holds" ? 0 : 1;
    return aWin - bWin;
  });

  return (
    <div className="space-y-4">
      <SummaryChips experiments={experiments} />

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500">
          No experiments found for this period. Start a test in the Experiments module.
        </p>
      ) : (
        <div>
          {sorted.slice(0, 6).map((e) => (
            <ExperimentRow key={e.id} item={e} />
          ))}
          {sorted.length > 6 && (
            <p className="mt-2 text-xs text-slate-600">
              + {sorted.length - 6} more experiment{sorted.length - 6 !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
