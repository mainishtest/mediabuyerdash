"use client";

import { useState, useMemo }         from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  PortfolioGovernancePayload,
  GovernanceFilterState,
  GovernancePriorityTier,
  PortfolioOpportunityCategory,
  PortfolioRiskCategory,
  PortfolioActionReadiness,
  PortfolioAutonomyMode,
} from "../../../lib/portfolioGovernance/types";
import { GovernanceSummaryBar } from "./sections/GovernanceSummaryBar";
import { OpportunitiesPanel }   from "./sections/OpportunitiesPanel";
import { RisksPanel }           from "./sections/RisksPanel";
import { BudgetGovernancePanel } from "./sections/BudgetGovernancePanel";

// ── Select style ──────────────────────────────────────────────────────────────

const SEL =
  "rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 " +
  "outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 " +
  "hover:border-slate-600 transition-colors";

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  count,
  countVariant,
  action,
  children,
}: {
  title:         string;
  count?:        number;
  countVariant?: "danger" | "warning" | "success" | "neutral";
  action?:       React.ReactNode;
  children:      React.ReactNode;
}) {
  const countCls =
    countVariant === "danger"  ? "border-rose-800/50 bg-rose-950/60 text-rose-300"    :
    countVariant === "warning" ? "border-amber-800/50 bg-amber-950/60 text-amber-300" :
    countVariant === "success" ? "border-emerald-800/50 bg-emerald-950/60 text-emerald-300" :
    "border-slate-700 bg-slate-800 text-slate-400";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40">
      <div className="flex items-center justify-between border-b border-slate-800/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {count !== undefined && (
            <span className={`rounded-full border px-2 py-0.5 text-xs ${countCls}`}>{count}</span>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({
  clients,
  selectedClientId,
  dateFrom,
  dateTo,
  local,
  onClientChange,
  onDateChange,
  onLocalChange,
}: {
  clients:          { id: string; name: string }[];
  selectedClientId: string;
  dateFrom:         string;
  dateTo:           string;
  local:            GovernanceFilterState;
  onClientChange:   (id: string) => void;
  onDateChange:     (from: string, to: string) => void;
  onLocalChange:    (patch: Partial<GovernanceFilterState>) => void;
}) {
  const [localFrom, setLocalFrom] = useState(dateFrom);
  const [localTo,   setLocalTo]   = useState(dateTo);

  return (
    <div className="flex flex-wrap items-end gap-2">
      {/* Client */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Client</label>
        <select
          value={selectedClientId}
          onChange={(e) => onClientChange(e.target.value)}
          className={SEL}
        >
          <option value="">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Date from */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">From</label>
        <input
          type="date" value={localFrom}
          onChange={(e) => setLocalFrom(e.target.value)}
          onBlur={() => onDateChange(localFrom, localTo)}
          className={SEL}
        />
      </div>

      {/* Date to */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">To</label>
        <input
          type="date" value={localTo}
          onChange={(e) => setLocalTo(e.target.value)}
          onBlur={() => onDateChange(localFrom, localTo)}
          className={SEL}
        />
      </div>

      {/* Priority tier */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Priority</label>
        <select
          value={local.priorityTier}
          onChange={(e) => onLocalChange({ priorityTier: e.target.value as GovernancePriorityTier | "" })}
          className={SEL}
        >
          <option value="">All priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Opportunity category */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Opportunity type</label>
        <select
          value={local.opportunityCategory}
          onChange={(e) => onLocalChange({ opportunityCategory: e.target.value as PortfolioOpportunityCategory | "" })}
          className={SEL}
        >
          <option value="">All types</option>
          <option value="winning_experiment_expansion">Experiment Expansion</option>
          <option value="account_scaling_candidate">Scaling Candidate</option>
          <option value="creative_refresh_opportunity">Creative Refresh</option>
          <option value="goal_outperformance">Goal Outperformance</option>
          <option value="strong_launch_candidate">Launch Ready</option>
        </select>
      </div>

      {/* Risk category */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Risk type</label>
        <select
          value={local.riskCategory}
          onChange={(e) => onLocalChange({ riskCategory: e.target.value as PortfolioRiskCategory | "" })}
          className={SEL}
        >
          <option value="">All types</option>
          <option value="goal_risk">Goal Risk</option>
          <option value="pacing_risk">Pacing Risk</option>
          <option value="governance_blocker">Governance Blocker</option>
          <option value="approval_bottleneck">Approval Bottleneck</option>
          <option value="automation_restriction">Automation Restricted</option>
          <option value="performance_decline">Performance Decline</option>
          <option value="fatigue_risk">Fatigue Risk</option>
        </select>
      </div>

      {/* Readiness */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Readiness</label>
        <select
          value={local.readiness}
          onChange={(e) => onLocalChange({ readiness: e.target.value as PortfolioActionReadiness | "" })}
          className={SEL}
        >
          <option value="">All readiness</option>
          <option value="ready">Ready</option>
          <option value="needs_review">Needs Review</option>
          <option value="blocked">Blocked</option>
          <option value="waiting">Waiting</option>
          <option value="low_confidence">Low Confidence</option>
        </select>
      </div>

      {/* Autonomy mode */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Autonomy mode</label>
        <select
          value={local.autonomyMode}
          onChange={(e) => onLocalChange({ autonomyMode: e.target.value as PortfolioAutonomyMode | "" })}
          className={SEL}
        >
          <option value="">All modes</option>
          <option value="restricted">Restricted</option>
          <option value="approval_required">Approval Required</option>
          <option value="guarded_auto_execute">Guarded Auto-Execute</option>
          <option value="recommend_only">Recommend Only</option>
        </select>
      </div>

      {/* Approval status */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Approval status</label>
        <select
          value={local.approvalStatus}
          onChange={(e) => onLocalChange({ approvalStatus: e.target.value as GovernanceFilterState["approvalStatus"] })}
          className={SEL}
        >
          <option value="">All</option>
          <option value="has_pending">Has pending</option>
          <option value="overdue">Overdue (&gt;48h)</option>
        </select>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function GovernanceView({
  payload,
}: {
  payload: PortfolioGovernancePayload;
}) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [local, setLocal] = useState<GovernanceFilterState>({
    clientId:            "",
    priorityTier:        "",
    opportunityCategory: "",
    riskCategory:        "",
    readiness:           "",
    autonomyMode:        "",
    approvalStatus:      "",
  });

  const selectedClientId = searchParams.get("clientId") ?? "";
  const dateFrom         = searchParams.get("from") ?? payload.summary.dateRange.from;
  const dateTo           = searchParams.get("to")   ?? payload.summary.dateRange.to;

  function handleClientChange(id: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (id) sp.set("clientId", id); else sp.delete("clientId");
    router.push(`/portfolio/governance?${sp.toString()}`);
  }

  function handleDateChange(from: string, to: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("from", from);
    sp.set("to", to);
    router.push(`/portfolio/governance?${sp.toString()}`);
  }

  // ── Client-side filtering ─────────────────────────────────────────────────

  const filteredOpportunities = useMemo(() => {
    let items = payload.opportunities;
    if (selectedClientId)        items = items.filter((o) => o.clientId === selectedClientId);
    if (local.priorityTier)      items = items.filter((o) => o.priorityScore.tier === local.priorityTier);
    if (local.opportunityCategory) items = items.filter((o) => o.category === local.opportunityCategory);
    if (local.readiness)         items = items.filter((o) => o.readiness === local.readiness);
    return items;
  }, [payload.opportunities, selectedClientId, local]);

  const filteredRisks = useMemo(() => {
    let items = payload.risks;
    if (selectedClientId)    items = items.filter((r) => r.clientId === selectedClientId);
    if (local.priorityTier)  items = items.filter((r) => r.priorityScore.tier === local.priorityTier);
    if (local.riskCategory)  items = items.filter((r) => r.category === local.riskCategory);
    if (local.readiness)     items = items.filter((r) => r.readiness === local.readiness);
    return items;
  }, [payload.risks, selectedClientId, local]);

  const filteredBudget = useMemo(() => {
    let items = payload.budgetGovernance;
    if (selectedClientId) items = items.filter((b) => b.clientId === selectedClientId);
    if (local.autonomyMode) items = items.filter((b) => b.autonomyMode === local.autonomyMode);
    return items;
  }, [payload.budgetGovernance, selectedClientId, local]);

  const { summary } = payload;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-screen-2xl">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Phase 7 · Portfolio Governance
              </p>
              <h1 className="mt-0.5 text-lg font-semibold text-white">
                Cross-Account Opportunity, Risk & Budget Governance
              </h1>
              <p className="mt-1 max-w-2xl text-xs text-slate-500">
                Decision support only — this layer ranks where attention and future capital decisions
                should be focused. It does not automatically reallocate budget or execute actions.
                All guidance requires operator review before any action is taken.
              </p>
            </div>
            <div className="text-right text-xs text-slate-600">
              {summary.dateRange.from} – {summary.dateRange.to}<br />
              {summary.totalClients} active client{summary.totalClients !== 1 ? "s" : ""} ·{" "}
              Generated {new Date(summary.generatedAt).toLocaleTimeString()}
            </div>
          </div>

          {/* Disclaimer banner */}
          <div className="mb-3 rounded-lg border border-amber-900/40 bg-amber-950/20 px-4 py-2">
            <p className="text-xs text-amber-300">
              <span className="font-semibold">Governance guidance only.</span>{" "}
              Scores and recommendations are decision support tools. No budget is moved and no
              actions are executed without explicit operator approval. ROAS and CPA use CRM
              (Shopify) as source of truth with a 7-day attribution window.
            </p>
          </div>

          <FilterBar
            clients={payload.clients}
            selectedClientId={selectedClientId}
            dateFrom={dateFrom}
            dateTo={dateTo}
            local={local}
            onClientChange={handleClientChange}
            onDateChange={handleDateChange}
            onLocalChange={(patch) => setLocal((prev) => ({ ...prev, ...patch }))}
          />
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-screen-2xl space-y-5 px-4 py-5 sm:px-6">

        {/* Summary bar */}
        <GovernanceSummaryBar summary={summary} />

        {/* Opportunities + Risks — side by side on desktop */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section
            title="Ranked Opportunities"
            count={filteredOpportunities.length}
            countVariant={
              filteredOpportunities.some((o) => o.priorityScore.tier === "critical") ? "warning" :
              filteredOpportunities.length > 0 ? "success" : "neutral"
            }
            action={
              <span className="text-xs text-slate-600">
                {filteredOpportunities.filter((o) => o.readiness === "ready").length} ready to act
              </span>
            }
          >
            <OpportunitiesPanel opportunities={filteredOpportunities} />
          </Section>

          <Section
            title="Ranked Risks"
            count={filteredRisks.length}
            countVariant={
              filteredRisks.some((r) => r.priorityScore.tier === "critical") ? "danger" :
              filteredRisks.length > 0 ? "warning" : "success"
            }
            action={
              <span className="text-xs text-slate-600">
                {filteredRisks.filter((r) => r.priorityScore.tier === "critical").length} critical
              </span>
            }
          >
            <RisksPanel risks={filteredRisks} />
          </Section>
        </div>

        {/* Budget governance — full width */}
        <Section
          title="Budget Governance Summaries"
          count={filteredBudget.length}
          countVariant={
            filteredBudget.some((b) => b.budgetRecommendation === "pause_candidate") ? "danger" :
            filteredBudget.some((b) => b.budgetRecommendation === "reduce_candidate") ? "warning" :
            filteredBudget.some((b) => b.budgetRecommendation === "increase_candidate") ? "success" :
            "neutral"
          }
          action={
            <span className="text-xs text-slate-500 italic">
              Guidance only — no automated budget movement
            </span>
          }
        >
          <BudgetGovernancePanel items={filteredBudget} />
        </Section>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 text-center">
          <p className="text-xs text-slate-700">
            Priority scores use a weighted composite of risk severity, opportunity upside, urgency,
            and data confidence. ROAS and CPA use CRM (Shopify) as source of truth with a 7-day
            attribution window. Budget guidance is advisory — no funds are moved by this layer.
            Scores refresh on page load. See{" "}
            <a href="/docs/portfolio-governance" className="underline hover:text-slate-500">
              setup docs
            </a>{" "}
            for scoring details.
          </p>
        </div>
      </div>
    </div>
  );
}
