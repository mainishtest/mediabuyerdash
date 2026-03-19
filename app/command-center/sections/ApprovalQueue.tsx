import Link from "next/link";
import type { CommandCenterApprovalItem } from "../../../lib/commandCenter/types";
import { priorityBadgeClass, priorityLabel, approvalPriority } from "../../../lib/commandCenter/priorityEngine";

function timeAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 36e5);
  if (h < 1)  return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ApprovalRow({ item }: { item: CommandCenterApprovalItem }) {
  const computedPriority = approvalPriority(item.priority, item.proposedAt);
  return (
    <div className="flex items-start gap-3 border-b border-slate-800/60 px-4 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${priorityBadgeClass(computedPriority)}`}
          >
            {priorityLabel(computedPriority)}
          </span>
          <span className="truncate text-xs text-slate-500">{item.clientName}</span>
        </div>
        <p className="mt-1 text-sm font-medium text-slate-200">{item.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.rationale}</p>
        <p className="mt-1 text-xs text-slate-600">{timeAgo(item.proposedAt)}</p>
      </div>
      <Link
        href={item.href}
        className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5
                   text-xs font-medium text-slate-300 transition-colors
                   hover:border-emerald-600 hover:bg-emerald-900/30 hover:text-emerald-300"
      >
        Review
      </Link>
    </div>
  );
}

export function ApprovalQueue({ approvals }: { approvals: CommandCenterApprovalItem[] }) {
  if (approvals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <p className="text-3xl">✓</p>
        <p className="mt-2 text-sm font-medium text-slate-300">No pending approvals</p>
        <p className="mt-1 text-xs text-slate-500">
          Automation proposals will appear here when rules are triggered.
        </p>
      </div>
    );
  }

  return (
    <div>
      {approvals.slice(0, 8).map((a) => (
        <ApprovalRow key={a.id} item={a} />
      ))}
      {approvals.length > 8 && (
        <div className="border-t border-slate-800/60 px-4 py-3">
          <Link
            href="/automation"
            className="text-xs text-emerald-400 hover:text-emerald-300"
          >
            View all {approvals.length} pending approvals →
          </Link>
        </div>
      )}
    </div>
  );
}
