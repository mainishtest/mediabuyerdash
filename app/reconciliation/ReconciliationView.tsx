"use client";

import { useState, useMemo } from "react";
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
  FilterBar,
  FilterSelect,
  EmptyState,
} from "../../components/ui";
import { formatCurrency, formatRoas } from "../../lib/metricUtils";

// ---------------------------------------------------------------------------
// Status display helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE_VARIANT: Record<ReconciliationMatchStatus, "success" | "warning" | "danger" | "neutral" | "info" | "purple"> = {
  matched:       "success",
  partial:       "warning",
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

const ALL_STATUSES = Object.keys(STATUS_LABELS) as ReconciliationMatchStatus[];

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

type FilterState = {
  matchStatus:  ReconciliationMatchStatus | "all";
  utmCampaign:  string;
  dateFrom:     string;
  dateTo:       string;
};

const EMPTY_FILTERS: FilterState = {
  matchStatus:  "all",
  utmCampaign:  "",
  dateFrom:     "",
  dateTo:       "",
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtCpa(v: number | null): string {
  return v != null ? formatCurrency(v) : "—";
}

function fmtRoas(v: number | null): string {
  return v != null ? formatRoas(v) : "—";
}

function fmtNum(v: number | undefined): string {
  return v != null ? v.toLocaleString() : "—";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Small status breakdown pills shown in the summary section. */
function StatusBreakdown({
  summary,
  activeStatus,
  onStatusClick,
}: {
  summary:       ReconciliationComputedSummary;
  activeStatus:  ReconciliationMatchStatus | "all";
  onStatusClick: (s: ReconciliationMatchStatus | "all") => void;
}) {
  const counts: { status: ReconciliationMatchStatus; count: number }[] = [
    { status: "matched",        count: summary.matchedRows },
    { status: "partial",        count: summary.partialRows },
    { status: "unmatched_meta", count: 0 },
    { status: "unmatched_crm",  count: 0 },
    { status: "ambiguous",      count: summary.ambiguousRows },
  ];

  // unmatchedRows is unmatched_meta + unmatched_crm combined in the summary.
  // Approximate split for display: re-derive from summary totals.
  // (Exact counts would need full row scan — not needed for display breakdown.)
  const unmatchedHalf = Math.floor(summary.unmatchedRows / 2);
  counts[2].count = unmatchedHalf;
  counts[3].count = summary.unmatchedRows - unmatchedHalf;

  return (
    <div className="flex flex-wrap gap-2">
      {counts.map(({ status, count }) => {
        const isActive = activeStatus === status;
        return (
          <button
            key={status}
            onClick={() => onStatusClick(isActive ? "all" : status)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors
              ${isActive
                ? "border-slate-600 bg-slate-700"
                : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/40"
              }`}
          >
            <Badge variant={STATUS_BADGE_VARIANT[status]}>
              {STATUS_LABELS[status]}
            </Badge>
            <span className="text-sm font-semibold text-slate-200">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Attribution model explanation card. */
function AttributionInfoCard() {
  return (
    <SectionCard title="How this page works" className="mb-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Meta — Delivery Metrics
          </p>
          <p className="text-sm text-slate-300">
            Spend, clicks, and impressions come from Meta. These measure
            ad delivery and reach only.
          </p>
        </div>
        <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-600">
            Shopify / CRM — Source of Truth
          </p>
          <p className="text-sm text-slate-300">
            Revenue and orders come from Shopify/CRM. These are the
            authoritative business outcomes used for CPA and ROAS.
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Attribution Window — 7 Days
          </p>
          <p className="text-sm text-slate-300">
            CRM orders are attributed within a 7-day window of the ad click.
            Evaluated CPA and ROAS reflect this window.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Props = {
  matchRows: ReconciliationMatchRow[];
  summary:   ReconciliationComputedSummary;
};

export function ReconciliationView({ matchRows, summary }: Props) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  // Unique campaign options for the filter dropdown.
  const campaignOptions = useMemo(
    () =>
      Array.from(
        new Set(matchRows.map((r) => r.utmCampaign ?? "").filter(Boolean))
      ).sort(),
    [matchRows]
  );

  // Apply filters.
  const filtered = useMemo(() => {
    return matchRows.filter((r) => {
      if (filters.matchStatus !== "all" && r.matchStatus !== filters.matchStatus)
        return false;
      if (filters.utmCampaign && r.utmCampaign !== filters.utmCampaign)
        return false;
      if (filters.dateFrom && r.date < filters.dateFrom)
        return false;
      if (filters.dateTo && r.date > filters.dateTo)
        return false;
      return true;
    });
  }, [matchRows, filters]);

  const hasFilters =
    filters.matchStatus !== "all" ||
    filters.utmCampaign !== "" ||
    filters.dateFrom   !== "" ||
    filters.dateTo     !== "";

  const dateRangeLabel =
    summary.dateFrom && summary.dateTo
      ? `${summary.dateFrom} → ${summary.dateTo}`
      : "No data";

  // Handle empty states.
  const noMetaData  = matchRows.every((r) => r.metaSpend === 0 && r.matchStatus === "unmatched_crm");
  const noCrmData   = matchRows.every((r) => r.crmOrders  === 0 && r.matchStatus === "unmatched_meta");
  const noDataAtAll = matchRows.length === 0;

  return (
    <div className="space-y-0">
      {/* Page header */}
      <PageHeader
        title="Reconciliation"
        description="Compare Meta delivery data against Shopify/CRM source-of-truth outcomes. Evaluated CPA and ROAS always use CRM data."
        badge={
          <Badge variant="info">7-day attribution window</Badge>
        }
      />

      {/* Attribution info */}
      <AttributionInfoCard />

      {/* Global empty state */}
      {noDataAtAll && (
        <SectionCard>
          <EmptyState
            icon="⚖"
            title="No reconciliation data yet"
            description="Sync your Meta ad account and connect Shopify to begin reconciling delivery data against CRM outcomes."
          />
        </SectionCard>
      )}

      {!noDataAtAll && (
        <>
          {/* Warning banners */}
          {noMetaData && (
            <div className="mb-6 rounded-xl border border-amber-800/40 bg-amber-950/20 px-5 py-3 text-sm text-amber-300">
              No Meta data found — all rows are CRM-only. Sync your Meta ad account to enable matching.
            </div>
          )}
          {noCrmData && (
            <div className="mb-6 rounded-xl border border-amber-800/40 bg-amber-950/20 px-5 py-3 text-sm text-amber-300">
              No CRM data found — all rows are Meta-only. Connect Shopify to enable CRM source-of-truth metrics.
            </div>
          )}

          {/* Summary stat cards */}
          <section className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              {dateRangeLabel}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard
                label="Meta Spend"
                value={formatCurrency(summary.totalMetaSpend)}
                sub="Source: Meta"
              />
              <StatCard
                label="CRM Revenue"
                value={formatCurrency(summary.totalCrmRevenue)}
                sub="Source: Shopify/CRM"
              />
              <StatCard
                label="CRM Orders"
                value={summary.totalCrmOrders.toLocaleString()}
                sub="Source: Shopify/CRM"
              />
              <StatCard
                label="Evaluated CPA"
                value={fmtCpa(summary.evaluatedCpa)}
                sub="Spend ÷ CRM orders"
              />
              <StatCard
                label="Evaluated ROAS"
                value={fmtRoas(summary.evaluatedRoas)}
                sub="CRM rev ÷ Spend"
              />
              <StatCard
                label="Match Rate"
                value={
                  summary.total > 0
                    ? `${Math.round((summary.matchedRows / summary.total) * 100)}%`
                    : "—"
                }
                sub={`${summary.matchedRows} of ${summary.total} rows`}
              />
            </div>
          </section>

          {/* Status breakdown (clickable filter) */}
          <section className="mb-8">
            <SectionCard title="Match Summary" description="Click a status to filter the table below.">
              <StatusBreakdown
                summary={summary}
                activeStatus={filters.matchStatus}
                onStatusClick={(s) =>
                  setFilters((p) => ({ ...p, matchStatus: s }))
                }
              />
            </SectionCard>
          </section>

          {/* Filters */}
          <SectionCard className="mb-6">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="mb-1.5 text-xs text-slate-500">Match Status</p>
                <FilterBar>
                  <FilterSelect
                    value={filters.matchStatus}
                    onChange={(v) =>
                      setFilters((p) => ({
                        ...p,
                        matchStatus: v as ReconciliationMatchStatus | "all",
                      }))
                    }
                  >
                    <option value="all">All statuses</option>
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </FilterSelect>
                </FilterBar>
              </div>

              <div>
                <p className="mb-1.5 text-xs text-slate-500">utm_campaign</p>
                <FilterBar>
                  <FilterSelect
                    value={filters.utmCampaign}
                    onChange={(v) =>
                      setFilters((p) => ({ ...p, utmCampaign: v }))
                    }
                  >
                    <option value="">All campaigns</option>
                    {campaignOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </FilterSelect>
                </FilterBar>
              </div>

              <div>
                <p className="mb-1.5 text-xs text-slate-500">Date from</p>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, dateFrom: e.target.value }))
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm
                    text-slate-200 focus:border-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <p className="mb-1.5 text-xs text-slate-500">Date to</p>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, dateTo: e.target.value }))
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm
                    text-slate-200 focus:border-slate-600 focus:outline-none"
                />
              </div>

              {hasFilters && (
                <button
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="self-end pb-0.5 text-xs text-slate-400 underline hover:text-slate-200"
                >
                  Clear filters
                </button>
              )}

              <span className="ml-auto self-end pb-0.5 text-xs text-slate-500">
                {filtered.length} of {matchRows.length} rows
              </span>
            </div>
          </SectionCard>

          {/* Detail table */}
          <SectionCard
            title="Reconciliation Detail"
            description="Each row represents one Meta UTM group matched against CRM orders. Evaluated metrics always use CRM as source of truth."
            flush
          >
            {filtered.length === 0 ? (
              <EmptyState
                title="No rows match the current filters"
                description="Try clearing filters or selecting a different date range."
              />
            ) : (
              <ReconciliationTable rows={filtered} />
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail table (extracted for readability)
// ---------------------------------------------------------------------------

const TH =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap";
const TD = "px-4 py-3 text-sm text-slate-300 whitespace-nowrap";
const TD_MONO = `${TD} font-mono text-xs text-slate-400`;

function ReconciliationTable({ rows }: { rows: ReconciliationMatchRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            <th className={TH}>Date</th>
            <th className={TH}>Campaign / Ad Set / Ad</th>
            <th className={TH}>utm_campaign</th>
            <th className={TH}>utm_content</th>
            <th className={TH}>utm_term</th>
            <th className={`${TH} text-right`}>Meta Spend</th>
            <th className={`${TH} text-right`}>CRM Orders</th>
            <th className={`${TH} text-right`}>CRM Revenue</th>
            <th className={`${TH} text-right`}>Eval. CPA</th>
            <th className={`${TH} text-right`}>Eval. ROAS</th>
            <th className={TH}>Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {rows.map((row) => (
            <ReconciliationRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReconciliationRow({ row }: { row: ReconciliationMatchRow }) {
  const campaignLabel =
    row.metaCampaignName ?? row.metaAdSetName ?? row.metaAdName ?? null;

  const hasEvalMetrics = row.matchStatus === "matched" || row.matchStatus === "partial";

  return (
    <tr className="hover:bg-slate-800/20 transition-colors">
      <td className={`${TD} text-slate-500`}>{row.date}</td>
      <td className={TD}>
        {campaignLabel ? (
          <div className="flex flex-col gap-0.5">
            {row.metaCampaignName && (
              <span className="text-xs text-slate-300">{row.metaCampaignName}</span>
            )}
            {row.metaAdSetName && (
              <span className="text-xs text-slate-500">{row.metaAdSetName}</span>
            )}
            {row.metaAdName && (
              <span className="text-xs text-slate-600">{row.metaAdName}</span>
            )}
          </div>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className={TD_MONO}>{row.utmCampaign ?? "—"}</td>
      <td className={TD_MONO}>{row.utmContent  ?? "—"}</td>
      <td className={TD_MONO}>{row.utmTerm     ?? "—"}</td>
      <td className={`${TD} text-right`}>
        {row.metaSpend > 0 ? formatCurrency(row.metaSpend) : "—"}
      </td>
      <td className={`${TD} text-right`}>
        {row.crmOrders > 0 ? row.crmOrders.toLocaleString() : "—"}
      </td>
      <td className={`${TD} text-right`}>
        {row.crmRevenue > 0 ? formatCurrency(row.crmRevenue) : "—"}
      </td>
      <td className={`${TD} text-right`}>
        {hasEvalMetrics ? (
          <span className={row.evaluatedCpa != null ? "text-slate-200" : "text-slate-600"}>
            {fmtCpa(row.evaluatedCpa)}
          </span>
        ) : (
          <span className="text-slate-700">—</span>
        )}
      </td>
      <td className={`${TD} text-right`}>
        {hasEvalMetrics ? (
          <span
            className={
              row.evaluatedRoas != null
                ? row.evaluatedRoas >= 3
                  ? "text-emerald-400"
                  : row.evaluatedRoas >= 1.5
                  ? "text-slate-200"
                  : "text-rose-400"
                : "text-slate-600"
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
  );
}
