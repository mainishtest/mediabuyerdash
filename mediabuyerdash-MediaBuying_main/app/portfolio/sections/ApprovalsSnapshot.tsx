import Link from "next/link";
import type { PortfolioApprovalSummary } from "../../../lib/portfolio/types";

function timeAgo(isoStr: string): string {
  const h = (Date.now() - new Date(isoStr).getTime()) / 3_600_000;
  if (h < 1)  return "< 1h ago";
  if (h < 24) return `${Math.floor(h)}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function EmptyApprovals() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-5 py-6 text-center">
      <p className="text-sm font-medium text-emerald-400">No pending approvals</p>
      <p className="mt-1 text-xs text-slate-600">All automation actions have been reviewed.</p>
    </div>
  );
}

export function ApprovalsSnapshot({ snapshots }: { snapshots: PortfolioApprovalSummary[] }) {
  if (snapshots.length === 0) return <EmptyApprovals />;

  return (
    <div className="space-y-2">
      {snapshots.map((snap) => (
        <Link
          key={snap.clientId}
          href={snap.href}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-800
                     bg-slate-900/40 px-4 py-3 transition-colors hover:border-slate-700 hover:bg-slate-900/60"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {snap.hasCritical && (
                <span className="rounded-full border border-rose-800/50 bg-rose-950/60 px-2 py-0.5
                                 text-xs font-medium text-rose-300">
                  Overdue
                </span>
              )}
              <span className="truncate text-sm font-medium text-white">{snap.clientName}</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {snap.count} pending · oldest {timeAgo(snap.oldestPendingAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-amber-800/50 bg-amber-950/60 px-2.5 py-0.5
                             text-xs font-semibold text-amber-300">
              {snap.count}
            </span>
            <svg
              className="h-4 w-4 text-slate-600"
              viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </Link>
      ))}
    </div>
  );
}
