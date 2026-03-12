import type { HourlyMetric, Weekday } from "../types/media";
import { formatCurrency, formatHour, formatRoas } from "./metricUtils";

export type HourClassification = "best" | "weak" | "neutral";

export interface HourInsight {
  hour: number;
  formattedHour: string;
  cpa: number;
  formattedCpa: string;
  roas: number;
  formattedRoas: string;
  classification: HourClassification;
}

export interface DaypartingResult {
  averageCpa: number;
  formattedAverageCpa: string;
  averageRoas: number;
  formattedAverageRoas: string;
  bestHours: HourInsight[];
  weakHours: HourInsight[];
}

export interface WeekdayHourGroup {
  weekday: Weekday;
  hour: number;
  formattedHour: string;
  formattedSpend: string;
  conversions: number;
  formattedCpa: string;
  formattedRoas: string;
  classification: HourClassification;
}

export const WEEKDAY_ORDER: Weekday[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

function computeAverageCpa(metrics: HourlyMetric[]): number {
  if (metrics.length === 0) return 0;
  return metrics.reduce((sum, m) => sum + m.cpa, 0) / metrics.length;
}

function computeAverageRoas(metrics: HourlyMetric[]): number {
  if (metrics.length === 0) return 0;
  return metrics.reduce((sum, m) => sum + m.roas, 0) / metrics.length;
}

function classifyHour(
  metric: HourlyMetric,
  avgCpa: number,
  avgRoas: number
): HourClassification {
  const betterCpa = metric.cpa < avgCpa;
  const betterRoas = metric.roas > avgRoas;
  if (betterCpa && betterRoas) return "best";
  if (!betterCpa && !betterRoas) return "weak";
  return "neutral";
}

export function analyzeDayparting(metrics: HourlyMetric[]): DaypartingResult {
  const avgCpa = computeAverageCpa(metrics);
  const avgRoas = computeAverageRoas(metrics);

  const insights: HourInsight[] = metrics.map((m) => ({
    hour: m.hour,
    formattedHour: formatHour(m.hour),
    cpa: m.cpa,
    formattedCpa: formatCurrency(m.cpa),
    roas: m.roas,
    formattedRoas: formatRoas(m.roas),
    classification: classifyHour(m, avgCpa, avgRoas)
  }));

  return {
    averageCpa: avgCpa,
    formattedAverageCpa: formatCurrency(avgCpa),
    averageRoas: avgRoas,
    formattedAverageRoas: formatRoas(avgRoas),
    bestHours: insights.filter((i) => i.classification === "best"),
    weakHours: insights.filter((i) => i.classification === "weak")
  };
}

export function groupByWeekdayAndHour(
  metrics: HourlyMetric[]
): WeekdayHourGroup[] {
  const avgCpa = computeAverageCpa(metrics);
  const avgRoas = computeAverageRoas(metrics);

  return metrics
    .map((m) => ({
      weekday: m.weekday,
      hour: m.hour,
      formattedHour: formatHour(m.hour),
      formattedSpend: formatCurrency(m.spend),
      conversions: m.conversions,
      formattedCpa: formatCurrency(m.cpa),
      formattedRoas: formatRoas(m.roas),
      classification: classifyHour(m, avgCpa, avgRoas)
    }))
    .sort((a, b) => {
      const dayDiff =
        WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday);
      return dayDiff !== 0 ? dayDiff : a.hour - b.hour;
    });
}
