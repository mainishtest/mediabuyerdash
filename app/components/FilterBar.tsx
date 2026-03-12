"use client";

import { DATE_RANGE_OPTIONS, type DateRange } from "../../lib/filterUtils";

type FilterBarProps = {
  selected: DateRange;
  onChange: (value: DateRange) => void;
};

export function FilterBar({ selected, onChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor="date-range"
        className="text-xs font-medium uppercase tracking-widest text-slate-400"
      >
        Date Range
      </label>
      <select
        id="date-range"
        value={selected}
        onChange={(e) => onChange(e.target.value as DateRange)}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500"
      >
        {DATE_RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
