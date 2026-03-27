import type { HourlyMetric } from "../types/media";

// Each range maps to a maximum number of unique sample dates to include.
// Sample data has 5 days, so ranges slice progressively more of it.
export type DateRange = "7" | "14" | "30";

export interface DateRangeOption {
  value: DateRange;
  label: string;
  maxDays: number;
}

export const DATE_RANGE_OPTIONS: DateRangeOption[] = [
  { value: "7",  label: "Last 7 days",  maxDays: 2 },
  { value: "14", label: "Last 14 days", maxDays: 4 },
  { value: "30", label: "Last 30 days", maxDays: 5 }
];

export function filterHourlyMetrics(
  metrics: HourlyMetric[],
  range: DateRange
): HourlyMetric[] {
  const option = DATE_RANGE_OPTIONS.find((o) => o.value === range);
  if (!option) return metrics;

  // Collect unique dates in the order they appear, then keep the last N.
  const uniqueDates = [...new Set(metrics.map((m) => m.date))];
  const allowedDates = new Set(uniqueDates.slice(-option.maxDays));

  return metrics.filter((m) => allowedDates.has(m.date));
}

export function getRangeLabel(range: DateRange): string {
  return DATE_RANGE_OPTIONS.find((o) => o.value === range)?.label ?? range;
}
