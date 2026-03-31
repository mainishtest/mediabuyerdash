// Column definitions and metric formatters for the Stats table.
// Each column defines how to render and sort its values.
// Column order matches the spec: Status, Revenue, Spend, ROAS, CPM, CTR, CPC, Conversions.

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

// ── Formatters ──────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  if (v === 0) return "$0.00";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtRoas(v: number): string {
  return `${v.toFixed(2)}x`;
}

function fmtPercent(v: number): string {
  return `${v.toFixed(2)}%`;
}

function fmtInt(v: number): string {
  if (Number.isInteger(v)) return v.toLocaleString("en-US");
  return v.toFixed(1);
}

function fmtNullCurrency(v: number | null): string {
  return v === null ? "-" : fmtCurrency(v);
}

// ── Status badge ────────────────────────────────────────────────────────────

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

// ── Revenue source indicator ────────────────────────────────────────────────

function SourceTag({ source }: { source: string }) {
  if (source === "crm" || source === "none") return null;
  const label = source === "utmContent" ? "UTM" : "Est.";
  const title = source === "utmContent"
    ? "Attributed via UTM content match"
    : "Estimated via spend-share distribution";
  return (
    <span className="ml-1 text-[9px] font-medium uppercase text-slate-600" title={title}>
      {label}
    </span>
  );
}

// ── Column definitions (matches spec order) ─────────────────────────────────

export const STATS_COLUMNS: StatsColumn[] = [
  {
    key: "status",
    header: "Status",
    align: "left",
    width: "w-24",
    render: (row) => <StatusBadge status={row.status} />,
    sortValue: (row) => (row.status === "ACTIVE" ? 0 : 1), // ACTIVE sorts first
  },
  {
    key: "revenue",
    header: "Sales",
    align: "right",
    render: (row) => (
      <>
        {fmtCurrency(row.revenue)}
        <SourceTag source={row.revenueSource} />
      </>
    ),
    sortValue: (row) => row.revenue,
  },
  {
    key: "spend",
    header: "Spend",
    align: "right",
    render: (row) => fmtCurrency(row.spend),
    sortValue: (row) => row.spend,
  },
  {
    key: "roas",
    header: "ROAS",
    align: "right",
    render: (row) => {
      const c =
        row.roas >= 3 ? "text-emerald-400" :
        row.roas >= 1 ? "text-amber-400"   :
        row.roas > 0  ? "text-red-400"     : "text-slate-500";
      return <span className={c}>{fmtRoas(row.roas)}</span>;
    },
    sortValue: (row) => row.roas,
  },
  {
    key: "cpm",
    header: "CPM",
    align: "right",
    render: (row) => fmtNullCurrency(row.cpm),
    sortValue: (row) => row.cpm ?? 0,
  },
  {
    key: "ctr",
    header: "CTR",
    align: "right",
    render: (row) => fmtPercent(row.ctr),
    sortValue: (row) => row.ctr,
  },
  {
    key: "cpc",
    header: "CPC",
    align: "right",
    render: (row) => fmtNullCurrency(row.cpc),
    sortValue: (row) => row.cpc ?? 0,
  },
  {
    key: "orders",
    header: "Conv.",
    align: "right",
    render: (row) => (
      <>
        {fmtInt(row.orders)}
        <SourceTag source={row.revenueSource} />
      </>
    ),
    sortValue: (row) => row.orders,
  },
];
