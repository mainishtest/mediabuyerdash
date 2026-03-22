"use client";

// BriefActionList — Prioritised action items with readiness indicators.
// Decision-first: shows what to do, readiness state, and blockers.

import Link from "next/link";
import type { DailyBriefActionItem } from "../../../types/dailyBrief";

function priorityStyle(priority: string): string {
  switch (priority) {
    case "critical": return "bg-rose-500/10 text-rose-400";
    case "high":     return "bg-amber-500/10 text-amber-400";
    case "medium":   return "bg-sky-500/10 text-sky-400";
    default:         return "bg-slate-700/50 text-slate-400";
  }
}

function readinessDot(readiness: string): string {
  switch (readiness) {
    case "ready":   return "bg-emerald-400";
    case "blocked": return "bg-rose-400";
    default:        return "bg-amber-400";
  }
}

function categoryLabel(category: string): string {
  switch (category) {
    case "scale":   return "Scale";
    case "refresh": return "Creative Lab";
    case "retest":  return "Follow-up Test";
    case "alert":   return "Alert";
    case "pacing":  return "Pacing";
    case "blocker": return "Blocker";
    default:        return category;
  }
}

export function BriefActionList({ actions }: { actions: DailyBriefActionItem[] }) {
  if (actions.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-8 text-center">
        <p className="text-sm text-slate-500">No actions needed today.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {actions.map((action) => (
        <Link
          key={action.id}
          href={action.href}
          className="group flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/50
                     px-4 py-3 transition-colors hover:border-slate-700 hover:bg-slate-800/50"
        >
          {/* Readiness dot */}
          <div className="mt-1.5 flex-shrink-0">
            <div className={`h-2.5 w-2.5 rounded-full ${readinessDot(action.readiness)}`} />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${priorityStyle(action.priority)}`}>
                {action.priority}
              </span>
              <span className="text-xs text-slate-500">{categoryLabel(action.category)}</span>
              <span className="text-xs text-slate-600">{action.clientName}</span>
            </div>
            <p className="mt-1 text-sm font-medium text-slate-200 group-hover:text-white">
              {action.label}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{action.description}</p>
            {action.blockerNote && (
              <p className="mt-1 text-xs font-medium text-rose-400">{action.blockerNote}</p>
            )}
          </div>

          {/* Arrow */}
          <div className="mt-1 flex-shrink-0 text-slate-600 transition-colors group-hover:text-slate-400">
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </Link>
      ))}
    </div>
  );
}
