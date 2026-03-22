"use client";

// WeeklyView — Account-level weekly learning and strategy rollup.
// Imports only from client-safe utils (no Prisma).

import Link from "next/link";
import type { WeeklyStrategyRollup } from "../../types/weeklyRollup";
import { RollupSummaryBar }          from "./sections/RollupSummaryBar";
import { NextStepsPanel }            from "./sections/NextStepsPanel";
import {
  WinnersSection,
  LosersSection,
  ExperimentsSection,
  PatternsSection,
  ScaleSection,
  DeclineSection,
} from "./sections/RollupSection";

type Props = {
  rollup: WeeklyStrategyRollup;
};

export function WeeklyView({ rollup }: Props) {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Weekly Strategy Rollup</h1>
          <p className="mt-1 text-sm text-slate-500">
            {rollup.summary.weekLabel} — What worked, what failed, what to do next
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/briefs" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-700">
            Morning Brief
          </Link>
          <Link href="/history" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-700">
            Action History
          </Link>
          <Link href="/command-center" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-700">
            Command Center
          </Link>
        </div>
      </div>

      {/* Trust warning */}
      {rollup.trustMessage && (
        <div className="rounded-lg border border-amber-800/40 bg-amber-950/30 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Data Note</p>
          <p className="mt-1 text-sm text-amber-400">{rollup.trustMessage}</p>
        </div>
      )}

      {/* Sparse week notice */}
      {rollup.isSparse && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-6 py-8 text-center">
          <p className="text-sm text-slate-400">Quiet week — limited activity detected.</p>
          <p className="mt-1 text-xs text-slate-600">
            This rollup has sparse data. Results improve as more tests run and outcomes are captured.
          </p>
        </div>
      )}

      {/* Summary KPIs */}
      <RollupSummaryBar summary={rollup.summary} />

      {/* Next steps — decision-first, at the top */}
      <NextStepsPanel steps={rollup.nextSteps} />

      {/* Winners and losers side-by-side */}
      <div className="grid gap-6 md:grid-cols-2">
        <WinnersSection winners={rollup.winners} />
        <LosersSection losers={rollup.losers} />
      </div>

      {/* Scale opportunities and decline signals */}
      <div className="grid gap-6 md:grid-cols-2">
        <ScaleSection opportunities={rollup.scaleOpportunities} />
        <DeclineSection signals={rollup.declineSignals} />
      </div>

      {/* Creative patterns */}
      <PatternsSection patterns={rollup.creativePatterns} />

      {/* Experiments */}
      <ExperimentsSection experiments={rollup.experiments} />

      {/* Footer links */}
      <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
        {[
          { href: "/command-center",       label: "Command Center" },
          { href: "/briefs",               label: "Morning Brief" },
          { href: "/history",              label: "Action History" },
          { href: "/creative-lab",         label: "Creative Lab" },
          { href: "/creative-lab/outcomes", label: "Outcome Routing" },
          { href: "/creative-lab/results", label: "Test Results" },
          { href: "/insights/memory",      label: "Learning Memory" },
          { href: "/optimization",         label: "Optimization" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
