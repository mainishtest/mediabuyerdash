"use client";

import { useState, useMemo } from "react";
import Link                   from "next/link";
import type {
  CreativePerformanceRow,
  CreativePerformanceSummary,
} from "../../../lib/creativePerformance/types";
import { EvaluationSignal, EvaluationCard } from "../../../components/ui/EvaluationBadge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt$  (n: number):         string { return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtN  (n: number):         string { return n.toLocaleString(); }
function fmtPct(n: number | null):  string { return n == null ? "—" : `${n.toFixed(2)}%`; }
function fmtX  (n: number | null):  string { return n == null ? "—" : `${n.toFixed(2)}x`; }
function fmt$2 (n: number | null):  string { return n == null ? "—" : `$${n.toFixed(2)}`; }
function fmtRoas(n: number):        string { return `${n.toFixed(2)}x`; }

// ---------------------------------------------------------------------------
// Sort types
// ---------------------------------------------------------------------------

type SortKey = "spend" | "impressions" | "clicks" | "conversions" | "revenue"
             | "ctr"   | "cpc"         | "cpm"    | "cpa"         | "roas" | "cvr";

type SortDir = "asc" | "desc";

const SORTABLE_COLUMNS: { key: SortKey; label: string; format: (r: CreativePerformanceRow) => string }[] = [
  { key: "spend",       label: "Spend",       format: r => fmt$(r.spend) },
  { key: "revenue",     label: "Revenue",     format: r => fmt$(Math.round(r.revenue)) },
  { key: "roas",        label: "ROAS",        format: r => fmtRoas(r.roas) },
  { key: "cpa",         label: "CPA",         format: r => fmt$2(r.cpa) },
  { key: "ctr",         label: "CTR",         format: r => fmtPct(r.ctr) },
  { key: "cvr",         label: "CVR",         format: r => fmtPct(r.cvr) },
  { key: "clicks",      label: "Clicks",      format: r => fmtN(r.clicks) },
  { key: "impressions", label: "Impr.",        format: r => fmtN(r.impressions) },
  { key: "conversions", label: "Conv.",        format: r => r.conversions.toFixed(1) },
  { key: "cpc",         label: "CPC",         format: r => fmt$2(r.cpc) },
  { key: "cpm",         label: "CPM",         format: r => fmt$2(r.cpm) },
];

function sortValue(row: CreativePerformanceRow, key: SortKey): number {
  const v = row[key];
  return v == null ? -Infinity : (v as number);
}

// ---------------------------------------------------------------------------
// CreativeThumbnail
// ---------------------------------------------------------------------------

function CreativeThumbnail({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded bg-slate-800">
        <span className="text-lg text-slate-600">◻</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className="h-full w-full rounded object-cover"
      onError={() => setFailed(true)}
    />
  );
}

// ---------------------------------------------------------------------------
// ROAS colouring helper
// ---------------------------------------------------------------------------

function roasColor(roas: number): string {
  if (roas >= 3)   return "text-emerald-400";
  if (roas >= 1.5) return "text-slate-200";
  if (roas >= 1)   return "text-amber-400";
  return "text-rose-400";
}

// ---------------------------------------------------------------------------
// SummaryBar — aggregate totals strip
// ---------------------------------------------------------------------------

function SummaryBar({ s }: { s: CreativePerformanceSummary }) {
  const items = [
    { label: "Creatives",    value: fmtN(s.totalCreatives)  },
    { label: "Spend",        value: fmt$(Math.round(s.totalSpend)) },
    { label: "Revenue",      value: fmt$(Math.round(s.totalRevenue)) },
    { label: "ROAS",         value: fmtRoas(s.aggregateRoas) },
    { label: "CPA",          value: fmt$2(s.aggregateCpa) },
    { label: "CTR",          value: fmtPct(s.aggregateCtr) },
    { label: "Conversions",  value: s.totalConversions.toFixed(1) },
    { label: "Clicks",       value: fmtN(s.totalClicks) },
  ];

  return (
    <div className="mb-6 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex min-w-max divide-x divide-slate-800">
        {items.map(item => (
          <div key={item.label} className="px-4 py-3">
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-100">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile CreativeCard
// Prominent: ROAS, CPA, Spend. Secondary: CTR, CVR, Clicks, Conversions.
// ---------------------------------------------------------------------------

function CreativeCard({ row }: { row: CreativePerformanceRow }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      {/* Top: thumbnail + identity */}
      <div className="flex gap-3 p-4">
        <div className="h-16 w-16 shrink-0">
          <CreativeThumbnail src={row.thumbnailUrl} name={row.adName} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-100">{row.adName}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{row.campaignName}</p>
          <p className="truncate text-xs text-slate-600">{row.clientName}</p>
        </div>
      </div>

      {/* Primary metrics: ROAS, CPA, Spend */}
      <div className="grid grid-cols-3 gap-px border-t border-slate-800 bg-slate-800">
        <div className="bg-slate-900 px-4 py-3 text-center">
          <p className="text-xs text-slate-500">ROAS</p>
          <p className={`mt-0.5 text-lg font-bold ${roasColor(row.roas)}`}>
            {fmtRoas(row.roas)}
          </p>
        </div>
        <div className="bg-slate-900 px-4 py-3 text-center">
          <p className="text-xs text-slate-500">CPA</p>
          <p className="mt-0.5 text-lg font-bold text-slate-100">{fmt$2(row.cpa)}</p>
        </div>
        <div className="bg-slate-900 px-4 py-3 text-center">
          <p className="text-xs text-slate-500">Spend</p>
          <p className="mt-0.5 text-lg font-bold text-slate-100">{fmt$(Math.round(row.spend))}</p>
        </div>
      </div>

      {/* Secondary metrics strip — toggled */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center justify-between border-t border-slate-800 px-4 py-2 text-left"
      >
        <span className="text-xs text-slate-500">
          Revenue: <span className="text-slate-300">{fmt$(Math.round(row.revenue))}</span>
          {" · "}CTR: <span className="text-slate-300">{fmtPct(row.ctr)}</span>
          {" · "}Clicks: <span className="text-slate-300">{fmtN(row.clicks)}</span>
        </span>
        <span className="text-xs text-slate-600">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="grid grid-cols-3 gap-3 border-t border-slate-800 px-4 py-3 sm:grid-cols-4">
          {[
            { label: "Revenue",  value: fmt$(Math.round(row.revenue)) },
            { label: "CVR",      value: fmtPct(row.cvr)  },
            { label: "Conv.",    value: row.conversions.toFixed(1) },
            { label: "Impr.",    value: fmtN(row.impressions) },
            { label: "CPC",      value: fmt$2(row.cpc)   },
            { label: "CPM",      value: fmt$2(row.cpm)   },
          ].map(m => (
            <div key={m.label}>
              <p className="text-xs text-slate-500">{m.label}</p>
              <p className="mt-0.5 text-sm font-medium text-slate-300">{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Ad copy snippet */}
      {row.adCopy && (
        <p className="border-t border-slate-800 px-4 py-2 text-xs italic text-slate-600 line-clamp-1">
          &ldquo;{row.adCopy}&rdquo;
        </p>
      )}

      {/* Phase 3 evaluation signal */}
      <div className="border-t border-slate-800 px-4 py-3">
        <EvaluationCard evaluation={row.evaluation} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortHeader — desktop table column header with sort toggle
// ---------------------------------------------------------------------------

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
}: {
  label:   string;
  sortKey: SortKey;
  current: SortKey;
  dir:     SortDir;
  onSort:  (k: SortKey) => void;
}) {
  const active = current === sortKey;

  return (
    <th
      scope="col"
      className="cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-right text-xs font-medium
                 uppercase tracking-wide text-slate-500 hover:text-slate-300 transition-colors"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {active && (
        <span className="ml-1 text-slate-400">{dir === "desc" ? "↓" : "↑"}</span>
      )}
    </th>
  );
}

// ---------------------------------------------------------------------------
// Desktop table row
// ---------------------------------------------------------------------------

function TableRow({ row }: { row: CreativePerformanceRow }) {
  return (
    <tr className="border-t border-slate-800 hover:bg-slate-800/40 transition-colors">
      {/* Creative identity */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 shrink-0">
            <CreativeThumbnail src={row.thumbnailUrl} name={row.adName} />
          </div>
          <div className="min-w-0">
            <p className="truncate max-w-[180px] text-sm font-medium text-slate-200"
               title={row.adName}>
              {row.adName}
            </p>
            <p className="truncate max-w-[180px] text-xs text-slate-500"
               title={row.campaignName}>
              {row.campaignName}
            </p>
          </div>
        </div>
      </td>

      {/* Metrics — right-aligned for fast scanning */}
      <td className="px-3 py-2.5 text-right text-sm font-medium text-slate-200">
        {fmt$(Math.round(row.spend))}
      </td>
      <td className="px-3 py-2.5 text-right text-sm text-slate-300">
        {fmt$(Math.round(row.revenue))}
      </td>
      <td className={`px-3 py-2.5 text-right text-sm font-semibold ${roasColor(row.roas)}`}>
        {fmtRoas(row.roas)}
      </td>
      <td className="px-3 py-2.5 text-right text-sm text-slate-300">{fmt$2(row.cpa)}</td>
      <td className="px-3 py-2.5 text-right text-sm text-slate-300">{fmtPct(row.ctr)}</td>
      <td className="px-3 py-2.5 text-right text-sm text-slate-300">{fmtPct(row.cvr)}</td>
      <td className="px-3 py-2.5 text-right text-sm text-slate-400">{fmtN(row.clicks)}</td>
      <td className="px-3 py-2.5 text-right text-sm text-slate-400">
        {row.conversions.toFixed(1)}
      </td>
      <td className="px-3 py-2.5">
        <EvaluationSignal evaluation={row.evaluation} showRec={false} />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-8 py-14 text-center">
      <p className="text-sm font-medium text-slate-300">No creative performance data</p>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-500">
        Creative performance requires ad-level Meta insights synced for at least
        one client. Run a sync from Integrations, then return here.
      </p>
      <Link
        href="/integrations"
        className="mt-5 inline-block rounded-lg border border-slate-700 bg-slate-800
                   px-5 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700
                   transition-colors"
      >
        Go to Integrations
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PerformanceView({
  rows,
  summary,
  dateFrom,
  dateTo,
}: {
  rows:     CreativePerformanceRow[];
  summary:  CreativePerformanceSummary;
  dateFrom: string;
  dateTo:   string;
}) {
  const [sortKey,  setSortKey]  = useState<SortKey>("spend");
  const [sortDir,  setSortDir]  = useState<SortDir>("desc");
  const [search,   setSearch]   = useState("");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  // Filter + sort
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? rows.filter(r =>
          r.adName.toLowerCase().includes(q)       ||
          r.campaignName.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q)   ||
          (r.creativeName ?? "").toLowerCase().includes(q)
        )
      : rows;

    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [rows, search, sortKey, sortDir]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 lg:px-8">

      {/* Sub-nav */}
      <nav className="mb-6 flex gap-4 border-b border-slate-800 pb-3 text-sm">
        <Link href="/creative-lab"
              className="text-slate-500 hover:text-slate-300 transition-colors">
          Creative Lab
        </Link>
        <Link href="/creative-lab/images"
              className="text-slate-500 hover:text-slate-300 transition-colors">
          Images
        </Link>
        <span className="font-medium text-white">Performance</span>
      </nav>

      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Creative Performance</h1>
          <p className="mt-1 text-sm text-slate-400">
            Ad-level delivery from Meta · CRM-attributed revenue &amp; conversions
            · {dateFrom} – {dateTo}
          </p>
        </div>
      </div>

      {/* No data */}
      {rows.length === 0 && <EmptyState />}

      {rows.length > 0 && (
        <>
          {/* Summary bar */}
          <SummaryBar s={summary} />

          {/* Search + sort controls */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="Search ad or campaign…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900
                         px-3 text-sm text-slate-200 placeholder-slate-500 outline-none
                         focus:border-slate-500 sm:w-64"
            />
            {/* Mobile sort select */}
            <div className="flex items-center gap-2 lg:hidden">
              <label className="text-xs text-slate-500">Sort:</label>
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                className="h-9 rounded-lg border border-slate-700 bg-slate-900
                           px-2 text-sm text-slate-200 outline-none focus:border-slate-500"
              >
                {SORTABLE_COLUMNS.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
              <button
                onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
                className="h-9 rounded-lg border border-slate-700 bg-slate-900
                           px-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                {sortDir === "desc" ? "↓" : "↑"}
              </button>
            </div>
          </div>

          {/* No match after filter */}
          {visible.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 py-10 text-center">
              <p className="text-sm text-slate-500">No creatives match &ldquo;{search}&rdquo;.</p>
            </div>
          )}

          {visible.length > 0 && (
            <>
              {/* ── Mobile: stacked cards ─────────────────────────────── */}
              <div className="grid grid-cols-1 gap-4 lg:hidden">
                {visible.map(row => (
                  <CreativeCard key={row.adId} row={row} />
                ))}
              </div>

              {/* ── Desktop: sortable table ───────────────────────────── */}
              <div className="hidden lg:block">
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full min-w-[900px] border-collapse text-left">
                    <thead className="bg-slate-900">
                      <tr>
                        <th scope="col"
                            className="px-3 py-2.5 text-xs font-medium uppercase
                                       tracking-wide text-slate-500">
                          Creative / Ad
                        </th>
                        {(["spend","revenue","roas","cpa","ctr","cvr","clicks","conversions"] as SortKey[]).map(k => {
                          const col = SORTABLE_COLUMNS.find(c => c.key === k)!;
                          return (
                            <SortHeader
                              key={k}
                              label={col.label}
                              sortKey={k}
                              current={sortKey}
                              dir={sortDir}
                              onSort={handleSort}
                            />
                          );
                        })}
                        <th scope="col"
                            className="px-3 py-2.5 text-xs font-medium uppercase
                                       tracking-wide text-slate-500">
                          Signal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {visible.map(row => (
                        <TableRow key={row.adId} row={row} />
                      ))}
                    </tbody>

                    {/* Summary footer row */}
                    <tfoot className="border-t-2 border-slate-700 bg-slate-900/80">
                      <tr>
                        <td className="px-3 py-2.5 text-xs font-medium text-slate-400">
                          {visible.length} ad{visible.length !== 1 ? "s" : ""}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-semibold text-slate-200">
                          {fmt$(Math.round(visible.reduce((s,r) => s + r.spend, 0)))}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-semibold text-slate-200">
                          {fmt$(Math.round(visible.reduce((s,r) => s + r.revenue, 0)))}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-semibold text-slate-400">—</td>
                        <td className="px-3 py-2.5 text-right text-sm font-semibold text-slate-400">—</td>
                        <td className="px-3 py-2.5 text-right text-sm font-semibold text-slate-400">—</td>
                        <td className="px-3 py-2.5 text-right text-sm font-semibold text-slate-400">—</td>
                        <td className="px-3 py-2.5 text-right text-sm text-slate-400">
                          {fmtN(visible.reduce((s,r) => s + r.clicks, 0))}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm text-slate-400">
                          {visible.reduce((s,r) => s + r.conversions, 0).toFixed(1)}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-slate-600">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Attribution quality + data notes */}
          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4">
            <p className="text-xs font-medium text-slate-400">Data notes</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              <li>
                · Attribution:{" "}
                <span className="text-slate-400">
                  {(summary.utmMatchRate * 100).toFixed(0)}% direct utm_content match
                  {" · "}
                  {(summary.windowMatchRate * 100).toFixed(0)}% spend-share (7-day window)
                  {" · "}
                  {(summary.unattributedRate * 100).toFixed(0)}% unattributed
                </span>
              </li>
              <li>· ROAS = CRM revenue ÷ Meta spend. CPA = Meta spend ÷ CRM conversions. Meta&apos;s own conversion data is not used.</li>
              <li>· Spend-share: campaign revenue distributed proportionally across ads by their spend in the 7 days before each order. Fractional conversions sum to campaign totals.</li>
              <li>· Dates follow the ad account&apos;s timezone. Shopify orders are bucketed into that same timezone.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
