// Main orchestrator for the Stats page.
// Manages filter state, syncs URL params, wires filters → hook → table.

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StatsFilters } from "./StatsFilters";
import { StatsTable } from "./StatsTable";
import { useStatsData, type DateRange } from "./useStatsData";

interface Props {
  clientId: string;
  clientName: string;
  timezone: string;
}

// ── Date helpers ────────────────────────────────────────────────────────────

function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

function daysAgoInTz(n: number, tz: string): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
}

function defaultDateRange(tz: string): DateRange {
  return { startDate: daysAgoInTz(6, tz), endDate: todayInTz(tz) };
}

// ── Formatters ──────────────────────────────────────────────────────────────

function fmtC(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtN(v: number): string {
  if (Number.isInteger(v)) return v.toLocaleString("en-US");
  return v.toFixed(1);
}

// ── Summary totals ──────────────────────────────────────────────────────────
// Weighted calculations match Facebook Ads Manager:
//   ROAS = totalRevenue / totalSpend
//   CPM  = (totalSpend / totalImpressions) * 1000
//   CTR  = (totalClicks / totalImpressions) * 100
//   CPC  = totalSpend / totalClicks

interface Totals {
  spend: number; revenue: number; orders: number; impressions: number; clicks: number;
}

function SummaryTotals({ totals, campaignCount }: { totals: Totals; campaignCount: number }) {
  const { spend, revenue, orders, impressions, clicks } = totals;

  const roas = spend > 0 ? revenue / spend : 0;
  const cpm  = impressions > 0 ? (spend / impressions) * 1000 : null;
  const ctr  = impressions > 0 ? (clicks / impressions) * 100 : null;
  const cpc  = clicks > 0 ? spend / clicks : null;

  return (
    <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-slate-800 bg-slate-800/60 sm:grid-cols-8">
      <SCell label="Campaigns" value={campaignCount.toString()} />
      <SCell label="Sales" value={fmtC(revenue)} bold />
      <SCell label="Spend" value={fmtC(spend)} />
      <SCell label="ROAS" value={`${roas.toFixed(2)}x`}
        color={roas >= 3 ? "text-emerald-400" : roas >= 1 ? "text-amber-400" : undefined} bold />
      <SCell label="CPM" value={cpm !== null ? fmtC(cpm) : "-"} />
      <SCell label="CTR" value={ctr !== null ? `${ctr.toFixed(2)}%` : "-"} />
      <SCell label="CPC" value={cpc !== null ? fmtC(cpc) : "-"} />
      <SCell label="Conv." value={fmtN(orders)} />
    </div>
  );
}

function SCell({ label, value, color, bold }: {
  label: string; value: string; color?: string; bold?: boolean;
}) {
  return (
    <div className="bg-slate-950 px-3 py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-600">{label}</div>
      <div className={`mt-px text-[13px] tabular-nums ${bold ? "font-semibold" : "font-medium"} ${color ?? "text-slate-200"}`}>
        {value}
      </div>
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────
// Mimics actual table structure: name column + 8 metric columns

function Skeleton() {
  const ROWS = 10;
  const WIDTHS = [220, 160, 240, 180, 200, 170, 230, 190, 210, 175];
  return (
    <div>
      {/* Header skeleton */}
      <div className="flex items-center border-b border-slate-800 px-3 py-2">
        <div className="h-2.5 w-12 rounded bg-slate-800/60" />
        <div className="ml-auto flex gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-2.5 w-10 rounded bg-slate-800/40" />
          ))}
        </div>
      </div>
      {/* Row skeletons */}
      {Array.from({ length: ROWS }).map((_, i) => (
        <div key={i} className="flex items-center border-b border-slate-800/20 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-slate-800/40" />
            <div
              className="h-3 rounded bg-slate-800/50 animate-pulse"
              style={{ width: WIDTHS[i], animationDelay: `${i * 50}ms` }}
            />
          </div>
          <div className="ml-auto flex gap-6">
            {Array.from({ length: 8 }).map((_, j) => (
              <div
                key={j}
                className="h-3 w-14 rounded bg-slate-800/30 animate-pulse"
                style={{ animationDelay: `${(i * 8 + j) * 20}ms` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Error ───────────────────────────────────────────────────────────────────

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-red-400">Failed to load stats</p>
        <p className="mt-0.5 text-xs text-red-400/50">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="rounded-md border border-red-800/40 px-3 py-1 text-xs font-medium text-red-400
          transition-colors hover:bg-red-900/20"
      >
        Retry
      </button>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

export function StatsView({ clientId, clientName, timezone }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const s = searchParams.get("start");
    const e = searchParams.get("end");
    return s && e ? { startDate: s, endDate: e } : defaultDateRange(timezone);
  });
  const [activeOnly, setActiveOnly] = useState(() => searchParams.get("active") === "1");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");

  // Debounced URL sync
  const urlTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => {
      const p = new URLSearchParams();
      p.set("start", dateRange.startDate);
      p.set("end", dateRange.endDate);
      if (activeOnly) p.set("active", "1");
      if (search) p.set("q", search);
      router.replace(`?${p.toString()}`, { scroll: false });
    }, 400);
    return () => clearTimeout(urlTimer.current);
  }, [dateRange, activeOnly, search, router]);

  const data = useStatsData({ clientId, dateRange, activeOnly, search });

  const handleRetry = useCallback(() => {
    setDateRange(prev => ({ ...prev }));
  }, []);

  const handleSearchChange = useCallback((s: string) => setSearch(s), []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6">
        {/* Header — compact */}
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-white">{clientName} <span className="font-normal text-slate-500">/ Stats</span></h1>
          </div>
          {!data.loading && !data.error && data.campaignRows.length > 0 && (
            <span className="text-xs text-slate-600 tabular-nums">
              {data.campaignRows.length} campaign{data.campaignRows.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="mb-3">
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

        {/* Error */}
        {data.error && (
          <div className="mb-3">
            <ErrorBanner message={data.error} onRetry={handleRetry} />
          </div>
        )}

        {/* Summary totals */}
        {!data.loading && !data.error && data.campaignRows.length > 0 && (
          <div className="mb-3">
            <SummaryTotals totals={data.totals} campaignCount={data.campaignRows.length} />
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border border-slate-800 bg-slate-950">
          {data.loading ? (
            <Skeleton />
          ) : data.error ? null : (
            <StatsTable
              campaignRows={data.campaignRows}
              childrenMap={data.childrenMap}
              expandedIds={data.expandedIds}
              expandingIds={data.expandingIds}
              onToggleExpand={data.toggleExpand}
              sortColumn={data.sortColumn}
              sortDirection={data.sortDirection}
              onSortColumn={data.setSortColumn}
              search={search}
            />
          )}
        </div>
      </div>
    </div>
  );
}
