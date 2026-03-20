"use client";

import { ConfidenceBadge } from "../../../../components/ui/ConfidenceBadge";

const LEVELS = [
  {
    level:   "high" as const,
    score:   "≥ 70 / 100",
    meaning: "Multiple consistent data sources, clear performance signal, complete goal coverage, full attribution window.",
    example: "Campaign with CRM ROAS + CPA both evaluated, 7-day window, explicit goal, no data warnings.",
  },
  {
    level:   "medium" as const,
    score:   "40–69 / 100",
    meaning: "Partial data, mixed signals, only one goal metric, or short data window.",
    example: "Experiment with moderate conversion volume, or campaign using client-default goal as fallback.",
  },
  {
    level:   "low" as const,
    score:   "< 40 / 100",
    meaning: "Sparse data, no goals configured, stale sync, very short observation window, or inconclusive outcome.",
    example: "New campaign with no CRM data yet, or failed experiment with no delivery.",
  },
] as const;

const FACTORS = [
  { label: "CRM data present",            points: "+30", note: "ROAS and CPA from Shopify/CRM reconciliation" },
  { label: "Goal configured",             points: "+20", note: "Explicit or client-default ROAS/CPA target" },
  { label: "Full 7-day window",           points: "+20", note: "Complete attribution cycle covered" },
  { label: "Consistent signal",           points: "+15", note: "Clear health status — no mixed indicators" },
  { label: "Multiple sources",            points: "+15", note: "Data from more than one module" },
  { label: "Data warning present",        points: "−20", note: "Per warning — stale sync, missing CRM data, etc." },
  { label: "No goal configured",          points: "−30", note: "Evaluation falls back to spend thresholds only" },
];

export function ConfidenceGuide() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
      <h2 className="text-base font-semibold text-slate-200">Confidence scoring model</h2>
      <p className="text-sm text-slate-400 leading-relaxed">
        Confidence is scored 0–100 based on data quality signals — no ML or probabilistic models.
        The same signals are used consistently across all traceable output types.
      </p>

      <div className="space-y-3">
        {LEVELS.map((l) => (
          <div key={l.level} className="space-y-1.5">
            <div className="flex items-center gap-3">
              <ConfidenceBadge level={l.level} />
              <span className="text-xs text-slate-500 font-mono">{l.score}</span>
            </div>
            <p className="text-sm text-slate-400 leading-snug pl-1">{l.meaning}</p>
            <p className="text-xs text-slate-500 italic pl-1">Example: {l.example}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-800 pt-4 space-y-2">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Scoring factors</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {FACTORS.map((f) => (
            <div key={f.label} className="flex items-start gap-2 text-xs">
              <span className={`font-mono shrink-0 w-8 text-right ${f.points.startsWith("+") ? "text-emerald-500" : "text-rose-500"}`}>
                {f.points}
              </span>
              <div>
                <span className="text-slate-300">{f.label}</span>
                <span className="text-slate-500"> — {f.note}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
