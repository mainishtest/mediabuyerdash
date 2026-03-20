import Link from "next/link";
import type {
  PortfolioAutomationStateItem,
  PortfolioAutonomySummary,
} from "../../../../lib/portfolioControls/types";
import {
  executionReadinessLabel,
  executionReadinessBadgeClass,
  autonomyModeLabel,
  autonomyModeBadgeClass,
} from "../../../../lib/portfolioControls/automationState";

// ── Autonomy mode distribution bar ───────────────────────────────────────────

function AutonomyDistribution({ summary }: { summary: PortfolioAutonomySummary }) {
  if (summary.total === 0) return null;

  const entries = [
    { label: "Guarded Auto",      count: summary.guardedCount,     cls: "bg-emerald-600" },
    { label: "Approval Required", count: summary.approvalRequired,  cls: "bg-amber-500" },
    { label: "Recommend Only",    count: summary.recommendOnly,     cls: "bg-sky-500" },
    { label: "Restricted",        count: summary.restrictedCount,   cls: "bg-rose-600" },
    { label: "No Policy",         count: summary.noPolicy,          cls: "bg-slate-600" },
  ].filter((e) => e.count > 0);

  return (
    <div className="mb-3">
      <p className="mb-1.5 text-xs text-slate-500">Autonomy mode distribution</p>
      {/* Bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {entries.map((e) => (
          <div
            key={e.label}
            className={e.cls}
            style={{ width: `${(e.count / summary.total) * 100}%` }}
            title={`${e.label}: ${e.count}`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
        {entries.map((e) => (
          <span key={e.label} className="text-xs text-slate-500">
            <span className={`inline-block h-2 w-2 rounded-full ${e.cls} mr-1`} />
            {e.label} ({e.count})
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-5 py-6 text-center">
      <p className="text-sm font-medium text-slate-400">No automation state data</p>
      <p className="mt-1 text-xs text-slate-600">Add clients and configure safety policies to see state.</p>
    </div>
  );
}

// ── Mobile card ───────────────────────────────────────────────────────────────

function AutoStateCard({ item }: { item: PortfolioAutomationStateItem }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-white">{item.clientName}</p>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${executionReadinessBadgeClass(item.executionReadiness)}`}>
          {executionReadinessLabel(item.executionReadiness)}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <span className="text-slate-500">Autonomy mode </span>
          <span className={`rounded border px-1.5 py-0.5 text-xs ${autonomyModeBadgeClass(item.autonomyMode)}`}>
            {autonomyModeLabel(item.autonomyMode)}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Auto-exec </span>
          <span className={item.autoExecEnabled ? "text-emerald-400" : "text-slate-500"}>
            {item.autoExecEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Pending </span>
          <span className={item.pendingApprovalCount > 0 ? "text-amber-400" : "text-slate-400"}>
            {item.pendingApprovalCount} approval{item.pendingApprovalCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Executions (7d) </span>
          <span className="text-slate-300">{item.recentExecutionCount}</span>
        </div>
      </div>

      {item.hasEmergencyStop && (
        <div className="mt-2 rounded border border-rose-800/50 bg-rose-950/30 px-2 py-1">
          <p className="text-xs font-medium text-rose-400">Emergency stop active</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={item.links.governance}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 transition-colors"
        >
          Governance
        </Link>
        <Link
          href={item.links.policies}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 transition-colors"
        >
          Policies
        </Link>
        {item.pendingApprovalCount > 0 && (
          <Link
            href={item.links.approvalQueue}
            className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-2.5 py-1 text-xs text-amber-300 hover:border-amber-700 transition-colors"
          >
            Approvals ({item.pendingApprovalCount})
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Desktop table row ─────────────────────────────────────────────────────────

function TableRow({ item }: { item: PortfolioAutomationStateItem }) {
  return (
    <tr className="border-t border-slate-800/60 hover:bg-slate-800/20 transition-colors">
      <td className="px-3 py-2.5 text-sm font-medium text-white">{item.clientName}</td>
      <td className="px-3 py-2.5">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${executionReadinessBadgeClass(item.executionReadiness)}`}>
          {executionReadinessLabel(item.executionReadiness)}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className={`rounded border px-1.5 py-0.5 text-xs ${autonomyModeBadgeClass(item.autonomyMode)}`}>
          {autonomyModeLabel(item.autonomyMode)}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs text-center">
        <span className={item.autoExecEnabled ? "text-emerald-400" : "text-slate-600"}>
          {item.autoExecEnabled ? "✓" : "—"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs text-center">
        <span className={item.hasEmergencyStop ? "text-rose-400 font-semibold" : "text-slate-600"}>
          {item.hasEmergencyStop ? "ACTIVE" : "—"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs tabular-nums text-center">
        <span className={item.pendingApprovalCount > 0 ? "text-amber-400" : "text-slate-500"}>
          {item.pendingApprovalCount}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs tabular-nums text-center text-slate-400">
        {item.recentExecutionCount}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={item.links.governance}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300 hover:border-slate-600 transition-colors"
          >
            Governance
          </Link>
          <Link
            href={item.links.policies}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300 hover:border-slate-600 transition-colors"
          >
            Policies
          </Link>
          {item.pendingApprovalCount > 0 && (
            <Link
              href={item.links.approvalQueue}
              className="rounded border border-amber-800/60 bg-amber-950/30 px-2 py-0.5 text-xs text-amber-300 hover:border-amber-700 transition-colors"
            >
              Approvals
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AutomationStatePanel({
  items,
  autonomySummary,
}: {
  items:           PortfolioAutomationStateItem[];
  autonomySummary: PortfolioAutonomySummary;
}) {
  if (items.length === 0) return <EmptyState />;

  return (
    <>
      <AutonomyDistribution summary={autonomySummary} />

      {/* Mobile: cards */}
      <div className="space-y-2 lg:hidden">
        {items.map((item) => (
          <AutoStateCard key={item.clientId} item={item} />
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-max text-left">
          <thead>
            <tr className="border-b border-slate-800">
              {[
                "Client",
                "Readiness",
                "Autonomy Mode",
                "Auto-Exec",
                "Emergency Stop",
                "Pending Approvals",
                "Executions (7d)",
                "Actions",
              ].map((h) => (
                <th key={h} className="px-3 py-2 text-xs font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <TableRow key={item.clientId} item={item} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
