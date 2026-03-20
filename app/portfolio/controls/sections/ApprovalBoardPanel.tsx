"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  PortfolioApprovalBoardItem,
  PortfolioApprovalAging,
} from "../../../../lib/portfolioControls/types";
import {
  agingBucketLabel,
  agingBucketBadgeClass,
  approvalStatusBadgeClass,
  controlPriorityBadgeClass,
  actionTypeLabel,
  formatAgingHours,
} from "../../../../lib/portfolioControls/approvalBoard";

// ── Aging summary pills ───────────────────────────────────────────────────────

function AgingSummary({ aging }: { aging: PortfolioApprovalAging }) {
  if (aging.total === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {(["critical", "overdue", "aging", "fresh"] as const).map((bucket) => {
        const count = aging[bucket];
        if (count === 0) return null;
        return (
          <span
            key={bucket}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${agingBucketBadgeClass(bucket)}`}
          >
            {agingBucketLabel(bucket)}: {count}
          </span>
        );
      })}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-5 py-6 text-center">
      <p className="text-sm font-medium text-emerald-400">No actionable approvals</p>
      <p className="mt-1 text-xs text-slate-600">
        All proposed actions have been reviewed or no actions are pending.
      </p>
    </div>
  );
}

// ── Approval card (mobile + desktop) ─────────────────────────────────────────

function ApprovalCard({
  item,
  onApprove,
  onReject,
  isPending,
}: {
  item:      PortfolioApprovalBoardItem;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
  isPending: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 transition-colors hover:border-slate-700">
      {/* Header badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${controlPriorityBadgeClass(item.controlPriority)}`}>
          {item.controlPriority.charAt(0).toUpperCase() + item.controlPriority.slice(1)}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-xs ${agingBucketBadgeClass(item.agingBucket)}`}>
          {agingBucketLabel(item.agingBucket)}
        </span>
        {item.status !== "proposed" && (
          <span className={`rounded-full border px-2 py-0.5 text-xs ${approvalStatusBadgeClass(item.status)}`}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </span>
        )}
        <span className="ml-auto text-xs text-slate-500">{formatAgingHours(item.agingHours)} ago</span>
      </div>

      {/* Title */}
      <p className="mt-1.5 text-sm font-semibold text-white">
        {actionTypeLabel(item.actionType)}
        <span className="ml-2 text-xs font-normal text-slate-400">
          — {item.entityName} ({item.entityType})
        </span>
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{item.clientName}</p>

      {/* Rationale */}
      <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{item.rationale}</p>

      {/* Escalation note */}
      {item.escalationNote && (
        <div className="mt-2 rounded-lg border border-violet-900/40 bg-violet-950/20 px-3 py-1.5">
          <p className="text-xs font-medium text-violet-400">Escalation note</p>
          <p className="mt-0.5 text-xs text-violet-300">{item.escalationNote}</p>
        </div>
      )}

      {/* Deferred until */}
      {item.deferredUntil && (
        <p className="mt-1.5 text-xs text-sky-400">
          Deferred until: {new Date(item.deferredUntil).toLocaleDateString()}
        </p>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        {item.status === "proposed" && (
          <>
            <button
              onClick={() => onApprove(item.id)}
              disabled={isPending}
              className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-300
                         hover:border-emerald-600 hover:bg-emerald-950/60 disabled:opacity-50 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => onReject(item.id)}
              disabled={isPending}
              className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-1.5 text-xs font-medium text-rose-300
                         hover:border-rose-700 hover:bg-rose-950/60 disabled:opacity-50 transition-colors"
            >
              Reject
            </button>
          </>
        )}
        <Link
          href={item.links.approvalQueue}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
        >
          Open Approval Queue
        </Link>
        <Link
          href={item.links.account}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
        >
          Open Account
        </Link>
      </div>
    </div>
  );
}

// ── Desktop table row ─────────────────────────────────────────────────────────

function TableRow({
  item,
  onApprove,
  onReject,
  isPending,
}: {
  item:      PortfolioApprovalBoardItem;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
  isPending: boolean;
}) {
  return (
    <tr className="border-t border-slate-800/60 hover:bg-slate-800/20 transition-colors">
      <td className="px-3 py-2.5 text-xs text-slate-300">{item.clientName}</td>
      <td className="px-3 py-2.5 text-xs font-medium text-white">{actionTypeLabel(item.actionType)}</td>
      <td className="px-3 py-2.5 text-xs text-slate-400">{item.entityName}</td>
      <td className="px-3 py-2.5">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${controlPriorityBadgeClass(item.controlPriority)}`}>
          {item.controlPriority}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className={`rounded-full border px-2 py-0.5 text-xs ${agingBucketBadgeClass(item.agingBucket)}`}>
          {formatAgingHours(item.agingHours)}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className={`rounded-full border px-2 py-0.5 text-xs ${approvalStatusBadgeClass(item.status)}`}>
          {item.status}
        </span>
      </td>
      <td className="px-3 py-2.5 max-w-xs">
        <p className="text-xs text-slate-400 truncate" title={item.rationale}>{item.rationale}</p>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          {item.status === "proposed" && (
            <>
              <button
                onClick={() => onApprove(item.id)}
                disabled={isPending}
                className="rounded border border-emerald-700/60 bg-emerald-950/40 px-2 py-0.5 text-xs text-emerald-300
                           hover:border-emerald-600 disabled:opacity-50 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => onReject(item.id)}
                disabled={isPending}
                className="rounded border border-rose-800/60 bg-rose-950/40 px-2 py-0.5 text-xs text-rose-300
                           hover:border-rose-700 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
            </>
          )}
          <Link
            href={item.links.approvalQueue}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300 hover:border-slate-600 transition-colors"
          >
            Queue
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ApprovalBoardPanel({
  items,
  aging,
}: {
  items: PortfolioApprovalBoardItem[];
  aging: PortfolioApprovalAging;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [actionState, setActionState] = useState<Record<string, "approving" | "rejecting" | "done">>({});

  if (items.length === 0) return <EmptyState />;

  async function handleApprove(id: string) {
    setActionState((s) => ({ ...s, [id]: "approving" }));
    try {
      await fetch(`/api/automation/${id}/approve`, { method: "POST" });
      setActionState((s) => ({ ...s, [id]: "done" }));
      startTransition(() => router.refresh());
    } catch {
      setActionState((s) => { const n = { ...s }; delete n[id]; return n; });
    }
  }

  async function handleReject(id: string) {
    setActionState((s) => ({ ...s, [id]: "rejecting" }));
    try {
      await fetch(`/api/automation/${id}/reject`, { method: "POST" });
      setActionState((s) => ({ ...s, [id]: "done" }));
      startTransition(() => router.refresh());
    } catch {
      setActionState((s) => { const n = { ...s }; delete n[id]; return n; });
    }
  }

  const visibleItems = items.filter((i) => actionState[i.id] !== "done");

  return (
    <>
      <AgingSummary aging={aging} />

      {/* Mobile: cards */}
      <div className="space-y-2 lg:hidden">
        {visibleItems.map((item) => (
          <ApprovalCard
            key={item.id}
            item={item}
            onApprove={handleApprove}
            onReject={handleReject}
            isPending={!!actionState[item.id]}
          />
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-max text-left">
          <thead>
            <tr className="border-b border-slate-800">
              {["Client", "Action", "Entity", "Priority", "Age", "Status", "Rationale", "Actions"].map((h) => (
                <th key={h} className="px-3 py-2 text-xs font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <TableRow
                key={item.id}
                item={item}
                onApprove={handleApprove}
                onReject={handleReject}
                isPending={!!actionState[item.id]}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
