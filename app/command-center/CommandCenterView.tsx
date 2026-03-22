"use client";

import { useState, useMemo }    from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  CommandCenterPayload,
  CommandCenterPriority,
} from "../../lib/commandCenter/types";
import { SummaryBar }      from "./sections/SummaryBar";
import { PriorityQueue }   from "./sections/PriorityQueue";
import { ApprovalQueue }   from "./sections/ApprovalQueue";
import { ExperimentsPanel } from "./sections/ExperimentsPanel";
import { CreativePanel }   from "./sections/CreativePanel";
import { PacingPanel }     from "./sections/PacingPanel";
import { AlertsPanel }     from "./sections/AlertsPanel";
import { OutcomesPanel }   from "./sections/OutcomesPanel";

// ── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({
  clients,
  selectedClientId,
  onClientChange,
  filterPriority,
  onPriorityChange,
}: {
  clients:          { id: string; name: string }[];
  selectedClientId: string;
  onClientChange:   (id: string) => void;
  filterPriority:   CommandCenterPriority | "";
  onPriorityChange: (p: CommandCenterPriority | "") => void;
}) {
  const selectClass =
    "rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 " +
    "outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 " +
    "hover:border-slate-600 hover:text-slate-200 transition-colors";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={selectedClientId}
        onChange={(e) => onClientChange(e.target.value)}
        className={selectClass}
        aria-label="Filter by client"
      >
        <option value="">All clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <select
        value={filterPriority}
        onChange={(e) => onPriorityChange(e.target.value as CommandCenterPriority | "")}
        className={selectClass}
        aria-label="Filter by priority"
      >
        <option value="">All priorities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────

function Section({
  title,
  count,
  countVariant,
  children,
  action,
}: {
  title:         string;
  count?:        number;
  countVariant?: "danger" | "warning" | "success" | "info" | "neutral";
  children:      React.ReactNode;
  action?:       React.ReactNode;
}) {
  const badgeCls =
    countVariant === "danger"  ? "border-rose-800/50 bg-rose-950/60 text-rose-300"   :
    countVariant === "warning" ? "border-amber-800/50 bg-amber-950/60 text-amber-300" :
    countVariant === "success" ? "border-emerald-800/50 bg-emerald-950/60 text-emerald-300" :
    countVariant === "info"    ? "border-sky-800/50 bg-sky-950/60 text-sky-300"       :
    "border-slate-700 bg-slate-800 text-slate-400";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {count !== undefined && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeCls}`}>
              {count}
            </span>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function CommandCenterView({ payload }: { payload: CommandCenterPayload }) {
  const router        = useRouter();
  const searchParams  = useSearchParams();

  const [filterPriority,   setFilterPriority]   = useState<CommandCenterPriority | "">("");
  const [selectedClientId, setSelectedClientId] = useState<string>(
    searchParams.get("clientId") ?? ""
  );

  // Client-side filter for priority (doesn't need server re-fetch)
  // Client filter causes URL navigation → server re-render
  function handleClientChange(id: string) {
    setSelectedClientId(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("clientId", id);
    else    params.delete("clientId");
    router.push(`/command-center?${params.toString()}`);
  }

  // Filter experiments, alerts, creatives by selectedClientId on the client side
  // (server already filtered if clientId was in URL, but local state may differ briefly)
  const experiments  = useMemo(() =>
    selectedClientId
      ? payload.experiments.filter((e) => e.clientId === selectedClientId)
      : payload.experiments,
    [payload.experiments, selectedClientId]
  );

  const alertItems   = useMemo(() =>
    selectedClientId
      ? payload.alertItems.filter((a) => a.clientId === selectedClientId)
      : payload.alertItems,
    [payload.alertItems, selectedClientId]
  );

  const approvals    = useMemo(() =>
    selectedClientId
      ? payload.approvals.filter((a) => a.clientId === selectedClientId)
      : payload.approvals,
    [payload.approvals, selectedClientId]
  );

  const creativeItems = useMemo(() =>
    selectedClientId
      ? payload.creativeItems.filter((c) => c.clientId === selectedClientId)
      : payload.creativeItems,
    [payload.creativeItems, selectedClientId]
  );

  const pacingItems  = useMemo(() =>
    selectedClientId
      ? payload.pacingItems.filter((p) => p.clientId === selectedClientId)
      : payload.pacingItems,
    [payload.pacingItems, selectedClientId]
  );

  const outcomeItems = useMemo(() =>
    selectedClientId
      ? payload.outcomeItems.filter((o) => o.clientAccountId === selectedClientId)
      : payload.outcomeItems,
    [payload.outcomeItems, selectedClientId]
  );

  const priorities   = useMemo(() => {
    let list = selectedClientId
      ? payload.priorities.filter(
          (p) => !p.clientName || payload.clients.find((c) => c.id === selectedClientId)?.name === p.clientName
        )
      : payload.priorities;
    if (filterPriority) list = list.filter((p) => p.priority === filterPriority);
    return list;
  }, [payload.priorities, payload.clients, selectedClientId, filterPriority]);

  const { summary } = payload;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Page header */}
      <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-screen-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Phase 4 · Execution Intelligence
              </p>
              <h1 className="mt-0.5 text-lg font-semibold text-white">Optimization Command Center</h1>
            </div>
            <FilterBar
              clients={payload.clients}
              selectedClientId={selectedClientId}
              onClientChange={handleClientChange}
              filterPriority={filterPriority}
              onPriorityChange={setFilterPriority}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-screen-xl space-y-5 px-4 py-5 sm:px-6">

        {/* KPI summary */}
        <SummaryBar summary={summary} />

        {/* Main grid: Today's Priorities + Approval Queue */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section
            title="Today's Priorities"
            count={priorities.length}
            countVariant={
              priorities.some((p) => p.priority === "critical") ? "danger" :
              priorities.some((p) => p.priority === "high")     ? "warning" : "neutral"
            }
          >
            <div className="p-4">
              <PriorityQueue
                priorities={priorities}
                filterPriority={filterPriority || undefined}
              />
            </div>
          </Section>

          <Section
            title="Actions Awaiting Approval"
            count={approvals.length}
            countVariant={approvals.length > 0 ? "warning" : "neutral"}
            action={
              approvals.length > 0 ? (
                <a
                  href="/automation"
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  View all →
                </a>
              ) : undefined
            }
          >
            <ApprovalQueue approvals={approvals} />
          </Section>
        </div>

        {/* Active Experiments + Creative Actions */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section
            title="Active Experiments"
            count={experiments.filter((e) => e.status === "active" || e.status === "evaluating").length}
            countVariant="info"
            action={
              <a href="/experiments" className="text-xs text-slate-400 hover:text-slate-200">
                All experiments →
              </a>
            }
          >
            <ExperimentsPanel experiments={experiments} />
          </Section>

          <Section
            title="Creative Actions"
            count={creativeItems.filter(
              (c) => c.direction === "ready_to_publish" || c.direction === "awaiting_review"
            ).length}
            countVariant={
              creativeItems.some((c) => c.direction === "ready_to_publish") ? "success" :
              creativeItems.some((c) => c.direction === "awaiting_review")  ? "warning"  : "neutral"
            }
            action={
              <a href="/creative-lab" className="text-xs text-slate-400 hover:text-slate-200">
                Creative Lab →
              </a>
            }
          >
            <CreativePanel creativeItems={creativeItems} />
          </Section>
        </div>

        {/* Launched-Test Outcomes */}
        {(outcomeItems.length > 0 || payload.outcomeSummary.pendingActionCount > 0) && (
          <Section
            title="Launched-Test Outcomes"
            count={payload.outcomeSummary.pendingActionCount}
            countVariant={
              payload.outcomeSummary.scaleReadyCount > 0 ? "success" :
              payload.outcomeSummary.refreshNeededCount > 0 ? "warning" : "info"
            }
            action={
              <a href="/creative-lab/outcomes" className="text-xs text-slate-400 hover:text-slate-200">
                All outcomes →
              </a>
            }
          >
            <OutcomesPanel
              outcomeItems={outcomeItems}
              outcomeSummary={payload.outcomeSummary}
            />
          </Section>
        )}

        {/* Budget Pacing Risks + Alerts & Blockers */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section
            title="Budget Pacing Risks"
            count={pacingItems.length}
            countVariant={pacingItems.some((p) => p.status === "over_pacing") ? "danger" : pacingItems.length > 0 ? "warning" : "neutral"}
            action={
              <a href="/pacing" className="text-xs text-slate-400 hover:text-slate-200">
                Full pacing →
              </a>
            }
          >
            <PacingPanel pacingItems={pacingItems} />
          </Section>

          <Section
            title="Alerts & Blockers"
            count={alertItems.filter((a) => !a.isAcknowledged).length}
            countVariant={
              alertItems.some((a) => !a.isAcknowledged && a.severity === "high")   ? "danger"  :
              alertItems.some((a) => !a.isAcknowledged && a.severity === "medium") ? "warning" : "neutral"
            }
            action={
              alertItems.length > 0 ? (
                <a href="/alerts" className="text-xs text-slate-400 hover:text-slate-200">
                  All alerts →
                </a>
              ) : undefined
            }
          >
            <AlertsPanel alertItems={alertItems} />
          </Section>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 text-center">
          <p className="text-xs text-slate-700">
            Data sourced from Meta (delivery) and Shopify/CRM (revenue attribution).
            All ROAS/CPA figures use a 7-day attribution window. CRM is source of truth.
          </p>
        </div>
      </div>
    </div>
  );
}
