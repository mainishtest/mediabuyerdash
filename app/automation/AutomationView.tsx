"use client";

import { useState, useTransition } from "react";
import type {
  ProposedAutomationActionRow,
  AutomationSummary,
  AutomationActionType,
  AutomationPriority,
  AutomationActionStatus,
} from "../../lib/automation/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTION_TYPE_LABELS: Record<AutomationActionType, string> = {
  pause_campaign:    "Pause Campaign",
  reduce_budget:     "Reduce Budget",
  increase_budget:   "Increase Budget",
  review_creative:   "Review Creative",
  refresh_creative:  "Refresh Creative",
  run_sync:          "Run Sync",
  investigate_client: "Investigate Client",
};

const PRIORITY_COLORS: Record<AutomationPriority, string> = {
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
  proposed: "bg-blue-500/20 text-blue-400",
  approved: "bg-emerald-500/20 text-emerald-400",
  rejected: "bg-slate-700 text-slate-400",
  executed: "bg-purple-500/20 text-purple-400",
  expired:  "bg-slate-800 text-slate-500",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// SummaryCard
// ---------------------------------------------------------------------------

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
      <p className={`mt-1 text-2xl font-bold ${accent ?? "text-white"}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionCard
// ---------------------------------------------------------------------------

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
  const borderColor = PRIORITY_COLORS[action.priority] ?? "border-l-slate-700";
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
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[action.priority]}`}
          >
            {action.priority}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[action.status]}`}
          >
            {action.status}
          </span>
        </div>
      </div>

      {/* Rationale */}
      <p className="mt-2 text-xs text-slate-400 leading-relaxed">
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

      {/* Proposed date + expiry */}
      <p className="mt-2 text-xs text-slate-600">
        Proposed {fmtDate(action.proposedAt)}
        {action.expiresAt && (
          <span> · expires {fmtDate(action.expiresAt)}</span>
        )}
      </p>

      {/* Rejection reason */}
      {action.status === "rejected" && action.rejectionReason && (
        <p className="mt-1 text-xs text-slate-500 italic">
          Rejected: {action.rejectionReason}
        </p>
      )}

      {/* Action buttons (only for proposed) */}
      {action.status === "proposed" && (
        <div className="mt-3 flex gap-2">
          <button
            disabled={isPending}
            onClick={() => onApprove(action.id)}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white
              transition-colors hover:bg-emerald-600 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={isPending}
            onClick={() => onReject(action.id)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium
              text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200
              disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {/* Approved notice */}
      {action.status === "approved" && (
        <p className="mt-3 text-xs text-emerald-500">
          Approved {action.approvedAt ? fmtDate(action.approvedAt) : ""} — awaiting execution
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function AutomationView({
  actions: initialActions,
  summary,
  clients,
}: {
  actions:  ProposedAutomationActionRow[];
  summary:  AutomationSummary;
  clients:  { id: string; name: string }[];
}) {
  const [actions, setActions]   = useState(initialActions);
  const [filters, setFilters]   = useState<Filters>(DEFAULT_FILTERS);
  const [isPending, startTransition] = useTransition();

  // ---------------------------------------------------------------------------
  // Apply filters
  // ---------------------------------------------------------------------------

  const filtered = actions.filter((a) => {
    if (filters.clientId   && a.clientAccountId !== filters.clientId)   return false;
    if (filters.actionType && a.actionType !== filters.actionType)       return false;
    if (filters.priority   && a.priority !== filters.priority)           return false;
    if (filters.status     && a.status !== filters.status)               return false;
    return true;
  });

  // ---------------------------------------------------------------------------
  // Approve / reject handlers
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 lg:px-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Automation</h1>
        <p className="mt-1 text-sm text-slate-400">
          Rule-driven recommendations requiring human approval. Actions are
          proposals only — approval does not yet write back to Meta.
        </p>
      </div>

      {/* Summary cards */}
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
          sub="awaiting execution"
          accent="text-emerald-400"
        />
        <SummaryCard
          label="Rejected"
          value={summary.rejectedCount}
          sub="dismissed"
        />
      </div>

      {/* Filter bar */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* Client */}
        <select
          value={filters.clientId}
          onChange={(e) => setFilters((f) => ({ ...f, clientId: e.target.value }))}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm
            text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Action type */}
        <select
          value={filters.actionType}
          onChange={(e) => setFilters((f) => ({ ...f, actionType: e.target.value }))}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm
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
        </select>

        {/* Priority */}
        <select
          value={filters.priority}
          onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm
            text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Status */}
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm
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

      {/* Action count */}
      <p className="mb-4 text-xs text-slate-500">
        {filtered.length} action{filtered.length !== 1 ? "s" : ""}
        {filters.status && ` · ${filters.status}`}
      </p>

      {/* Action cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center">
          <p className="text-sm text-slate-500">No proposed actions match these filters.</p>
          {filters.status === "proposed" && (
            <p className="mt-1 text-xs text-slate-600">
              Rules are evaluated each time this page loads.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
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
    </div>
  );
}
