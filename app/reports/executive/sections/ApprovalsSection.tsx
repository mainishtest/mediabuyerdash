import type { ExecutiveApprovalSummary, ExecutiveApprovalItem } from "../../../../lib/executiveReporting/types";

const STATUS_BADGE: Record<string, string> = {
  proposed: "border-amber-800/50 bg-amber-950/60 text-amber-300",
  approved: "border-emerald-800/50 bg-emerald-950/60 text-emerald-300",
  rejected: "border-rose-800/50 bg-rose-950/60 text-rose-300",
  executed: "border-sky-800/50 bg-sky-950/60 text-sky-300",
  expired:  "border-slate-700 bg-slate-800 text-slate-400",
};

const ACTION_LABEL: Record<string, string> = {
  pause_campaign:    "Pause Campaign",
  reduce_budget:     "Reduce Budget",
  increase_budget:   "Increase Budget",
  review_creative:   "Review Creative",
  refresh_creative:  "Refresh Creative",
  run_sync:          "Run Sync",
  investigate_client: "Investigate Client",
};

function timeAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 36e5);
  if (h < 1)  return "< 1h ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Summary chips ─────────────────────────────────────────────────────────────

function SummaryChips({ approvals }: { approvals: ExecutiveApprovalSummary }) {
  const chips = [
    { label: "Pending",  value: approvals.pendingCount,         cls: approvals.pendingCount > 0 ? "border-amber-800/50 bg-amber-950/60 text-amber-300" : "border-slate-700 bg-slate-800 text-slate-400" },
    { label: "Approved", value: approvals.approvedThisPeriod,   cls: "border-emerald-800/50 bg-emerald-950/60 text-emerald-300" },
    { label: "Executed", value: approvals.executedThisPeriod,   cls: "border-sky-800/50 bg-sky-950/60 text-sky-300" },
    { label: "Rejected", value: approvals.rejectedThisPeriod,   cls: "border-slate-700 bg-slate-800 text-slate-400" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <div key={c.label} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${c.cls}`}>
          <span className="text-sm font-semibold">{c.value}</span>
          <span className="text-xs">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Approval row ──────────────────────────────────────────────────────────────

function ApprovalRow({ item }: { item: ExecutiveApprovalItem }) {
  const badge = STATUS_BADGE[item.status] ?? "border-slate-700 bg-slate-800 text-slate-400";
  return (
    <div className="border-b border-slate-800/60 py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badge}`}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </span>
        <span className="text-xs text-slate-500">
          {ACTION_LABEL[item.actionType] ?? item.actionType.replace(/_/g, " ")}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium text-slate-200">{item.entityName}</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.rationale}</p>
      <p className="mt-1 text-xs text-slate-600">
        {item.clientName} · {timeAgo(item.proposedAt)}
      </p>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export function ApprovalsSection({ approvals }: { approvals: ExecutiveApprovalSummary }) {
  // Pending first, then approved/executed, then rejected/expired
  const ORDER: Record<string, number> = { proposed: 0, approved: 1, executed: 2, rejected: 3, expired: 4 };
  const sorted = [...approvals.items].sort(
    (a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9)
  );

  return (
    <div className="space-y-4">
      <SummaryChips approvals={approvals} />

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500">
          No automation proposals recorded for this period.
        </p>
      ) : (
        <div>
          {sorted.slice(0, 6).map((a) => (
            <ApprovalRow key={a.id} item={a} />
          ))}
          {sorted.length > 6 && (
            <p className="mt-2 text-xs text-slate-600">
              + {sorted.length - 6} more action{sorted.length - 6 !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
