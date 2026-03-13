"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type {
  ReconciliationResult,
  ReconciliationStatus,
  ReconciliationSummary
} from "../../types/crm";
import { formatCurrency, formatRoas } from "../../lib/metricUtils";

// --- Style constants ---------------------------------------------------------

const TH = "px-3 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400 whitespace-nowrap";
const TD = "px-3 py-3 text-sm text-slate-300 whitespace-nowrap";

// --- Status badge helpers -----------------------------------------------------

const STATUS_STYLES: Record<ReconciliationStatus, string> = {
  matched:      "bg-emerald-900/60 text-emerald-300",
  partial:      "bg-amber-900/60 text-amber-300",
  mismatch:     "bg-rose-900/60 text-rose-300",
  missing_crm:  "bg-orange-900/60 text-orange-300",
  missing_meta: "bg-slate-800 text-slate-400"
};

const STATUS_LABELS: Record<ReconciliationStatus, string> = {
  matched:      "Matched",
  partial:      "Partial",
  mismatch:     "Mismatch",
  missing_crm:  "Missing CRM",
  missing_meta: "Missing Meta"
};

function StatusBadge({ status }: { status: ReconciliationStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// --- Summary stat card -------------------------------------------------------

function StatCard({
  label,
  value,
  colorClass = "text-slate-50"
}: {
  label: string;
  value: string | number;
  colorClass?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${colorClass}`}>{value}</p>
    </div>
  );
}

// --- Status breakdown cards --------------------------------------------------

function StatusBreakdown({ summary }: { summary: ReconciliationSummary }) {
  const items: { status: ReconciliationStatus; count: number }[] = [
    { status: "matched",      count: summary.matched },
    { status: "partial",      count: summary.partial },
    { status: "mismatch",     count: summary.mismatch },
    { status: "missing_crm",  count: summary.missing_crm },
    { status: "missing_meta", count: summary.missing_meta }
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ status, count }) => (
        <div
          key={status}
          className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
        >
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
            {STATUS_LABELS[status]}
          </span>
          <span className="text-sm font-semibold text-slate-200">{count}</span>
        </div>
      ))}
    </div>
  );
}

// --- Filter helpers ----------------------------------------------------------

type FilterState = {
  status:       ReconciliationStatus | "all";
  utm_campaign: string | null;
};

const EMPTY_FILTERS: FilterState = { status: "all", utm_campaign: null };

// --- Props -------------------------------------------------------------------

type Props = {
  results: ReconciliationResult[];
  summary: ReconciliationSummary;
};

// --- Main component ----------------------------------------------------------

export function ReconciliationView({ results, summary }: Props) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  const utmCampaignOptions = useMemo(
    () => Array.from(new Set(results.map((r) => r.utm_campaign ?? "").filter(Boolean))).sort(),
    [results]
  );

  const filtered = useMemo(
    () =>
      results.filter((r) => {
        if (filters.status !== "all" && r.status !== filters.status) return false;
        if (filters.utm_campaign && r.utm_campaign !== filters.utm_campaign) return false;
        return true;
      }),
    [results, filters]
  );

  const hasActiveFilters = filters.status !== "all" || filters.utm_campaign !== null;

  return (
    <>
      {/* Page header */}
      <header className="mb-10">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
          Reconciliation
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-300">
          Compare Meta-reported performance against CRM source-of-truth data.
          Rows are matched on date + clientAccountId + utm_campaign + utm_content + utm_term.
        </p>
      </header>

      {/* Status breakdown */}
      <section className="mb-6">
        <StatusBreakdown summary={summary} />
      </section>

      {/* Revenue summary */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Rows"      value={summary.total} />
        <StatCard label="Meta Spend"      value={formatCurrency(summary.totalMetaSpend)} />
        <StatCard label="Meta Revenue"    value={formatCurrency(summary.totalMetaRevenue)} />
        <StatCard label="CRM Revenue"     value={formatCurrency(summary.totalCrmRevenue)} />
        <StatCard
          label="Revenue Delta (CRM − Meta)"
          value={`${summary.revenueDelta >= 0 ? "+" : ""}${formatCurrency(summary.revenueDelta)}`}
          colorClass={summary.revenueDelta < 0 ? "text-rose-400" : "text-emerald-400"}
        />
      </section>

      {/* Filter panel */}
      <section className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Status</label>
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((p) => ({ ...p, status: e.target.value as ReconciliationStatus | "all" }))
            }
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="all">All statuses</option>
            {(Object.keys(STATUS_LABELS) as ReconciliationStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-500">utm_campaign</label>
          <select
            value={filters.utm_campaign ?? ""}
            onChange={(e) =>
              setFilters((p) => ({ ...p, utm_campaign: e.target.value || null }))
            }
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="">All campaigns</option>
            {utmCampaignOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="self-end pb-2 text-xs text-slate-400 underline hover:text-slate-200"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto self-end pb-2 text-xs text-slate-500">
          Showing {filtered.length} of {results.length} rows
        </span>
      </section>

      {/* Results table */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-slate-800 bg-slate-900/60 px-6 py-10 text-sm text-slate-500">
          No rows match the current filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm shadow-slate-900/40">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className={TH}>Date</th>
                <th className={TH}>utm_campaign</th>
                <th className={TH}>utm_content</th>
                <th className={TH}>utm_term</th>
                <th className={TH}>Meta Spend</th>
                <th className={TH}>Meta Conv.</th>
                <th className={TH}>Meta Rev.</th>
                <th className={TH}>CRM Orders</th>
                <th className={TH}>CRM Rev.</th>
                <th className={TH}>Δ Rev.</th>
                <th className={TH}>Δ %</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={r.id}
                  className={i < filtered.length - 1 ? "border-b border-slate-800" : ""}
                >
                  <td className={`${TD} text-slate-500`}>{r.date}</td>
                  <td className={`${TD} font-mono text-xs text-slate-400`}>
                    {r.utm_campaign ?? "—"}
                  </td>
                  <td className={`${TD} font-mono text-xs text-slate-400`}>
                    {r.utm_content ?? "—"}
                  </td>
                  <td className={`${TD} font-mono text-xs text-slate-400`}>
                    {r.utm_term ?? "—"}
                  </td>
                  <td className={TD}>{r.metaSpend    != null ? formatCurrency(r.metaSpend)    : "—"}</td>
                  <td className={TD}>{r.metaConversions ?? "—"}</td>
                  <td className={TD}>{r.metaRevenue  != null ? formatCurrency(r.metaRevenue)  : "—"}</td>
                  <td className={TD}>{r.crmOrders    ?? "—"}</td>
                  <td className={TD}>{r.crmRevenue   != null ? formatCurrency(r.crmRevenue)   : "—"}</td>
                  <td className={TD}>
                    {r.revenueDelta != null ? (
                      <span className={r.revenueDelta < 0 ? "text-rose-400" : "text-emerald-400"}>
                        {r.revenueDelta > 0 ? "+" : ""}{formatCurrency(r.revenueDelta)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className={TD}>
                    {r.revenueDeltaPct != null ? (
                      <span className={r.revenueDeltaPct < 0 ? "text-rose-400" : "text-emerald-400"}>
                        {r.revenueDeltaPct > 0 ? "+" : ""}{r.revenueDeltaPct}%
                      </span>
                    ) : "—"}
                  </td>
                  <td className={TD}>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
