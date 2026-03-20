"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  ReconciliationMatchRow,
  ReconciliationComputedSummary,
  ReconciliationMatchStatus,
} from "../../types/reconciliation";
import {
  PageHeader,
  SectionCard,
  StatCard,
  Badge,
  EmptyState,
} from "../../components/ui";
import { formatCurrency, formatRoas } from "../../lib/metricUtils";
import { fetchAdLevelInsightsAction }  from "./actions";
import type { AdInsightRow }            from "./actions";

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE_VARIANT: Record<ReconciliationMatchStatus, "success" | "warning" | "danger" | "neutral" | "info" | "purple"> = {
  matched:        "success",
  partial:        "warning",
  unmatched_meta: "danger",
  unmatched_crm:  "neutral",
  ambiguous:      "purple",
};

const STATUS_LABELS: Record<ReconciliationMatchStatus, string> = {
  matched:        "Matched",
  partial:        "Partial",
  unmatched_meta: "No CRM",
  unmatched_crm:  "No Meta",
  ambiguous:      "Ambiguous",
};

const STATUS_DESCRIPTIONS: Record<ReconciliationMatchStatus, string> = {
  matched:        "Meta spend matched to CRM orders",
  partial:        "Partial match — some data missing",
  unmatched_meta: "Meta spend with no CRM orders found",
  unmatched_crm:  "CRM orders with no Meta spend found",
  ambiguous:      "Multiple possible matches",
};

const ALL_STATUSES = Object.keys(STATUS_LABELS) as ReconciliationMatchStatus[];

// ---------------------------------------------------------------------------
// Sort state
// ---------------------------------------------------------------------------

type SortKey = "date" | "campaign" | "spend" | "crmRevenue" | "roas" | "cpa" | "crmOrders";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtCpa(v: number | null): string {
  return v != null ? formatCurrency(v) : "—";
}

function fmtRoas(v: number | null): string {
  return v != null ? formatRoas(v) : "—";
}

// ---------------------------------------------------------------------------
// Status pill filter
// ---------------------------------------------------------------------------

function StatusPills({
  rows,
  activeStatus,
  onStatusClick,
}: {
  rows:          ReconciliationMatchRow[];
  activeStatus:  ReconciliationMatchStatus | "all";
  onStatusClick: (s: ReconciliationMatchStatus | "all") => void;
}) {
  const counts = useMemo(() => {
    const c: Record<ReconciliationMatchStatus, number> = {
      matched: 0, partial: 0, unmatched_meta: 0, unmatched_crm: 0, ambiguous: 0,
    };
    for (const r of rows) c[r.matchStatus]++;
    return c;
  }, [rows]);

  return (
    <div className="flex flex-wrap gap-2">
      {ALL_STATUSES.map((status) => {
        const count    = counts[status];
        const isActive = activeStatus === status;
        return (
          <button
            key={status}
            onClick={() => onStatusClick(isActive ? "all" : status)}
            title={STATUS_DESCRIPTIONS[status]}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors
              ${isActive
                ? "border-slate-600 bg-slate-700"
                : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/40"
              }`}
          >
            <Badge variant={STATUS_BADGE_VARIANT[status]}>
              {STATUS_LABELS[status]}
            </Badge>
            <span className="font-semibold text-slate-200">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type ClientOption = { id: string; name: string };

type Props = {
  clients:          ClientOption[];
  clientId:         string | null;
  initialMatchRows: ReconciliationMatchRow[];
  initialSummary:   ReconciliationComputedSummary | null;
  /** The date range that was used to load data from the DB (from URL params). */
  initialDateFrom:  string;
  initialDateTo:    string;
};

export function ReconciliationView({
  clients,
  clientId,
  initialMatchRows,
  initialSummary,
  initialDateFrom,
  initialDateTo,
}: Props) {
  const router = useRouter();
  const [matchRows, setMatchRows] = useState<ReconciliationMatchRow[]>(initialMatchRows);
  const [summary,   setSummary]   = useState<ReconciliationComputedSummary | null>(initialSummary);
  const [running,   setRunning]   = useState(false);
  const [runError,  setRunError]  = useState<string | null>(null);

  // Filters — date state initialised from URL params (the loaded DB range)
  const [activeStatus, setActiveStatus] = useState<ReconciliationMatchStatus | "all">("all");
  const [utmCampaign,  setUtmCampaign]  = useState("");
  const [dateFrom,     setDateFrom]     = useState(initialDateFrom);
  const [dateTo,       setDateTo]       = useState(initialDateTo);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // -------------------------------------------------------------------------
  // URL navigation helpers
  // -------------------------------------------------------------------------

  function buildUrl(overrides: { clientId?: string | null; dateFrom?: string; dateTo?: string }) {
    const id  = overrides.clientId  !== undefined ? overrides.clientId  : clientId;
    const dfr = overrides.dateFrom  !== undefined ? overrides.dateFrom  : dateFrom;
    const dto = overrides.dateTo    !== undefined ? overrides.dateTo    : dateTo;
    const params = new URLSearchParams();
    if (id)  params.set("clientId",  id);
    if (dfr) params.set("dateFrom",  dfr);
    if (dto) params.set("dateTo",    dto);
    return `/reconciliation${params.size > 0 ? `?${params.toString()}` : ""}`;
  }

  function handleClientChange(id: string) {
    router.push(buildUrl({ clientId: id || null }));
  }

  /** Reload the page so the server filters the DB query to the new date range. */
  function handleApplyDates() {
    router.push(buildUrl({}));
  }

  function handleClearFilters() {
    setActiveStatus("all");
    setUtmCampaign("");
    setDateFrom("");
    setDateTo("");
    router.push(buildUrl({ dateFrom: "", dateTo: "" }));
  }

  // -------------------------------------------------------------------------
  // Refresh — re-runs reconciliation, passes current date range to the API
  // -------------------------------------------------------------------------

  async function handleRun() {
    if (!clientId || running) return;
    setRunning(true);
    setRunError(null);
    try {
      const body: Record<string, string> = {};
      if (dateFrom) body.dateFrom = dateFrom;
      if (dateTo)   body.dateTo   = dateTo;

      const res = await fetch(
        `/api/clients/${encodeURIComponent(clientId)}/reconciliation/run`,
        {
          method:  "POST",
          headers: Object.keys(body).length > 0 ? { "Content-Type": "application/json" } : {},
          body:    Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
        }
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setMatchRows(data.matchRows ?? []);
      setSummary(data.summary ?? null);
      setActiveStatus("all");
      setUtmCampaign("");
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  function handleSortClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  // Campaign options for the dropdown
  const campaignOptions = useMemo(
    () =>
      Array.from(
        new Set(matchRows.map((r) => r.utmCampaign ?? "").filter(Boolean))
      ).sort(),
    [matchRows]
  );

  // Filter + sort
  const filtered = useMemo(() => {
    let rows = matchRows.filter((r) => {
      if (activeStatus !== "all" && r.matchStatus !== activeStatus) return false;
      if (utmCampaign && r.utmCampaign !== utmCampaign)              return false;
      // Client-side date filter allows zooming within the already-loaded range
      if (dateFrom && r.date < dateFrom)                              return false;
      if (dateTo   && r.date > dateTo)                               return false;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortKey) {
        case "date":       av = a.date;               bv = b.date;               break;
        case "campaign":   av = a.utmCampaign ?? "";  bv = b.utmCampaign ?? "";  break;
        case "spend":      av = a.metaSpend;          bv = b.metaSpend;          break;
        case "crmRevenue": av = a.crmRevenue;         bv = b.crmRevenue;         break;
        case "crmOrders":  av = a.crmOrders;          bv = b.crmOrders;          break;
        case "roas":       av = a.evaluatedRoas ?? -1;       bv = b.evaluatedRoas ?? -1;       break;
        case "cpa":        av = a.evaluatedCpa  ?? Infinity; bv = b.evaluatedCpa  ?? Infinity; break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1  : -1;
      return 0;
    });

    return rows;
  }, [matchRows, activeStatus, utmCampaign, dateFrom, dateTo, sortKey, sortDir]);

  const hasFilters   = activeStatus !== "all" || utmCampaign !== "" || dateFrom !== "" || dateTo !== "";
  const noDataAtAll  = matchRows.length === 0;
  const noMetaData   = matchRows.length > 0 && matchRows.every((r) => r.metaSpend === 0 && r.matchStatus === "unmatched_crm");
  const noCrmData    = matchRows.length > 0 && matchRows.every((r) => r.crmOrders  === 0 && r.matchStatus === "unmatched_meta");

  const matchedSpend = matchRows.filter((r) => r.matchStatus === "matched" || r.matchStatus === "partial").reduce((s, r) => s + r.metaSpend, 0);
  const totalSpend   = summary?.totalMetaSpend ?? 0;
  const coveragePct  = totalSpend > 0 ? Math.round((matchedSpend / totalSpend) * 100) : null;

  const dateRangeLabel =
    summary?.dateFrom && summary?.dateTo
      ? `${summary.dateFrom} → ${summary.dateTo}`
      : (initialDateFrom && initialDateTo)
      ? `${initialDateFrom} → ${initialDateTo}`
      : null;

  // Whether the current dateFrom/dateTo differs from what's loaded (URL params)
  const datesChanged = dateFrom !== initialDateFrom || dateTo !== initialDateTo;

  return (
    <div className="space-y-0">
      {/* Header + Refresh button */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Reconciliation"
          description="True CPA and ROAS using Shopify/CRM as the source of truth. Meta self-reported conversions are not used."
          badge={<Badge variant="info">7-day attribution window</Badge>}
        />
        {clientId && (
          <div className="pt-6 pr-2 flex flex-col items-end gap-1.5">
            <button
              onClick={handleRun}
              disabled={running}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {running ? "Running…" : "Refresh"}
            </button>
            {runError && <p className="text-xs text-rose-400 max-w-[240px] text-right">{runError}</p>}
          </div>
        )}
      </div>

      {/* Client selector */}
      <SectionCard className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px] max-w-sm">
            <p className="mb-1.5 text-xs text-slate-500">Client</p>
            <select
              value={clientId ?? ""}
              onChange={(e) => handleClientChange(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                text-slate-200 focus:border-slate-600 focus:outline-none"
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      {/* No client */}
      {!clientId && (
        <SectionCard>
          <EmptyState
            icon="⚖"
            title="Select a client to get started"
            description="Choose a client above, then click Refresh to compare Meta spend against Shopify/CRM outcomes."
          />
        </SectionCard>
      )}

      {/* No data yet */}
      {clientId && noDataAtAll && !running && (
        <SectionCard>
          <EmptyState
            icon="⚖"
            title="No reconciliation data yet"
            description='Click "Refresh" to match Meta spend against Shopify orders for this client.'
          />
        </SectionCard>
      )}

      {clientId && !noDataAtAll && summary && (
        <>
          {/* Warning banners */}
          {noMetaData && (
            <div className="mb-6 rounded-xl border border-amber-800/40 bg-amber-950/20 px-5 py-3 text-sm text-amber-300">
              No Meta spend data found — all rows are CRM-only. Sync your Meta ad account to enable matching.
            </div>
          )}
          {noCrmData && (
            <div className="mb-6 rounded-xl border border-amber-800/40 bg-amber-950/20 px-5 py-3 text-sm text-amber-300">
              No CRM data found — all rows are Meta-only. Connect Shopify to see true CPA and ROAS.
            </div>
          )}

          {/* Summary stats */}
          <section className="mb-6">
            {dateRangeLabel && (
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                {dateRangeLabel}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Ad Spend"         value={formatCurrency(summary.totalMetaSpend)} sub="Source: Meta"          />
              <StatCard label="True Revenue"     value={formatCurrency(summary.totalCrmRevenue)} sub="Source: Shopify/CRM"  />
              <StatCard label="Attributed Orders" value={summary.totalCrmOrders.toLocaleString()} sub="Source: Shopify/CRM" />
              <StatCard label="True CPA"         value={fmtCpa(summary.evaluatedCpa)}           sub="Spend ÷ CRM orders"   />
              <StatCard label="True ROAS"        value={fmtRoas(summary.evaluatedRoas)}          sub="CRM rev ÷ spend"      />
              <StatCard label="Spend Coverage"   value={coveragePct != null ? `${coveragePct}%` : "—"} sub="of spend matched to CRM" />
            </div>
          </section>

          {/* Filter bar */}
          <SectionCard className="mb-6">
            <div className="flex flex-col gap-4">
              {/* Status pills */}
              <StatusPills
                rows={matchRows}
                activeStatus={activeStatus}
                onStatusClick={setActiveStatus}
              />

              {/* Secondary filters */}
              <div className="flex flex-wrap items-end gap-3">
                {campaignOptions.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs text-slate-500">Campaign</p>
                    <select
                      value={utmCampaign}
                      onChange={(e) => setUtmCampaign(e.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm
                        text-slate-200 focus:border-slate-600 focus:outline-none"
                    >
                      <option value="">All campaigns</option>
                      {campaignOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Date range — these inputs change local state immediately (client-side
                    filter) and the Apply button reloads from DB for the new range. */}
                <div>
                  <p className="mb-1 text-xs text-slate-500">From</p>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm
                      text-slate-200 focus:border-slate-600 focus:outline-none"
                  />
                </div>

                <div>
                  <p className="mb-1 text-xs text-slate-500">To</p>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm
                      text-slate-200 focus:border-slate-600 focus:outline-none"
                  />
                </div>

                {/* Apply button — reloads page with date params so the DB filters data */}
                <button
                  onClick={handleApplyDates}
                  className={`self-end rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors
                    ${datesChanged
                      ? "border-indigo-700 bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900/60"
                      : "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                >
                  Apply Date Range
                </button>

                {hasFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="self-end pb-0.5 text-xs text-slate-400 underline hover:text-slate-200"
                  >
                    Clear filters
                  </button>
                )}

                <span className="ml-auto self-end pb-0.5 text-xs text-slate-500">
                  {filtered.length} of {matchRows.length} rows
                </span>
              </div>
            </div>
          </SectionCard>

          {/* Detail table */}
          <SectionCard
            title="Campaign Performance"
            description="Click ▶ on a row to drill into ad-level delivery metrics. True CPA and ROAS always use CRM data."
            flush
          >
            {filtered.length === 0 ? (
              <EmptyState
                title="No rows match the current filters"
                description="Try clearing filters or adjusting the date range."
              />
            ) : (
              <ReconciliationTable
                rows={filtered}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSortClick}
                clientId={clientId}
              />
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table with expandable ad drill-down rows
// ---------------------------------------------------------------------------

type DrillDownState = { loading: boolean; rows: AdInsightRow[]; error?: string };

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-slate-700">↕</span>;
  return <span className="ml-1 text-slate-300">{dir === "desc" ? "↓" : "↑"}</span>;
}

const TH_BASE     = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap";
const TH_SORTABLE = `${TH_BASE} cursor-pointer select-none hover:text-slate-300 transition-colors`;
const TD          = "px-4 py-3 text-sm text-slate-300 whitespace-nowrap";
const TD_R        = `${TD} text-right`;

function ReconciliationTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  clientId,
}: {
  rows:     ReconciliationMatchRow[];
  sortKey:  SortKey;
  sortDir:  SortDir;
  onSort:   (k: SortKey) => void;
  clientId: string;
}) {
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [drillCache,  setDrillCache]  = useState<Map<string, DrillDownState>>(new Map());

  async function handleExpand(row: ReconciliationMatchRow) {
    // Toggle — collapse if already expanded
    if (expandedId === row.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(row.id);

    // Skip fetch if already cached
    if (drillCache.has(row.id)) return;

    const campaign = row.utmCampaign ?? null;
    if (!campaign) {
      setDrillCache((prev) => new Map(prev).set(row.id, {
        loading: false,
        rows:    [],
        error:   "No campaign name on this row — cannot drill down.",
      }));
      return;
    }

    // Mark loading
    setDrillCache((prev) => new Map(prev).set(row.id, { loading: true, rows: [] }));

    const result = await fetchAdLevelInsightsAction(clientId, campaign, row.date);
    setDrillCache((prev) => new Map(prev).set(row.id, {
      loading: false,
      rows:    result.rows,
      error:   result.error,
    }));
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            {/* Expand toggle column */}
            <th className="w-10 px-3 py-3" />

            <th className={TH_SORTABLE} onClick={() => onSort("date")}>
              Date <SortIcon active={sortKey === "date"} dir={sortDir} />
            </th>
            <th className={TH_SORTABLE} onClick={() => onSort("campaign")}>
              Campaign <SortIcon active={sortKey === "campaign"} dir={sortDir} />
            </th>
            <th className={`${TH_SORTABLE} text-right`} onClick={() => onSort("spend")}>
              Ad Spend <SortIcon active={sortKey === "spend"} dir={sortDir} />
            </th>
            <th className={`${TH_SORTABLE} text-right`} onClick={() => onSort("crmOrders")}>
              Orders <SortIcon active={sortKey === "crmOrders"} dir={sortDir} />
            </th>
            <th className={`${TH_SORTABLE} text-right`} onClick={() => onSort("crmRevenue")}>
              True Revenue <SortIcon active={sortKey === "crmRevenue"} dir={sortDir} />
            </th>
            <th className={`${TH_SORTABLE} text-right`} onClick={() => onSort("cpa")}>
              True CPA <SortIcon active={sortKey === "cpa"} dir={sortDir} />
            </th>
            <th className={`${TH_SORTABLE} text-right`} onClick={() => onSort("roas")}>
              True ROAS <SortIcon active={sortKey === "roas"} dir={sortDir} />
            </th>
            <th className={TH_BASE}>Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {rows.map((row) => {
            const isExpanded = expandedId === row.id;
            const drill      = drillCache.get(row.id);
            return (
              <ReconciliationRowGroup
                key={row.id}
                row={row}
                isExpanded={isExpanded}
                drill={drill}
                onExpand={() => handleExpand(row)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row group — campaign row + optional ad drill-down expansion
// ---------------------------------------------------------------------------

function ReconciliationRowGroup({
  row,
  isExpanded,
  drill,
  onExpand,
}: {
  row:        ReconciliationMatchRow;
  isExpanded: boolean;
  drill:      DrillDownState | undefined;
  onExpand:   () => void;
}) {
  const hasEvalMetrics = row.matchStatus === "matched" || row.matchStatus === "partial";
  const campaignLabel  = row.utmCampaign ?? row.matchKey ?? null;
  const canExpand      = !!row.utmCampaign;

  return (
    <>
      {/* Campaign row */}
      <tr className={`transition-colors ${isExpanded ? "bg-slate-800/30" : "hover:bg-slate-800/20"}`}>

        {/* Expand toggle */}
        <td className="px-3 py-3">
          <button
            onClick={onExpand}
            disabled={!canExpand}
            title={canExpand ? "Drill down to ad level" : "No campaign name — cannot drill down"}
            className={`flex h-6 w-6 items-center justify-center rounded text-xs transition-colors
              ${canExpand
                ? "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                : "cursor-default text-slate-700"
              }`}
          >
            {isExpanded ? "▼" : "▶"}
          </button>
        </td>

        <td className={`${TD} text-slate-500`}>{row.date}</td>

        <td className={TD}>
          {campaignLabel
            ? <span className="text-slate-200">{campaignLabel}</span>
            : <span className="text-slate-600">—</span>}
        </td>

        <td className={TD_R}>
          {row.metaSpend > 0 ? formatCurrency(row.metaSpend) : <span className="text-slate-600">—</span>}
        </td>

        <td className={TD_R}>
          {row.crmOrders > 0 ? row.crmOrders.toLocaleString() : <span className="text-slate-600">—</span>}
        </td>

        <td className={TD_R}>
          {row.crmRevenue > 0 ? formatCurrency(row.crmRevenue) : <span className="text-slate-600">—</span>}
        </td>

        <td className={TD_R}>
          {hasEvalMetrics
            ? <span className={row.evaluatedCpa != null ? "text-slate-200" : "text-slate-600"}>{fmtCpa(row.evaluatedCpa)}</span>
            : <span className="text-slate-700">—</span>}
        </td>

        <td className={TD_R}>
          {hasEvalMetrics && row.evaluatedRoas != null ? (
            <span
              className={
                row.evaluatedRoas >= 3   ? "font-semibold text-emerald-400" :
                row.evaluatedRoas >= 1.5 ? "text-slate-200"                 : "text-rose-400"
              }
            >
              {fmtRoas(row.evaluatedRoas)}
            </span>
          ) : (
            <span className="text-slate-700">—</span>
          )}
        </td>

        <td className={TD}>
          <Badge variant={STATUS_BADGE_VARIANT[row.matchStatus]}>
            {STATUS_LABELS[row.matchStatus]}
          </Badge>
        </td>
      </tr>

      {/* Ad drill-down row — spans all 9 columns */}
      {isExpanded && (
        <tr className="bg-slate-950/40">
          <td colSpan={9} className="px-6 pb-4 pt-2">
            <AdDrillDownPanel drill={drill} date={row.date} />
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Ad drill-down panel — shown inside the expanded row
// ---------------------------------------------------------------------------

function AdDrillDownPanel({
  drill,
  date,
}: {
  drill: DrillDownState | undefined;
  date:  string;
}) {
  if (!drill || drill.loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-slate-500">
        <span className="animate-pulse">●</span>
        Loading ad-level data for {date}…
      </div>
    );
  }

  if (drill.error) {
    return (
      <div className="rounded-lg border border-amber-800/30 bg-amber-950/20 px-4 py-3 text-xs text-amber-300">
        {drill.error}
      </div>
    );
  }

  if (drill.rows.length === 0) {
    return (
      <p className="py-3 text-xs text-slate-600">
        No ad-level data found for {date}. Meta may not have synced insights at the ad level for this date.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
        Ad breakdown — {date} · Meta delivery only · no CRM data at ad level
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/60">
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-widest text-slate-600">Ad Name</th>
              <th className="px-3 py-2 text-right font-semibold uppercase tracking-widest text-slate-600">Spend</th>
              <th className="px-3 py-2 text-right font-semibold uppercase tracking-widest text-slate-600">Impressions</th>
              <th className="px-3 py-2 text-right font-semibold uppercase tracking-widest text-slate-600">Clicks</th>
              <th className="px-3 py-2 text-right font-semibold uppercase tracking-widest text-slate-600">CTR</th>
              <th className="px-3 py-2 text-right font-semibold uppercase tracking-widest text-slate-600">Avg. Freq.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {drill.rows.map((ad) => (
              <tr key={ad.externalAdId} className="hover:bg-slate-800/20 transition-colors">
                <td className="px-3 py-2 text-slate-300 max-w-[240px] truncate">
                  {ad.adName ?? <span className="text-slate-600">{ad.externalAdId}</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                  {formatCurrency(ad.spend)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                  {ad.impressions.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                  {ad.clicks.toLocaleString()}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums font-medium
                  ${ad.ctr >= 1.5 ? "text-emerald-400" : ad.ctr < 0.8 ? "text-rose-400" : "text-slate-300"}`}
                >
                  {ad.ctr.toFixed(2)}%
                </td>
                <td className={`px-3 py-2 text-right tabular-nums
                  ${ad.avgFrequency != null && ad.avgFrequency > 3.5 ? "text-amber-400" : "text-slate-400"}`}
                >
                  {ad.avgFrequency != null ? `${ad.avgFrequency.toFixed(1)}x` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
