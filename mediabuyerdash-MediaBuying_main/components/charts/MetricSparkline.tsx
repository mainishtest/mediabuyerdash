"use client";
// components/charts/MetricSparkline.tsx
// General-purpose sparkline for any metric (spend, ROAS, CPA, etc.)
// Auto-detects trend direction and applies color-coding:
//   - Improving/up: emerald (#10b981)
//   - Declining/down: rose (#f43f5e)
//   - Flat: slate (#64748b)
// No axes, labels, or tooltips — just the trend shape.

import { AreaChart, Area, ResponsiveContainer } from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetricSparklineDataPoint {
  date: string;
  value: number;
}

export type TrendDirection = "up" | "down" | "flat";

export interface MetricSparklineProps {
  /** Time-series data points */
  data: MetricSparklineDataPoint[];
  /** Optional custom color (hex); overrides trend-based color if provided */
  color?: string;
  /** Height in pixels; defaults to 24 */
  height?: number;
  /** Width in pixels; defaults to 80 */
  width?: number;
  /**
   * For metrics where lower is better (CPA, cost per click, etc.),
   * set to true to invert the trend logic.
   * "down" becomes "improving", "up" becomes "declining".
   */
  invertTrend?: boolean;
}

// ---------------------------------------------------------------------------
// Helper: Trend detection
// ---------------------------------------------------------------------------

/**
 * Detects trend direction by comparing the average of the first half
 * to the average of the second half.
 *
 * @param data - Array of objects with `value` property
 * @param invert - If true, inverts the logic (down is good, up is bad)
 * @returns "up" if trending upward, "down" if downward, "flat" if stable
 */
export function detectTrend(
  data: { value: number }[],
  invert: boolean = false
): TrendDirection {
  if (!data || data.length < 2) return "flat";

  const midpoint = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, midpoint);
  const secondHalf = data.slice(midpoint);

  if (firstHalf.length === 0 || secondHalf.length === 0) return "flat";

  const firstAvg = firstHalf.reduce((sum, p) => sum + p.value, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, p) => sum + p.value, 0) / secondHalf.length;

  const diff = secondAvg - firstAvg;
  const threshold = 0.001; // Threshold for "flat" detection (0.1% change)

  if (Math.abs(diff) < threshold) return "flat";

  const isUp = diff > 0;
  return invert ? (isUp ? "down" : "up") : (isUp ? "up" : "down");
}

// ---------------------------------------------------------------------------
// Color mapping based on trend
// ---------------------------------------------------------------------------

function getTrendColor(trend: TrendDirection, customColor?: string): string {
  if (customColor) return customColor;

  switch (trend) {
    case "up":
      return "#10b981"; // emerald
    case "down":
      return "#f43f5e"; // rose
    case "flat":
    default:
      return "#64748b"; // slate
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetricSparkline({
  data,
  color: customColor,
  height = 24,
  width = 80,
  invertTrend = false,
}: MetricSparklineProps) {
  // Early exit: insufficient data
  if (!data || data.length < 2) {
    return (
      <span
        className="block rounded bg-slate-800/40"
        style={{ height: `${height}px`, width: `${width}px` }}
        aria-hidden
      />
    );
  }

  // Detect trend and pick color
  const trend = detectTrend(data, invertTrend);
  const color = getTrendColor(trend, customColor);

  // Use a unique gradient ID to avoid conflicts when multiple sparklines exist
  const gradientId = `metric-sparkline-${color.replace("#", "")}-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <span
      className="block"
      style={{ height: `${height}px`, width: `${width}px` }}
      aria-hidden
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </span>
  );
}
