"use client";

import type { AuditResult } from "../../../lib/agentFramework/types";

const CATEGORY_LABELS: Record<string, string> = {
  structure: "Structure",
  spend_efficiency: "Spend Efficiency",
  configuration: "Configuration",
  creative_health: "Creative Health",
};

const STATUS_COLORS = {
  pass: "text-emerald-400",
  warn: "text-amber-400",
  fail: "text-red-400",
} as const;

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function getScoreRingColor(score: number): string {
  if (score >= 80) return "stroke-emerald-500";
  if (score >= 60) return "stroke-amber-500";
  return "stroke-red-500";
}

export function AuditHealthScore({ result }: { result: AuditResult }) {
  const { healthScore, checks, summary } = result;
  const circumference = 2 * Math.PI * 40;
  const progress = (healthScore.overall / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Score circle + summary */}
      <div className="flex items-center gap-6">
        <div className="relative h-24 w-24 shrink-0">
          <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-800" />
            <circle
              cx="48" cy="48" r="40" fill="none" strokeWidth="6"
              strokeDasharray={`${progress} ${circumference}`}
              strokeLinecap="round"
              className={getScoreRingColor(healthScore.overall)}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-2xl font-bold ${getScoreColor(healthScore.overall)}`}>
              {healthScore.overall}
            </span>
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-300">{summary}</p>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(healthScore.breakdown).map(([cat, { score, maxScore }]) => {
          const pct = Math.round((score / maxScore) * 100);
          return (
            <div key={cat} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
                <span className={`text-xs font-bold ${getScoreColor(pct)}`}>
                  {score}/{maxScore}
                </span>
              </div>
              <div className="mt-2 h-1 rounded-full bg-slate-800">
                <div
                  className={`h-1 rounded-full ${
                    pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Check list */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-white">Individual Checks</h4>
        {checks.map((check, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/30 px-3 py-2">
            <span className={`mt-0.5 text-xs font-bold ${STATUS_COLORS[check.status]}`}>
              {check.status === "pass" ? "\u2713" : check.status === "warn" ? "!" : "\u2717"}
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-300">{check.name}</span>
                <span className="rounded bg-slate-800 px-1 py-0.5 text-xs text-slate-500">
                  {CATEGORY_LABELS[check.category] ?? check.category}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{check.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
