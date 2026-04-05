// Column definitions and metric formatters for the Stats table.
// Formatting rules:
//   - Currency: $1,234.56 for large, $0.53 for small, dim zero values
//   - Percentages: 2 decimal places, dim when 0
//   - ROAS: color-coded (green >= 3x, amber >= 1x, red < 1x, dim 0)
//   - Nulls: show "-" (e.g. CPC when clicks = 0)

import type { StatsRow } from "../../../../lib/stats/statsTypes";

export type SortDirection = "asc" | "desc";

export interface StatsColumn {
  key: string;
  header: string;
  align: "left" | "right";
  minW?: string;
  render: (row: StatsRow) => React.ReactNode;
  sortValue: (row: StatsRow) => number | string;
}

// ── Formatters ──────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  if (v === 0) return "$0.00";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtRoas(v: number): string {
  return `${v.toFixed(2)}x`;
}

function fmtPct(v: number): string {
  return `${v.toFixed(2)}%`;
}

function fmtInt(v: number): string {
  if (Number.isInteger(v)) return v.toLocaleString("en-US");
  return v.toFixed(1);
}

// Dim class for zero/null values — reduces noise so non-zero values pop
const DIM = "text-slate-600";

// ── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "ACTIVE";
  const isPaused = status === "PAUSED";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide ${
        isActive ? "bg-emerald-500/10 text-emerald-400" :
        isPaused ? "bg-amber-500/10 text-amber-500/70" :
                   "bg-slate-800 text-slate-500"
      }`}
    >
      <span className={`inline-block h-1 w-1 rounded-full ${
        isActive ? "bg-emerald-400" : isPaused ? "bg-amber-500/70" : "bg-slate-600"
      }`} />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ── Revenue source indicator ────────────────────────────────────────────────

function SourceTag({ source }: { source: string }) {
  if (source === "crm" || source === "none") return null;
  const label = source === "utmContent" ? "utm" : "est";
  const title = source === "utmContent"
    ? "Attributed via UTM content match"
    : "Estimated via spend-share distribution";
  return (
    <span className="ml-1 text-[8px] font-medium uppercase text-slate-600" title={title}>
      {label}
    </span>
  );
}

// ── Column definitions ──────────────────────────────────────────────────────

export const STATS_COLUMNS: StatsColumn[] = [
  {
    key: "status",
    header: "Status",
    align: "left",
    minW: "min-w-[80px]",
    render: (row) => <StatusBadge status={row.status} />,
    sortValue: (row) => (row.status === "ACTIVE" ? 0 : row.status === "PAUSED" ? 1 : 2),
  },
  {
    key: "revenue",
    header: "Sales",
    align: "right",
    minW: "min-w-[90px]",
    render: (row) => (
      <span className={row.revenue === 0 ? DIM : "text-slate-100 font-medium"}>
        {fmtCurrency(row.revenue)}
        <SourceTag source={row.revenueSource} />
      </span>
    ),
    sortValue: (row) => row.revenue,
  },
  {
    key: "spend",
    header: "Spend",
    align: "right",
    minW: "min-w-[90px]",
    render: (row) => (
      <span className={row.spend === 0 ? DIM : "text-slate-100"}>
        {fmtCurrency(row.spend)}
      </span>
    ),
    sortValue: (row) => row.spend,
  },
  {
    key: "roas",
    header: "ROAS",
    align: "right",
    minW: "min-w-[70px]",
    render: (row) => {
      if (row.roas === 0) return <span className={DIM}>-</span>;
      const c =
        row.roas >= 3 ? "text-emerald-400 font-medium" :
        row.roas >= 1 ? "text-amber-400" : "text-red-400";
      return <span className={c}>{fmtRoas(row.roas)}</span>;
    },
    sortValue: (row) => row.roas,
  },
  {
    key: "cpm",
    header: "CPM",
    align: "right",
    minW: "min-w-[70px]",
    render: (row) => (
      <span className={row.cpm === null || row.cpm === 0 ? DIM : "text-slate-300"}>
        {row.cpm === null ? "-" : fmtCurrency(row.cpm)}
      </span>
    ),
    sortValue: (row) => row.cpm ?? 0,
  },
  {
    key: "ctr",
    header: "CTR",
    align: "right",
    minW: "min-w-[60px]",
    render: (row) => (
      <span className={row.ctr === 0 ? DIM : "text-slate-300"}>
        {row.ctr === 0 ? "-" : fmtPct(row.ctr)}
      </span>
    ),
    sortValue: (row) => row.ctr,
  },
  {
    key: "cpc",
    header: "CPC",
    align: "right",
    minW: "min-w-[65px]",
    render: (row) => (
      <span className={row.cpc === null || row.cpc === 0 ? DIM : "text-slate-300"}>
        {row.cpc === null ? "-" : fmtCurrency(row.cpc)}
      </span>
    ),
    sortValue: (row) => row.cpc ?? 0,
  },
  {
    key: "orders",
    header: "Conv.",
    align: "right",
    minW: "min-w-[60px]",
    render: (row) => (
      <span className={row.orders === 0 ? DIM : "text-slate-100"}>
        {row.orders === 0 ? "-" : fmtInt(row.orders)}
        {row.orders > 0 && <SourceTag source={row.revenueSource} />}
      </span>
    ),
    sortValue: (row) => row.orders,
  },
];
