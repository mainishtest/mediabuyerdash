// Date range, search, and active-only filter controls.

"use client";

import { useState, useEffect, useRef } from "react";
import type { DateRange } from "./useStatsData";

interface Props {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  activeOnly: boolean;
  onActiveOnlyChange: (v: boolean) => void;
  search: string;
  onSearchChange: (s: string) => void;
  timezone: string;
}

// ── Date helpers (account-timezone-aware) ────────────────────────────────────

function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

function daysAgoInTz(n: number, tz: string): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
}

const QUICK_RANGES = [
  { label: "Today",       days: 0 },
  { label: "Yesterday",   days: 1 },
  { label: "Last 3 Days", days: 3 },
  { label: "Last 7 Days", days: 7 },
] as const;

function quickRange(days: number, tz: string): DateRange {
  const today = todayInTz(tz);
  if (days === 0) return { startDate: today, endDate: today };
  if (days === 1) { const y = daysAgoInTz(1, tz); return { startDate: y, endDate: y }; }
  return { startDate: daysAgoInTz(days - 1, tz), endDate: today };
}

function activeQuickIndex(dr: DateRange, tz: string): number | null {
  for (const qr of QUICK_RANGES) {
    const r = quickRange(qr.days, tz);
    if (r.startDate === dr.startDate && r.endDate === dr.endDate) return qr.days;
  }
  return null;
}

// ── Component ───────────────────────────────────────────────────────────────

export function StatsFilters({
  dateRange, onDateRangeChange, activeOnly, onActiveOnlyChange,
  search, onSearchChange, timezone,
}: Props) {
  const [input, setInput] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const active = activeQuickIndex(dateRange, timezone);

  // Debounce search — 300ms after typing stops
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearchChange(input), 300);
    return () => clearTimeout(timer.current);
    // onSearchChange is stable (useCallback in parent) — safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  // Sync external search changes (e.g. URL param init)
  useEffect(() => { setInput(search); }, [search]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Quick date buttons */}
      <div className="flex items-center gap-0.5 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
        {QUICK_RANGES.map(qr => (
          <button
            key={qr.days}
            onClick={() => onDateRangeChange(quickRange(qr.days, timezone))}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              active === qr.days
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {qr.label}
          </button>
        ))}
      </div>

      {/* Custom date pickers */}
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1">
        <input
          type="date"
          value={dateRange.startDate}
          onChange={e => onDateRangeChange({ ...dateRange, startDate: e.target.value })}
          className="bg-transparent text-xs text-slate-300 outline-none [color-scheme:dark]"
        />
        <span className="text-[10px] text-slate-600">to</span>
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
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Search campaigns, ad sets, ads..."
          className="h-8 w-64 rounded-lg border border-slate-800 bg-slate-900/60 pl-8 pr-8 text-xs text-slate-300
            placeholder-slate-600 outline-none transition-colors focus:border-slate-600 focus:ring-1 focus:ring-slate-600"
        />
        {input && (
          <button
            onClick={() => { setInput(""); onSearchChange(""); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            aria-label="Clear search"
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
