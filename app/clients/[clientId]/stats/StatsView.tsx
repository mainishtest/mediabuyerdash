// app/clients/[clientId]/stats/StatsView.tsx
// Client-side orchestrator for the Stats page.
// Connects filters, data hook, and table.

"use client";

import { useState, useCallback } from "react";
import { StatsFilters } from "./StatsFilters";
import { StatsTable } from "./StatsTable";
import { useStatsData } from "./useStatsData";

interface StatsViewProps {
  clientId: string;
  clientName: string;
  timezone: string;
}

// ---------------------------------------------------------------------------
// Date helpers (same as StatsFilters, inline for initial range)
// ---------------------------------------------------------------------------

function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

function daysAgoInTz(n: number, tz: string): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
}

// ---------------------------------------------------------------------------
// Totals bar
// ---------------------------------------------------------------------------

function fmtCurrency(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function TotalsBar({ totals }: { totals: { spend: number; revenue: number; orders: number; impressions: number; clicks: number } }) {
  const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  return (
    <div className="flex flex-wrap items-center gap-6 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-3">
      <TotalStat label="Spend" value={fmtCurrency(totals.spend)} />
      <TotalStat label="Revenue" value={fmtCurrency(totals.revenue)} />
      <TotalStat label="ROAS" value={`${roas.toFixed(2)}x`} color={roas >= 3 ? "text-emerald-400" : roas >= 1 ? "text-amber-400" : "text-slate-200"} />
      <TotalStat label="Sales" value={totals.orders.toLocaleString("en-US")} />
      <TotalStat label="CTR" value={`${ctr.toFixed(2)}%`} />
      <TotalStat label="Impressions" value={totals.impressions.toLocaleString("en-US")} />
      <TotalStat label="Clicks" value={totals.clicks.toLocaleString("en-US")} />
    </div>
  );
}

function TotalStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${color ?? "text-slate-200"}`}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="space-y-1 py-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-3 py-2.5">
          <div className="h-4 w-4 animate-pulse rounded bg-slate-800" />
          <div className="h-4 flex-1 animate-pulse rounded bg-slate-800" style={{ maxWidth: `${200 + Math.random() * 100}px` }} />
          {Array.from({ length: 8 }).map((_, j) => (
            <div key={j} className="h-4 w-16 animate-pulse rounded bg-slate-800" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StatsView({ clientId, clientName, timezone }: StatsViewProps) {
  // Default to last 7 days
  const [dateRange, setDateRange] = useState(() => ({
    startDate: daysAgoInTz(6, timezone),
    endDate: todayInTz(timezone),
  }));
  const [activeOnly, setActiveOnly] = useState(false);
  const [search, setSearch] = useState("");

  const {
    campaignRows,
    childrenMap,
    totals,
    loading,
    expandingIds,
    expandedIds,
    toggleExpand,
    sortColumn,
    sortDirection,
    setSortColumn,
  } = useStatsData({ clientId, dateRange, activeOnly, search });

  const handleSearchChange = useCallback((s: string) => setSearch(s), []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-lg font-bold text-white">{clientName} — Stats</h1>
          <p className="text-xs text-slate-500">
            Performance breakdown by campaign, ad set, and ad. CRM is source of truth for revenue.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-4">
          <StatsFilters
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            activeOnly={activeOnly}
            onActiveOnlyChange={setActiveOnly}
            search={search}
            onSearchChange={handleSearchChange}
            timezone={timezone}
          />
        </div>

        {/* Totals bar */}
        {!loading && (
          <div className="mb-4">
            <TotalsBar totals={totals} />
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40">
          {loading ? (
            <TableSkeleton />
          ) : (
            <StatsTable
              campaignRows={campaignRows}
              childrenMap={childrenMap}
              expandedIds={expandedIds}
              expandingIds={expandingIds}
              onToggleExpand={toggleExpand}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSortColumn={setSortColumn}
              search={search}
            />
          )}
        </div>
      </div>
    </div>
  );
}
