"use client";

// TimelineFilters — filter controls for action history timeline.

import type { ActionHistoryFilterState } from "../../../types/actionHistory";

type Props = {
  filters:     ActionHistoryFilterState;
  clients:     { id: string; name: string }[];
  onChange:    (f: ActionHistoryFilterState) => void;
  onReset:    () => void;
};

const EVENT_TYPE_OPTIONS = [
  { value: "",                          label: "All events" },
  { value: "approval_granted",          label: "Approvals" },
  { value: "approval_rejected",         label: "Rejections" },
  { value: "scale_plan_created",        label: "Scale plans" },
  { value: "scale_executed",            label: "Scale executed" },
  { value: "test_created",             label: "Tests created" },
  { value: "test_launched",            label: "Tests launched" },
  { value: "creative_refresh_sent",    label: "Creative refresh" },
  { value: "image_generation_completed", label: "Image generation" },
  { value: "outcome_routed",           label: "Outcome routed" },
  { value: "execution_succeeded",      label: "Execution success" },
  { value: "execution_failed",         label: "Execution failed" },
  { value: "action_blocked",           label: "Blocked" },
  { value: "recommendation_created",   label: "Recommendations" },
];

const STATUS_OPTIONS = [
  { value: "",          label: "All statuses" },
  { value: "success",   label: "Success" },
  { value: "failed",    label: "Failed" },
  { value: "blocked",   label: "Blocked" },
  { value: "pending",   label: "Pending" },
  { value: "skipped",   label: "Skipped" },
];

const selectClass = `rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5
  text-sm text-slate-300 transition-colors hover:border-slate-600
  focus:border-emerald-600 focus:outline-none`;

const inputClass = `rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5
  text-sm text-slate-300 transition-colors hover:border-slate-600
  focus:border-emerald-600 focus:outline-none`;

export function TimelineFilters({ filters, clients, onChange, onReset }: Props) {
  const hasFilters = filters.clientId || filters.eventType || filters.status || filters.dateFrom || filters.dateTo;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Client */}
      <select
        value={filters.clientId}
        onChange={(e) => onChange({ ...filters, clientId: e.target.value })}
        className={selectClass}
      >
        <option value="">All clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {/* Event type */}
      <select
        value={filters.eventType}
        onChange={(e) => onChange({ ...filters, eventType: e.target.value as any })}
        className={selectClass}
      >
        {EVENT_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Status */}
      <select
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value as any })}
        className={selectClass}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Date from */}
      <input
        type="date"
        value={filters.dateFrom}
        onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
        className={inputClass}
        placeholder="From"
      />

      {/* Date to */}
      <input
        type="date"
        value={filters.dateTo}
        onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
        className={inputClass}
        placeholder="To"
      />

      {/* Reset */}
      {hasFilters && (
        <button
          onClick={onReset}
          className="rounded-lg px-3 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
        >
          Reset
        </button>
      )}
    </div>
  );
}
