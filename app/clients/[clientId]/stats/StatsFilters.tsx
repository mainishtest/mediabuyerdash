// app/clients/[clientId]/stats/StatsFilters.tsx
// Date range controls, search input, and active-only toggle for the Stats view.

"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface DateRange {
  startDate: string;
  endDate: string;
}

interface StatsFiltersProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  activeOnly: boolean;
  onActiveOnlyChange: (active: boolean) => void;
  search: string;
  onSearchChange: (search: string) => void;
  timezone: string;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

function daysAgoInTz(n: number, tz: string): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
}

type QuickRange = { label: string; days: number };
const QUICK_RANGES: QuickRange[] = [
  { label: "Today", days: 0 },
  { label: "Yesterday", days: 1 },
  { label: "Last 3 Days", days: 3 },
  { label: "Last 7 Days", days: 7 },
];

function getQuickRange(days: number, tz: string): DateRange {
  const today = todayInTz(tz);
  if (days === 0) return { startDate: today, endDate: today };
  if (days === 1) {
    const yesterday = daysAgoInTz(1, tz);
    return { startDate: yesterday, endDate: yesterday };
  }
  return { startDate: daysAgoInTz(days - 1, tz), endDate: today };
}

function getActiveQuickRange(dateRange: DateRange, tz: string): number | null {
  for (const qr of QUICK_RANGES) {
    const range = getQuickRange(qr.days, tz);
    if (range.startDate === dateRange.startDate && range.endDate === dateRange.endDate) {
      return qr.days;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatsFilters({
  dateRange,
  onDateRangeChange,
  activeOnly,
  onActiveOnlyChange,
  search,
  onSearchChange,
  timezone,
}: StatsFiltersProps) {
  const [searchInput, setSearchInput] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const activeQuick = getActiveQuickRange(dateRange, timezone);

  // Debounce search input
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(searchInput);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput, onSearchChange]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Quick date range buttons */}
      <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
        {QUICK_RANGES.map(qr => (
          <button
            key={qr.days}
            onClick={() => onDateRangeChange(getQuickRange(qr.days, timezone))}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeQuick === qr.days
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {qr.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1">
        <input
          type="date"
          value={dateRange.startDate}
          onChange={e => onDateRangeChange({ ...dateRange, startDate: e.target.value })}
          className="bg-transparent text-xs text-slate-300 outline-none [color-scheme:dark]"
        />
        <span className="text-xs text-slate-600">-</span>
        <input
          type="date"
          value={dateRange.endDate}
          onChange={e => onDateRangeChange({ ...dateRange, endDate: e.target.value })}
          className="bg-transparent text-xs text-slate-300 outline-none [color-scheme:dark]"
        />
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search campaigns, ad sets, ads..."
          className="h-8 w-64 rounded-lg border border-slate-800 bg-slate-900/60 pl-8 pr-3 text-xs text-slate-300 placeholder-slate-600 outline-none transition-colors focus:border-slate-600 focus:ring-1 focus:ring-slate-600"
        />
        {searchInput && (
          <button
            onClick={() => { setSearchInput(""); onSearchChange(""); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Active only toggle */}
      <button
        onClick={() => onActiveOnlyChange(!activeOnly)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
          activeOnly
            ? "border-emerald-600/50 bg-emerald-500/10 text-emerald-400"
            : "border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        }`}
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${activeOnly ? "bg-emerald-400" : "bg-slate-600"}`} />
        Active only
      </button>
    </div>
  );
}
