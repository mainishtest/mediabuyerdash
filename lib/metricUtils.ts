import type { DailyMetric, HourlyMetric } from "../types/media";

export function totalSpend(metrics: DailyMetric[]): number {
  return metrics.reduce((sum, m) => sum + m.spend, 0);
}

export function totalConversions(metrics: DailyMetric[]): number {
  return metrics.reduce((sum, m) => sum + m.conversions, 0);
}

export function averageCpa(metrics: DailyMetric[]): number {
  const conversions = totalConversions(metrics);
  if (conversions === 0) return 0;
  return totalSpend(metrics) / conversions;
}

export function averageRoas(metrics: DailyMetric[]): number {
  if (metrics.length === 0) return 0;
  return metrics.reduce((sum, m) => sum + m.roas, 0) / metrics.length;
}

export function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatRoas(value: number): string {
  return `${value.toFixed(2)}x`;
}

export function formatHour(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}
