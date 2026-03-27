"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type {
  UTMPerformanceRow,
  ReportingFilterState,
  FilterOption
} from "../../types/reporting";
import {
  extractFilterOptions,
  applyFilters,
  hasActiveFilters,
  summarizeRows
} from "../../lib/utmReportingUtils";
import { formatCurrency, formatRoas } from "../../lib/metricUtils";

// --- Constants ---------------------------------------------------------------

const EMPTY_FILTERS: ReportingFilterState = {
  campaignName: null,
  adSetName:    null,
  adName:       null,
  utm_campaign: null,
  utm_content:  null,
  utm_term:     null
};

// --- Style helpers -----------------------------------------------------------

const TH = "px-3 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400 whitespace-nowrap";
const TD = "px-3 py-3 text-sm text-slate-300 whitespace-nowrap";

// --- Sub-component: single filter dropdown -----------------------------------

function FilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label:    string;
  value:    string | null;
  options:  FilterOption[];
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// --- Props -------------------------------------------------------------------

type Props = { rows: UTMPerformanceRow[] };

// --- Main component ----------------------------------------------------------

export function ReportingView({ rows }: Props) {
  const [filters, setFilters] = useState<ReportingFilterState>(EMPTY_FILTERS);

  function setFilter(key: keyof ReportingFilterState, value: string | null) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  // Extract options from the full dataset so dropdowns always show all values
  // regardless of what other filters are active.
  const filterOptions = useMemo(
    () => ({
      campaignName: extractFilterOptions(rows, "campaignName"),
      adSetName:    extractFilterOptions(rows, "adSetName"),
      adName:       extractFilterOptions(rows, "adName"),
      utm_campaign: extractFilterOptions(rows, "utm_campaign"),
      utm_content:  extractFilterOptions(rows, "utm_content"),
      utm_term:     extractFilterOptions(rows, "utm_term")
    }),
    [rows]
  );

  const filteredRows = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const summary      = useMemo(() => summarizeRows(filteredRows), [filteredRows]);
  const active       = hasActiveFilters(filters);

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
          UTM Reporting
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-300">
          Filter performance data by campaign, ad set, ad, and UTM parameters.
          All filtering is local — no API calls are made.
        </p>
      </header>

      {/* Filter panel */}
      <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm shadow-slate-900/40">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Filters</h2>
          {active && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-xs text-slate-400 underline hover:text-slate-200"
            >
              Clear all filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-6">
          <FilterSelect
            label="Campaign"
            value={filters.campaignName}
            options={filterOptions.campaignName}
            onChange={(v) => setFilter("campaignName", v)}
          />
          <FilterSelect
            label="Ad Set"
            value={filters.adSetName}
            options={filterOptions.adSetName}
            onChange={(v) => setFilter("adSetName", v)}
          />
          <FilterSelect
            label="Ad"
            value={filters.adName}
            options={filterOptions.adName}
            onChange={(v) => setFilter("adName", v)}
          />
          <FilterSelect
            label="utm_campaign"
            value={filters.utm_campaign}
            options={filterOptions.utm_campaign}
            onChange={(v) => setFilter("utm_campaign", v)}
          />
          <FilterSelect
            label="utm_content"
            value={filters.utm_content}
            options={filterOptions.utm_content}
            onChange={(v) => setFilter("utm_content", v)}
          />
          <FilterSelect
            label="utm_term"
            value={filters.utm_term}
            options={filterOptions.utm_term}
            onChange={(v) => setFilter("utm_term", v)}
          />
        </div>
      </section>

      {/* Summary bar */}
      <div className="mb-4 flex flex-wrap gap-4 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-3 text-sm text-slate-400">
        <span>
          <span className="font-medium text-slate-200">{summary.rowCount}</span>{" "}
          row{summary.rowCount !== 1 ? "s" : ""}
          {active && <span className="ml-1 text-slate-500">(filtered)</span>}
        </span>
        <span>
          Spend{" "}
          <span className="font-medium text-slate-200">
            {formatCurrency(summary.totalSpend)}
          </span>
        </span>
        <span>
          Conversions{" "}
          <span className="font-medium text-slate-200">{summary.totalConversions}</span>
        </span>
        <span>
          Avg CPA{" "}
          <span className="font-medium text-slate-200">
            {formatCurrency(summary.avgCpa)}
          </span>
        </span>
        <span>
          Avg ROAS{" "}
          <span className="font-medium text-slate-200">
            {formatRoas(summary.avgRoas)}
          </span>
        </span>
      </div>

      {/* Results table */}
      {filteredRows.length === 0 ? (
        <p className="rounded-xl border border-slate-800 bg-slate-900/60 px-6 py-10 text-sm text-slate-500">
          No rows match the current filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm shadow-slate-900/40">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className={TH}>Date</th>
                <th className={TH}>Campaign</th>
                <th className={TH}>Ad Set</th>
                <th className={TH}>Ad</th>
                <th className={TH}>utm_campaign</th>
                <th className={TH}>utm_content</th>
                <th className={TH}>utm_term</th>
                <th className={TH}>Spend</th>
                <th className={TH}>Conv.</th>
                <th className={TH}>CPA</th>
                <th className={TH}>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => (
                <tr
                  key={row.id}
                  className={
                    i < filteredRows.length - 1 ? "border-b border-slate-800" : ""
                  }
                >
                  <td className={`${TD} text-slate-500`}>{row.date}</td>
                  <td className={`${TD} font-medium text-slate-200`}>
                    {row.campaignName}
                  </td>
                  <td className={TD}>{row.adSetName}</td>
                  <td className={TD}>{row.adName}</td>
                  <td className={`${TD} font-mono text-xs text-slate-400`}>
                    {row.utm_campaign ?? "—"}
                  </td>
                  <td className={`${TD} font-mono text-xs text-slate-400`}>
                    {row.utm_content ?? "—"}
                  </td>
                  <td className={`${TD} font-mono text-xs text-slate-400`}>
                    {row.utm_term ?? "—"}
                  </td>
                  <td className={TD}>{formatCurrency(row.spend)}</td>
                  <td className={TD}>{row.conversions}</td>
                  <td className={TD}>{formatCurrency(row.cpa)}</td>
                  <td className={TD}>{formatRoas(row.roas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
