import Link from "next/link";
import type {
  PortfolioGovernanceControlItem,
  PortfolioGovernanceBlocker,
  PortfolioEmergencyStopSummary,
} from "../../../../lib/portfolioControls/types";
import {
  controlTypeLabel,
  controlTypeBadgeClass,
  overrideTypeLabel,
  scopeLabel,
} from "../../../../lib/portfolioControls/governanceControl";
import { controlPriorityBadgeClass } from "../../../../lib/portfolioControls/approvalBoard";

// ── Emergency stop summary banner ─────────────────────────────────────────────

function EmergencyStopBanner({
  summary,
}: {
  summary: PortfolioEmergencyStopSummary;
}) {
  if (summary.totalActive === 0) {
    return (
      <div className="mb-3 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-2">
        <p className="text-xs text-emerald-400">
          <span className="font-semibold">No emergency stops active.</span>{" "}
          All accounts are operating within normal governance bounds.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-2.5">
      <p className="text-xs font-semibold text-rose-300">
        {summary.totalActive} emergency stop{summary.totalActive !== 1 ? "s" : ""} active
        {summary.globalStops > 0 && (
          <span className="ml-2 rounded-full border border-rose-700/60 bg-rose-900/40 px-2 py-0.5 text-xs">
            {summary.globalStops} global
          </span>
        )}
      </p>
      {summary.stoppedClientNames.length > 0 && (
        <p className="mt-0.5 text-xs text-rose-400">
          Affected clients: {summary.stoppedClientNames.join(", ")}
        </p>
      )}
    </div>
  );
}

// ── Governance blockers ───────────────────────────────────────────────────────

function BlockerCard({ blocker }: { blocker: PortfolioGovernanceBlocker }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${controlPriorityBadgeClass(blocker.controlPriority)}`}>
          {blocker.controlPriority.charAt(0).toUpperCase() + blocker.controlPriority.slice(1)}
        </span>
        <span className="text-sm font-medium text-white">{blocker.clientName}</span>
      </div>

      <p className="mt-1.5 text-xs text-slate-400">{blocker.description}</p>

      <div className="mt-2 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-1.5">
        <p className="text-xs font-medium text-amber-400">Recommended intervention</p>
        <p className="mt-0.5 text-xs text-amber-300">{blocker.intervention}</p>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-500">
        {blocker.blockerTypes.map((bt) => (
          <span key={bt} className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5">
            {bt.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={blocker.links.governance}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 transition-colors"
        >
          Open Governance
        </Link>
        <Link
          href={blocker.links.approvalQueue}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 transition-colors"
        >
          Approval Queue
        </Link>
        <Link
          href={blocker.links.account}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 transition-colors"
        >
          Open Account
        </Link>
      </div>
    </div>
  );
}

// ── Governance control items (stops + overrides) ──────────────────────────────

function ControlItem({ item }: { item: PortfolioGovernanceControlItem }) {
  const appliedAgo = Math.round(
    (Date.now() - new Date(item.appliedAt).getTime()) / 3_600_000
  );
  const ageLabel = appliedAgo < 24 ? `${appliedAgo}h ago` : `${Math.round(appliedAgo / 24)}d ago`;

  return (
    <div className={`rounded-xl border px-4 py-3 transition-colors
      ${item.isGlobal
        ? "border-rose-800/50 bg-rose-950/20 hover:border-rose-700/60"
        : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
      }`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${controlPriorityBadgeClass(item.controlPriority)}`}>
          {item.controlPriority.charAt(0).toUpperCase() + item.controlPriority.slice(1)}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${controlTypeBadgeClass(item.controlType)}`}>
          {controlTypeLabel(item.controlType)}
        </span>
        {item.overrideType && (
          <span className="rounded border border-amber-800/50 bg-amber-950/30 px-1.5 py-0.5 text-xs text-amber-400">
            {overrideTypeLabel(item.overrideType)}
          </span>
        )}
        {item.isGlobal && (
          <span className="rounded border border-rose-700/60 bg-rose-900/40 px-1.5 py-0.5 text-xs font-semibold text-rose-300">
            GLOBAL
          </span>
        )}
        <span className="ml-auto text-xs text-slate-500">{ageLabel}</span>
      </div>

      <p className="mt-1.5 text-sm font-medium text-white">{item.scopeLabel}</p>
      <p className="mt-0.5 text-xs text-slate-400">{item.reason}</p>

      {item.appliedBy && (
        <p className="mt-0.5 text-xs text-slate-600">Applied by: {item.appliedBy}</p>
      )}
      {item.expiresAt && (
        <p className="mt-0.5 text-xs text-slate-600">
          Expires: {new Date(item.expiresAt).toLocaleDateString()}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={item.links.governance}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 transition-colors"
        >
          Open Governance Controls
        </Link>
        {item.clientId && (
          <Link
            href={item.links.account}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 transition-colors"
          >
            Open Account
          </Link>
        )}
        <Link
          href={item.links.auditHistory}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 transition-colors"
        >
          Audit History
        </Link>
      </div>
    </div>
  );
}

// ── Empty states ──────────────────────────────────────────────────────────────

function EmptyControls() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-5 py-5 text-center">
      <p className="text-sm font-medium text-emerald-400">No active governance controls</p>
      <p className="mt-1 text-xs text-slate-600">No emergency stops or overrides are currently active.</p>
    </div>
  );
}

function EmptyBlockers() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-5 py-5 text-center">
      <p className="text-sm font-medium text-emerald-400">No governance blockers</p>
      <p className="mt-1 text-xs text-slate-600">All accounts are operating without active blockers.</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GovernanceControlPanel({
  controls,
  blockers,
  emergencyStopSummary,
}: {
  controls:             PortfolioGovernanceControlItem[];
  blockers:             PortfolioGovernanceBlocker[];
  emergencyStopSummary: PortfolioEmergencyStopSummary;
}) {
  return (
    <div className="space-y-5">
      {/* Emergency stop banner */}
      <EmergencyStopBanner summary={emergencyStopSummary} />

      {/* Governance blockers */}
      {blockers.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Accounts Requiring Intervention ({blockers.length})
          </h3>
          <div className="space-y-2">
            {blockers.map((b) => <BlockerCard key={b.clientId} blocker={b} />)}
          </div>
        </div>
      )}

      {blockers.length === 0 && <EmptyBlockers />}

      {/* Active stops + overrides */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Active Stops & Overrides ({controls.length})
        </h3>
        {controls.length === 0
          ? <EmptyControls />
          : (
            <div className="space-y-2">
              {controls.map((c) => <ControlItem key={c.id} item={c} />)}
            </div>
          )
        }
      </div>
    </div>
  );
}
