"use client";
// components/charts/SparkLine.tsx
// Tiny inline spend sparkline for campaign list rows.
// No axes, no labels, no tooltip — just the trend shape.
// Width is responsive; height is fixed at 36px.

import { AreaChart, Area, ResponsiveContainer } from "recharts";
import type { SparkPoint } from "../../lib/charts/dataService";

type Props = {
  data:  SparkPoint[];
  color?: string;   // tailwind-compatible hex; defaults to indigo
};

export function SparkLine({ data, color = "#6366f1" }: Props) {
  if (!data || data.length < 2) {
    return (
      <span className="block h-9 w-20 rounded bg-slate-800/40" />
    );
  }

  return (
    <span className="block h-9 w-20" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0}   />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="spend"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#spark-${color.replace("#", "")})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </span>
  );
}
