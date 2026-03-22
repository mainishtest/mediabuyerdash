"use client";
// app/alerts/AlertsView.tsx
// Alerts page — severity cards, filters, and alert list.
//
// All filtering is client-side (alerts are loaded server-side).
// Acknowledge/Resolve call API routes and optimistically update UI.
//
// Mobile:  stacked cards, severity badge prominent, large tap targets
// Desktop: richer card list with inline metadata columns

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import type { AlertEventRow, AlertSummary, AlertType, AlertSeverity, AlertStatus } from "../../lib/alerts/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  roas_drop:                  "ROAS Drop",
  cpa_spike:                  "CPA Spike",
  spend_drop:                 "Spend Drop",
  spend_spike:                "Spend Spike",
  stale_sync:                 "Stale Sync",
  no_data:                    "No Data",
  campaign_below_goal:        "Below Goal",
  campaign_above_goal:        "Above Goal",
  integration_failure:        "Integration Failure",
  // Proactive triggers
  scale_ready:                "Scale Ready",
  winner_detected:            "Winner Detected",
  loser_detected:             "Loser Detected",
  creative_fatigue_detected:  "Creative Fatigue",
  follow_up_test_needed:      "Follow-Up Test",
  action_blocked:             "Action Blocked",
  trust_state_warning:        "Trust Warning",
  sync_health_issue:          "Sync Issue",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function severityBorder(s: AlertSeverity) {
  if (s === "high")   return "border-l-rose-500";
  if (s === "medium") return "border-l-amber-500";
  return "border-l-slate-600";
}

function severityBadge(s: AlertSeverity) {
  if (s === "high")   return "bg-rose-900/60 text-rose-300";
  if (s === "medium") return "bg-amber-900/60 text-amber-300";
  return "bg-slate-800 text-slate-400";
}

function statusBadge(s: AlertStatus) {
  if (s === "open")         return "bg-rose-900/40 text-rose-300";
  if (s === "acknowledged") return "bg-amber-900/40 text-amber-300";
  return "bg-emerald-900/40 text-emerald-400";
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

// ── Summary cards ─────────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: AlertSummary }) {
  const cards = [
    { label: "Open",         value: summary.openCount,         color: summary.openCount > 0 ? "text-rose-400" : "text-slate-200" },
    { label: "High Severity",value: summary.highSeverityCount, color: summary.highSeverityCount > 0 ? "text-rose-400" : "text-slate-200" },
    { label: "Acknowledged", value: summary.acknowledgedCount, color: summary.acknowledgedCount > 0 ? "text-amber-400" : "text-slate-200" },
    { label: "Resolved",     value: summary.resolvedCount,     color: "text-emerald-400" },
  ];

  return (
    <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-500">{c.label}</p>
          <p className={`mt-1 text-2xl font-semibold ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

type Filters = {
  clientId:  string;
  alertType: string;
  severity:  string;
  status:    string;
};

function FilterBar({
  filters,
  onChange,
  clients,
}: {
  filters:  Filters;
  onChange: (f: Filters) => void;
  clients:  { id: string; name: string }[];
}) {
  const SEL = "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500 w-full";

  const set = (key: keyof Filters, val: string) =>
    onChange({ ...filters, [key]: val });

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <select className={SEL} value={filters.clientId} onChange={(e) => set("clientId", e.target.value)}>
        <option value="">All Clients</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      <select className={SEL} value={filters.alertType} onChange={(e) => set("alertType", e.target.value)}>
        <option value="">All Types</option>
        {(Object.keys(ALERT_TYPE_LABELS) as AlertType[]).map((t) => (
          <option key={t} value={t}>{ALERT_TYPE_LABELS[t]}</option>
        ))}
      </select>

      <select className={SEL} value={filters.severity} onChange={(e) => set("severity", e.target.value)}>
        <option value="">All Severities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      <select className={SEL} value={filters.status} onChange={(e) => set("status", e.target.value)}>
        <option value="">All Statuses</option>
        <option value="open">Open</option>
        <option value="acknowledged">Acknowledged</option>
        <option value="resolved">Resolved</option>
      </select>
    </div>
  );
}

// ── Contextual action buttons ─────────────────────────────────────────────────

type ActionButton = {
  label:   string;
  href:    string;
  variant: "indigo" | "slate" | "rose";
};

function getAlertActions(alert: AlertEventRow): ActionButton[] {
  const cid          = encodeURIComponent(alert.clientAccountId);
  const optUrl       = `/optimization?clientId=${cid}`;
  const creativeUrl  = `/creative-lab/generate?clientId=${cid}`;
  const integUrl     = `/clients/${alert.clientAccountId}/integrations`;

  switch (alert.alertType) {
    case "campaign_above_goal":
      return [
        { label: "Scale Campaign →",    href: optUrl,      variant: "indigo" },
      ];

    case "roas_drop":
    case "cpa_spike":
    case "campaign_below_goal":
      return [
        { label: "Lower Spend →",       href: optUrl,      variant: "slate"  },
        { label: "Adjust Creative →",   href: creativeUrl, variant: "indigo" },
        { label: "Pause Campaign →",    href: optUrl,      variant: "rose"   },
      ];

    case "spend_spike":
      return [
        { label: "Review Spend →",      href: optUrl,      variant: "slate"  },
        { label: "Pause Campaign →",    href: optUrl,      variant: "rose"   },
      ];

    case "spend_drop":
      return [
        { label: "Review Campaign →",   href: optUrl,      variant: "slate"  },
        { label: "Adjust Creative →",   href: creativeUrl, variant: "indigo" },
      ];

    case "stale_sync":
    case "no_data":
    case "integration_failure":
      return [
        { label: "Fix Integration →",   href: integUrl,    variant: "indigo" },
      ];

    default:
      return [
        { label: "View in Optimization →", href: optUrl,   variant: "slate"  },
      ];
  }
}

const ACTION_CLS: Record<ActionButton["variant"], string> = {
  indigo: "border border-indigo-700 bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900/60 hover:text-indigo-200",
  slate:  "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700",
  rose:   "border border-rose-800 bg-rose-950/60 text-rose-300 hover:bg-rose-900/50",
};

// ── Alert card ────────────────────────────────────────────────────────────────

function AlertCard({
  alert,
  onAcknowledge,
  onResolve,
  isPending,
}: {
  alert:         AlertEventRow;
  onAcknowledge: (id: string) => void;
  onResolve:     (id: string) => void;
  isPending:     boolean;
}) {
  const metrics = Object.entries(alert.supportingMetrics);

  return (
    <div className={`border-l-4 ${severityBorder(alert.severity)} rounded-r-xl border border-l-0 border-slate-800 bg-slate-900/40 p-4`}>
      {/* Top row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${severityBadge(alert.severity)}`}>
            {alert.severity}
          </span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
            {ALERT_TYPE_LABELS[alert.alertType] ?? alert.alertType}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(alert.status)}`}>
            {alert.status}
          </span>
        </div>
        <span className="text-xs text-slate-600 shrink-0">{alert.clientName}</span>
      </div>

      {/* Summary */}
      <p className="mt-2 text-sm text-slate-200">{alert.summary}</p>

      {/* Entity + time */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>{alert.entityName}</span>
        <span className="text-slate-700">·</span>
        <span>Detected {fmtTime(alert.lastDetectedAt)}</span>
      </div>

      {/* Supporting metrics */}
      {metrics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {metrics.map(([k, v]) => (
            <span key={k} className="text-xs text-slate-500">
              <span className="text-slate-600">{k}:</span> {String(v)}
            </span>
          ))}
        </div>
      )}

      {/* Contextual action buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        {getAlertActions(alert).map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors active:scale-95 ${ACTION_CLS[action.variant]}`}
          >
            {action.label}
          </Link>
        ))}
      </div>

      {/* Status actions */}
      {alert.status !== "resolved" && (
        <div className="mt-2 flex flex-wrap gap-2">
          {alert.status === "open" && (
            <button
              disabled={isPending}
              onClick={() => onAcknowledge(alert.id)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50 active:scale-95"
            >
              Acknowledge
            </button>
          )}
          <button
            disabled={isPending}
            onClick={() => onResolve(alert.id)}
            className="rounded-lg border border-emerald-800 bg-emerald-900/30 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-900/50 disabled:opacity-50 active:scale-95"
          >
            Resolve
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  alerts:   AlertEventRow[];
  summary:  AlertSummary;
  clients:  { id: string; name: string }[];
};

export function AlertsView({ alerts: initialAlerts, summary: initialSummary, clients }: Props) {
  const [alerts, setAlerts]   = useState<AlertEventRow[]>(initialAlerts);
  const [filters, setFilters] = useState<Filters>({ clientId: "", alertType: "", severity: "", status: "open" });
  const [isPending, startTransition] = useTransition();

  const summary = useMemo(() => {
    const open = alerts.filter((a) => a.status === "open").length;
    const high = alerts.filter((a) => a.severity === "high" && a.status !== "resolved").length;
    const ack  = alerts.filter((a) => a.status === "acknowledged").length;
    const res  = alerts.filter((a) => a.status === "resolved").length;
    return { openCount: open, highSeverityCount: high, acknowledgedCount: ack, resolvedCount: res, totalCount: alerts.length };
  }, [alerts]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (filters.clientId  && a.clientAccountId !== filters.clientId)      return false;
      if (filters.alertType && a.alertType        !== filters.alertType)     return false;
      if (filters.severity  && a.severity          !== filters.severity)     return false;
      if (filters.status    && a.status            !== filters.status)       return false;
      return true;
    });
  }, [alerts, filters]);

  function handleAcknowledge(id: string) {
    startTransition(async () => {
      await fetch(`/api/alerts/${id}/acknowledge`, { method: "POST" });
      setAlerts((prev) => prev.map((a) =>
        a.id === id ? { ...a, status: "acknowledged" as const, acknowledgedAt: new Date().toISOString() } : a
      ));
    });
  }

  function handleResolve(id: string) {
    startTransition(async () => {
      await fetch(`/api/alerts/${id}/resolve`, { method: "POST" });
      setAlerts((prev) => prev.map((a) =>
        a.id === id ? { ...a, status: "resolved" as const, resolvedAt: new Date().toISOString() } : a
      ));
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Alerts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Anomaly detection across all clients — ROAS, CPA, spend patterns, sync health, and goal adherence.
        </p>
      </div>

      {/* Summary cards */}
      <SummaryCards summary={summary} />

      {/* Filters */}
      <FilterBar filters={filters} onChange={setFilters} clients={clients} />

      {/* Alert list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-6 py-14 text-center">
          <p className="text-2xl text-slate-700 mb-3">○</p>
          <p className="text-sm font-medium text-slate-300">
            {summary.totalCount === 0
              ? "No alerts detected yet"
              : "No alerts match the current filters"}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            {summary.totalCount === 0
              ? "Alerts are generated when anomalies are detected in your campaign data."
              : "Try changing the filters above to see other alerts."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
              isPending={isPending}
            />
          ))}
          <p className="pt-2 text-center text-xs text-slate-600">
            Showing {filtered.length} of {alerts.length} alerts
          </p>
        </div>
      )}
    </div>
  );
}
