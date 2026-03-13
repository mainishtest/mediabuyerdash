"use client";

import { useState } from "react";
import { PATTERN_DISPLAY } from "../../lib/creativeIntelligence";
import type {
  CreativeIntelligenceSummary,
  CreativePerformanceInsight,
  CreativePatternType,
} from "../../types/creativeIntelligence";

type Props = { summary: CreativeIntelligenceSummary };

const STRENGTH_STYLES: Record<string, string> = {
  strong:   "bg-emerald-900/60 text-emerald-300",
  moderate: "bg-amber-900/60 text-amber-300",
  weak:     "bg-rose-900/60 text-rose-300",
};

const TAB_LABELS: { type: CreativePatternType; label: string }[] = [
  { type: "hook_type",   label: "Hooks"        },
  { type: "cta_type",    label: "CTAs"         },
  { type: "body_angle",  label: "Body Angles"  },
  { type: "visual_style", label: "Visual Styles" },
];

function display(label: string): string {
  return PATTERN_DISPLAY[label] ?? label;
}

export function CreativeIntelligenceView({ summary }: Props) {
  const [activeTab, setActiveTab] = useState<CreativePatternType>("hook_type");

  const tabInsights = summary.insights
    .filter((i) => i.patternType === activeTab)
    .sort((a, b) => (a.averageCPA ?? 999) - (b.averageCPA ?? 999));

  return (
    <div className="space-y-6">
      {/* Top stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total signals" value={String(summary.totalSignals)} />
        <StatCard
          label="Top hook"
          value={summary.topHookPattern ? display(summary.topHookPattern.patternLabel) : "—"}
          sub={summary.topHookPattern ? `$${summary.topHookPattern.averageCPA} CPA` : undefined}
        />
        <StatCard
          label="Top CTA"
          value={summary.topCTAPattern ? display(summary.topCTAPattern.patternLabel) : "—"}
          sub={summary.topCTAPattern ? `ROAS ${summary.topCTAPattern.averageROAS}x` : undefined}
        />
        <StatCard
          label="Top visual"
          value={summary.topVisualPattern ? display(summary.topVisualPattern.patternLabel) : "—"}
          sub={summary.topVisualPattern ? `$${summary.topVisualPattern.averageCPA} CPA` : undefined}
        />
      </div>

      {/* Emerging Learnings */}
      {summary.emergingLearnings.length > 0 && (
        <section className="rounded-xl border border-violet-800/40 bg-violet-950/20 p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-violet-400">
            Emerging Learnings
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {summary.emergingLearnings.map((l, i) => (
              <li
                key={i}
                className="rounded-lg border border-violet-700/30 bg-violet-900/20 px-4 py-3 text-sm text-violet-100"
              >
                {l}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Top performers — quick summary row */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Top Performers by Category
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[summary.topHookPattern, summary.topCTAPattern, summary.topVisualPattern]
            .filter((p): p is CreativePerformanceInsight => p != null)
            .map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-4"
              >
                <p className="text-xs text-slate-400 uppercase tracking-wide">
                  {TAB_LABELS.find((t) => t.type === p.patternType)?.label ?? p.patternType}
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-300">
                  {display(p.patternLabel)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  CPA ${p.averageCPA} · ROAS {p.averageROAS}x · CTR {p.averageCTR}%
                </p>
                <p className="mt-1 text-xs text-slate-500">{p.sampleCount} signal{p.sampleCount !== 1 ? "s" : ""}</p>
              </div>
            ))}
        </div>
      </section>

      {/* Pattern detail tables */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          {TAB_LABELS.map((t) => (
            <button
              key={t.type}
              onClick={() => setActiveTab(t.type)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === t.type
                  ? "border-b-2 border-sky-500 text-sky-300"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {tabInsights.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No signals detected for this pattern type yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/40">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Pattern</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Signals</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Avg CPA</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Avg ROAS</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Avg CTR</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Strength</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Summary</th>
                </tr>
              </thead>
              <tbody>
                {tabInsights.map((insight, i) => (
                  <tr
                    key={insight.id}
                    className={`border-b border-slate-800 last:border-0 ${i === 0 ? "bg-emerald-950/10" : "hover:bg-slate-800/30"}`}
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      {i === 0 && (
                        <span className="mr-2 text-xs text-emerald-400">★</span>
                      )}
                      {display(insight.patternLabel)}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{insight.sampleCount}</td>
                    <td className="px-4 py-3 text-slate-300">${insight.averageCPA}</td>
                    <td className="px-4 py-3 text-slate-300">{insight.averageROAS}x</td>
                    <td className="px-4 py-3 text-slate-300">{insight.averageCTR}%</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STRENGTH_STYLES[insight.strength] ?? ""}`}>
                        {insight.strength}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 max-w-xs">{insight.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Architecture note */}
      <p className="text-center text-xs text-slate-600">
        Pattern signals are extracted deterministically from generated variations.
        Real performance data (CPA, ROAS) will be linked when ad results are connected.
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
