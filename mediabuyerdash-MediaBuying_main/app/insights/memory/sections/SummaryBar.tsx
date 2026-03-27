import type { LearningSummary } from "../../../../lib/learningMemory/types";

function Chip({
  value, label, cls,
}: {
  value: number | string;
  label: string;
  cls:   string;
}) {
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-3 ${cls}`}>
      <span className="text-xl font-semibold">{value}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}

export function SummaryBar({ summary }: { summary: LearningSummary }) {
  return (
    <div className="space-y-3">
      {/* Sparse data warning */}
      {summary.isSparse && (
        <div className="rounded-lg border border-amber-800/40 bg-amber-950/30 px-4 py-3">
          <p className="text-xs font-semibold text-amber-400">Sparse learning data</p>
          <p className="mt-0.5 text-xs text-amber-300/80">
            Fewer than 5 learnings found for this period. Run experiment evaluations, sync Meta
            data, and ensure reconciliation has completed to generate richer insights.
          </p>
        </div>
      )}

      {/* Count chips */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Chip
          value={summary.totalEntries}
          label="total learnings"
          cls="border-slate-800 bg-slate-900/60"
        />
        <Chip
          value={summary.highConfidenceCount}
          label="high confidence"
          cls={summary.highConfidenceCount > 0
            ? "border-emerald-800/50 bg-emerald-950/60"
            : "border-slate-800 bg-slate-900/60"}
        />
        <Chip
          value={summary.experimentCount}
          label="from experiments"
          cls="border-violet-800/50 bg-violet-950/60"
        />
        <Chip
          value={summary.usableForBriefsCount}
          label="usable for briefs"
          cls="border-sky-800/50 bg-sky-950/60"
        />
      </div>

      {/* Top insight */}
      {summary.topInsight && (
        <p className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
          {summary.topInsight}
        </p>
      )}
    </div>
  );
}
