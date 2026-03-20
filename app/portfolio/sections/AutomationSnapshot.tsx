import Link from "next/link";
import type { PortfolioAutomationSummary } from "../../../lib/portfolio/types";
import { autonomyModeDisplay } from "../../../lib/portfolio/health";

function ModeChip({ mode }: { mode: string | null }) {
  if (!mode) {
    return (
      <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
        Not set
      </span>
    );
  }
  const cls =
    mode === "restricted"           ? "border-rose-800/50 bg-rose-950/60 text-rose-300"       :
    mode === "guarded_auto_execute" ? "border-emerald-800/50 bg-emerald-950/60 text-emerald-300" :
    mode === "approval_required"    ? "border-amber-800/50 bg-amber-950/60 text-amber-300"     :
    "border-slate-700 bg-slate-800 text-slate-400";

  return (
    <span className={`rounded border px-2 py-0.5 text-xs ${cls}`}>
      {autonomyModeDisplay(mode)}
    </span>
  );
}

export function AutomationSnapshot({ snapshots }: { snapshots: PortfolioAutomationSummary[] }) {
  if (snapshots.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-5 py-6 text-center">
        <p className="text-sm font-medium text-slate-400">No client accounts</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {snapshots.map((snap) => (
        <div
          key={snap.clientId}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border
                     border-slate-800 bg-slate-900/40 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{snap.clientName}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <ModeChip mode={snap.autonomyMode} />
              {snap.hasEmergencyStop && (
                <span className="rounded border border-rose-800/50 bg-rose-950/60 px-2 py-0.5
                                 text-xs text-rose-300">
                  🛑 Emergency stop
                </span>
              )}
              {snap.autoExecutionEnabled && !snap.hasEmergencyStop && (
                <span className="rounded border border-emerald-800/40 bg-emerald-950/40 px-2 py-0.5
                                 text-xs text-emerald-400">
                  Auto-exec on
                </span>
              )}
              {snap.recentExecutionCount > 0 && (
                <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5
                                 text-xs text-slate-400">
                  {snap.recentExecutionCount} exec last 7d
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {snap.hasEmergencyStop && (
              <Link
                href={snap.href}
                className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-2.5 py-1
                           text-xs text-rose-300 transition-colors hover:border-rose-600"
              >
                Resolve
              </Link>
            )}
            <Link
              href={snap.href}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1
                         text-xs text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
            >
              Governance
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
