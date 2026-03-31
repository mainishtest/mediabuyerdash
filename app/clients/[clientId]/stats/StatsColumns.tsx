// app/clients/[clientId]/stats/StatsColumns.tsx
// Column definitions and metric formatters for the Stats table.

import type { StatsRow } from "../../../../lib/stats/statsTypes";

export type SortDirection = "asc" | "desc";

export interface StatsColumn {
  key: string;
  header: string;
  align: "left" | "right";
  width?: string;
  render: (row: StatsRow) => React.ReactNode;
  sortValue: (row: StatsRow) => number | string;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtCurrency(v: number): string {
  if (v === 0) return "$0.00";
  if (v >= 1000) return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${v.toFixed(2)}`;
}

function fmtRoas(v: number): string {
  if (v === 0) return "0.00x";
  return `${v.toFixed(2)}x`;
}

function fmtPercent(v: number): string {
  if (v === 0) return "0.00%";
  return `${v.toFixed(2)}%`;
}

function fmtNumber(v: number): string {
  if (v === 0) return "0";
  if (Number.isInteger(v)) return v.toLocaleString("en-US");
  return v.toFixed(1);
}

function fmtNullCurrency(v: number | null): string {
  if (v === null) return "-";
  return fmtCurrency(v);
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "ACTIVE";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        isActive
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-slate-700/50 text-slate-500"
      }`}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Revenue source indicator
// ---------------------------------------------------------------------------

function RevenueIndicator({ source }: { source: string }) {
  if (source === "crm") return null;
  if (source === "none") return null;
  const label = source === "utmContent" ? "UTM" : "Est.";
  return (
    <span className="ml-1 text-[9px] font-medium uppercase text-slate-600" title={
      source === "utmContent" ? "Attributed via UTM content match" : "Estimated via spend-share distribution"
    }>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

export const STATS_COLUMNS: StatsColumn[] = [
  {
    key: "status",
    header: "Status",
    align: "left",
    width: "w-20",
    render: (row) => <StatusBadge status={row.status} />,
    sortValue: (row) => row.status,
  },
  {
    key: "revenue",
    header: "Revenue",
    align: "right",
    render: (row) => (
      <span className="text-slate-200">
        {fmtCurrency(row.revenue)}
        <RevenueIndicator source={row.revenueSource} />
      </span>
    ),
    sortValue: (row) => row.revenue,
  },
  {
    key: "spend",
    header: "Spend",
    align: "right",
    render: (row) => <span className="text-slate-200">{fmtCurrency(row.spend)}</span>,
    sortValue: (row) => row.spend,
  },
  {
    key: "roas",
    header: "ROAS",
    align: "right",
    render: (row) => {
      const color = row.roas >= 3 ? "text-emerald-400" : row.roas >= 1 ? "text-amber-400" : row.roas > 0 ? "text-red-400" : "text-slate-500";
      return <span className={color}>{fmtRoas(row.roas)}</span>;
    },
    sortValue: (row) => row.roas,
  },
  {
    key: "cpm",
    header: "CPM",
    align: "right",
    render: (row) => <span className="text-slate-300">{fmtNullCurrency(row.cpm)}</span>,
    sortValue: (row) => row.cpm ?? 0,
  },
  {
    key: "ctr",
    header: "CTR",
    align: "right",
    render: (row) => <span className="text-slate-300">{fmtPercent(row.ctr)}</span>,
    sortValue: (row) => row.ctr,
  },
  {
    key: "cpc",
    header: "CPC",
    align: "right",
    render: (row) => <span className="text-slate-300">{fmtNullCurrency(row.cpc)}</span>,
    sortValue: (row) => row.cpc ?? 0,
  },
  {
    key: "orders",
    header: "Sales",
    align: "right",
    render: (row) => (
      <span className="text-slate-200">
        {fmtNumber(row.orders)}
        <RevenueIndicator source={row.revenueSource} />
      </span>
    ),
    sortValue: (row) => row.orders,
  },
];
