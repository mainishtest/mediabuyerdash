const STATUS_STYLES: Record<string, string> = {
  // Workspace pipeline
  draft:              "border-slate-700 bg-slate-800/50 text-slate-300",
  strategy_ready:     "border-indigo-700 bg-indigo-900/30 text-indigo-300",
  render_brief_ready: "border-violet-700 bg-violet-900/30 text-violet-300",
  rendering:          "border-amber-700 bg-amber-900/30 text-amber-300",
  reviewing:          "border-cyan-700 bg-cyan-900/30 text-cyan-300",
  approved:           "border-emerald-700 bg-emerald-900/30 text-emerald-300",
  in_production:      "border-sky-700 bg-sky-900/30 text-sky-300",
  launched:           "border-emerald-600 bg-emerald-800/40 text-emerald-200",
  archived:           "border-slate-700 bg-slate-800/30 text-slate-500",
  // Legacy
  shot:     "border-amber-700 bg-amber-900/30 text-amber-300",
  live:     "border-sky-700 bg-sky-900/30 text-sky-300",
  killed:   "border-rose-800 bg-rose-900/20 text-rose-300",
  // Strategy/render statuses
  pending:   "border-slate-700 bg-slate-800/50 text-slate-400",
  running:   "border-amber-700 bg-amber-900/30 text-amber-300",
  completed: "border-emerald-700 bg-emerald-900/30 text-emerald-300",
  failed:    "border-rose-800 bg-rose-900/20 text-rose-300",
  compiled:  "border-sky-700 bg-sky-900/30 text-sky-300",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, label, size = "sm" }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  const text = size === "sm" ? "text-[10px]" : "text-xs";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 ${text} font-semibold uppercase tracking-wider ${style}`}>
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}
