"use client";

import { useState, useMemo }         from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  PortfolioControlsPayload,
  PortfolioControlFilterState,
  PortfolioApprovalAgingBucket,
  PortfolioExecutionReadiness,
} from "../../../lib/portfolioControls/types";
import { ControlSummaryBar }       from "./sections/ControlSummaryBar";
import { ApprovalBoardPanel }      from "./sections/ApprovalBoardPanel";
import { AutomationStatePanel }    from "./sections/AutomationStatePanel";
import { GovernanceControlPanel }  from "./sections/GovernanceControlPanel";

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
  countVariant?: "danger" | "warning" | "success" | "neutral" | "violet";
  action?:       React.ReactNode;
  children:      React.ReactNode;
}) {
  const countCls =
    countVariant === "danger"  ? "border-rose-800/50 bg-rose-950/60 text-rose-300"       :
    countVariant === "warning" ? "border-amber-800/50 bg-amber-950/60 text-amber-300"    :
    countVariant === "success" ? "border-emerald-800/50 bg-emerald-950/60 text-emerald-300" :
    countVariant === "violet"  ? "border-violet-800/50 bg-violet-950/60 text-violet-300" :
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
  local,
  onClientChange,
  onLocalChange,
}: {
  clients:          { id: string; name: string }[];
  selectedClientId: string;
  local:            PortfolioControlFilterState;
  onClientChange:   (id: string) => void;
  onLocalChange:    (patch: Partial<PortfolioControlFilterState>) => void;
}) {
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

      {/* Approval state */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Approval state</label>
        <select
          value={local.approvalState}
          onChange={(e) => onLocalChange({ approvalState: e.target.value as PortfolioControlFilterState["approvalState"] })}
          className={SEL}
        >
          <option value="all">All states</option>
          <option value="proposed">Proposed</option>
          <option value="deferred">Deferred</option>
          <option value="escalated">Escalated</option>
        </select>
      </div>

      {/* Aging bucket */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Aging</label>
        <select
          value={local.agingBucket}
          onChange={(e) => onLocalChange({ agingBucket: e.target.value as PortfolioControlFilterState["agingBucket"] })}
          className={SEL}
        >
          <option value="all">All ages</option>
          <option value="critical">Critical (&gt;48h)</option>
          <option value="overdue">Overdue (24–48h)</option>
          <option value="aging">Aging (4–24h)</option>
          <option value="fresh">Fresh (&lt;4h)</option>
        </select>
      </div>

      {/* Autonomy mode */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Autonomy mode</label>
        <select
          value={local.autonomyMode}
          onChange={(e) => onLocalChange({ autonomyMode: e.target.value })}
          className={SEL}
        >
          <option value="">All modes</option>
          <option value="restricted">Restricted</option>
          <option value="approval_required">Approval Required</option>
          <option value="guarded_auto_execute">Guarded Auto-Execute</option>
          <option value="recommend_only">Recommend Only</option>
          <option value="prepare_only">Prepare Only</option>
          <option value="__no_policy__">No Policy Set</option>
        </select>
      </div>

      {/* Auto-exec state */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Auto-exec</label>
        <select
          value={local.autoExecState}
          onChange={(e) => onLocalChange({ autoExecState: e.target.value as PortfolioControlFilterState["autoExecState"] })}
          className={SEL}
        >
          <option value="all">All</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {/* Emergency stop state */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Emergency stop</label>
        <select
          value={local.emergencyStopState}
          onChange={(e) => onLocalChange({ emergencyStopState: e.target.value as PortfolioControlFilterState["emergencyStopState"] })}
          className={SEL}
        >
          <option value="all">All</option>
          <option value="stopped">Has Stop</option>
          <option value="not_stopped">No Stop</option>
        </select>
      </div>

      {/* Blocker type */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Control type</label>
        <select
          value={local.blockerType}
          onChange={(e) => onLocalChange({ blockerType: e.target.value as PortfolioControlFilterState["blockerType"] })}
          className={SEL}
        >
          <option value="all">All types</option>
          <option value="emergency_stop">Emergency Stop</option>
          <option value="override">Override</option>
        </select>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function ControlsView({
  payload,
}: {
  payload: PortfolioControlsPayload;
}) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [local, setLocal] = useState<PortfolioControlFilterState>({
    clientId:           "",
    approvalState:      "all",
    agingBucket:        "all",
    autonomyMode:       "",
    autoExecState:      "all",
    emergencyStopState: "all",
    blockerType:        "all",
  });

  const selectedClientId = searchParams.get("clientId") ?? "";

  function handleClientChange(id: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (id) sp.set("clientId", id); else sp.delete("clientId");
    router.push(`/portfolio/controls?${sp.toString()}`);
  }

  // ── Client-side filtering ─────────────────────────────────────────────────

  const filteredApprovals = useMemo(() => {
    let items = payload.approvalBoard;
    if (selectedClientId)            items = items.filter((a) => a.clientId === selectedClientId);
    if (local.approvalState !== "all") items = items.filter((a) => a.status === local.approvalState);
    if (local.agingBucket !== "all") items = items.filter((a) => a.agingBucket === local.agingBucket);
    return items;
  }, [payload.approvalBoard, selectedClientId, local.approvalState, local.agingBucket]);

  const filteredAutomation = useMemo(() => {
    let items = payload.automationState;
    if (selectedClientId)            items = items.filter((a) => a.clientId === selectedClientId);
    if (local.autonomyMode)          items = items.filter((a) => {
      if (local.autonomyMode === "__no_policy__") return !a.autonomyMode;
      return a.autonomyMode === local.autonomyMode;
    });
    if (local.autoExecState !== "all") items = items.filter((a) =>
      local.autoExecState === "enabled" ? a.autoExecEnabled : !a.autoExecEnabled
    );
    if (local.emergencyStopState !== "all") items = items.filter((a) =>
      local.emergencyStopState === "stopped" ? a.hasEmergencyStop : !a.hasEmergencyStop
    );
    return items;
  }, [payload.automationState, selectedClientId, local]);

  const filteredControls = useMemo(() => {
    let items = payload.governanceControls;
    if (selectedClientId) items = items.filter((c) =>
      !c.clientId || c.clientId === selectedClientId || c.isGlobal
    );
    if (local.blockerType !== "all") items = items.filter((c) => c.controlType === local.blockerType);
    return items;
  }, [payload.governanceControls, selectedClientId, local.blockerType]);

  const filteredBlockers = useMemo(() => {
    if (!selectedClientId) return payload.governanceBlockers;
    return payload.governanceBlockers.filter((b) => b.clientId === selectedClientId);
  }, [payload.governanceBlockers, selectedClientId]);

  const { summary } = payload;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-screen-2xl">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Phase 7 · Portfolio Controls
              </p>
              <h1 className="mt-0.5 text-lg font-semibold text-white">
                Approval, Automation & Governance Control Board
              </h1>
              <p className="mt-1 max-w-2xl text-xs text-slate-500">
                Centralized visibility and control over approvals, automation state, autonomy modes,
                emergency stops, and governance blockers across all accounts. All actions link to
                existing approval and governance workflows.
              </p>
            </div>
            <p className="text-right text-xs text-slate-600">
              {summary.totalClients} active client{summary.totalClients !== 1 ? "s" : ""} ·{" "}
              Generated {new Date(summary.generatedAt).toLocaleTimeString()}
            </p>
          </div>

          {/* Alert banner — global stop */}
          {summary.globalStopsActive > 0 && (
            <div className="mb-3 rounded-lg border border-rose-700/50 bg-rose-950/40 px-4 py-2.5">
              <p className="text-xs font-semibold text-rose-300">
                ⚠ {summary.globalStopsActive} global emergency stop{summary.globalStopsActive !== 1 ? "s" : ""} active.
                All automated execution is blocked portfolio-wide.
              </p>
              <p className="mt-0.5 text-xs text-rose-400">
                Review governance controls to lift or adjust the stop before automation can resume.
              </p>
            </div>
          )}

          <FilterBar
            clients={payload.clients}
            selectedClientId={selectedClientId}
            local={local}
            onClientChange={handleClientChange}
            onLocalChange={(patch) => setLocal((prev) => ({ ...prev, ...patch }))}
          />
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-screen-2xl space-y-5 px-4 py-5 sm:px-6">

        {/* Summary bar */}
        <ControlSummaryBar summary={summary} />

        {/* Approval board — full width */}
        <Section
          title="Approvals Awaiting Action"
          count={filteredApprovals.length}
          countVariant={
            filteredApprovals.some((a) => a.agingBucket === "critical") ? "danger" :
            filteredApprovals.some((a) => a.status === "escalated")     ? "violet" :
            filteredApprovals.length > 0 ? "warning" : "neutral"
          }
          action={
            <a
              href="/automation"
              className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
            >
              Full approval queue →
            </a>
          }
        >
          <ApprovalBoardPanel items={filteredApprovals} aging={payload.approvalAging} />
        </Section>

        {/* Automation state + governance — 2 col on desktop */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">

          <Section
            title="Automation State by Account"
            count={filteredAutomation.length}
            countVariant={
              filteredAutomation.some((a) => a.hasEmergencyStop) ? "danger" :
              filteredAutomation.some((a) => a.isRestricted)     ? "warning" :
              "neutral"
            }
            action={
              <a
                href="/automation/policies"
                className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
              >
                Manage policies →
              </a>
            }
          >
            <AutomationStatePanel
              items={filteredAutomation}
              autonomySummary={payload.autonomySummary}
            />
          </Section>

          <Section
            title="Governance Controls & Blockers"
            count={filteredControls.length + filteredBlockers.length}
            countVariant={
              summary.globalStopsActive > 0        ? "danger"  :
              summary.totalActiveStops > 0         ? "danger"  :
              filteredBlockers.length > 0          ? "warning" :
              filteredControls.length > 0          ? "warning" :
              "neutral"
            }
            action={
              <a
                href="/automation/governance"
                className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
              >
                Manage governance →
              </a>
            }
          >
            <GovernanceControlPanel
              controls={filteredControls}
              blockers={filteredBlockers}
              emergencyStopSummary={payload.emergencyStopSummary}
            />
          </Section>
        </div>

        {/* Accounts ready for broader automation */}
        {summary.accountsReady > 0 && (
          <Section
            title="Accounts Ready for Broader Automation"
            count={summary.accountsReady}
            countVariant="success"
          >
            <div className="space-y-1">
              {payload.automationState
                .filter((a) => a.executionReadiness === "ready")
                .map((a) => (
                  <div
                    key={a.clientId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-900/30 bg-emerald-950/10 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{a.clientName}</p>
                      <p className="text-xs text-emerald-400">
                        Guarded auto-execute · {a.recentExecutionCount} execution{a.recentExecutionCount !== 1 ? "s" : ""} in 7d
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={a.links.auditHistory}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 transition-colors"
                      >
                        Audit History
                      </a>
                      <a
                        href={a.links.governance}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 transition-colors"
                      >
                        Governance
                      </a>
                    </div>
                  </div>
                ))
              }
            </div>
          </Section>
        )}

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 text-center">
          <p className="text-xs text-slate-700">
            The Portfolio Control Board surfaces live governance state — approvals, emergency stops,
            overrides, and automation readiness. Actions link to existing approval and governance
            workflows. No autonomous mutations are performed by this view. Approvals and rejection
            calls use the same API as the per-account approval queue. Data refreshes on page load.
          </p>
        </div>
      </div>
    </div>
  );
}
