"use client";
// app/operations/OperationsView.tsx
// Daily Operations Command Center — main client component.
//
// Layout:
//   Mobile  → single column, stacked sections, card-based items
//   Desktop → summary row, then 2-col issues+opportunities, full-width actions,
//             full-width client readiness table
//
// Receives a pre-computed OperationsSnapshot — no data fetching here.

import Link from "next/link";
import type { AlertEventRow, AlertSeverity }              from "../../lib/alerts/types";
import type { ProposedAutomationActionRow, AutomationPriority } from "../../lib/automation/types";
import type {
  OperationsSnapshot,
  OperationsIssue,
  OperationsOpportunity,
  OperationsAction,
  ClientReadinessRow,
  OperationsPriority,
  ClientReadinessStatus,
} from "../../lib/operations/types";

// ── Shared style constants ────────────────────────────────────────────────────

const CARD = "rounded-xl border border-slate-800 bg-slate-900/60";
const TH   = "px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400 whitespace-nowrap";
const TD   = "px-4 py-3 text-sm text-slate-300";

// ── Priority helpers ──────────────────────────────────────────────────────────

function priorityBorderColor(p: OperationsPriority) {
  if (p === "high")   return "border-l-rose-500";
  if (p === "medium") return "border-l-amber-500";
  return "border-l-slate-700";
}

function priorityBadge(p: OperationsPriority) {
  if (p === "high")   return "bg-rose-900/50 text-rose-300";
  if (p === "medium") return "bg-amber-900/50 text-amber-300";
  return "bg-slate-800 text-slate-400";
}

function PriorityPill({ priority }: { priority: OperationsPriority }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${priorityBadge(priority)}`}>
      {priority}
    </span>
  );
}

// ── Issue type labels ─────────────────────────────────────────────────────────

const ISSUE_LABELS: Record<string, string> = {
  stale_sync:            "Stale Data",
  sync_failed:           "Sync Failed",
  missing_meta_mapping:  "No Meta",
  missing_shopify:       "No Shopify",
  campaigns_below_goal:  "Below Goal",
  no_campaign_goals:     "No Goals",
  no_reconciliation:     "No Reconciliation",
};

const OPP_LABELS: Record<string, string> = {
  above_roas_goal:  "Above Goal",
  ready_to_scale:   "Ready to Scale",
  strong_performer: "Strong Performer",
};

// ── Empty state ───────────────────────────────────────────────────────────────

function SectionEmpty({ message }: { message: string }) {
  return (
    <div className="px-5 py-8 text-center">
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

// ── Issue card ────────────────────────────────────────────────────────────────

function IssueCard({ issue }: { issue: OperationsIssue }) {
  const typeLabel = ISSUE_LABELS[issue.issueType] ?? issue.issueType;
  const metrics   = Object.entries(issue.supportingMetrics);

  return (
    <div className={`border-l-4 ${priorityBorderColor(issue.priority)} rounded-r-lg bg-slate-900/40 border border-l-0 border-slate-800 p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
            {typeLabel}
          </span>
          <PriorityPill priority={issue.priority} />
        </div>
        <span className="text-xs text-slate-600 shrink-0">{issue.clientName}</span>
      </div>
      <p className="mt-2 text-sm text-slate-200">{issue.summary}</p>
      {metrics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {metrics.map(([k, v]) => (
            <span key={k} className="text-xs text-slate-500">
              <span className="text-slate-600">{k}:</span> {String(v)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Opportunity card ──────────────────────────────────────────────────────────

function OpportunityCard({ opp }: { opp: OperationsOpportunity }) {
  const typeLabel = OPP_LABELS[opp.opportunityType] ?? opp.opportunityType;
  const metrics   = Object.entries(opp.supportingMetrics);

  return (
    <div className={`border-l-4 ${priorityBorderColor(opp.priority)} rounded-r-lg bg-emerald-950/20 border border-l-0 border-slate-800 p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-400">
            {typeLabel}
          </span>
          <PriorityPill priority={opp.priority} />
        </div>
        <span className="text-xs text-slate-600 shrink-0">{opp.clientName}</span>
      </div>
      <p className="mt-2 text-sm text-slate-200">{opp.summary}</p>
      {metrics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {metrics.map(([k, v]) => (
            <span key={k} className="text-xs text-slate-500">
              <span className="text-slate-600">{k}:</span> {String(v)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Action card ───────────────────────────────────────────────────────────────

function ActionCard({ action }: { action: OperationsAction }) {
  return (
    <div className={`flex flex-col gap-3 border-l-4 ${priorityBorderColor(action.priority)} rounded-r-lg bg-slate-900/40 border border-l-0 border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityPill priority={action.priority} />
          <span className="text-xs text-slate-600">{action.clientName}</span>
        </div>
        <p className="mt-1.5 text-sm font-medium text-slate-100">{action.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{action.summary}</p>
      </div>
      <Link
        href={action.destinationUrl}
        className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-center text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white active:scale-95 sm:text-sm"
      >
        Go →
      </Link>
    </div>
  );
}

// ── Client readiness status ───────────────────────────────────────────────────

const READINESS_LABELS: Record<ClientReadinessStatus, string> = {
  live:                  "Live",
  partially_configured:  "Partial",
  missing_integrations:  "Missing Integrations",
  needs_setup:           "Needs Setup",
};

function readinessBadgeClass(s: ClientReadinessStatus): string {
  if (s === "live")                 return "bg-emerald-900/50 text-emerald-300";
  if (s === "partially_configured") return "bg-amber-900/50 text-amber-300";
  if (s === "missing_integrations") return "bg-rose-900/50 text-rose-300";
  return "bg-slate-800 text-slate-400";
}

function CheckDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-700"}`} />
  );
}

function ClientReadinessCard({ row }: { row: ClientReadinessRow }) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-100 text-sm" title={row.clientName}>
            {row.clientName}
          </p>
          {row.lastSyncAt && (
            <p className="mt-0.5 text-xs text-slate-600">
              Last sync: {new Date(row.lastSyncAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${readinessBadgeClass(row.status)}`}>
          {READINESS_LABELS[row.status]}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><CheckDot ok={row.hasMetaMapping} /> Meta</span>
        <span className="flex items-center gap-1.5"><CheckDot ok={row.hasShopify} /> Shopify</span>
        <span className="flex items-center gap-1.5"><CheckDot ok={!row.syncIsStale} /> Sync</span>
        <span className="flex items-center gap-1.5"><CheckDot ok={row.hasGoals} /> Goals</span>
        <span className="flex items-center gap-1.5"><CheckDot ok={row.hasReconciliation} /> Reconciled</span>
      </div>
      {row.issueCount > 0 && (
        <p className="mt-2 text-xs text-rose-400">{row.issueCount} issue{row.issueCount > 1 ? "s" : ""}</p>
      )}
      <Link
        href={`/clients/${row.clientAccountId}`}
        className="mt-3 block text-xs text-slate-500 hover:text-slate-300"
      >
        View client →
      </Link>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  description,
  count,
  countColor = "bg-slate-700 text-slate-300",
}: {
  title:       string;
  description: string;
  count:       number;
  countColor?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-slate-50">{title}</h2>
        {count > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${countColor}`}>
            {count}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-slate-500">{description}</p>
    </div>
  );
}

// ── Summary stat strip ────────────────────────────────────────────────────────

function SummaryStrip({ snapshot }: { snapshot: OperationsSnapshot }) {
  const stats = [
    { label: "Total Clients",   value: snapshot.totalClientsCount,        color: "text-slate-200" },
    { label: "Live",            value: snapshot.liveClientsCount,          color: "text-emerald-400" },
    { label: "Needs Attention", value: snapshot.clientsNeedingAttention,   color: snapshot.clientsNeedingAttention > 0 ? "text-rose-400" : "text-slate-200" },
    { label: "Active Issues",   value: snapshot.activeIssuesCount,         color: snapshot.activeIssuesCount > 0 ? "text-rose-400" : "text-slate-200" },
    { label: "Opportunities",   value: snapshot.activeOpportunitiesCount,  color: snapshot.activeOpportunitiesCount > 0 ? "text-emerald-400" : "text-slate-200" },
    { label: "Stale Clients",   value: snapshot.staleClientsCount,         color: snapshot.staleClientsCount > 0 ? "text-amber-400" : "text-slate-200" },
  ];

  return (
    <div className="mb-8 grid grid-cols-3 gap-3 sm:grid-cols-6">
      {stats.map((s) => (
        <div key={s.label} className={`${CARD} p-3`}>
          <p className="text-xs text-slate-500">{s.label}</p>
          <p className={`mt-1 text-xl font-semibold ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// ── Top alerts strip (for Operations page) ───────────────────────────────────

function alertSeverityBorder(s: AlertSeverity) {
  if (s === "high")   return "border-l-rose-500";
  if (s === "medium") return "border-l-amber-500";
  return "border-l-slate-600";
}
function alertSeverityBadge(s: AlertSeverity) {
  if (s === "high")   return "bg-rose-900/50 text-rose-300";
  if (s === "medium") return "bg-amber-900/50 text-amber-300";
  return "bg-slate-800 text-slate-400";
}

function TopAlertsSection({ alerts }: { alerts: AlertEventRow[] }) {
  if (alerts.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-50">Active Alerts</h2>
          <p className="text-xs text-slate-500">Top open anomalies across all clients.</p>
        </div>
        <Link href="/alerts" className="text-xs text-slate-500 hover:text-slate-300">
          View all alerts →
        </Link>
      </div>
      <div className="space-y-2">
        {alerts.map((a) => (
          <div
            key={a.id}
            className={`border-l-4 ${alertSeverityBorder(a.severity)} rounded-r-lg border border-l-0 border-slate-800 bg-slate-900/40 px-4 py-3`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${alertSeverityBadge(a.severity)}`}>
                  {a.severity}
                </span>
                <p className="text-sm text-slate-200">{a.summary}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-600">{a.clientName}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Top proposed automation actions (for Operations page) ────────────────────

function automationPriorityBorder(p: AutomationPriority) {
  if (p === "high")   return "border-l-rose-500";
  if (p === "medium") return "border-l-amber-500";
  return "border-l-slate-600";
}

function automationPriorityBadge(p: AutomationPriority) {
  if (p === "high")   return "bg-rose-900/50 text-rose-300";
  if (p === "medium") return "bg-amber-900/50 text-amber-300";
  return "bg-slate-800 text-slate-400";
}

const ACTION_LABELS: Record<string, string> = {
  pause_campaign:     "Pause Campaign",
  reduce_budget:      "Reduce Budget",
  increase_budget:    "Increase Budget",
  review_creative:    "Review Creative",
  refresh_creative:   "Refresh Creative",
  run_sync:           "Run Sync",
  investigate_client: "Investigate Client",
};

function TopProposedActionsSection({
  actions,
}: {
  actions: ProposedAutomationActionRow[];
}) {
  if (actions.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-50">
            Proposed Automation
          </h2>
          <p className="text-xs text-slate-500">
            High-priority rule-driven recommendations awaiting approval.
          </p>
        </div>
        <Link
          href="/automation"
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          Review all →
        </Link>
      </div>
      <div className="space-y-2">
        {actions.map((a) => (
          <div
            key={a.id}
            className={`border-l-4 ${automationPriorityBorder(a.priority)} rounded-r-lg border border-l-0 border-slate-800 bg-slate-900/40 px-4 py-3`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${automationPriorityBadge(a.priority)}`}
                >
                  {a.priority}
                </span>
                <span className="rounded px-2 py-0.5 text-xs font-medium bg-slate-800 text-slate-300">
                  {ACTION_LABELS[a.actionType] ?? a.actionType}
                </span>
                <p className="text-sm text-slate-200 truncate max-w-xs">{a.rationale}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-600">{a.clientName}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function OperationsView({
  snapshot,
  topAlerts = [],
  topProposedActions = [],
}: {
  snapshot:             OperationsSnapshot;
  topAlerts?:           AlertEventRow[];
  topProposedActions?:  ProposedAutomationActionRow[];
}) {
  const hasClients = snapshot.totalClientsCount > 0;
  const genTime    = new Date(snapshot.generatedAt).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Operations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Daily command center — what is broken, what is working, what to do next.
          <span className="ml-2 text-slate-600">Generated at {genTime}</span>
        </p>
      </div>

      {/* No clients yet */}
      {!hasClients && (
        <div className={`${CARD} px-6 py-16 text-center`}>
          <p className="text-2xl text-slate-700 mb-3">○</p>
          <p className="text-sm font-medium text-slate-300">No clients yet</p>
          <p className="mt-1.5 max-w-sm mx-auto text-xs leading-relaxed text-slate-500">
            Add your first client account to start tracking campaign performance and operations health.
          </p>
          <Link
            href="/clients"
            className="mt-5 inline-block rounded-lg border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700"
          >
            Go to Clients
          </Link>
        </div>
      )}

      {hasClients && (
        <>
          {/* Summary strip */}
          <SummaryStrip snapshot={snapshot} />

          {/* Active Alerts from anomaly detection */}
          <TopAlertsSection alerts={topAlerts} />

          {/* High-priority proposed automation actions */}
          <TopProposedActionsSection actions={topProposedActions} />

          {/* Issues + Opportunities — 2-col on desktop, stacked on mobile */}
          <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">

            {/* Needs Attention */}
            <section>
              <SectionHeader
                title="Needs Attention"
                description="Broken integrations, missed goals, stale data."
                count={snapshot.activeIssuesCount}
                countColor="bg-rose-900/50 text-rose-300"
              />
              {snapshot.issues.length === 0 ? (
                <div className={`${CARD}`}>
                  <SectionEmpty message="No issues detected. Everything looks healthy." />
                </div>
              ) : (
                <div className="space-y-3">
                  {snapshot.issues.map((issue) => (
                    <IssueCard key={issue.id} issue={issue} />
                  ))}
                </div>
              )}
            </section>

            {/* Opportunities */}
            <section>
              <SectionHeader
                title="Opportunities"
                description="Campaigns exceeding goals, ready to scale."
                count={snapshot.activeOpportunitiesCount}
                countColor="bg-emerald-900/50 text-emerald-300"
              />
              {snapshot.opportunities.length === 0 ? (
                <div className={`${CARD}`}>
                  <SectionEmpty message="No opportunities detected yet. Run reconciliation to unlock campaign-level insights." />
                </div>
              ) : (
                <div className="space-y-3">
                  {snapshot.opportunities.map((opp) => (
                    <OpportunityCard key={opp.id} opp={opp} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Next Best Actions */}
          <section className="mb-8">
            <SectionHeader
              title="Next Best Actions"
              description="Prioritised actions with direct links to fix or investigate."
              count={snapshot.pendingActionsCount}
              countColor="bg-slate-700 text-slate-300"
            />
            {snapshot.actions.length === 0 ? (
              <div className={`${CARD}`}>
                <SectionEmpty message="No actions needed right now." />
              </div>
            ) : (
              <div className="space-y-3">
                {snapshot.actions.map((action) => (
                  <ActionCard key={action.id} action={action} />
                ))}
              </div>
            )}
          </section>

          {/* Client Readiness */}
          <section>
            <SectionHeader
              title="Client Readiness"
              description="Integration and configuration status per client."
              count={snapshot.totalClientsCount}
            />

            {/* Mobile: cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
              {snapshot.clientReadiness.map((row) => (
                <ClientReadinessCard key={row.clientAccountId} row={row} />
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto rounded-xl border border-slate-800 lg:block">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/60">
                    <th className={TH}>Client</th>
                    <th className={TH}>Status</th>
                    <th className={`${TH} text-center`}>Meta</th>
                    <th className={`${TH} text-center`}>Shopify</th>
                    <th className={`${TH} text-center`}>Sync</th>
                    <th className={`${TH} text-center`}>Goals</th>
                    <th className={`${TH} text-center`}>Reconciled</th>
                    <th className={TH}>Last Sync</th>
                    <th className={TH}>Issues</th>
                    <th className={TH}></th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.clientReadiness.map((row, i) => (
                    <tr
                      key={row.clientAccountId}
                      className={`transition-colors hover:bg-slate-800/20 ${
                        i < snapshot.clientReadiness.length - 1 ? "border-b border-slate-800" : ""
                      }`}
                    >
                      <td className={`${TD} font-medium text-slate-100 max-w-[200px] truncate`}>
                        {row.clientName}
                      </td>
                      <td className={TD}>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${readinessBadgeClass(row.status)}`}>
                          {READINESS_LABELS[row.status]}
                        </span>
                      </td>
                      <td className={`${TD} text-center`}><CheckDot ok={row.hasMetaMapping} /></td>
                      <td className={`${TD} text-center`}><CheckDot ok={row.hasShopify} /></td>
                      <td className={`${TD} text-center`}><CheckDot ok={!row.syncIsStale} /></td>
                      <td className={`${TD} text-center`}><CheckDot ok={row.hasGoals} /></td>
                      <td className={`${TD} text-center`}><CheckDot ok={row.hasReconciliation} /></td>
                      <td className={`${TD} text-slate-500`}>
                        {row.lastSyncAt
                          ? new Date(row.lastSyncAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : "—"}
                      </td>
                      <td className={TD}>
                        {row.issueCount > 0 ? (
                          <span className="text-rose-400">{row.issueCount}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className={TD}>
                        <Link
                          href={`/clients/${row.clientAccountId}`}
                          className="text-xs text-slate-500 hover:text-slate-300"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
