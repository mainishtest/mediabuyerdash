"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import type { ExecutiveTrendSummary } from "../../../../lib/executiveReporting/types";

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtK(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?:  boolean;
  payload?: { name: string; value: number; color: string }[];
  label?:   string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-slate-300">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="leading-relaxed">
          {p.name}: {p.name === "ROAS" ? `${p.value.toFixed(2)}x` : fmtK(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyTrend() {
  return (
    <div className="flex h-40 items-center justify-center">
      <p className="text-sm text-slate-500">
        No day-level data available for this period.
      </p>
    </div>
  );
}

// ── Spend / Revenue chart ─────────────────────────────────────────────────────

function SpendRevenueChart({ data }: { data: ExecutiveTrendSummary["byDay"] }) {
  if (data.length === 0) return <EmptyTrend />;

  const formatted = data.map((d) => ({
    date:    fmtDate(d.date),
    Spend:   Math.round(d.spend),
    Revenue: Math.round(d.revenue),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#34d399" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#34d399" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="gradSpend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={fmtK}
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="Revenue"
          stroke="#34d399"
          strokeWidth={1.5}
          fill="url(#gradRevenue)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="Spend"
          stroke="#38bdf8"
          strokeWidth={1.5}
          fill="url(#gradSpend)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── ROAS chart ────────────────────────────────────────────────────────────────

function RoasChart({ data }: { data: ExecutiveTrendSummary["byDay"] }) {
  const filtered = data.filter((d) => d.roas !== null);
  if (filtered.length === 0) return <EmptyTrend />;

  const formatted = filtered.map((d) => ({
    date: fmtDate(d.date),
    ROAS: d.roas!,
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v) => `${v.toFixed(1)}x`}
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} />
        {/* Breakeven reference */}
        <Line
          type="monotone"
          dataKey="ROAS"
          stroke="#fbbf24"
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-6 rounded-full"
            style={{ background: i.color }}
          />
          <span className="text-xs text-slate-500">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export function TrendSection({ trend }: { trend: ExecutiveTrendSummary }) {
  const hasRoasData = trend.byDay.some((d) => d.roas !== null);

  return (
    <div className="space-y-4">
      {/* Spend + Revenue */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Spend & CRM Revenue</h2>
          <Legend
            items={[
              { color: "#34d399", label: "CRM Revenue" },
              { color: "#38bdf8", label: "Spend"       },
            ]}
          />
        </div>
        <SpendRevenueChart data={trend.byDay} />
        <p className="mt-2 text-xs text-slate-600">
          Revenue is CRM-attributed (7-day window). Spend is Meta delivery.
        </p>
      </div>

      {/* ROAS trend */}
      {hasRoasData && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">ROAS Trend</h2>
            <Legend items={[{ color: "#fbbf24", label: "ROAS" }]} />
          </div>
          <RoasChart data={trend.byDay} />
        </div>
      )}
    </div>
  );
}
