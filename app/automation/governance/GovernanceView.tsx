"use client";

// app/automation/governance/GovernanceView.tsx
// Approval Routing, Override & Emergency Stop Controls — responsive client component.
//
// Mobile:  emergency stop bar prominent at top, large pause/resume buttons,
//          stacked scope cards, approval queue as action cards
// Desktop: stats row + split layout — left (stops+overrides), right (approval queue)

import { useState, useTransition } from "react";
import type {
  GovernanceControlSummary,
  EmergencyStopState,
  AutomationOverrideRecord,
  EmergencyStopScope,
} from "../../../lib/governance/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PendingAction = {
  id:             string;
  clientName:     string;
  clientAccountId: string;
  actionType:     string;
  status:         string;
  priority:       string;
  entityType:     string;
  entityId:       string;
  entityName:     string;
  rationale:      string;
  proposedAt:     string;
  expiresAt:      string | null;
  deferredUntil:  string | null;
  escalatedAt:    string | null;
  escalationNote: string | null;
};

interface Props {
  workspaceId:    string;
  summary:        GovernanceControlSummary;
  pendingActions: PendingAction[];
  clients:        { id: string; name: string }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    hour:  "2-digit",
    minute: "2-digit",
  });
}

function fmtActionType(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Status / priority / scope badges
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  proposed:  "bg-blue-900/40 text-blue-300",
  deferred:  "bg-amber-900/40 text-amber-300",
  escalated: "bg-rose-900/40 text-rose-300",
  approved:  "bg-emerald-900/40 text-emerald-300",
  rejected:  "bg-slate-700 text-slate-400",
};

const PRIORITY_DOT: Record<string, string> = {
  high:   "bg-rose-500",
  medium: "bg-amber-500",
  low:    "bg-slate-600",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-slate-700 text-slate-400";
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${PRIORITY_DOT[priority] ?? "bg-slate-600"}`}
      title={priority}
    />
  );
}

// ---------------------------------------------------------------------------
// Emergency stop indicator bar
// ---------------------------------------------------------------------------

function StopIndicatorBar({
  automationPaused,
  stopCount,
  onPauseAll,
  disabled,
}: {
  automationPaused: boolean;
  stopCount:        number;
  onPauseAll:       () => void;
  disabled:         boolean;
}) {
  if (!automationPaused && stopCount === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-800/40 bg-emerald-900/20 px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-sm text-emerald-300">
          Automation running normally — no active emergency stops.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-rose-700 bg-rose-900/30 px-4 py-3">
      <span className="h-3 w-3 animate-pulse rounded-full bg-rose-500" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-rose-300">
          {automationPaused
            ? "Automation is paused workspace-wide"
            : `${stopCount} emergency stop${stopCount > 1 ? "s" : ""} active`}
        </p>
        <p className="text-xs text-rose-400/70">
          Guarded auto-execution is blocked. Approvals can still be processed manually.
        </p>
      </div>
      <button
        disabled={disabled}
        onClick={onPauseAll}
        className="shrink-0 rounded-lg border border-rose-700 bg-rose-900/50 px-3 py-1.5
                   text-xs font-medium text-rose-300 transition-colors hover:bg-rose-800/50
                   disabled:opacity-50"
      >
        + Add Stop
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stop card
// ---------------------------------------------------------------------------

function StopCard({
  stop,
  onClear,
  clearing,
}: {
  stop:     EmergencyStopState;
  onClear:  (id: string) => void;
  clearing: boolean;
}) {
  const scopeLabel =
    stop.scope === "global"      ? "Workspace-wide" :
    stop.scope === "client"      ? `Client: ${stop.scopeId}` :
    stop.scope === "ad_account"  ? `Ad Account: ${stop.scopeId}` :
    stop.scope === "campaign"    ? `Campaign: ${stop.scopeId}` :
    stop.scope === "action_type" ? `Action type: ${stop.scopeId}` :
    stop.scope;

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-rose-800/50 bg-rose-900/20 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-rose-300">{scopeLabel}</span>
          {stop.expiresAt && (
            <span className="text-xs text-slate-500">
              expires {fmtDate(stop.expiresAt)}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-400">{stop.reason}</p>
        <p className="mt-0.5 text-xs text-slate-600">
          Set {fmtDate(stop.createdAt)}
          {stop.stoppedBy ? ` · by ${stop.stoppedBy.slice(0, 8)}…` : ""}
        </p>
      </div>
      <button
        disabled={clearing}
        onClick={() => onClear(stop.id)}
        className="shrink-0 rounded border border-slate-700 px-2 py-1 text-xs text-slate-400
                   transition-colors hover:border-slate-500 hover:text-slate-200 disabled:opacity-50"
      >
        Clear
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Override card
// ---------------------------------------------------------------------------

function OverrideCard({
  override,
  onClear,
  clearing,
}: {
  override: AutomationOverrideRecord;
  onClear:  (id: string) => void;
  clearing: boolean;
}) {
  const typeLabel: Record<string, string> = {
    pause_scope:          "Scope Paused",
    require_approval_all: "Approval Required (All)",
    defer_action:         "Action Deferred",
    override_block:       "Block Override",
    resume_scope:         "Scope Resumed",
  };

  const typeColor: Record<string, string> = {
    pause_scope:          "text-amber-300",
    require_approval_all: "text-blue-300",
    defer_action:         "text-amber-400",
    override_block:       "text-rose-300",
    resume_scope:         "text-emerald-300",
  };

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-800/40 bg-amber-900/10 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-xs font-medium ${typeColor[override.overrideType] ?? "text-slate-300"}`}>
            {typeLabel[override.overrideType] ?? override.overrideType}
          </span>
          <span className="text-xs text-slate-500">
            {override.scope}/{override.scopeId.slice(0, 12)}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">{override.reason}</p>
        <p className="mt-0.5 text-xs text-slate-600">
          Applied {fmtDate(override.createdAt)}
          {override.appliedBy ? ` · by ${override.appliedBy.slice(0, 8)}…` : ""}
        </p>
      </div>
      <button
        disabled={clearing}
        onClick={() => onClear(override.id)}
        className="shrink-0 rounded border border-slate-700 px-2 py-1 text-xs text-slate-400
                   transition-colors hover:border-slate-500 hover:text-slate-200 disabled:opacity-50"
      >
        Clear
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action row — approval queue
// ---------------------------------------------------------------------------

function ActionQueueItem({
  action,
  onApprove,
  onReject,
  onDefer,
  onEscalate,
  busy,
}: {
  action:     PendingAction;
  onApprove:  (id: string) => void;
  onReject:   (id: string) => void;
  onDefer:    (id: string) => void;
  onEscalate: (id: string) => void;
  busy:       boolean;
}) {
  const isEscalated = action.status === "escalated";
  const isDeferred  = action.status === "deferred";

  return (
    <div
      className={`rounded-xl border bg-slate-900 ${
        isEscalated
          ? "border-rose-800/60"
          : isDeferred
          ? "border-amber-800/40"
          : "border-slate-800"
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-3 pb-2">
        <PriorityDot priority={action.priority} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-100">
              {fmtActionType(action.actionType)}
            </span>
            <StatusBadge status={action.status} />
            <span className="text-xs text-slate-500">{action.clientName}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {action.entityName} · {action.entityType}
          </p>
          {action.escalationNote && (
            <p className="mt-1 rounded bg-rose-900/20 px-2 py-1 text-xs text-rose-300">
              Escalation: {action.escalationNote}
            </p>
          )}
          {action.deferredUntil && (
            <p className="mt-1 text-xs text-amber-400/80">
              Deferred until {fmtDate(action.deferredUntil)}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            {action.rationale}
          </p>
        </div>
        <span className="shrink-0 text-xs text-slate-600">
          {fmtDate(action.proposedAt)}
        </span>
      </div>

      {/* Action buttons — full-width on mobile, inline on desktop */}
      <div className="flex flex-wrap gap-2 border-t border-slate-800 px-4 py-2">
        <button
          disabled={busy}
          onClick={() => onApprove(action.id)}
          className="flex-1 rounded-lg bg-emerald-900/40 px-3 py-1.5 text-xs font-medium
                     text-emerald-300 transition-colors hover:bg-emerald-800/50 disabled:opacity-50
                     sm:flex-none"
        >
          Approve
        </button>
        <button
          disabled={busy}
          onClick={() => onReject(action.id)}
          className="flex-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium
                     text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200
                     disabled:opacity-50 sm:flex-none"
        >
          Reject
        </button>
        {!isDeferred && (
          <button
            disabled={busy}
            onClick={() => onDefer(action.id)}
            className="flex-1 rounded-lg bg-amber-900/30 px-3 py-1.5 text-xs font-medium
                       text-amber-400 transition-colors hover:bg-amber-900/50 disabled:opacity-50
                       sm:flex-none"
          >
            Defer
          </button>
        )}
        {!isEscalated && (
          <button
            disabled={busy}
            onClick={() => onEscalate(action.id)}
            className="flex-1 rounded-lg bg-rose-900/20 px-3 py-1.5 text-xs font-medium
                       text-rose-400 transition-colors hover:bg-rose-900/40 disabled:opacity-50
                       sm:flex-none"
          >
            Escalate
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add stop modal (inline form)
// ---------------------------------------------------------------------------

function AddStopForm({
  clients,
  onSubmit,
  onCancel,
  busy,
}: {
  clients:  { id: string; name: string }[];
  onSubmit: (scope: EmergencyStopScope, scopeId: string, reason: string) => void;
  onCancel: () => void;
  busy:     boolean;
}) {
  const [scope,   setScope]   = useState<EmergencyStopScope>("global");
  const [scopeId, setScopeId] = useState("global");
  const [reason,  setReason]  = useState("");

  const needsScopeId = scope !== "global";

  return (
    <div className="rounded-xl border border-rose-800/60 bg-slate-900 p-4">
      <p className="mb-3 text-sm font-semibold text-rose-300">Set Emergency Stop</p>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Scope</label>
          <select
            value={scope}
            onChange={(e) => {
              const s = e.target.value as EmergencyStopScope;
              setScope(s);
              setScopeId(s === "global" ? "global" : "");
            }}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5
                       text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-600"
          >
            <option value="global">Workspace-wide (global)</option>
            <option value="client">Client</option>
            <option value="ad_account">Ad Account</option>
            <option value="campaign">Campaign</option>
            <option value="action_type">Action Type</option>
          </select>
        </div>

        {needsScopeId && (
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              {scope === "client" ? "Client" : "Scope ID"}
            </label>
            {scope === "client" ? (
              <select
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5
                           text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-600"
              >
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder={
                  scope === "action_type" ? "e.g. pause_campaign" : "Entity ID…"
                }
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5
                           text-xs text-slate-200 placeholder:text-slate-600
                           focus:outline-none focus:ring-1 focus:ring-rose-600"
              />
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs text-slate-500">Reason (required)</label>
          <input
            type="text"
            placeholder="Why is this stop being applied?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5
                       text-xs text-slate-200 placeholder:text-slate-600
                       focus:outline-none focus:ring-1 focus:ring-rose-600"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            disabled={busy || !reason.trim() || (needsScopeId && !scopeId)}
            onClick={() => onSubmit(scope, scopeId, reason.trim())}
            className="flex-1 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-medium
                       text-white transition-colors hover:bg-rose-600 disabled:opacity-50"
          >
            {busy ? "Applying…" : "Apply Stop"}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400
                       transition-colors hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline defer / escalate modal
// ---------------------------------------------------------------------------

function ActionReasonModal({
  title,
  placeholder,
  onConfirm,
  onCancel,
  busy,
}: {
  title:       string;
  placeholder: string;
  onConfirm:   (reason: string) => void;
  onCancel:    () => void;
  busy:        boolean;
}) {
  const [text, setText] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-4 lg:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <p className="mb-3 text-sm font-semibold text-slate-200">{title}</p>
        <input
          autoFocus
          type="text"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && text.trim() && onConfirm(text.trim())}
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2
                     text-sm text-slate-200 placeholder:text-slate-600
                     focus:outline-none focus:ring-1 focus:ring-blue-600"
        />
        <div className="mt-3 flex gap-2">
          <button
            disabled={busy || !text.trim()}
            onClick={() => onConfirm(text.trim())}
            className="flex-1 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium
                       text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
          >
            {busy ? "…" : "Confirm"}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400
                       transition-colors hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function GovernanceView({
  workspaceId,
  summary: initialSummary,
  pendingActions: initialActions,
  clients,
}: Props) {
  const [summary,  setSummary]  = useState(initialSummary);
  const [actions,  setActions]  = useState(initialActions);
  const [showAddStop, setShowAddStop] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [modalConfig, setModalConfig]   = useState<{
    actionId: string;
    mode:     "defer" | "escalate";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // ── Stop management ──────────────────────────────────────────────────────

  async function handleAddStop(
    scope:   EmergencyStopScope,
    scopeId: string,
    reason:  string
  ) {
    setError(null);
    try {
      const res = await fetch("/api/governance/stops", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ scope, scopeId, reason }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed to apply stop.");
        return;
      }
      const data = await res.json();
      startTransition(() => {
        setSummary((prev) => ({
          ...prev,
          activeStops:     [...prev.activeStops, data.stop],
          activeStopCount: prev.activeStopCount + 1,
          automationPaused: prev.automationPaused || scope === "global",
        }));
      });
      setShowAddStop(false);
    } catch {
      setError("Network error — please try again.");
    }
  }

  async function handleClearStop(stopId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/governance/stops/${stopId}`, { method: "DELETE" });
      if (!res.ok) { setError("Failed to clear stop."); return; }
      startTransition(() => {
        setSummary((prev) => {
          const stops = prev.activeStops.filter((s) => s.id !== stopId);
          return {
            ...prev,
            activeStops:     stops,
            activeStopCount: stops.length,
            automationPaused: stops.some((s) => s.scope === "global"),
          };
        });
      });
    } catch {
      setError("Network error — please try again.");
    }
  }

  // ── Override management ──────────────────────────────────────────────────

  async function handleClearOverride(overrideId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/governance/overrides/${overrideId}`, { method: "DELETE" });
      if (!res.ok) { setError("Failed to clear override."); return; }
      startTransition(() => {
        setSummary((prev) => {
          const overrides = prev.activeOverrides.filter((o) => o.id !== overrideId);
          return { ...prev, activeOverrides: overrides, activeOverrideCount: overrides.length };
        });
      });
    } catch {
      setError("Network error — please try again.");
    }
  }

  // ── Approval queue actions ───────────────────────────────────────────────

  async function postActionStatus(
    actionId: string,
    endpoint: string,
    body:     Record<string, unknown>
  ): Promise<boolean> {
    try {
      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Action failed.");
        return false;
      }
      return true;
    } catch {
      setError("Network error — please try again.");
      return false;
    }
  }

  function removeAction(actionId: string) {
    startTransition(() => setActions((prev) => prev.filter((a) => a.id !== actionId)));
  }

  function updateActionStatus(actionId: string, status: string, extra?: Partial<PendingAction>) {
    startTransition(() =>
      setActions((prev) =>
        prev.map((a) => a.id === actionId ? { ...a, status, ...extra } : a)
      )
    );
  }

  async function handleApprove(actionId: string) {
    setBusyActionId(actionId);
    setError(null);
    const ok = await postActionStatus(actionId, `/api/automation/${actionId}/approve`, {});
    if (ok) removeAction(actionId);
    setBusyActionId(null);
  }

  async function handleReject(actionId: string) {
    setBusyActionId(actionId);
    setError(null);
    const ok = await postActionStatus(actionId, `/api/automation/${actionId}/reject`, {});
    if (ok) removeAction(actionId);
    setBusyActionId(null);
  }

  async function handleDeferConfirm(reason: string) {
    if (!modalConfig) return;
    const { actionId } = modalConfig;
    setBusyActionId(actionId);
    setError(null);
    const ok = await postActionStatus(
      actionId,
      `/api/automation/${actionId}/defer`,
      { reason }
    );
    if (ok) updateActionStatus(actionId, "deferred");
    setBusyActionId(null);
    setModalConfig(null);
  }

  async function handleEscalateConfirm(reason: string) {
    if (!modalConfig) return;
    const { actionId } = modalConfig;
    setBusyActionId(actionId);
    setError(null);
    const ok = await postActionStatus(
      actionId,
      `/api/automation/${actionId}/escalate`,
      { escalationNote: reason }
    );
    if (ok) updateActionStatus(actionId, "escalated", { escalationNote: reason });
    setBusyActionId(null);
    setModalConfig(null);
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const escalatedActions = actions.filter((a) => a.status === "escalated");
  const deferredActions  = actions.filter((a) => a.status === "deferred");
  const proposedActions  = actions.filter((a) => a.status === "proposed");

  return (
    <>
      {/* Defer / escalate modal */}
      {modalConfig && (
        <ActionReasonModal
          title={
            modalConfig.mode === "defer" ? "Defer Action" : "Escalate Action"
          }
          placeholder={
            modalConfig.mode === "defer"
              ? "Reason for deferral…"
              : "Reason for escalation…"
          }
          onConfirm={
            modalConfig.mode === "defer" ? handleDeferConfirm : handleEscalateConfirm
          }
          onCancel={() => setModalConfig(null)}
          busy={busyActionId === modalConfig.actionId}
        />
      )}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-slate-100">
            Governance Controls
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Emergency stops, overrides, approval routing, and operator intervention tools.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-lg border border-rose-800 bg-rose-900/30 px-4 py-3 text-sm text-rose-300">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-rose-500 hover:text-rose-300">×</button>
          </div>
        )}

        {/* Stats row */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { label: "Active Stops",     value: summary.activeStopCount,    color: summary.activeStopCount > 0    ? "text-rose-400"    : "text-slate-200" },
            { label: "Active Overrides", value: summary.activeOverrideCount, color: summary.activeOverrideCount > 0 ? "text-amber-400"  : "text-slate-200" },
            { label: "Escalated",        value: escalatedActions.length,     color: escalatedActions.length > 0    ? "text-rose-300"    : "text-slate-200" },
            { label: "Pending Approval", value: proposedActions.length,      color: "text-blue-400" },
            { label: "Deferred",         value: deferredActions.length,      color: "text-amber-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className={`text-2xl font-semibold ${color}`}>{value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Emergency stop indicator */}
        <div className="mb-5">
          <StopIndicatorBar
            automationPaused={summary.automationPaused}
            stopCount={summary.activeStopCount}
            onPauseAll={() => setShowAddStop(true)}
            disabled={false}
          />
        </div>

        {/* Add stop form */}
        {showAddStop && (
          <div className="mb-5">
            <AddStopForm
              clients={clients}
              onSubmit={handleAddStop}
              onCancel={() => setShowAddStop(false)}
              busy={false}
            />
          </div>
        )}

        {/* Main content — desktop: side-by-side; mobile: stacked */}
        <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
          {/* ── Left panel: stops + overrides ────────────────────────── */}
          <div className="w-full space-y-4 lg:w-80 lg:shrink-0">
            {/* Active stops */}
            <div className="rounded-xl border border-slate-800 bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-300">Emergency Stops</h2>
                <button
                  onClick={() => setShowAddStop(true)}
                  className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-500
                             transition-colors hover:border-slate-500 hover:text-slate-300"
                >
                  + Add
                </button>
              </div>
              <div className="space-y-2 p-3">
                {summary.activeStops.length === 0 ? (
                  <p className="text-xs text-slate-600 py-2 text-center">No active stops.</p>
                ) : (
                  summary.activeStops.map((s) => (
                    <StopCard
                      key={s.id}
                      stop={s}
                      onClear={handleClearStop}
                      clearing={false}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Active overrides */}
            <div className="rounded-xl border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-300">Active Overrides</h2>
              </div>
              <div className="space-y-2 p-3">
                {summary.activeOverrides.length === 0 ? (
                  <p className="text-xs text-slate-600 py-2 text-center">No active overrides.</p>
                ) : (
                  summary.activeOverrides.map((o) => (
                    <OverrideCard
                      key={o.id}
                      override={o}
                      onClear={handleClearOverride}
                      clearing={false}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── Right panel: approval queue ───────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Escalated first */}
            {escalatedActions.length > 0 && (
              <div className="mb-4">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  Escalated — Elevated Review Required
                  <span className="rounded bg-rose-900/40 px-1.5 py-0.5 text-xs">{escalatedActions.length}</span>
                </h2>
                <div className="space-y-3">
                  {escalatedActions.map((a) => (
                    <ActionQueueItem
                      key={a.id}
                      action={a}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onDefer={(id) => setModalConfig({ actionId: id, mode: "defer" })}
                      onEscalate={(id) => setModalConfig({ actionId: id, mode: "escalate" })}
                      busy={busyActionId === a.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pending approvals */}
            <div className="mb-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Pending Approval
                <span className="rounded bg-blue-900/40 px-1.5 py-0.5 text-xs text-blue-300">{proposedActions.length}</span>
              </h2>
              {proposedActions.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
                  <p className="text-sm text-slate-500">No actions pending approval.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {proposedActions.map((a) => (
                    <ActionQueueItem
                      key={a.id}
                      action={a}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onDefer={(id) => setModalConfig({ actionId: id, mode: "defer" })}
                      onEscalate={(id) => setModalConfig({ actionId: id, mode: "escalate" })}
                      busy={busyActionId === a.id}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Deferred */}
            {deferredActions.length > 0 && (
              <div>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Deferred
                  <span className="rounded bg-amber-900/40 px-1.5 py-0.5 text-xs">{deferredActions.length}</span>
                </h2>
                <div className="space-y-3">
                  {deferredActions.map((a) => (
                    <ActionQueueItem
                      key={a.id}
                      action={a}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onDefer={(id) => setModalConfig({ actionId: id, mode: "defer" })}
                      onEscalate={(id) => setModalConfig({ actionId: id, mode: "escalate" })}
                      busy={busyActionId === a.id}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Docs reference */}
        <p className="mt-8 text-xs text-slate-600">
          See{" "}
          <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-400">
            docs/governance-controls.md
          </code>{" "}
          for full documentation on stops, overrides, and approval routing.
        </p>
      </div>
    </>
  );
}
