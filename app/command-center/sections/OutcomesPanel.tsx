"use client";

import type {
  CommandCenterOutcomeItem,
  CommandCenterOutcomeSummary,
} from "../../../lib/commandCenter/types";

// ── Badge helpers ──────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  winner:            "Winner",
  loser:             "Loser",
  scale_opportunity: "Scale",
  refresh_needed:    "Refresh",
  retest_needed:     "Retest",
  monitoring:        "Monitor",
};

const TYPE_COLOR: Record<string, string> = {
  winner:            "border-emerald-800/50 bg-emerald-950/40 text-emerald-400",
  loser:             "border-amber-800/50 bg-amber-950/40 text-amber-400",
  scale_opportunity: "border-sky-800/50 bg-sky-950/40 text-sky-400",
  refresh_needed:    "border-rose-800/50 bg-rose-950/40 text-rose-400",
  retest_needed:     "border-violet-800/50 bg-violet-950/40 text-violet-400",
  monitoring:        "border-slate-700 bg-slate-800/40 text-slate-400",
};

const READINESS_DOT: Record<string, string> = {
  pending_action:   "bg-amber-400",
  actioned:         "bg-emerald-400",
  archived:         "bg-slate-500",
  learning_captured: "bg-indigo-400",
};

// ── Summary counters ──────────────────────────────────────────────────────

function OutcomeSummaryBar({ summary }: { summary: CommandCenterOutcomeSummary }) {
  const items = [
    { label: "Scale Ready", count: summary.scaleReadyCount, color: "text-sky-400" },
    { label: "Winners",     count: summary.winnersCount,    color: "text-emerald-400" },
    { label: "Refresh",     count: summary.refreshNeededCount, color: "text-rose-400" },
    { label: "Retest",      count: summary.retestNeededCount,  color: "text-violet-400" },
    { label: "Monitoring",  count: summary.monitoringCount,    color: "text-slate-400" },
  ].filter((i) => i.count > 0);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3 px-4 py-2 border-b border-slate-800/40">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className={`text-sm font-semibold ${item.color}`}>{item.count}</span>
          <span className="text-xs text-slate-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Single outcome row ────────────────────────────────────────────────────

function OutcomeRow({ item }: { item: CommandCenterOutcomeItem }) {
  const typeBadge = TYPE_COLOR[item.type] ?? TYPE_COLOR.monitoring;
  const typeLabel = TYPE_LABEL[item.type] ?? "Outcome";
  const readinessDot = READINESS_DOT[item.readinessState] ?? READINESS_DOT.pending_action;

  return (
    <a
      href={item.linkedWorkflow ?? item.href}
      className="flex items-start gap-3 border-b border-slate-800/30 px-4 py-3 transition-colors hover:bg-slate-800/30 last:border-b-0"
    >
      {/* Readiness dot */}
      <div className="mt-1.5 shrink-0">
        <div className={`h-2 w-2 rounded-full ${readinessDot}`} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${typeBadge}`}>
            {typeLabel}
          </span>
          {item.isBlocker && (
            <span className="inline-flex items-center rounded-full border border-rose-800/50 bg-rose-950/40 px-2 py-0.5 text-[10px] font-medium text-rose-400">
              Action needed
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-200 line-clamp-1">{item.title}</p>
        <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{item.subtitle}</p>
      </div>

      {/* Action hint */}
      <div className="shrink-0 self-center">
        <span className="text-xs text-emerald-400/70 hover:text-emerald-400">
          {item.nextActionLabel} →
        </span>
      </div>
    </a>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────

export function OutcomesPanel({
  outcomeItems,
  outcomeSummary,
}: {
  outcomeItems: CommandCenterOutcomeItem[];
  outcomeSummary: CommandCenterOutcomeSummary;
}) {
  if (outcomeItems.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-slate-500">No launched-test outcomes yet.</p>
        <p className="mt-1 text-xs text-slate-600">
          Launch creative tests from the Creative Lab to see results here.
        </p>
      </div>
    );
  }

  // Sort: blockers first, then scale opportunities, then by type
  const sorted = [...outcomeItems].sort((a, b) => {
    if (a.isBlocker !== b.isBlocker) return a.isBlocker ? -1 : 1;
    if (a.type === "scale_opportunity" && b.type !== "scale_opportunity") return -1;
    if (b.type === "scale_opportunity" && a.type !== "scale_opportunity") return 1;
    if (a.type === "refresh_needed" && b.type !== "refresh_needed") return -1;
    if (b.type === "refresh_needed" && a.type !== "refresh_needed") return 1;
    return 0;
  });

  return (
    <div>
      <OutcomeSummaryBar summary={outcomeSummary} />
      <div className="max-h-80 overflow-y-auto">
        {sorted.map((item) => (
          <OutcomeRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
