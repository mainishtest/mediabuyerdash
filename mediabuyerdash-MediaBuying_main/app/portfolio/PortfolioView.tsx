"use client";

import { useState, useMemo }         from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  PortfolioPayload,
  PortfolioPriority,
  PortfolioAutonomyMode,
} from "../../lib/portfolio/types";
import { KPISummaryBar }      from "./sections/KPISummaryBar";
import { HealthBoard }        from "./sections/HealthBoard";
import { RisksPanel }         from "./sections/RisksPanel";
import { OpportunitiesPanel } from "./sections/OpportunitiesPanel";
import { ApprovalsSnapshot }  from "./sections/ApprovalsSnapshot";
import { AutomationSnapshot } from "./sections/AutomationSnapshot";

// ── Section wrapper ────────────────────────────────────────────────────────────

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
            <span className={`rounded-full border px-2 py-0.5 text-xs ${countCls}`}>
              {count}
            </span>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

const SEL =
  "rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 " +
  "outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 " +
  "hover:border-slate-600 transition-colors";

type LocalFilters = {
  riskLevel:      PortfolioPriority | "";
  automationState: PortfolioAutonomyMode | "";
  approvalState:  "has_pending" | "overdue" | "";
  healthSort:     "health" | "spend" | "name";
};

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
  local:            LocalFilters;
  onClientChange:   (id: string) => void;
  onDateChange:     (from: string, to: string) => void;
  onLocalChange:    (patch: Partial<LocalFilters>) => void;
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
          type="date"
          value={localFrom}
          onChange={(e) => setLocalFrom(e.target.value)}
          onBlur={() => onDateChange(localFrom, localTo)}
          className={SEL}
        />
      </div>

      {/* Date to */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">To</label>
        <input
          type="date"
          value={localTo}
          onChange={(e) => setLocalTo(e.target.value)}
          onBlur={() => onDateChange(localFrom, localTo)}
          className={SEL}
        />
      </div>

      {/* Risk level (client-side) */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Risk level</label>
        <select
          value={local.riskLevel}
          onChange={(e) => onLocalChange({ riskLevel: e.target.value as PortfolioPriority | "" })}
          className={SEL}
        >
          <option value="">All risk levels</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Automation state (client-side) */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Automation</label>
        <select
          value={local.automationState}
          onChange={(e) => onLocalChange({ automationState: e.target.value as PortfolioAutonomyMode | "" })}
          className={SEL}
        >
          <option value="">All modes</option>
          <option value="restricted">Restricted</option>
          <option value="approval_required">Approval Required</option>
          <option value="guarded_auto_execute">Guarded Auto-Execute</option>
          <option value="recommend_only">Recommend Only</option>
        </select>
      </div>

      {/* Approval state (client-side) */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Approvals</label>
        <select
          value={local.approvalState}
          onChange={(e) => onLocalChange({ approvalState: e.target.value as LocalFilters["approvalState"] })}
          className={SEL}
        >
          <option value="">All</option>
          <option value="has_pending">Has pending</option>
          <option value="overdue">Overdue (&gt;48h)</option>
        </select>
      </div>

      {/* Health sort */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Sort board by</label>
        <select
          value={local.healthSort}
          onChange={(e) => onLocalChange({ healthSort: e.target.value as LocalFilters["healthSort"] })}
          className={SEL}
        >
          <option value="health">Health (worst first)</option>
          <option value="spend">Spend (highest first)</option>
          <option value="name">Name (A→Z)</option>
        </select>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function PortfolioView({ payload }: { payload: PortfolioPayload }) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [local, setLocal] = useState<LocalFilters>({
    riskLevel:       "",
    automationState: "",
    approvalState:   "",
    healthSort:      "health",
  });

  const selectedClientId = searchParams.get("clientId") ?? "";
  const dateFrom         = searchParams.get("from")     ?? payload.summary.dateRange.from;
  const dateTo           = searchParams.get("to")       ?? payload.summary.dateRange.to;

  function handleClientChange(id: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (id) sp.set("clientId", id); else sp.delete("clientId");
    router.push(`/portfolio?${sp.toString()}`);
  }

  function handleDateChange(from: string, to: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("from", from);
    sp.set("to", to);
    router.push(`/portfolio?${sp.toString()}`);
  }

  // ── Client-side filtering ────────────────────────────────────────────────

  const filteredHealthBoard = useMemo(() => {
    let items = payload.healthBoard;
    if (local.riskLevel) {
      items = items.filter((h) => h.priority === local.riskLevel);
    }
    if (local.automationState) {
      items = items.filter((h) => h.autonomyMode === local.automationState);
    }
    if (local.approvalState === "has_pending") {
      items = items.filter((h) => h.approvalCount > 0);
    }
    if (local.approvalState === "overdue") {
      items = items.filter((h) => {
        const snap = payload.approvalSnapshots.find((s) => s.clientId === h.clientId);
        return snap?.hasCritical ?? false;
      });
    }
    return items;
  }, [payload.healthBoard, payload.approvalSnapshots, local]);

  const filteredRisks = useMemo(() => {
    if (!local.riskLevel) return payload.risks;
    return payload.risks.filter((r) => r.priority === local.riskLevel);
  }, [payload.risks, local.riskLevel]);

  const { summary } = payload;
  const hasAnyRisk  = filteredRisks.length > 0;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Page header */}
      <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-screen-2xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Phase 7 · Portfolio Command Center
              </p>
              <h1 className="mt-0.5 text-lg font-semibold text-white">
                Multi-Account Health Board
              </h1>
            </div>
            <p className="text-xs text-slate-600">
              {summary.dateRange.from} – {summary.dateRange.to} ·{" "}
              {summary.totalClients} active client{summary.totalClients !== 1 ? "s" : ""} ·{" "}
              Generated {new Date(summary.generatedAt).toLocaleTimeString()}
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

      {/* Content */}
      <div className="mx-auto max-w-screen-2xl space-y-5 px-4 py-5 sm:px-6">

        {/* KPI summary bar */}
        <KPISummaryBar summary={summary} />

        {/* Health board */}
        <Section
          title="Client Health Board"
          count={filteredHealthBoard.length}
          countVariant={
            summary.accountsAtRisk > 0 ? "danger" :
            filteredHealthBoard.length > 0 ? "neutral" : "neutral"
          }
        >
          <HealthBoard items={filteredHealthBoard} sortBy={local.healthSort} />
        </Section>

        {/* Risks + Opportunities — 2 col on desktop */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section
            title="Top Risks"
            count={filteredRisks.length}
            countVariant={hasAnyRisk ? "danger" : "success"}
          >
            <RisksPanel risks={filteredRisks} />
          </Section>

          <Section
            title="Top Opportunities"
            count={payload.opportunities.length}
            countVariant={payload.opportunities.length > 0 ? "success" : "neutral"}
          >
            <OpportunitiesPanel opportunities={payload.opportunities} />
          </Section>
        </div>

        {/* Approvals + Automation — 2 col on desktop */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section
            title="Approvals Awaiting Action"
            count={payload.approvalSnapshots.length}
            countVariant={
              payload.approvalSnapshots.some((s) => s.hasCritical) ? "danger" :
              payload.approvalSnapshots.length > 0 ? "warning" : "neutral"
            }
            action={
              payload.summary.pendingApprovalsCount > 0 ? (
                <a
                  href="/automation"
                  className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                >
                  View all ({payload.summary.pendingApprovalsCount})
                </a>
              ) : undefined
            }
          >
            <ApprovalsSnapshot snapshots={payload.approvalSnapshots} />
          </Section>

          <Section
            title="Automation & Governance Status"
            count={payload.automationSnapshots.length}
          >
            <AutomationSnapshot snapshots={payload.automationSnapshots} />
          </Section>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 text-center">
          <p className="text-xs text-slate-700">
            Portfolio health is derived from reconciliation summaries (CRM source of truth, 7-day
            attribution), alert events, pending approvals, governance state, and budget pacing.
            ROAS and CPA use Meta spend against Shopify/CRM revenue. Scores refresh on page load.
          </p>
        </div>
      </div>
    </div>
  );
}
