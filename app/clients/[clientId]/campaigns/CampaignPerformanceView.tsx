"use client";

// app/clients/[clientId]/campaigns/CampaignPerformanceView.tsx
// Campaign-level live performance view.
// Mobile:  stacked cards, 2-col summary grid, thumb-friendly filters.
// Desktop: 4-col summary row, full table with all metric columns.

import { useState, useMemo } from "react";
import Link from "next/link";
import { StatCard }   from "../../../../components/ui/StatCard";
import { SectionCard } from "../../../../components/ui/SectionCard";
import { EmptyState }  from "../../../../components/ui/EmptyState";
import { Badge }       from "../../../../components/ui/Badge";
import type { BadgeVariant } from "../../../../components/ui/Badge";
import { countCampaignsByHealthStatus }  from "../../../../lib/campaignPerformance/evaluator";
import { buildOpportunityRiskSummary }   from "../../../../lib/campaignPerformance/recommendations";
import type {
  CampaignPerformanceSnapshot,
  CampaignHealthStatus,
  CampaignActionType,
} from "../../../../lib/campaignPerformance/types";

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  clientId:   string;
  clientName: string;
  currency:   string;
  snapshots:  CampaignPerformanceSnapshot[];
};

// ── Format helpers ────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  if (n === 0) return "—";
  return n >= 1000
    ? `$${(n / 1000).toFixed(1)}k`
    : `$${n.toFixed(2)}`;
}
function fmtRoas(n: number): string { return n === 0 ? "—" : `${n.toFixed(2)}x`; }
function fmtCpa(n: number): string  { return n === 0 ? "—" : `$${n.toFixed(2)}`;  }
function fmtNum(n: number): string  { return n === 0 ? "—" : String(n); }

// ── Health / action badge styles ──────────────────────────────────────────────

const HEALTH_COLORS: Record<CampaignHealthStatus, string> = {
  strong:     "bg-emerald-800/60 text-emerald-300",
  on_target:  "bg-emerald-900/40 text-emerald-400",
  watch:      "bg-amber-900/40 text-amber-300",
  below_goal: "bg-rose-900/50 text-rose-300",
  no_goal:    "bg-slate-800 text-slate-400",
  stale:      "bg-slate-800 text-slate-500",
  no_data:    "bg-slate-800 text-slate-600",
};

const HEALTH_LABELS: Record<CampaignHealthStatus, string> = {
  strong:     "Strong",
  on_target:  "On Target",
  watch:      "Watch",
  below_goal: "Below Goal",
  no_goal:    "No Goal",
  stale:      "Stale",
  no_data:    "No Data",
};

const ACTION_COLORS: Record<CampaignActionType, string> = {
  scale:        "bg-emerald-800/60 text-emerald-300",
  maintain:     "bg-emerald-900/40 text-emerald-400",
  review:       "bg-amber-900/40 text-amber-300",
  reduce_spend: "bg-rose-900/50 text-rose-300",
  watch:        "bg-amber-900/30 text-amber-400",
  set_goal:     "bg-slate-800 text-slate-400",
  sync_now:     "bg-slate-800 text-slate-500",
};

function HealthChip({ status }: { status: CampaignHealthStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${HEALTH_COLORS[status]}`}>
      {HEALTH_LABELS[status]}
    </span>
  );
}

function ActionChip({ action }: { action: CampaignActionType }) {
  const label = action.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[action]}`}>
      {label}
    </span>
  );
}

function GoalStatusChip({ hasGoal }: { hasGoal: boolean }) {
  if (hasGoal) {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-900/40 text-emerald-400">
        Goal set
      </span>
    );
  }
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-amber-900/40 text-amber-400">
      Missing goal
    </span>
  );
}

function statusBadgeVariant(s: string): BadgeVariant {
  if (s === "ACTIVE") return "success";
  if (s === "PAUSED") return "warning";
  return "neutral";
}

// ── Goal delta indicator ──────────────────────────────────────────────────────

function GoalDelta({
  actual,
  goal,
  higherIsBetter,
}: {
  actual: number;
  goal:   number | null;
  higherIsBetter: boolean;
}) {
  if (!goal || actual === 0) return <span className="text-slate-600">—</span>;
  const pct  = ((actual - goal) / goal) * 100;
  const good = higherIsBetter ? pct >= 0 : pct <= 0;
  const sign = pct >= 0 ? "+" : "";
  return (
    <span className={`text-xs font-medium ${good ? "text-emerald-400" : "text-rose-400"}`}>
      {sign}{pct.toFixed(1)}%
    </span>
  );
}

// ── Missing Goals Banner ──────────────────────────────────────────────────────

function MissingGoalsBanner({
  missingCount,
  totalCount,
  clientId,
  onFilterMissing,
}: {
  missingCount:    number;
  totalCount:      number;
  clientId:        string;
  onFilterMissing: () => void;
}) {
  if (missingCount === 0) return null;

  if (missingCount === totalCount) {
    return (
      <div className="mb-5 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-amber-300">
            No campaigns have goals set
          </p>
          <p className="mt-0.5 text-xs text-amber-600">
            {totalCount} campaign{totalCount !== 1 ? "s" : ""} imported · add goals to enable health scoring and recommendations
          </p>
        </div>
        <button
          onClick={onFilterMissing}
          className="text-xs text-amber-400 hover:text-amber-200 transition-colors underline underline-offset-2"
        >
          View campaigns →
        </button>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-amber-300">
          {missingCount} campaign{missingCount !== 1 ? "s" : ""} missing goals
        </p>
        <p className="mt-0.5 text-xs text-amber-600">
          {totalCount - missingCount} of {totalCount} campaigns have goals · click to filter
        </p>
      </div>
      <button
        onClick={onFilterMissing}
        className="text-xs text-amber-400 hover:text-amber-200 transition-colors underline underline-offset-2"
      >
        Show missing →
      </button>
    </div>
  );
}

// ── Mobile campaign card ──────────────────────────────────────────────────────

function CampaignCard({ s, clientId }: { s: CampaignPerformanceSnapshot; clientId: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
      {/* Name + statuses */}
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/clients/${clientId}/campaigns/${s.externalCampaignId}`}
          className="text-sm font-semibold text-slate-100 leading-tight hover:text-emerald-400 transition-colors"
        >
          {s.campaignName}
        </Link>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Badge variant={statusBadgeVariant(s.campaignStatus)}>
            {s.campaignStatus}
          </Badge>
          <HealthChip status={s.healthStatus} />
        </div>
      </div>

      {/* Goal status */}
      <div className="flex items-center gap-2">
        <GoalStatusChip hasGoal={s.hasGoal} />
        {s.hasGoal && s.roasGoalValue && (
          <span className="text-xs text-slate-500">
            ROAS {s.roasGoalValue.toFixed(2)}x · CPA ${s.cpaGoalValue?.toFixed(2) ?? "—"}
          </span>
        )}
        {!s.hasGoal && (
          <Link
            href={`/clients/${clientId}/campaigns/${s.externalCampaignId}`}
            className="text-xs text-amber-500 hover:text-amber-300 transition-colors underline underline-offset-2"
          >
            Add goal →
          </Link>
        )}
      </div>

      {/* Key metrics — 2-column */}
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-800/30 p-3">
        {[
          { label: "Spend",    value: fmt$(s.metaSpend) },
          { label: "CRM Rev",  value: fmt$(s.crmRevenue) },
          { label: "Orders",   value: fmtNum(s.crmOrders) },
          { label: "ROAS",     value: fmtRoas(s.evaluatedRoas) },
          { label: "CPA",      value: fmtCpa(s.evaluatedCpa) },
          { label: "vs Goal",  value: s.hasGoal ? (
            <span className="text-xs">
              <GoalDelta actual={s.evaluatedRoas} goal={s.roasGoalValue} higherIsBetter />
            </span>
          ) : <span className="text-slate-600 text-xs">No goal</span> },
        ].map((m) => (
          <div key={m.label}>
            <p className="text-xs text-slate-500">{m.label}</p>
            <p className="text-sm font-medium text-slate-200">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Recommendation */}
      <div className="flex items-start gap-2">
        <ActionChip action={s.recommendation.actionType} />
        <p className="text-xs text-slate-400 leading-relaxed">{s.recommendation.reason}</p>
      </div>

      {s.recommendation.supportingMetrics && (
        <p className="text-xs text-slate-600">{s.recommendation.supportingMetrics}</p>
      )}
    </div>
  );
}

// ── Desktop table ─────────────────────────────────────────────────────────────

const TH = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-slate-400 whitespace-nowrap";
const TD = "px-3 py-3 text-sm text-slate-300 align-top";

function CampaignTableRow({ s, clientId }: { s: CampaignPerformanceSnapshot; clientId: string }) {
  return (
    <tr className="border-b border-slate-800 last:border-0 hover:bg-slate-800/20 transition-colors">
      <td className={`${TD} max-w-[200px]`}>
        <Link
          href={`/clients/${clientId}/campaigns/${s.externalCampaignId}`}
          className="font-medium text-slate-100 hover:text-emerald-400 transition-colors truncate block"
        >
          {s.campaignName}
        </Link>
        <p className="text-xs text-slate-600 font-mono truncate">{s.externalCampaignId}</p>
      </td>
      <td className={TD}>
        <Badge variant={statusBadgeVariant(s.campaignStatus)}>{s.campaignStatus}</Badge>
      </td>
      {/* Goal column */}
      <td className={TD}>
        <div className="space-y-1">
          <GoalStatusChip hasGoal={s.hasGoal} />
          {s.hasGoal && s.roasGoalValue && (
            <p className="text-xs text-slate-500">
              ROAS {s.roasGoalValue.toFixed(2)}x
            </p>
          )}
          {s.hasGoal && s.cpaGoalValue && (
            <p className="text-xs text-slate-500">
              CPA ${s.cpaGoalValue.toFixed(2)}
            </p>
          )}
          {!s.hasGoal && (
            <Link
              href={`/clients/${clientId}/campaigns/${s.externalCampaignId}`}
              className="block text-xs text-amber-500 hover:text-amber-300 transition-colors"
            >
              + Add goal
            </Link>
          )}
        </div>
      </td>
      <td className={`${TD} text-right`}>{fmt$(s.metaSpend)}</td>
      <td className={`${TD} text-right`}>{fmt$(s.crmRevenue)}</td>
      <td className={`${TD} text-right`}>{fmtNum(s.crmOrders)}</td>
      <td className={`${TD} text-right`}>
        <div className="flex flex-col items-end gap-0.5">
          <span>{fmtRoas(s.evaluatedRoas)}</span>
          {s.roasGoalValue && (
            <span className="text-xs text-slate-500">
              goal {s.roasGoalValue.toFixed(2)}x
            </span>
          )}
        </div>
      </td>
      <td className={`${TD} text-right`}>
        <div className="flex flex-col items-end gap-0.5">
          <span>{fmtCpa(s.evaluatedCpa)}</span>
          {s.cpaGoalValue && (
            <span className="text-xs text-slate-500">goal ${s.cpaGoalValue.toFixed(2)}</span>
          )}
        </div>
      </td>
      <td className={`${TD} text-right`}>
        <div className="flex flex-col items-end gap-0.5">
          <GoalDelta actual={s.evaluatedRoas} goal={s.roasGoalValue} higherIsBetter />
          <GoalDelta actual={s.evaluatedCpa}  goal={s.cpaGoalValue}  higherIsBetter={false} />
        </div>
      </td>
      <td className={TD}>
        <HealthChip status={s.healthStatus} />
      </td>
      <td className={TD}>
        <div className="space-y-1">
          <ActionChip action={s.recommendation.actionType} />
          <p className="text-xs text-slate-500 max-w-[180px] leading-relaxed">
            {s.recommendation.reason}
          </p>
        </div>
      </td>
    </tr>
  );
}

// ── Opportunities / Risks strip ────────────────────────────────────────────────

function OpportunityRiskStrip({ snapshots }: { snapshots: CampaignPerformanceSnapshot[] }) {
  const { opportunities, risks } = buildOpportunityRiskSummary(snapshots);
  if (opportunities.length === 0 && risks.length === 0) return null;

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {opportunities.length > 0 && (
        <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
            Opportunities
          </p>
          {opportunities.map((line, i) => (
            <p key={i} className="flex items-start gap-2 text-sm text-emerald-300">
              <span className="mt-0.5 shrink-0">↑</span>{line}
            </p>
          ))}
        </div>
      )}
      {risks.length > 0 && (
        <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">
            Needs Attention
          </p>
          {risks.map((line, i) => (
            <p key={i} className="flex items-start gap-2 text-sm text-rose-300">
              <span className="mt-0.5 shrink-0">⚠</span>{line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Campaign Actions (top-priority recommendation list) ───────────────────────

function CampaignActionsSection({ snapshots }: { snapshots: CampaignPerformanceSnapshot[] }) {
  const highPriority = snapshots
    .filter((s) => s.recommendation.priority === "high")
    .sort((a, b) => {
      const order = { scale: 0, reduce_spend: 1 } as Record<string, number>;
      return (order[a.recommendation.actionType] ?? 2) - (order[b.recommendation.actionType] ?? 2);
    })
    .slice(0, 5);

  if (highPriority.length === 0) return null;

  return (
    <section className="mt-8">
      <SectionCard title="Campaign Actions" description="Highest-priority deterministic recommendations.">
        <div className="space-y-3">
          {highPriority.map((s) => (
            <div
              key={s.campaignId}
              className="flex flex-col gap-2 rounded-lg bg-slate-800/30 px-4 py-3 sm:flex-row sm:items-start sm:gap-4"
            >
              <div className="flex shrink-0 gap-2">
                <ActionChip action={s.recommendation.actionType} />
                <HealthChip  status={s.healthStatus} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200 truncate">{s.campaignName}</p>
                <p className="mt-0.5 text-xs text-slate-400">{s.recommendation.reason}</p>
                {s.recommendation.supportingMetrics && (
                  <p className="mt-0.5 text-xs text-slate-600">{s.recommendation.supportingMetrics}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-slate-500">Spend</p>
                <p className="text-sm font-medium text-slate-300">{fmt$(s.metaSpend)}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </section>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

type HealthFilter  = CampaignHealthStatus | "all";
type StatusFilter  = "all" | "ACTIVE" | "PAUSED";
type PriorityFilter = "all" | "high" | "medium" | "low";
type GoalFilter    = "all" | "has_goal" | "missing_goal";

const SELECT_CLS =
  "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 " +
  "focus:outline-none focus:ring-1 focus:ring-slate-500 min-h-[40px]";

function FilterBar({
  healthFilter,  setHealthFilter,
  statusFilter,  setStatusFilter,
  priorityFilter, setPriorityFilter,
  goalFilter,    setGoalFilter,
  search,        setSearch,
}: {
  healthFilter:    HealthFilter;
  setHealthFilter: (v: HealthFilter)   => void;
  statusFilter:    StatusFilter;
  setStatusFilter: (v: StatusFilter)   => void;
  priorityFilter:  PriorityFilter;
  setPriorityFilter: (v: PriorityFilter) => void;
  goalFilter:      GoalFilter;
  setGoalFilter:   (v: GoalFilter) => void;
  search:    string;
  setSearch: (v: string) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <input
        type="text"
        placeholder="Search campaigns…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`${SELECT_CLS} min-w-[160px] flex-1 sm:flex-none`}
      />
      <select
        value={goalFilter}
        onChange={(e) => setGoalFilter(e.target.value as GoalFilter)}
        className={SELECT_CLS}
      >
        <option value="all">All campaigns</option>
        <option value="has_goal">Has goals</option>
        <option value="missing_goal">Missing goals</option>
      </select>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        className={SELECT_CLS}
      >
        <option value="all">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="PAUSED">Paused</option>
      </select>
      <select
        value={healthFilter}
        onChange={(e) => setHealthFilter(e.target.value as HealthFilter)}
        className={SELECT_CLS}
      >
        <option value="all">All health</option>
        <option value="strong">Strong</option>
        <option value="on_target">On Target</option>
        <option value="watch">Watch</option>
        <option value="below_goal">Below Goal</option>
        <option value="no_goal">No Goal</option>
        <option value="stale">Stale</option>
      </select>
      <select
        value={priorityFilter}
        onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
        className={SELECT_CLS}
      >
        <option value="all">All priorities</option>
        <option value="high">High priority</option>
        <option value="medium">Medium priority</option>
        <option value="low">Low priority</option>
      </select>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CampaignPerformanceView({
  clientId,
  clientName,
  snapshots,
}: Props) {
  const [healthFilter,   setHealthFilter]   = useState<HealthFilter>("all");
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [goalFilter,     setGoalFilter]     = useState<GoalFilter>("all");
  const [search,         setSearch]         = useState("");

  const counts = useMemo(() => countCampaignsByHealthStatus(snapshots), [snapshots]);

  // Missing goals counts (computed from all snapshots, not just filtered)
  const missingGoalsCount = useMemo(
    () => snapshots.filter((s) => !s.hasGoal).length,
    [snapshots]
  );

  const filtered = useMemo(() => {
    return snapshots.filter((s) => {
      if (goalFilter === "has_goal"     && !s.hasGoal) return false;
      if (goalFilter === "missing_goal" &&  s.hasGoal) return false;
      if (healthFilter   !== "all" && s.healthStatus               !== healthFilter)   return false;
      if (statusFilter   !== "all" && s.campaignStatus             !== statusFilter)   return false;
      if (priorityFilter !== "all" && s.recommendation.priority    !== priorityFilter) return false;
      if (search && !s.campaignName.toLowerCase().includes(search.toLowerCase()))      return false;
      return true;
    });
  }, [snapshots, goalFilter, healthFilter, statusFilter, priorityFilter, search]);

  // ── Empty states ───────────────────────────────────────────────────────────

  const noSync   = snapshots.length === 0;
  const noFilter = filtered.length === 0 && snapshots.length > 0;

  // ── Summary card data ──────────────────────────────────────────────────────

  const aboveGoal    = counts.strong + counts.on_target;
  const needsReview  = counts.no_goal + counts.stale + counts.no_data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">

      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/clients/${clientId}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
        >
          ← Back to {clientName}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
              Campaign Performance
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Live metrics for {clientName} · CRM is source of truth for ROAS and CPA · 7-day attribution window
            </p>
          </div>
          <Link
            href={`/clients/${clientId}`}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Run sync to refresh →
          </Link>
        </div>
      </div>

      {noSync ? (
        <SectionCard>
          <EmptyState
            title="No campaigns synced yet"
            description="Run a Meta sync from the client page to pull in campaign data. Make sure a Meta ad account is mapped to this client first."
            icon="□"
            action={
              <Link
                href={`/clients/${clientId}`}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
              >
                Go to client page →
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <>
          {/* Summary cards — 2-col on mobile, 4-col on desktop */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Above Goal"
              value={String(aboveGoal)}
              sub={`${counts.strong} strong · ${counts.on_target} on target`}
            />
            <StatCard
              label="On Watch"
              value={String(counts.watch)}
              sub="Hitting one goal"
            />
            <StatCard
              label="Below Goal"
              value={String(counts.below_goal)}
              sub="Missing both goals"
            />
            <StatCard
              label="Needs Setup"
              value={String(needsReview)}
              sub={`${counts.no_goal} no goal · ${counts.stale + counts.no_data} no data`}
            />
          </div>

          {/* Missing Goals Banner */}
          <MissingGoalsBanner
            missingCount={missingGoalsCount}
            totalCount={snapshots.length}
            clientId={clientId}
            onFilterMissing={() => setGoalFilter("missing_goal")}
          />

          {/* Opportunities / Risks strip */}
          <OpportunityRiskStrip snapshots={snapshots} />

          {/* Filters */}
          <FilterBar
            healthFilter={healthFilter}     setHealthFilter={setHealthFilter}
            statusFilter={statusFilter}     setStatusFilter={setStatusFilter}
            priorityFilter={priorityFilter} setPriorityFilter={setPriorityFilter}
            goalFilter={goalFilter}         setGoalFilter={setGoalFilter}
            search={search}                 setSearch={setSearch}
          />

          {noFilter ? (
            <SectionCard>
              {goalFilter === "missing_goal" && missingGoalsCount === 0 ? (
                <EmptyState
                  title="All campaigns have goals set"
                  description="Every imported campaign has a ROAS and CPA goal configured."
                  icon="✓"
                  action={
                    <button
                      onClick={() => setGoalFilter("all")}
                      className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
                    >
                      View all campaigns
                    </button>
                  }
                />
              ) : goalFilter === "has_goal" ? (
                <EmptyState
                  title="No campaigns have goals yet"
                  description="Open a campaign from the list below and use the Campaign Goals section to add ROAS and CPA targets."
                  icon="◎"
                  action={
                    <button
                      onClick={() => setGoalFilter("all")}
                      className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
                    >
                      View all campaigns
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  title="No campaigns match these filters"
                  description="Try adjusting the health, status, goal, or priority filters."
                  icon="□"
                />
              )}
            </SectionCard>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="space-y-3 md:hidden">
                {filtered.map((s) => <CampaignCard key={s.campaignId} s={s} clientId={clientId} />)}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 md:block">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className={TH}>Campaign</th>
                      <th className={TH}>Status</th>
                      <th className={TH}>Goal</th>
                      <th className={`${TH} text-right`}>Spend</th>
                      <th className={`${TH} text-right`}>CRM Rev</th>
                      <th className={`${TH} text-right`}>Orders</th>
                      <th className={`${TH} text-right`}>ROAS</th>
                      <th className={`${TH} text-right`}>CPA</th>
                      <th className={`${TH} text-right`}>vs Goal</th>
                      <th className={TH}>Health</th>
                      <th className={TH}>Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <CampaignTableRow key={s.campaignId} s={s} clientId={clientId} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* No reconciliation data hint */}
              {filtered.every((s) => s.crmRevenue === 0 && s.crmOrders === 0) && (
                <p className="mt-3 text-xs text-slate-600">
                  No CRM order data matched to these campaigns. Sync Shopify orders and ensure
                  UTM campaign names match your Meta campaign names.
                </p>
              )}
            </>
          )}

          {/* Campaign Actions */}
          <CampaignActionsSection snapshots={filtered} />
        </>
      )}
    </div>
  );
}
