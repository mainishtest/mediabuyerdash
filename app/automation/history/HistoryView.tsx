"use client";

// app/automation/history/HistoryView.tsx
// Automation Audit Log, Execution History & Rollback Readiness — responsive UI.
//
// Mobile:  stat chips, compact filter row, event cards (expand on tap),
//          rollback badge always visible, action buttons in expanded drawer.
// Desktop: stat bar, left filter panel, right table with clickable rows,
//          side detail panel for selected entry.

import { useState, useMemo } from "react";
import type {
  AutomationAuditEntry,
  AutomationAuditSummary,
  AutomationEventType,
  RollbackReadinessState,
} from "../../../lib/auditLog/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  entries: AutomationAuditEntry[];
  summary: AutomationAuditSummary;
  clients: { id: string; name: string }[];
}

type FilterState = {
  clientId:         string;
  eventType:        string;
  actionType:       string;
  rollbackReadiness: string;
  dateFrom:         string;
  dateTo:           string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_TYPE_LABELS: Record<AutomationEventType, string> = {
  recommended:          "Recommended",
  prepared:             "Prepared",
  approval_requested:   "Approval Requested",
  approved:             "Approved",
  rejected:             "Rejected",
  deferred:             "Deferred",
  blocked:              "Blocked",
  execution_started:    "Execution Started",
  execution_succeeded:  "Execution Succeeded",
  execution_failed:     "Execution Failed",
  rollback_ready:       "Rollback Ready",
  rollback_not_available: "Rollback N/A",
  emergency_stopped:    "Emergency Stopped",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  recommended:          "bg-blue-900/40 text-blue-300 border-blue-800/40",
  prepared:             "bg-blue-900/30 text-blue-400 border-blue-800/30",
  approval_requested:   "bg-amber-900/40 text-amber-300 border-amber-800/40",
  approved:             "bg-emerald-900/40 text-emerald-300 border-emerald-800/40",
  rejected:             "bg-slate-700/50 text-slate-400 border-slate-600/40",
  deferred:             "bg-amber-900/30 text-amber-400 border-amber-800/30",
  blocked:              "bg-rose-900/40 text-rose-300 border-rose-800/40",
  execution_started:    "bg-blue-900/40 text-blue-300 border-blue-800/40",
  execution_succeeded:  "bg-emerald-900/50 text-emerald-300 border-emerald-700/50",
  execution_failed:     "bg-rose-900/50 text-rose-300 border-rose-700/50",
  rollback_ready:       "bg-violet-900/40 text-violet-300 border-violet-800/40",
  rollback_not_available: "bg-slate-700/40 text-slate-500 border-slate-600/30",
  emergency_stopped:    "bg-rose-900/60 text-rose-200 border-rose-700",
};

const ROLLBACK_COLORS: Record<RollbackReadinessState, string> = {
  rollback_available:       "bg-violet-900/40 text-violet-300 border-violet-800/40",
  rollback_unavailable:     "bg-slate-800 text-slate-500 border-slate-700",
  rollback_requires_review: "bg-amber-900/40 text-amber-300 border-amber-800/40",
};

const ROLLBACK_LABELS: Record<RollbackReadinessState, string> = {
  rollback_available:       "Rollback Available",
  rollback_unavailable:     "No Rollback",
  rollback_requires_review: "Rollback: Review Required",
};

const BLOCK_SOURCE_LABELS: Record<string, string> = {
  policy:          "Policy Block",
  governance_stop: "Emergency Stop",
  override:        "Override",
  guardrail:       "Guardrail Block",
  safety_mode:     "Safety Mode",
  unknown:         "Unknown",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month:  "short",
    day:    "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

function fmtActionType(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getUniqueActionTypes(entries: AutomationAuditEntry[]): string[] {
  return Array.from(new Set(entries.map((e) => e.actionType))).sort();
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

function EventTypeBadge({ type }: { type: AutomationEventType }) {
  const cls = EVENT_TYPE_COLORS[type] ?? "bg-slate-700/50 text-slate-400 border-slate-600";
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {EVENT_TYPE_LABELS[type] ?? type}
    </span>
  );
}

function RollbackBadge({ state }: { state: RollbackReadinessState }) {
  const cls   = ROLLBACK_COLORS[state];
  const label = ROLLBACK_LABELS[state];
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${cls}`}>
      {label}
    </span>
  );
}

function SourceBadge({ source }: { source: AutomationAuditEntry["source"] }) {
  if (source === "native") return null;
  return (
    <span className="inline-flex items-center rounded border border-slate-700/50 px-1 py-0.5 text-xs text-slate-600">
      legacy
    </span>
  );
}

// ---------------------------------------------------------------------------
// Summary stat cards
// ---------------------------------------------------------------------------

function SummaryBar({ summary }: { summary: AutomationAuditSummary }) {
  const stats = [
    { label: "Total Events",     value: summary.totalEntries,           color: "text-slate-200" },
    { label: "Succeeded",        value: summary.byEventType?.execution_succeeded ?? 0, color: "text-emerald-400" },
    { label: "Blocked",          value: summary.blockedCount,           color: summary.blockedCount > 0 ? "text-rose-400" : "text-slate-200" },
    { label: "Failed",           value: summary.failedExecutionCount,   color: summary.failedExecutionCount > 0 ? "text-rose-300" : "text-slate-200" },
    { label: "Rollback: Review", value: summary.rollbackReviewCount,    color: summary.rollbackReviewCount > 0 ? "text-amber-400" : "text-slate-200" },
    { label: "Approved",         value: summary.approvedCount,          color: "text-emerald-400" },
  ];

  return (
    <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {stats.map(({ label, value, color }) => (
        <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
          <p className={`text-xl font-semibold ${color}`}>{value}</p>
          <p className="mt-0.5 text-xs text-slate-500">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter bar (compact — used on both mobile and desktop)
// ---------------------------------------------------------------------------

function FilterBar({
  filters,
  clients,
  actionTypes,
  onChange,
  onClear,
}: {
  filters:     FilterState;
  clients:     { id: string; name: string }[];
  actionTypes: string[];
  onChange:    (key: keyof FilterState, value: string) => void;
  onClear:     () => void;
}) {
  const hasFilter =
    filters.clientId || filters.eventType || filters.actionType ||
    filters.rollbackReadiness || filters.dateFrom || filters.dateTo;

  const selectCls =
    "rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 " +
    "focus:outline-none focus:ring-1 focus:ring-blue-600";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {/* Client */}
      <select
        value={filters.clientId}
        onChange={(e) => onChange("clientId", e.target.value)}
        className={selectCls}
      >
        <option value="">All clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {/* Event type */}
      <select
        value={filters.eventType}
        onChange={(e) => onChange("eventType", e.target.value)}
        className={selectCls}
      >
        <option value="">All events</option>
        {(Object.keys(EVENT_TYPE_LABELS) as AutomationEventType[]).map((t) => (
          <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
        ))}
      </select>

      {/* Action type */}
      <select
        value={filters.actionType}
        onChange={(e) => onChange("actionType", e.target.value)}
        className={selectCls}
      >
        <option value="">All actions</option>
        {actionTypes.map((t) => (
          <option key={t} value={t}>{fmtActionType(t)}</option>
        ))}
      </select>

      {/* Rollback readiness */}
      <select
        value={filters.rollbackReadiness}
        onChange={(e) => onChange("rollbackReadiness", e.target.value)}
        className={selectCls}
      >
        <option value="">Any rollback state</option>
        <option value="rollback_available">Available</option>
        <option value="rollback_unavailable">Unavailable</option>
        <option value="rollback_requires_review">Requires Review</option>
      </select>

      {/* Date range */}
      <input
        type="date"
        value={filters.dateFrom}
        onChange={(e) => onChange("dateFrom", e.target.value)}
        className={selectCls}
        title="From date"
      />
      <input
        type="date"
        value={filters.dateTo}
        onChange={(e) => onChange("dateTo", e.target.value)}
        className={selectCls}
        title="To date"
      />

      {/* Clear */}
      {hasFilter && (
        <button
          onClick={onClear}
          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-500
                     transition-colors hover:border-slate-500 hover:text-slate-300"
        >
          Clear
        </button>
      )}

      {/* Active filter indicator */}
      {hasFilter && (
        <span className="rounded border border-blue-800/40 bg-blue-900/20 px-2 py-0.5 text-xs text-blue-400">
          Filtered
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event detail panel (shown on mobile expand + desktop side panel)
// ---------------------------------------------------------------------------

function EntryDetail({
  entry,
  onClose,
}: {
  entry:   AutomationAuditEntry;
  onClose?: () => void;
}) {
  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <EventTypeBadge type={entry.eventType} />
            <span className="rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-400">
              {fmtActionType(entry.actionType)}
            </span>
            <SourceBadge source={entry.source} />
          </div>
          <p className="mt-1.5 text-sm font-medium text-slate-200">
            {entry.scope.entityName}
          </p>
          <p className="text-xs text-slate-500">
            {entry.scope.entityType}
            {entry.clientName ? ` · ${entry.clientName}` : ""}
            {" · "}
            {fmtDate(entry.occurredAt)}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          >
            ✕
          </button>
        )}
      </div>

      {/* Actor */}
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Actor</p>
        <p className="text-xs text-slate-300">
          {entry.actor.label}
          {" "}
          <span className="text-slate-600">({entry.actor.type})</span>
        </p>
      </div>

      {/* Notes / rationale */}
      {entry.notes && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Rationale</p>
          <p className="text-xs text-slate-400 leading-relaxed">{entry.notes}</p>
        </div>
      )}

      {/* Policy decision */}
      {(entry.policyDecision || entry.policyReason) && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Policy Decision</p>
          <div className="flex flex-wrap gap-2">
            {entry.policyDecision && (
              <span className="rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
                {entry.policyDecision}
              </span>
            )}
            {entry.policyReason && (
              <span className="text-xs text-slate-400">{entry.policyReason.replace(/_/g, " ")}</span>
            )}
          </div>
        </div>
      )}

      {/* Approval */}
      {entry.approval && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Approval</p>
          <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-2.5 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">State:</span>
              <span className="text-xs font-medium text-slate-200">
                {entry.approval.approvalState}
              </span>
              {entry.approval.routeType && (
                <span className="rounded border border-slate-700 px-1 py-0.5 text-xs text-slate-500">
                  {entry.approval.routeType.replace(/_/g, " ")}
                </span>
              )}
            </div>
            {entry.approval.reason && (
              <p className="text-xs text-slate-400">{entry.approval.reason}</p>
            )}
            {entry.approval.decidedAt && (
              <p className="text-xs text-slate-600">
                Decided {fmtDate(entry.approval.decidedAt)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Execution */}
      {entry.execution && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Execution</p>
          <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-2.5 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${
                entry.execution.status === "success"
                  ? "border-emerald-700 text-emerald-300"
                  : entry.execution.status === "failed"
                  ? "border-rose-700 text-rose-300"
                  : "border-amber-700 text-amber-300"
              }`}>
                {entry.execution.status}
              </span>
              {entry.execution.durationMs != null && (
                <span className="text-xs text-slate-500">
                  {entry.execution.durationMs}ms
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">{entry.execution.decisionReason}</p>
            {entry.execution.errorMessage && (
              <p className="mt-1 rounded bg-rose-900/20 px-2 py-1 text-xs text-rose-300">
                {entry.execution.errorMessage}
              </p>
            )}
            {/* Guardrail results */}
            {entry.execution.guardrailResults.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-slate-600">Guardrails:</p>
                {entry.execution.guardrailResults.map((g, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${g.passed ? "bg-emerald-500" : "bg-rose-500"}`} />
                    <span className="text-xs text-slate-400">{g.name}: {g.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Block */}
      {entry.block && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Block Reason</p>
          <div className="rounded-lg border border-rose-800/40 bg-rose-900/10 p-2.5 space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded border border-rose-800/50 px-1.5 py-0.5 text-xs text-rose-300">
                {BLOCK_SOURCE_LABELS[entry.block.source] ?? entry.block.source}
              </span>
            </div>
            <p className="text-xs text-slate-300">{entry.block.reason}</p>
            {entry.block.policyReason && (
              <p className="text-xs text-slate-500">{entry.block.policyReason.replace(/_/g, " ")}</p>
            )}
          </div>
        </div>
      )}

      {/* Rollback readiness */}
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Rollback Readiness</p>
        <RollbackBadge state={entry.rollback.state} />
        {entry.rollback.notes && (
          <p className="mt-1 text-xs text-slate-500">{entry.rollback.notes}</p>
        )}
        {entry.rollback.blockers.length > 0 && (
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            {entry.rollback.blockers.map((b, i) => (
              <li key={i} className="text-xs text-slate-500">{b}</li>
            ))}
          </ul>
        )}
        {entry.rollback.preview && (
          <div className="mt-2 rounded-lg border border-amber-800/40 bg-amber-900/10 p-2.5 space-y-1">
            <p className="text-xs font-medium text-amber-300">
              Rollback Preview: {fmtActionType(entry.rollback.preview.actionType)}
            </p>
            <p className="text-xs text-slate-400">{entry.rollback.preview.description}</p>
            <p className="text-xs text-slate-500">Target: {entry.rollback.preview.targetEntity}</p>
            {entry.rollback.preview.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-400/70">⚠ {w}</p>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
        {entry.relatedActionId && (
          <a
            href={`/automation/governance`}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400
                       transition-colors hover:border-slate-500 hover:text-slate-200"
          >
            Open Approval
          </a>
        )}
        {entry.scope.entityType === "campaign" && entry.scope.entityId && (
          <a
            href={`/operations`}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400
                       transition-colors hover:border-slate-500 hover:text-slate-200"
          >
            Open Campaign
          </a>
        )}
        {entry.relatedExecutionLogId && (
          <a
            href={`/automation/auto-execution`}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400
                       transition-colors hover:border-slate-500 hover:text-slate-200"
          >
            Open Execution Log
          </a>
        )}
        <a
          href={`/automation/policies`}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400
                     transition-colors hover:border-slate-500 hover:text-slate-200"
        >
          View Policy
        </a>
        {entry.rollback.state === "rollback_requires_review" && (
          <button
            className="rounded-lg border border-amber-700/60 bg-amber-900/20 px-3 py-1.5 text-xs
                       text-amber-300 transition-colors hover:bg-amber-900/40"
            onClick={() => alert("View Rollback Preview — Rollback orchestration is planned for a future phase. Create an opposing action via the Automation queue.")}
          >
            View Rollback Preview
          </button>
        )}
        <button
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400
                     transition-colors hover:border-slate-500 hover:text-slate-200"
          onClick={() => alert("This entry has been flagged for manual review. Check the Governance queue.")}
        >
          Send for Review
        </button>
      </div>

      {/* IDs (for debugging / support) */}
      <div className="space-y-0.5 border-t border-slate-800 pt-2">
        <p className="text-xs text-slate-700">
          Entry: <code className="text-slate-600">{entry.id}</code>
        </p>
        {entry.relatedActionId && (
          <p className="text-xs text-slate-700">
            Action: <code className="text-slate-600">{entry.relatedActionId}</code>
          </p>
        )}
        {entry.relatedExecutionLogId && (
          <p className="text-xs text-slate-700">
            Exec log: <code className="text-slate-600">{entry.relatedExecutionLogId}</code>
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile event card
// ---------------------------------------------------------------------------

function MobileEventCard({ entry }: { entry: AutomationAuditEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-xl border bg-slate-900 transition-colors ${
        expanded ? "border-slate-700" : "border-slate-800"
      }`}
    >
      {/* Summary row — always visible */}
      <button
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {/* Left: event + action */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <EventTypeBadge type={entry.eventType} />
            <span className="text-xs text-slate-500">{fmtActionType(entry.actionType)}</span>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-slate-200">
            {entry.scope.entityName}
          </p>
          <p className="text-xs text-slate-500">
            {entry.clientName ?? "—"}
            {" · "}
            {fmtDate(entry.occurredAt)}
          </p>
        </div>
        {/* Right: rollback badge + chevron */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <RollbackBadge state={entry.rollback.state} />
          <svg
            className={`h-4 w-4 text-slate-600 transition-transform ${expanded ? "rotate-180" : ""}`}
            viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-800">
          <EntryDetail entry={entry} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop table row
// ---------------------------------------------------------------------------

function DesktopTableRow({
  entry,
  selected,
  onSelect,
}: {
  entry:    AutomationAuditEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b border-slate-800 transition-colors ${
        selected ? "bg-slate-800/70" : "hover:bg-slate-800/40"
      }`}
    >
      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
        {fmtDate(entry.occurredAt)}
      </td>
      <td className="px-4 py-3">
        <EventTypeBadge type={entry.eventType} />
      </td>
      <td className="px-4 py-3">
        <span className="rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
          {fmtActionType(entry.actionType)}
        </span>
      </td>
      <td className="max-w-[180px] px-4 py-3">
        <p className="truncate text-xs text-slate-200">{entry.scope.entityName}</p>
        <p className="truncate text-xs text-slate-600">{entry.scope.entityType}</p>
      </td>
      <td className="max-w-[120px] px-4 py-3 text-xs text-slate-400 truncate">
        {entry.clientName ?? "—"}
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">
        {entry.actor.label}
      </td>
      <td className="px-4 py-3">
        <RollbackBadge state={entry.rollback.state} />
      </td>
      <td className="px-4 py-3">
        {entry.source !== "native" && <SourceBadge source={entry.source} />}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
      <p className="text-sm text-slate-400">
        {filtered ? "No events match the current filters." : "No automation activity recorded yet."}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {filtered
          ? "Try clearing some filters to see more results."
          : "Automation events will appear here once rules run and actions are processed."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function HistoryView({ entries, summary, clients }: Props) {
  const [filters, setFilters] = useState<FilterState>({
    clientId:         "",
    eventType:        "",
    actionType:       "",
    rollbackReadiness: "",
    dateFrom:         "",
    dateTo:           "",
  });
  const [selectedEntry, setSelectedEntry] = useState<AutomationAuditEntry | null>(null);

  const actionTypes = useMemo(() => getUniqueActionTypes(entries), [entries]);

  // Client-side filtering (data already loaded server-side)
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filters.clientId && e.clientAccountId !== filters.clientId && e.scope.clientId !== filters.clientId) return false;
      if (filters.eventType && e.eventType !== filters.eventType) return false;
      if (filters.actionType && e.actionType !== filters.actionType) return false;
      if (filters.rollbackReadiness && e.rollback.state !== filters.rollbackReadiness) return false;
      if (filters.dateFrom && new Date(e.occurredAt) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setDate(to.getDate() + 1);
        if (new Date(e.occurredAt) > to) return false;
      }
      return true;
    });
  }, [entries, filters]);

  const hasFilter = Object.values(filters).some(Boolean);

  function handleFilterChange(key: keyof FilterState, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setSelectedEntry(null);
  }

  function handleClearFilters() {
    setFilters({ clientId: "", eventType: "", actionType: "", rollbackReadiness: "", dateFrom: "", dateTo: "" });
    setSelectedEntry(null);
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-100">Audit History</h1>
        <p className="mt-1 text-sm text-slate-400">
          Automation activity, execution history, approval records, and rollback readiness.
          Showing {filtered.length} of {entries.length} events.
        </p>
      </div>

      {/* Summary stats */}
      <SummaryBar summary={summary} />

      {/* Filters */}
      <FilterBar
        filters={filters}
        clients={clients}
        actionTypes={actionTypes}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      {/* ── Mobile: stacked cards ──────────────────────────────────────── */}
      <div className="space-y-2 lg:hidden">
        {filtered.length === 0 ? (
          <EmptyState filtered={hasFilter} />
        ) : (
          filtered.map((entry) => (
            <MobileEventCard key={entry.id} entry={entry} />
          ))
        )}
      </div>

      {/* ── Desktop: table + side panel ───────────────────────────────── */}
      <div className="hidden lg:flex lg:gap-5">
        {/* Main table */}
        <div className={`flex-1 min-w-0 overflow-hidden rounded-xl border border-slate-800 ${
          selectedEntry ? "lg:w-[calc(100%-400px)]" : ""
        }`}>
          {filtered.length === 0 ? (
            <EmptyState filtered={hasFilter} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80">
                    {["Time", "Event", "Action", "Entity", "Client", "Actor", "Rollback", ""].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-slate-900">
                  {filtered.map((entry) => (
                    <DesktopTableRow
                      key={entry.id}
                      entry={entry}
                      selected={selectedEntry?.id === entry.id}
                      onSelect={() =>
                        setSelectedEntry((prev) =>
                          prev?.id === entry.id ? null : entry
                        )
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Side detail panel */}
        {selectedEntry && (
          <div className="w-[380px] shrink-0 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900">
            <EntryDetail
              entry={selectedEntry}
              onClose={() => setSelectedEntry(null)}
            />
          </div>
        )}
      </div>

      {/* Rollback notice */}
      <p className="mt-8 text-xs text-slate-600">
        Rollback orchestration is visibility-only in this phase. Entries marked{" "}
        <span className="text-amber-400">Rollback: Review Required</span> need a new
        opposing action to be created and approved manually.{" "}
        See{" "}
        <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-500">
          docs/automation-audit-log.md
        </code>{" "}
        for full documentation.
      </p>
    </div>
  );
}
