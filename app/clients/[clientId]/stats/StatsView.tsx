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

// ── Totals bar ──────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function TotalsBar({ totals }: { totals: { spend: number; revenue: number; orders: number; impressions: number; clicks: number } }) {
  const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-3">
      <Stat label="Spend"       value={fmtCurrency(totals.spend)} />
      <Stat label="Revenue"     value={fmtCurrency(totals.revenue)} />
      <Stat label="ROAS"        value={`${roas.toFixed(2)}x`}
            color={roas >= 3 ? "text-emerald-400" : roas >= 1 ? "text-amber-400" : undefined} />
      <Stat label="Sales"       value={totals.orders.toLocaleString("en-US")} />
      <Stat label="CTR"         value={`${ctr.toFixed(2)}%`} />
      <Stat label="Impressions" value={totals.impressions.toLocaleString("en-US")} />
      <Stat label="Clicks"      value={totals.clicks.toLocaleString("en-US")} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${color ?? "text-slate-200"}`}>{value}</div>
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

        {/* Totals bar (hidden during loading / error) */}
        {!data.loading && !data.error && (
          <div className="mb-4">
            <TotalsBar totals={data.totals} />
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
