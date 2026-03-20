"use client";

// app/creative-lab/creative-engine/ContextSummaryPanel.tsx
// Displays the assembled generation context — performance signals, learning
// memory, trigger rationale, and data quality.
//
// Responsive: stacked on mobile, 2-col grid on desktop.

type ContextMeta = {
  clientName:       string;
  evaluationStatus: string;
  fatigueStatus:    string | null;
  dataQuality:      "sparse" | "moderate" | "rich";
  triggerType:      string;
  triggerRationale: string;
  currentCtr:       number;
  currentRoas:      number | null;
  winningPatterns:  number;
  losingPatterns:   number;
  builtAt:          string;
};

type Props = {
  context:          ContextMeta;
  clientName:       string;
  selectedClientId: string;
};

const DATA_QUALITY_STYLES: Record<string, string> = {
  rich:     "text-emerald-400",
  moderate: "text-amber-400",
  sparse:   "text-rose-400",
};

const TRIGGER_STYLES: Record<string, string> = {
  fatigue:          "border-amber-800/40 bg-amber-950/20 text-amber-300",
  underperformance: "border-rose-800/40 bg-rose-950/20 text-rose-300",
  opportunity:      "border-emerald-800/40 bg-emerald-950/20 text-emerald-300",
  manual:           "border-slate-700/60 bg-slate-800/20 text-slate-300",
};

const TRIGGER_LABELS: Record<string, string> = {
  fatigue:          "Audience Fatigue",
  underperformance: "Underperformance",
  opportunity:      "Opportunity",
  manual:           "Manual",
};

export function ContextSummaryPanel({ context, clientName, selectedClientId }: Props) {
  const qualityColor = DATA_QUALITY_STYLES[context.dataQuality] ?? "text-slate-400";
  const triggerStyle = TRIGGER_STYLES[context.triggerType] ?? TRIGGER_STYLES.manual;
  const triggerLabel = TRIGGER_LABELS[context.triggerType] ?? context.triggerType;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">

      {/* Trigger badge */}
      <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${triggerStyle}`}>
        <span>
          {context.triggerType === "fatigue"          ? "⚡" :
           context.triggerType === "underperformance" ? "↓"  :
           context.triggerType === "opportunity"      ? "↑"  : "◎"}
        </span>
        <span>{triggerLabel} — {context.triggerRationale}</span>
      </div>

      {/* Signal grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">CTR</p>
          <p className={`text-sm font-semibold ${context.currentCtr < 0.8 ? "text-rose-400" : "text-emerald-400"}`}>
            {context.currentCtr.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">ROAS (CRM)</p>
          <p className="text-sm font-semibold text-slate-200">
            {context.currentRoas != null ? `${context.currentRoas.toFixed(2)}x` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Status</p>
          <p className="text-sm font-medium text-slate-200 capitalize">{context.evaluationStatus}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Data quality</p>
          <p className={`text-sm font-medium capitalize ${qualityColor}`}>{context.dataQuality}</p>
        </div>
      </div>

      {/* Learning memory */}
      {(context.winningPatterns > 0 || context.losingPatterns > 0) && (
        <div className="flex flex-wrap gap-3 border-t border-slate-800/60 pt-3">
          {context.winningPatterns > 0 && (
            <div className="flex items-center gap-1.5 rounded-md bg-emerald-950/30 border border-emerald-800/30 px-2.5 py-1 text-xs text-emerald-300">
              <span>✓</span>
              <span>{context.winningPatterns} winning pattern{context.winningPatterns !== 1 ? "s" : ""} applied</span>
            </div>
          )}
          {context.losingPatterns > 0 && (
            <div className="flex items-center gap-1.5 rounded-md bg-rose-950/30 border border-rose-800/30 px-2.5 py-1 text-xs text-rose-300">
              <span>✕</span>
              <span>{context.losingPatterns} losing pattern{context.losingPatterns !== 1 ? "s" : ""} excluded</span>
            </div>
          )}
        </div>
      )}

      {/* Data quality warning */}
      {context.dataQuality === "sparse" && (
        <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
          ⚠ Sparse performance data — concepts are broadly framed. Run more campaigns and reconciliation to improve signal quality.
        </div>
      )}

      <p className="text-xs text-slate-700">
        Context built at {new Date(context.builtAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·
        ROAS sourced from CRM (7-day attribution) — not Meta self-reported
      </p>
    </div>
  );
}
