"use client";
// components/charts/TrendChart.tsx
// Full spend + ROAS dual-axis area/line chart for the campaign drill-down page.
//
// Left axis  (blue area)  — Meta Spend ($)
// Right axis (green line) — Evaluated ROAS (CRM revenue ÷ spend)
//
// Both series use 30-day daily DailyPoint data from lib/charts/dataService.
// Zero-spend days show ROAS as null → rendered as a gap in the ROAS line
// rather than a misleading zero.

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DailyPoint } from "../../lib/charts/dataService";

// ---------------------------------------------------------------------------
// Formatting helpers (client-side only)
// ---------------------------------------------------------------------------

function fmtDate(d: string): string {
  // "2024-03-15" → "Mar 15"
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    timeZone: "UTC",
  });
}

function fmtDollar(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function fmtRoas(v: number | null): string {
  return v != null ? `${v.toFixed(2)}x` : "—";
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?:  boolean;
  payload?: { name: string; value: number | null; color: string }[];
  label?:   string;
}) {
  if (!active || !payload?.length) return null;

  const spend   = payload.find((p) => p.name === "Spend");
  const revenue = payload.find((p) => p.name === "Revenue");
  const roas    = payload.find((p) => p.name === "ROAS");

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 shadow-xl text-xs">
      <p className="mb-1.5 font-medium text-slate-300">{label ? fmtDate(label) : ""}</p>
      {spend && (
        <p className="text-indigo-300">
          Spend: <span className="font-semibold text-white">
            {spend.value != null ? fmtDollar(spend.value) : "—"}
          </span>
        </p>
      )}
      {revenue && (
        <p className="text-emerald-400">
          Revenue: <span className="font-semibold text-white">
            {revenue.value != null ? fmtDollar(revenue.value) : "—"}
          </span>
        </p>
      )}
      {roas && (
        <p className="text-amber-300">
          ROAS: <span className="font-semibold text-white">
            {fmtRoas(roas.value)}
          </span>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Props = {
  data:        DailyPoint[];
  showRevenue?: boolean;   // show CRM revenue area (default true)
  showRoas?:    boolean;   // show ROAS line on secondary axis (default true)
  height?:      number;
};

export function TrendChart({
  data,
  showRevenue = true,
  showRoas    = true,
  height      = 260,
}: Props) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40"
        style={{ height }}
      >
        <p className="text-sm text-slate-600">No data available for this period</p>
      </div>
    );
  }

  // Show date labels at ~weekly intervals to avoid crowding.
  const tickIndices = new Set<number>();
  const step = Math.max(1, Math.floor(data.length / 6));
  for (let i = 0; i < data.length; i += step) tickIndices.add(i);
  tickIndices.add(data.length - 1);

  const xTicks = data
    .filter((_, i) => tickIndices.has(i))
    .map((d) => d.date);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 48, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="grad-spend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.20} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#1e293b"
          vertical={false}
        />

        <XAxis
          dataKey="date"
          ticks={xTicks}
          tickFormatter={fmtDate}
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={{ stroke: "#334155" }}
          tickLine={false}
        />

        {/* Left axis — dollars */}
        <YAxis
          yAxisId="dollars"
          tickFormatter={fmtDollar}
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />

        {/* Right axis — ROAS ratio (only rendered if showRoas) */}
        {showRoas && (
          <YAxis
            yAxisId="roas"
            orientation="right"
            tickFormatter={(v) => `${v}x`}
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
            domain={[0, "auto"]}
          />
        )}

        <Tooltip content={<ChartTooltip />} />

        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: "#94a3b8", paddingTop: 8 }}
        />

        {/* Spend area */}
        <Area
          yAxisId="dollars"
          type="monotone"
          dataKey="spend"
          name="Spend"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#grad-spend)"
          dot={false}
          isAnimationActive={false}
          connectNulls={false}
        />

        {/* CRM Revenue area */}
        {showRevenue && (
          <Area
            yAxisId="dollars"
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#grad-revenue)"
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
        )}

        {/* ROAS line (secondary axis) */}
        {showRoas && (
          <Line
            yAxisId="roas"
            type="monotone"
            dataKey="roas"
            name="ROAS"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
            strokeDasharray="5 3"
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
