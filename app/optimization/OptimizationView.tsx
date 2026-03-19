"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  GoalAwareEvaluationResult,
  GoalAwareRecommendation,
  GoalAwareEntityStatus,
  GoalAwareActionType,
  OptimizationPriority,
} from "../../types/goalAwareOptimization";
import type { AdCreativeData }   from "../../lib/optimization/realDataService";
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
import { AdDetailPanel }              from "./AdDetailPanel";

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const STATUS_VARIANT: Record<GoalAwareEntityStatus, "success" | "warning" | "danger" | "info" | "neutral" | "purple"> = {
  strong:          "success",
  on_track:        "info",
  underperforming: "warning",
  critical:        "danger",
  watch:           "neutral",
  no_data:         "neutral",
};

const STATUS_LABEL: Record<GoalAwareEntityStatus, string> = {
  strong:          "Strong",
  on_track:        "On Track",
  underperforming: "Underperforming",
  critical:        "Critical",
  watch:           "Watch",
  no_data:         "No Data",
};

const ACTION_VARIANT: Record<GoalAwareActionType, "success" | "warning" | "danger" | "info" | "neutral" | "purple"> = {
  scale:           "success",
  maintain:        "info",
  reduce_spend:    "warning",
  pause:           "danger",
  review_creative: "purple",
  watch:           "neutral",
};

const ACTION_LABEL: Record<GoalAwareActionType, string> = {
  scale:           "Scale",
  maintain:        "Maintain",
  reduce_spend:    "Reduce Spend",
  pause:           "Pause",
  review_creative: "Review Creative",
  watch:           "Watch",
};

const PRIORITY_VARIANT: Record<OptimizationPriority, "danger" | "warning" | "neutral"> = {
  high:   "danger",
  medium: "warning",
  low:    "neutral",
};

const PRIORITY_ORDER: Record<OptimizationPriority, number> = {
  high: 0, medium: 1, low: 2,
};

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

type EntityLevelFilter  = "all" | "campaign" | "adset" | "ad";
type StatusFilter       = "all" | GoalAwareEntityStatus;
type PriorityFilter     = "all" | OptimizationPriority;

type FilterState = {
  entityLevel: EntityLevelFilter;
  status:      StatusFilter;
  priority:    PriorityFilter;
};

const EMPTY_FILTERS: FilterState = {
  entityLevel: "all",
  status:      "all",
  priority:    "all",
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtCpa(v: number | null | undefined): string {
  return v != null ? formatCurrency(v) : "—";
}

function fmtRoas(v: number | null | undefined): string {
  return v != null ? formatRoas(v) : "—";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Source-of-truth explanation card */
function SourceOfTruthCard() {
  return (
    <SectionCard
      title="Source-of-Truth Optimization View"
      description="All ROAS and CPA evaluations are driven by reconciled CRM data, not Meta-reported revenue."
      className="mb-8"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Meta — Delivery Diagnostics
          </p>
          <p className="text-sm text-slate-300">
            Spend, clicks, impressions, CTR, and CPM come from Meta. Used for
            delivery analysis only — not for ROAS or CPA evaluation.
          </p>
        </div>
        <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-600">
            Shopify / CRM — Source of Truth
          </p>
          <p className="text-sm text-slate-300">
            Revenue and orders come from Shopify/CRM. Evaluated CPA and ROAS
            are always computed from CRM outcomes, not Meta attribution.
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Goal-Aware Recommendations
          </p>
          <p className="text-sm text-slate-300">
            Each entity is evaluated against its campaign&apos;s ROAS and CPA
            goals. Recommendations are deterministic and read-only in v1.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

/** Evaluation table for campaigns, ad sets, or ads */
function EvaluationTable({
  evaluations,
  title,
  description,
  clientId,
  onRowClick,
}: {
  evaluations: GoalAwareEvaluationResult[];
  title:       string;
  description: string;
  clientId:    string | null;
  onRowClick?: (ev: GoalAwareEvaluationResult) => void;
}) {
  if (evaluations.length === 0) {
    return (
      <SectionCard title={title} description={description} className="mb-8">
        <EmptyState
          title="No data for this entity level"
          description="No reconciled performance data found for the selected period."
        />
      </SectionCard>
    );
  }

  const TH = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap";
  const TD = "px-4 py-3 text-sm text-slate-300 whitespace-nowrap";

  return (
    <SectionCard title={title} description={description} flush className="mb-8">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className={TH}>Entity</th>
              <th className={`${TH} text-right`}>ROAS Goal</th>
              <th className={`${TH} text-right`}>Actual ROAS</th>
              <th className={`${TH} text-right`}>CPA Goal</th>
              <th className={`${TH} text-right`}>Actual CPA</th>
              <th className={TH}>Status</th>
              <th className={TH}>Priority</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {evaluations.map((ev) => (
              <EvaluationRow
                key={`${ev.entityType}-${ev.entityId}`}
                ev={ev}
                TD={TD}
                clientId={clientId}
                onClick={onRowClick ? () => onRowClick(ev) : undefined}
              />
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function CreativeLabDropdown({ clientId }: { clientId: string | null }) {
  const router  = useRouter();
  const [open, setOpen] = useState(false);
  const ref     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const base = clientId
    ? `/creative-lab/generate?clientId=${encodeURIComponent(clientId)}`
    : "/creative-lab/generate";

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-700
                   bg-indigo-950/60 px-3 py-1.5 text-xs font-medium text-indigo-300
                   hover:bg-indigo-900/60 hover:text-indigo-200 transition-colors"
      >
        Fix Creative
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 8L1 3h10L6 8z"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-48 rounded-xl
                        border border-slate-700 bg-slate-800 shadow-2xl overflow-hidden">
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`${base}&type=image`); }}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm
                       text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <span className="text-base">🖼</span>
            Image Variations
          </button>
          <div className="border-t border-slate-700/60" />
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`${base}&type=copy`); }}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm
                       text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <span className="text-base">✍️</span>
            Copy Variations
          </button>
        </div>
      )}
    </div>
  );
}

function EvaluationRow({
  ev,
  TD,
  clientId,
  onClick,
}: {
  ev:       GoalAwareEvaluationResult;
  TD:       string;
  clientId: string | null;
  onClick?: () => void;
}) {
  const roasMet  = ev.meetsRoasGoal === true;
  const roasMiss = ev.meetsRoasGoal === false;
  const cpaMet   = ev.meetsCpaGoal  === true;
  const cpaMiss  = ev.meetsCpaGoal  === false;

  const isActionable = ev.status === "underperforming" || ev.status === "critical";

  return (
    <tr
      className={`hover:bg-slate-800/20 transition-colors ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <td className={TD}>
        <span className="font-medium text-white">{ev.entityName}</span>
        <span className="ml-2 text-xs text-slate-600">
          {ev.entityType === "adset" ? "ad set" : ev.entityType}
        </span>
      </td>
      <td className={`${TD} text-right text-slate-500`}>
        {formatRoas(ev.roasGoalValue)}
      </td>
      <td className={`${TD} text-right font-medium`}>
        <span className={
          roasMet  ? "text-emerald-400" :
          roasMiss ? "text-rose-400"    : "text-slate-500"
        }>
          {fmtRoas(ev.actualRoas)}
        </span>
      </td>
      <td className={`${TD} text-right text-slate-500`}>
        {formatCurrency(ev.cpaGoalValue)}
      </td>
      <td className={`${TD} text-right font-medium`}>
        <span className={
          cpaMet  ? "text-emerald-400" :
          cpaMiss ? "text-rose-400"    : "text-slate-500"
        }>
          {fmtCpa(ev.actualCpa)}
        </span>
      </td>
      <td className={TD}>
        <Badge variant={STATUS_VARIANT[ev.status]}>
          {STATUS_LABEL[ev.status]}
        </Badge>
      </td>
      <td className={TD}>
        <Badge variant={PRIORITY_VARIANT[ev.priority]}>
          {ev.priority.charAt(0).toUpperCase() + ev.priority.slice(1)}
        </Badge>
      </td>
      <td className={`${TD} text-right`}>
        {isActionable
          ? <CreativeLabDropdown clientId={clientId} />
          : onClick
            ? <span className="text-xs text-slate-600">View →</span>
            : null
        }
      </td>
    </tr>
  );
}

/** Recommendations list */
function RecommendationsList({ recommendations }: { recommendations: GoalAwareRecommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <SectionCard title="Recommendations" description="Goal-aware recommendations based on reconciled CRM metrics.">
        <EmptyState
          icon="✓"
          title="No recommendations"
          description="All evaluated entities are meeting their goals or have insufficient data."
        />
      </SectionCard>
    );
  }

  const sorted = [...recommendations].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );

  return (
    <SectionCard
      title="Recommendations"
      description={`${sorted.length} recommendation${sorted.length !== 1 ? "s" : ""} based on reconciled CRM performance.`}
    >
      <div className="space-y-3">
        {sorted.map((rec) => (
          <RecommendationCard key={`${rec.entityType}-${rec.entityId}`} rec={rec} />
        ))}
      </div>
    </SectionCard>
  );
}

function RecommendationCard({ rec }: { rec: GoalAwareRecommendation }) {
  const m = rec.supportingMetrics;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant={ACTION_VARIANT[rec.actionType]}>
          {ACTION_LABEL[rec.actionType]}
        </Badge>
        <Badge variant={PRIORITY_VARIANT[rec.priority]}>
          {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)} priority
        </Badge>
        <span className="text-sm font-medium text-white">{rec.entityName}</span>
        <span className="text-xs text-slate-600">
          {rec.entityType === "adset" ? "ad set" : rec.entityType}
        </span>
      </div>

      <p className="mb-3 text-sm text-slate-400">{rec.reason}</p>

      {/* Supporting metrics */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
        {m.metaSpend    != null && <span>Spend: <span className="text-slate-300">{formatCurrency(m.metaSpend)}</span></span>}
        {m.actualRoas   != null && <span>ROAS: <span className="text-slate-300">{formatRoas(m.actualRoas)} <span className="text-slate-600">/ goal {formatRoas(m.roasGoal ?? 0)}</span></span></span>}
        {m.actualCpa    != null && <span>CPA: <span className="text-slate-300">{formatCurrency(m.actualCpa)} <span className="text-slate-600">/ goal {formatCurrency(m.cpaGoal ?? 0)}</span></span></span>}
        {m.crmOrders    != null && <span>CRM orders: <span className="text-slate-300">{m.crmOrders}</span></span>}
        {m.ctr          != null && <span>CTR: <span className="text-slate-300">{(m.ctr * 100).toFixed(2)}%</span></span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ClientOption = { id: string; name: string };

type Props = {
  clients:             ClientOption[];
  clientId:            string | null;
  campaignEvaluations: GoalAwareEvaluationResult[];
  adSetEvaluations:    GoalAwareEvaluationResult[];
  adEvaluations:       GoalAwareEvaluationResult[];
  recommendations:     GoalAwareRecommendation[];
  totalSpend:          number;
  totalCrmRevenue:     number;
  totalCrmOrders:      number;
  evaluatedCpa:        number | null;
  evaluatedRoas:       number | null;
  dateFrom:            string;
  dateTo:              string;
  adCreatives:         Record<string, AdCreativeData>;
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OptimizationView({
  clients,
  clientId,
  campaignEvaluations,
  adSetEvaluations,
  adEvaluations,
  recommendations,
  totalSpend,
  totalCrmRevenue,
  totalCrmOrders,
  evaluatedCpa,
  evaluatedRoas,
  dateFrom,
  dateTo,
  adCreatives,
}: Props) {
  const router = useRouter();
  const [filters, setFilters]           = useState<FilterState>(EMPTY_FILTERS);
  const [selectedAdEv, setSelectedAdEv] = useState<GoalAwareEvaluationResult | null>(null);

  function handleClientChange(id: string) {
    if (id) {
      router.push(`/optimization?clientId=${encodeURIComponent(id)}`);
    } else {
      router.push("/optimization");
    }
  }

  const allEvaluations = useMemo(
    () => [...campaignEvaluations, ...adSetEvaluations, ...adEvaluations],
    [campaignEvaluations, adSetEvaluations, adEvaluations]
  );

  const noData = allEvaluations.length === 0;

  // Apply status filter to evaluation tables.
  const filterEvals = (evs: GoalAwareEvaluationResult[]) => {
    if (filters.status === "all") return evs;
    return evs.filter((e) => e.status === filters.status);
  };

  // Apply priority filter to recommendations.
  const filteredRecs = useMemo(() => {
    if (filters.priority === "all") return recommendations;
    return recommendations.filter((r) => r.priority === filters.priority);
  }, [recommendations, filters.priority]);

  const showCampaigns = filters.entityLevel === "all" || filters.entityLevel === "campaign";
  const showAdSets    = filters.entityLevel === "all" || filters.entityLevel === "adset";
  const showAds       = filters.entityLevel === "all" || filters.entityLevel === "ad";

  const dateRangeLabel = `${dateFrom} → ${dateTo}`;

  const highPriorityCount  = recommendations.filter((r) => r.priority === "high").length;
  const actionableCount    = recommendations.filter((r) => r.actionType !== "watch" && r.actionType !== "maintain").length;

  return (
    <div className="space-y-0">
      {/* Page header */}
      <PageHeader
        title="Optimization"
        description="Goal-aware evaluation and recommendations driven by reconciled CRM metrics. All ROAS and CPA decisions use Shopify/CRM as the source of truth."
        badge={<Badge variant="info">CRM Source of Truth</Badge>}
      />

      {/* Client selector */}
      <SectionCard className="mb-8">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
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
          {clientId && dateFrom && dateTo && (
            <p className="self-end pb-1 text-xs text-slate-500">
              Last 30 days: {dateFrom} → {dateTo}
            </p>
          )}
        </div>
      </SectionCard>

      {/* Source-of-truth explanation */}
      <SourceOfTruthCard />

      {/* No client selected */}
      {!clientId && (
        <SectionCard>
          <EmptyState
            icon="◎"
            title="Select a client to get started"
            description="Choose a client above to view goal-aware evaluations and recommendations based on reconciled CRM data."
          />
        </SectionCard>
      )}

      {/* Global empty state (client selected, no data) */}
      {clientId && noData && (
        <SectionCard>
          <EmptyState
            icon="◎"
            title="No reconciled performance data"
            description="Sync your Meta ad account, connect Shopify, and run reconciliation to populate goal-aware evaluations."
          />
        </SectionCard>
      )}

      {clientId && !noData && (
        <>
          {/* Summary stat cards */}
          <section className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              {dateRangeLabel}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard
                label="Meta Spend"
                value={formatCurrency(totalSpend)}
                sub="Source: Meta"
              />
              <StatCard
                label="CRM Revenue"
                value={formatCurrency(totalCrmRevenue)}
                sub="Source: Shopify/CRM"
              />
              <StatCard
                label="CRM Orders"
                value={totalCrmOrders.toLocaleString()}
                sub="Source: Shopify/CRM"
              />
              <StatCard
                label="Evaluated CPA"
                value={fmtCpa(evaluatedCpa)}
                sub="Spend ÷ CRM orders"
              />
              <StatCard
                label="Evaluated ROAS"
                value={fmtRoas(evaluatedRoas)}
                sub="CRM rev ÷ Spend"
              />
            </div>
          </section>

          {/* Alert banner for high-priority recommendations */}
          {highPriorityCount > 0 && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-800/40 bg-rose-950/20 px-5 py-3 text-sm text-rose-300">
              <span className="mt-0.5 shrink-0 text-rose-400">●</span>
              <span>
                <span className="font-semibold">{highPriorityCount} high-priority</span>{" "}
                issue{highPriorityCount !== 1 ? "s" : ""} detected.{" "}
                {actionableCount > 0 && (
                  <span className="text-rose-400/80">{actionableCount} entities require immediate attention.</span>
                )}
              </span>
            </div>
          )}

          {/* Filters */}
          <SectionCard className="mb-8">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="mb-1.5 text-xs text-slate-500">Entity Level</p>
                <FilterBar>
                  <FilterSelect
                    value={filters.entityLevel}
                    onChange={(v) => setFilters((p) => ({ ...p, entityLevel: v as EntityLevelFilter }))}
                  >
                    <option value="all">All levels</option>
                    <option value="campaign">Campaigns</option>
                    <option value="adset">Ad Sets</option>
                    <option value="ad">Ads</option>
                  </FilterSelect>
                </FilterBar>
              </div>

              <div>
                <p className="mb-1.5 text-xs text-slate-500">Evaluation Status</p>
                <FilterBar>
                  <FilterSelect
                    value={filters.status}
                    onChange={(v) => setFilters((p) => ({ ...p, status: v as StatusFilter }))}
                  >
                    <option value="all">All statuses</option>
                    <option value="strong">Strong</option>
                    <option value="on_track">On Track</option>
                    <option value="underperforming">Underperforming</option>
                    <option value="critical">Critical</option>
                    <option value="watch">Watch</option>
                    <option value="no_data">No Data</option>
                  </FilterSelect>
                </FilterBar>
              </div>

              <div>
                <p className="mb-1.5 text-xs text-slate-500">Recommendation Priority</p>
                <FilterBar>
                  <FilterSelect
                    value={filters.priority}
                    onChange={(v) => setFilters((p) => ({ ...p, priority: v as PriorityFilter }))}
                  >
                    <option value="all">All priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </FilterSelect>
                </FilterBar>
              </div>

              {(filters.entityLevel !== "all" || filters.status !== "all" || filters.priority !== "all") && (
                <button
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="self-end pb-0.5 text-xs text-slate-400 underline hover:text-slate-200"
                >
                  Clear filters
                </button>
              )}
            </div>
          </SectionCard>

          {/* Campaign evaluations */}
          {showCampaigns && (
            <EvaluationTable
              evaluations={filterEvals(campaignEvaluations)}
              title="Campaigns"
              description="Campaign-level evaluation against configured ROAS and CPA goals."
              clientId={clientId}
            />
          )}

          {/* Ad set evaluations */}
          {showAdSets && (
            <EvaluationTable
              evaluations={filterEvals(adSetEvaluations)}
              title="Ad Sets"
              description="Ad set evaluation using parent campaign goals as thresholds."
              clientId={clientId}
            />
          )}

          {/* Ad evaluations — rows are clickable to open the creative detail panel */}
          {showAds && (
            <EvaluationTable
              evaluations={filterEvals(adEvaluations)}
              title="Ads"
              description="Ad-level evaluation using grandparent campaign goals as thresholds. Click an ad to view its creative and take action."
              clientId={clientId}
              onRowClick={(ev) => setSelectedAdEv(ev)}
            />
          )}

          {/* Recommendations */}
          <RecommendationsList recommendations={filteredRecs} />
        </>
      )}

      {/* Ad creative detail panel — shown when buyer clicks an ad row */}
      {selectedAdEv && (
        <AdDetailPanel
          ev={selectedAdEv}
          creative={adCreatives[selectedAdEv.entityId]}
          clientId={clientId}
          onClose={() => setSelectedAdEv(null)}
        />
      )}
    </div>
  );
}
