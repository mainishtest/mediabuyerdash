"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type QuickViewData = {
  dateFrom:       string;
  dateTo:         string;
  fbSpend:        number;
  shopifyRevenue: number;
  orderCount:     number;
  roas:           number | null;
  cpa:            number | null;
};

type DateMode = "yesterday" | "today" | "custom";

// ── Helpers ──────────────────────────────────────────────────────────────────

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getYesterday(): string {
  return toISODate(new Date(Date.now() - 864e5));
}

function getToday(): string {
  return toISODate(new Date());
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v);
}

function fmtNumber(v: number): string {
  return new Intl.NumberFormat("en-US").format(v);
}

// ── Stat card ────────────────────────────────────────────────────────────────

function QuickStat({
  label,
  value,
  subtext,
}: {
  label:    string;
  value:    string;
  subtext?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
      {subtext && (
        <p className="text-xs text-slate-500">{subtext}</p>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function QuickViewSection({ clientId }: { clientId?: string }) {
  const [mode, setMode]           = useState<DateMode>("yesterday");
  const [customFrom, setCustomFrom] = useState(getYesterday());
  const [customTo, setCustomTo]     = useState(getYesterday());
  const [data, setData]           = useState<QuickViewData | null>(null);
  const [loading, setLoading]     = useState(true);

  const dateFrom = mode === "yesterday" ? getYesterday()
                 : mode === "today"     ? getToday()
                 : customFrom;
  const dateTo   = mode === "yesterday" ? getYesterday()
                 : mode === "today"     ? getToday()
                 : customTo;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      if (clientId) params.set("clientId", clientId);
      const res  = await fetch(`/api/executive/quick-view?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, clientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Toggle button style ────────────────────────────────────────────────────

  const btnBase =
    "rounded-lg px-4 py-1.5 text-xs font-medium transition-colors";
  const btnActive =
    "border border-emerald-600 bg-emerald-900/50 text-emerald-300";
  const btnInactive =
    "border border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-300 hover:border-slate-600";

  const inputCls =
    "rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 " +
    "outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors";

  // ── Date label ─────────────────────────────────────────────────────────────

  const dateLabel =
    mode === "yesterday" ? `Yesterday (${getYesterday()})`
    : mode === "today"   ? `Today (${getToday()})`
    : dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`;

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900/80 to-slate-900/40 p-5">
      {/* Header with toggles */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Quick View</h2>
          <p className="text-xs text-slate-500">{dateLabel}</p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {/* Yesterday / Today toggles */}
          <button
            onClick={() => setMode("yesterday")}
            className={`${btnBase} ${mode === "yesterday" ? btnActive : btnInactive}`}
          >
            Yesterday
          </button>
          <button
            onClick={() => setMode("today")}
            className={`${btnBase} ${mode === "today" ? btnActive : btnInactive}`}
          >
            Today
          </button>
          <button
            onClick={() => {
              setMode("custom");
              setCustomFrom(getYesterday());
              setCustomTo(getYesterday());
            }}
            className={`${btnBase} ${mode === "custom" ? btnActive : btnInactive}`}
          >
            Custom
          </button>

          {/* Custom date inputs */}
          {mode === "custom" && (
            <>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className={inputCls}
                aria-label="Quick view from date"
              />
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className={inputCls}
                aria-label="Quick view to date"
              />
            </>
          )}
        </div>
      </div>

      {/* KPI row */}
      {loading ? (
        <div className="flex h-20 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          <QuickStat
            label="FB Spend"
            value={fmtCurrency(data.fbSpend)}
            subtext="Facebook ad account spend"
          />
          <QuickStat
            label="Shopify Revenue"
            value={fmtCurrency(data.shopifyRevenue)}
            subtext="Facebook-attributed orders"
          />
          <QuickStat
            label="Orders"
            value={fmtNumber(data.orderCount)}
            subtext="From Facebook traffic"
          />
          <QuickStat
            label="ROAS"
            value={data.roas !== null ? `${data.roas.toFixed(2)}x` : "—"}
            subtext="Revenue / Spend"
          />
          <QuickStat
            label="CPA"
            value={data.cpa !== null ? fmtCurrency(data.cpa) : "—"}
            subtext="Spend / Orders"
          />
        </div>
      ) : (
        <p className="text-sm text-slate-500">Unable to load quick view data.</p>
      )}
    </div>
  );
}
