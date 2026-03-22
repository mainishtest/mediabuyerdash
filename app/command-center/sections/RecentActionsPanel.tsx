"use client";

// RecentActionsPanel — Recent action history entries on the command center.
// Shows the last 24h of account-level decisions with links to the full timeline.

import Link from "next/link";
import type {
  CommandCenterRecentAction,
  CommandCenterRecentActionsSummary,
} from "../../../lib/commandCenter/types";

// ── Helpers ─────────────────────────────────────────────────────────────────

function statusDot(status: string): string {
  switch (status) {
    case "success":  return "bg-emerald-400";
    case "failed":   return "bg-rose-400";
    case "blocked":  return "bg-rose-400";
    case "pending":  return "bg-amber-400";
    default:         return "bg-slate-500";
  }
}

function eventLabel(t: string): string {
  const map: Record<string, string> = {
    recommendation_created: "Recommendation", approval_requested: "Approval Req",
    approval_granted: "Approved", approval_rejected: "Rejected",
    scale_plan_created: "Scale Plan", scale_executed: "Scale Exec",
    test_created: "Test Created", test_launched: "Test Launched",
    creative_refresh_sent: "Refresh", image_generation_completed: "Image Gen",
    outcome_routed: "Outcome", execution_succeeded: "Executed",
    execution_failed: "Failed", action_blocked: "Blocked",
  };
  return map[t] ?? t.replace(/_/g, " ");
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Component ───────────────────────────────────────────────────────────────

export function RecentActionsPanel({
  actions,
  summary,
  clientFilter,
}: {
  actions:      CommandCenterRecentAction[];
  summary:      CommandCenterRecentActionsSummary;
  clientFilter: string;
}) {
  const filtered = clientFilter
    ? actions.filter((a) => a.clientName?.toLowerCase().includes(clientFilter.toLowerCase()))
    : actions;

  return (
    <div>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-200">Recent Actions</h2>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">{summary.totalCount}</span>
          {summary.failedCount > 0 && (
            <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400">
              {summary.failedCount} failed
            </span>
          )}
          {summary.blockedCount > 0 && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
              {summary.blockedCount} blocked
            </span>
          )}
        </div>
        <Link
          href="/history"
          className="text-xs text-slate-500 transition-colors hover:text-slate-300"
        >
          View all
        </Link>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-6 text-center">
          <p className="text-xs text-slate-500">No recent actions in the last 24h.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.slice(0, 10).map((a) => (
            <Link
              key={a.id}
              href={a.href}
              className="group flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-900/50
                         px-3 py-2 transition-colors hover:border-slate-700 hover:bg-slate-800/50"
            >
              <div className={`h-2 w-2 shrink-0 rounded-full ${statusDot(a.status)}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-slate-500">{eventLabel(a.eventType)}</span>
                  <span className="text-[10px] text-slate-700">{timeAgo(a.occurredAt)}</span>
                </div>
                <p className="truncate text-xs text-slate-300 group-hover:text-white">{a.title}</p>
              </div>
              {a.clientName && (
                <span className="shrink-0 text-[10px] text-slate-600">{a.clientName}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
