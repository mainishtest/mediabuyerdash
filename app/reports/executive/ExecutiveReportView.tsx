"use client";

import { useState }                        from "react";
import { useRouter, useSearchParams }       from "next/navigation";
import type { ExecutiveSummary }            from "../../../lib/executiveReporting/types";
import { KpiSection }         from "./sections/KpiSection";
import { NarrativeSection }   from "./sections/NarrativeSection";
import { TrendSection }       from "./sections/TrendSection";
import { ExperimentsSection } from "./sections/ExperimentsSection";
import { CreativeSection }    from "./sections/CreativeSection";
import { ApprovalsSection }   from "./sections/ApprovalsSection";
import { ImpactSection }      from "./sections/ImpactSection";

// ── Filter bar ────────────────────────────────────────────────────────────────

// ── Quick range helpers ──────────────────────────────────────────────────────

type QuickRange = { label: string; days: number };

const QUICK_RANGES: QuickRange[] = [
  { label: "Today",  days: 0 },
  { label: "3 Day",  days: 3 },
  { label: "7 Day",  days: 7 },
  { label: "30 Day", days: 30 },
];

function daysAgoStr(n: number): string {
  return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
}

function FilterBar({
  summary,
  onNavigate,
}: {
  summary:    ExecutiveSummary;
  onNavigate: (params: Record<string, string>) => void;
}) {
  const [dateFrom,  setDateFrom]  = useState(summary.dateRange.from);
  const [dateTo,    setDateTo]    = useState(summary.dateRange.to);
  const [clientId,  setClientId]  = useState(summary.clientId ?? "");
  const [compare,   setCompare]   = useState(!!summary.comparisonRange);

  function buildParams(from: string, to: string): Record<string, string> {
    const params: Record<string, string> = { from, to };
    if (clientId) params.clientId = clientId;
    if (compare)  params.compare  = "1";
    return params;
  }

  function apply() {
    onNavigate(buildParams(dateFrom, dateTo));
  }

  function applyQuickRange(days: number) {
    const to   = daysAgoStr(0);
    const from = daysAgoStr(days);
    setDateFrom(from);
    setDateTo(to);
    onNavigate(buildParams(from, to));
  }

  const inputCls =
    "rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 " +
    "outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors";

  // Detect which quick range is currently active (if any)
  const today = daysAgoStr(0);
  const activeQuickDays = QUICK_RANGES.find(
    (r) => dateTo === today && dateFrom === daysAgoStr(r.days)
  )?.days;

  return (
    <div className="flex flex-wrap items-end gap-2">
      {/* Quick range buttons — auto-apply on click */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-slate-500">Quick Range</span>
        <div className="flex gap-1">
          {QUICK_RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => applyQuickRange(r.days)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeQuickDays === r.days
                  ? "border-emerald-700 bg-emerald-900/50 text-emerald-300"
                  : "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Client */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Client</label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className={inputCls}
          aria-label="Filter by client"
        >
          <option value="">All clients</option>
          {summary.clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Date from */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">From</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className={inputCls}
          aria-label="Date from"
        />
      </div>

      {/* Date to */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">To</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className={inputCls}
          aria-label="Date to"
        />
      </div>

      {/* Compare toggle */}
      <label className="flex cursor-pointer items-center gap-2 pb-1.5">
        <input
          type="checkbox"
          checked={compare}
          onChange={(e) => setCompare(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 accent-emerald-500"
        />
        <span className="text-xs text-slate-400">Compare to prior period</span>
      </label>

      {/* Apply — for custom date ranges */}
      <button
        onClick={apply}
        className="rounded-lg border border-emerald-700 bg-emerald-900/40 px-4 py-1.5 text-xs
                   font-medium text-emerald-300 transition-colors hover:bg-emerald-900/60 pb-1.5"
      >
        Apply
      </button>
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────

function ReportSection({
  title,
  description,
  children,
}: {
  title?:       string;
  description?: string;
  children:     React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60">
      {(title || description) && (
        <div className="border-b border-slate-800/60 px-5 py-4">
          {title && <h2 className="text-sm font-semibold text-white">{title}</h2>}
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── No data state ─────────────────────────────────────────────────────────────

function NoDataState({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-6 py-12 text-center">
      <p className="text-3xl">◈</p>
      <p className="mt-3 text-sm font-medium text-slate-300">No data for this period</p>
      <p className="mt-1 text-xs text-slate-500">
        Adjust the date range or ensure Meta sync and reconciliation have run for this client.
      </p>
      {warnings.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs text-amber-400">
          {warnings.map((w) => <li key={w}>· {w}</li>)}
        </ul>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function ExecutiveReportView({ summary }: { summary: ExecutiveSummary }) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString());
    // Clear existing filter params before applying new ones
    ["clientId", "campaignId", "from", "to", "compare"].forEach((k) => sp.delete(k));
    Object.entries(params).forEach(([k, v]) => sp.set(k, v));
    router.push(`/reports/executive?${sp.toString()}`);
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Page header */}
      <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-screen-xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Phase 4 · Executive Reporting
              </p>
              <h1 className="mt-0.5 text-lg font-semibold text-white">
                {summary.clientName ? `${summary.clientName} — Executive Report` : "Executive Report"}
              </h1>
            </div>
            <p className="text-xs text-slate-600">
              {summary.dateRange.from} – {summary.dateRange.to}
              {summary.comparisonRange && (
                <span className="ml-2 text-slate-700">
                  vs {summary.comparisonRange.from} – {summary.comparisonRange.to}
                </span>
              )}
            </p>
          </div>
          <FilterBar summary={summary} onNavigate={navigate} />
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-screen-xl space-y-5 px-4 py-5 sm:px-6">

        {/* KPI cards — always shown */}
        <KpiSection cards={summary.kpiCards} />

        {/* Narrative — always shown, mobile-first */}
        <NarrativeSection narrative={summary.narrative} />

        {/* No data fallback below narrative */}
        {!summary.hasData ? (
          <NoDataState warnings={summary.impact.dataWarnings} />
        ) : (
          <>
            {/* Trend charts */}
            <ReportSection
              title="Performance Trend"
              description={`${summary.dateRange.from} to ${summary.dateRange.to} · CRM source of truth · 7-day attribution`}
            >
              <TrendSection trend={summary.trend} />
            </ReportSection>

            {/* Experiments + Creative — desktop 2-col */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <ReportSection
                title="Experiments & Test Outcomes"
                description="Active tests, declared winners, and recommended actions"
              >
                <ExperimentsSection experiments={summary.experiments} />
              </ReportSection>

              <ReportSection
                title="Creative Refresh & Launch Activity"
                description="Briefs created, variants generated, approved, and launched"
              >
                <CreativeSection creative={summary.creative} />
              </ReportSection>
            </div>

            {/* Approvals + Impact — desktop 2-col */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <ReportSection
                title="Approval & Workflow Status"
                description="Automation proposals proposed, approved, rejected, and executed"
              >
                <ApprovalsSection approvals={summary.approvals} />
              </ReportSection>

              <ReportSection
                title="Risk & Operational Impact"
                description="Alerts, pacing, auto-executions, and data quality notices"
              >
                <ImpactSection impact={summary.impact} />
              </ReportSection>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 text-center">
          <p className="text-xs text-slate-700">
            Generated {new Date(summary.generatedAt).toLocaleString("en-US", {
              month: "short", day: "numeric", year: "numeric",
              hour: "numeric", minute: "2-digit",
            })} · CRM revenue uses 7-day attribution window · Meta is source of truth for delivery
          </p>
        </div>
      </div>
    </div>
  );
}
