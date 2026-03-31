// Main orchestrator for the Stats page.
// Manages filter state, syncs URL params, and wires filters → hook → table.

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

// ── Timezone-aware date helpers ─────────────────────────────────────────────

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

// ── Summary totals ──────────────────────────────────────────────────────────
// All derived metrics use weighted calculations (not simple averages):
//   ROAS = totalRevenue / totalSpend
//   CPM  = (totalSpend / totalImpressions) * 1000     (spend-weighted)
//   CTR  = (totalClicks / totalImpressions) * 100      (impression-weighted)
//   CPC  = totalSpend / totalClicks                    (spend-weighted)
//
// These match Facebook Ads Manager's aggregate calculations. Weighted metrics
// are the only correct way to aggregate rates — averaging per-row CPMs would
// over-weight low-impression rows.

function fmtCurrency(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtInt(v: number): string {
  if (Number.isInteger(v)) return v.toLocaleString("en-US");
  return v.toFixed(1);
}

interface Totals {
  spend: number;
  revenue: number;
  orders: number;
  impressions: number;
  clicks: number;
}

function SummaryTotals({ totals }: { totals: Totals }) {
  const { spend, revenue, orders, impressions, clicks } = totals;

  const roas = spend > 0 ? revenue / spend : 0;
  const cpm  = impressions > 0 ? (spend / impressions) * 1000 : null;
  const ctr  = impressions > 0 ? (clicks / impressions) * 100 : null;
  const cpc  = clicks > 0 ? spend / clicks : null;

  const roasColor =
    roas >= 3 ? "text-emerald-400" :
    roas >= 1 ? "text-amber-400"   : undefined;

  return (
    <div className="grid grid-cols-4 gap-px overflow-hidden rounded-xl border border-slate-800 bg-slate-800 sm:grid-cols-7">
      <Cell label="Total Sales"  value={fmtCurrency(revenue)} />
      <Cell label="Total Spend"  value={fmtCurrency(spend)} />
      <Cell label="ROAS"         value={`${roas.toFixed(2)}x`} color={roasColor} />
      <Cell label="CPM"          value={cpm !== null ? fmtCurrency(cpm) : "-"} sub="weighted" />
      <Cell label="CTR"          value={ctr !== null ? `${ctr.toFixed(2)}%` : "-"} sub="weighted" />
      <Cell label="CPC"          value={cpc !== null ? fmtCurrency(cpc) : "-"} sub="weighted" />
      <Cell label="Conversions"  value={fmtInt(orders)} />
    </div>
  );
}

function Cell({ label, value, color, sub }: {
  label: string; value: string; color?: string; sub?: string;
}) {
  return (
    <div className="bg-slate-900/80 px-4 py-3">
      <div className="flex items-baseline gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
        {sub && <span className="text-[8px] text-slate-600">{sub}</span>}
      </div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${color ?? "text-slate-200"}`}>
        {value}
      </div>
    </div>
  );
}

// ── Loading skeleton (stable widths — no Math.random) ───────────────────────

const SKEL_WIDTHS = [240, 180, 260, 200, 220, 190, 250, 210];

function Skeleton() {
  return (
    <div className="py-3">
      {SKEL_WIDTHS.map((w, i) => (
        <div key={i} className="flex items-center gap-4 px-3 py-2.5">
          <div className="h-4 w-4 animate-pulse rounded bg-slate-800/80" />
          <div className="h-4 animate-pulse rounded bg-slate-800/80" style={{ width: w }} />
          {Array.from({ length: 8 }).map((_, j) => (
            <div key={j} className="h-4 w-16 animate-pulse rounded bg-slate-800/60" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Error state ─────────────────────────────────────────────────────────────

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-red-900/50 bg-red-950/30 px-5 py-3">
      <div>
        <p className="text-sm font-medium text-red-400">Failed to load stats</p>
        <p className="mt-0.5 text-xs text-red-400/60">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="rounded-lg border border-red-800/50 px-3 py-1.5 text-xs font-medium text-red-400
          transition-colors hover:bg-red-900/30"
      >
        Retry
      </button>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function StatsView({ clientId, clientName, timezone }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Init state from URL params (or defaults)
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const s = searchParams.get("start");
    const e = searchParams.get("end");
    return s && e ? { startDate: s, endDate: e } : defaultDateRange(timezone);
  });
  const [activeOnly, setActiveOnly] = useState(() => searchParams.get("active") === "1");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");

  // Sync state → URL params (debounced to avoid 8 router.replace calls while typing)
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

  // Retry: clear error and re-trigger by toggling a dependency
  const handleRetry = useCallback(() => {
    setDateRange(prev => ({ ...prev })); // Shallow clone triggers useEffect
  }, []);

  const handleSearchChange = useCallback((s: string) => setSearch(s), []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-lg font-bold text-white">{clientName} — Stats</h1>
          <p className="text-xs text-slate-500">
            Performance by campaign, ad set, and ad. CRM revenue is source of truth.
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

        {/* Error */}
        {data.error && (
          <div className="mb-4">
            <ErrorBanner message={data.error} onRetry={handleRetry} />
          </div>
        )}

        {/* Summary totals (hidden during loading / error) */}
        {!data.loading && !data.error && (
          <div className="mb-4">
            <SummaryTotals totals={data.totals} />
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40">
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
