"use client";
// app/automation/AutomationView.tsx
// Automation Rules & Approval Workflow — client component.
//
// Layout:
//   Mobile  → summary cards (2-col), filter bar stacks, action CARDS with
//             tap-friendly approve/reject buttons
//   Desktop → summary cards (4-col), filter bar in one row, action TABLE
//             with richer columns + inline approve/reject
//
// v1 notice: approval does NOT write back to Meta. Actions are proposals only.

import { useState, useTransition } from "react";
import type {
  ProposedAutomationActionRow,
  AutomationSummary,
  AutomationActionType,
  AutomationPriority,
  AutomationActionStatus,
} from "../../lib/automation/types";

// ── Label maps ────────────────────────────────────────────────────────────────

const ACTION_TYPE_LABELS: Record<AutomationActionType, string> = {
  pause_campaign:     "Pause Campaign",
  reduce_budget:      "Reduce Budget",
  increase_budget:    "Increase Budget",
  review_creative:    "Review Creative",
  refresh_creative:   "Refresh Creative",
  run_sync:           "Run Sync",
  investigate_client: "Investigate Client",
  set_goals:          "Set Goals",
  review_pacing:      "Review Pacing",
};

// ── Style maps ────────────────────────────────────────────────────────────────

const PRIORITY_BORDER: Record<AutomationPriority, string> = {
  high:   "border-l-rose-500",
  medium: "border-l-amber-500",
  low:    "border-l-slate-700",
};

const PRIORITY_BADGE: Record<AutomationPriority, string> = {
  high:   "bg-rose-500/20 text-rose-400",
  medium: "bg-amber-500/20 text-amber-400",
  low:    "bg-slate-700 text-slate-400",
};

const STATUS_BADGE: Record<AutomationActionStatus, string> = {
  proposed:  "bg-blue-500/20 text-blue-400",
  approved:  "bg-emerald-500/20 text-emerald-400",
  rejected:  "bg-slate-700 text-slate-400",
  executed:  "bg-purple-500/20 text-purple-400",
  expired:   "bg-slate-800 text-slate-500",
  deferred:  "bg-amber-900/40 text-amber-300",
  escalated: "bg-rose-900/40 text-rose-300",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

// ── Filter state ──────────────────────────────────────────────────────────────

type Filters = {
  clientId:   string;
  actionType: string;
  priority:   string;
  status:     string;
};

const DEFAULT_FILTERS: Filters = {
  clientId:   "",
  actionType: "",
  priority:   "",
  status:     "proposed",
};

// ── Components ────────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  accent,
}: {
  label:   string;
  value:   number;
  sub?:    string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// V1 safety notice banner
function V1NoticeBanner() {
  return (
    <div className="mb-6 rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-3">
      <p className="text-xs font-medium text-amber-400">
        Recommendations only — v1 safety layer
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-amber-300/70">
        Approving an action records your decision but does{" "}
        <span className="font-semibold">not</span> write anything to Meta Ads
        Manager. Real execution (budget changes, pausing) will be added in the
        next phase, guarded by this approval layer.
      </p>
    </div>
  );
}

// ── Mobile card ───────────────────────────────────────────────────────────────

function ActionCard({
  action,
  onApprove,
  onReject,
  isPending,
}: {
  action:    ProposedAutomationActionRow;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
  isPending: boolean;
}) {
  const borderColor = PRIORITY_BORDER[action.priority] ?? "border-l-slate-700";
  const metrics     = action.supportingData;
  const metricKeys  = Object.keys(metrics);

  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900 border-l-4 ${borderColor} p-4`}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">
            {ACTION_TYPE_LABELS[action.actionType] ?? action.actionType}
          </p>
          <p className="mt-0.5 text-xs text-slate-400 truncate">
            {action.clientName}
            {action.entityType !== "client" && (
              <span className="text-slate-500"> · {action.entityName}</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[action.priority]}`}>
            {action.priority}
          </span>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[action.status]}`}>
            {action.status}
          </span>
        </div>
      </div>

      {/* Rationale */}
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        {action.rationale}
      </p>

      {/* Supporting metrics */}
      {metricKeys.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          {metricKeys.map((k) => (
            <div key={k} className="text-xs">
              <span className="text-slate-500">
                {k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim()}:{" "}
              </span>
              <span className="font-medium text-slate-300">{metrics[k]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Proposed date */}
      <p className="mt-2 text-xs text-slate-600">
        Proposed {fmtDate(action.proposedAt)}
        {action.expiresAt && (
          <span> · expires {fmtDate(action.expiresAt)}</span>
        )}
      </p>

      {/* Rejection reason */}
      {action.status === "rejected" && action.rejectionReason && (
        <p className="mt-1 text-xs italic text-slate-500">
          Rejected: {action.rejectionReason}
        </p>
      )}

      {/* Approve/reject — large tap targets on mobile */}
      {action.status === "proposed" && (
        <div className="mt-3 flex gap-2">
          <button
            disabled={isPending}
            onClick={() => onApprove(action.id)}
            className="flex-1 rounded-lg bg-emerald-700 py-2 text-sm font-medium text-white
              transition-colors hover:bg-emerald-600 active:scale-95 disabled:opacity-50
              sm:flex-none sm:px-4 sm:py-1.5 sm:text-xs"
          >
            Approve
          </button>
          <button
            disabled={isPending}
            onClick={() => onReject(action.id)}
            className="flex-1 rounded-lg border border-slate-700 py-2 text-sm font-medium
              text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200
              active:scale-95 disabled:opacity-50
              sm:flex-none sm:px-4 sm:py-1.5 sm:text-xs"
          >
            Reject
          </button>
        </div>
      )}

      {action.status === "approved" && (
        <p className="mt-3 text-xs text-emerald-500">
          Approved {action.approvedAt ? fmtDate(action.approvedAt) : ""} — recorded, not yet executed
        </p>
      )}
    </div>
  );
}

// ── Desktop table row ─────────────────────────────────────────────────────────

const TH = "px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400 whitespace-nowrap";
const TD = "px-4 py-3 text-sm text-slate-300 align-top";

function ActionTableRow({
  action,
  onApprove,
  onReject,
  isPending,
}: {
  action:    ProposedAutomationActionRow;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
  isPending: boolean;
}) {
  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/20 transition-colors">
      {/* Client + entity */}
      <td className={TD}>
        <p className="font-medium text-slate-100 truncate max-w-[160px]">
          {action.clientName}
        </p>
        {action.entityType !== "client" && (
          <p className="mt-0.5 text-xs text-slate-500 truncate max-w-[160px]">
            {action.entityName}
          </p>
        )}
      </td>

      {/* Action type */}
      <td className={TD}>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300 whitespace-nowrap">
          {ACTION_TYPE_LABELS[action.actionType] ?? action.actionType}
        </span>
      </td>

      {/* Priority */}
      <td className={TD}>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[action.priority]}`}>
          {action.priority}
        </span>
      </td>

      {/* Reason */}
      <td className={`${TD} max-w-xs`}>
        <p className="text-xs leading-relaxed text-slate-400 line-clamp-3">
          {action.rationale}
        </p>
      </td>

      {/* Status */}
      <td className={TD}>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[action.status]}`}>
          {action.status}
        </span>
      </td>

      {/* Created */}
      <td className={`${TD} text-slate-500 whitespace-nowrap`}>
        {fmtDateShort(action.proposedAt)}
      </td>

      {/* Actions */}
      <td className={TD}>
        {action.status === "proposed" ? (
          <div className="flex gap-1.5">
            <button
              disabled={isPending}
              onClick={() => onApprove(action.id)}
              className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-medium text-white
                hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              Approve
            </button>
            <button
              disabled={isPending}
              onClick={() => onReject(action.id)}
              className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-medium
                text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50
                transition-colors"
            >
              Reject
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        )}
      </td>
    </tr>
  );
}

// ── Empty state variants ──────────────────────────────────────────────────────

function EmptyState({
  variant,
}: {
  variant: "no_actions" | "no_clients" | "no_sync" | "no_goals";
}) {
  const content = {
    no_actions: {
      icon: "○",
      heading: "No proposed actions",
      body:    "Rules are evaluated each time this page loads. Actions appear here when rule conditions are met.",
      hint:    "Try changing the status filter to \"All Statuses\" to see approved or rejected actions.",
    },
    no_clients: {
      icon: "○",
      heading: "No clients yet",
      body:    "Add your first client account before running automation rules.",
      hint:    "Go to Clients → add an account → connect Meta and Shopify to start generating signals.",
    },
    no_sync: {
      icon: "↻",
      heading: "No synced data",
      body:    "Rules need Meta campaign data and CRM orders to evaluate conditions.",
      hint:    "Connect Meta via Integrations and run a sync. Come back here after the first sync completes.",
    },
    no_goals: {
      icon: "◎",
      heading: "No proposed actions match these filters",
      body:    "If you expected rule triggers, check that campaigns have ROAS/CPA goals configured and data has been reconciled.",
      hint:    "Visit individual clients → Goals to set defaults, then revisit.",
    },
  } as const;

  const c = content[variant];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-14 text-center">
      <p className="text-3xl text-slate-700 mb-3">{c.icon}</p>
      <p className="text-sm font-medium text-slate-300">{c.heading}</p>
      <p className="mt-1.5 mx-auto max-w-sm text-xs leading-relaxed text-slate-500">{c.body}</p>
      {c.hint && (
        <p className="mt-2 mx-auto max-w-xs text-xs leading-relaxed text-slate-600">{c.hint}</p>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function AutomationView({
  actions: initialActions,
  summary,
  clients,
}: {
  actions:  ProposedAutomationActionRow[];
  summary:  AutomationSummary;
  clients:  { id: string; name: string }[];
}) {
  const [actions, setActions]         = useState(initialActions);
  const [filters, setFilters]         = useState<Filters>(DEFAULT_FILTERS);
  const [isPending, startTransition]  = useTransition();

  // ── Filter ──────────────────────────────────────────────────────────────────

  const filtered = actions.filter((a) => {
    if (filters.clientId   && a.clientAccountId !== filters.clientId)   return false;
    if (filters.actionType && a.actionType !== filters.actionType)       return false;
    if (filters.priority   && a.priority !== filters.priority)           return false;
    if (filters.status     && a.status !== filters.status)               return false;
    return true;
  });

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleApprove(id: string) {
    startTransition(async () => {
      await fetch(`/api/automation/${id}/approve`, { method: "POST" });
      setActions((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: "approved", approvedAt: new Date().toISOString() }
            : a
        )
      );
    });
  }

  function handleReject(id: string) {
    startTransition(async () => {
      await fetch(`/api/automation/${id}/reject`, { method: "POST" });
      setActions((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: "rejected", rejectedAt: new Date().toISOString() }
            : a
        )
      );
    });
  }

  // ── Determine empty state variant ───────────────────────────────────────────

  function emptyVariant(): "no_actions" | "no_clients" | "no_sync" | "no_goals" {
    if (clients.length === 0) return "no_clients";
    if (actions.length === 0) return "no_sync";
    return "no_actions";
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 lg:px-8">

      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-white">Automation</h1>
        <p className="mt-1 text-sm text-slate-400">
          Deterministic rule-driven recommendations, reviewed and approved by a human before any action is taken.
        </p>
      </div>

      {/* V1 safety notice */}
      <V1NoticeBanner />

      {/* Summary cards — 2-col mobile, 4-col tablet+ */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="Proposed"
          value={summary.proposedCount}
          sub="awaiting review"
          accent="text-blue-400"
        />
        <SummaryCard
          label="High Priority"
          value={summary.highPriorityCount}
          sub="needs attention"
          accent="text-rose-400"
        />
        <SummaryCard
          label="Approved"
          value={summary.approvedCount}
          sub="recorded, not executed"
          accent="text-emerald-400"
        />
        <SummaryCard
          label="Rejected"
          value={summary.rejectedCount}
          sub="dismissed"
        />
      </div>

      {/* Filter bar — stacks on mobile, 1 row on sm+ */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select
          value={filters.clientId}
          onChange={(e) => setFilters((f) => ({ ...f, clientId: e.target.value }))}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm
            text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={filters.actionType}
          onChange={(e) => setFilters((f) => ({ ...f, actionType: e.target.value }))}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm
            text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">All Action Types</option>
          <option value="pause_campaign">Pause Campaign</option>
          <option value="reduce_budget">Reduce Budget</option>
          <option value="increase_budget">Increase Budget</option>
          <option value="review_creative">Review Creative</option>
          <option value="refresh_creative">Refresh Creative</option>
          <option value="run_sync">Run Sync</option>
          <option value="investigate_client">Investigate Client</option>
          <option value="set_goals">Set Goals</option>
          <option value="review_pacing">Review Pacing</option>
        </select>

        <select
          value={filters.priority}
          onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm
            text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm
            text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">All Statuses</option>
          <option value="proposed">Proposed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="executed">Executed</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Result count */}
      <p className="mb-4 text-xs text-slate-500">
        {filtered.length} action{filtered.length !== 1 ? "s" : ""}
        {filters.status ? ` · ${filters.status}` : ""}
      </p>

      {/* Empty state */}
      {filtered.length === 0 && <EmptyState variant={emptyVariant()} />}

      {/* Mobile: action cards (hidden on lg+) */}
      {filtered.length > 0 && (
        <div className="space-y-3 lg:hidden">
          {filtered.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onApprove={handleApprove}
              onReject={handleReject}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {/* Desktop: table (hidden below lg) */}
      {filtered.length > 0 && (
        <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/60">
                <th className={TH}>Client / Entity</th>
                <th className={TH}>Action Type</th>
                <th className={TH}>Priority</th>
                <th className={TH}>Reason</th>
                <th className={TH}>Status</th>
                <th className={TH}>Proposed</th>
                <th className={TH}>Actions</th>
              </tr>
            </thead>
            <tbody className="bg-slate-900/40">
              {filtered.map((action) => (
                <ActionTableRow
                  key={action.id}
                  action={action}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  isPending={isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
