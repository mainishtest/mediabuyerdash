"use client";

// NextStepsPanel — Evidence-backed next steps for the coming week.

import Link from "next/link";
import type { WeeklyNextStep } from "../../../types/weeklyRollup";
import { priorityColor, categoryLabel, categoryIcon } from "../../../lib/weeklyRollup/utils";

export function NextStepsPanel({ steps }: { steps: WeeklyNextStep[] }) {
  if (steps.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-6 py-8 text-center">
        <p className="text-sm text-slate-500">No recommended next steps this week.</p>
        <p className="mt-1 text-xs text-slate-600">This typically means all accounts are stable with no pending actions.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-300">What To Do Next Week</h3>
        <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-400">{steps.length}</span>
      </div>
      <div className="space-y-2">
        {steps.map((step) => (
          <Link
            key={step.id}
            href={step.href}
            className="group flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/50
                       px-4 py-3 transition-colors hover:border-slate-700 hover:bg-slate-800/50"
          >
            {/* Category icon */}
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-800 text-xs font-bold text-slate-400">
              {categoryIcon(step.category)}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${priorityColor(step.priority)}`}>
                  {step.priority}
                </span>
                <span className="text-[10px] text-slate-600">{categoryLabel(step.category)}</span>
                <span className="text-[10px] text-slate-600">{step.clientName}</span>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-200 group-hover:text-white">{step.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{step.description}</p>

              {/* Evidence links */}
              {step.evidence.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {step.evidence.map((e, i) => (
                    <span key={i} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                      {e.entityType} · {e.label.slice(0, 40)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className="mt-1 shrink-0 text-slate-700 transition-colors group-hover:text-slate-500">
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
