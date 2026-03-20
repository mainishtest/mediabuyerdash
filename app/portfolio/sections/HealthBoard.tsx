import Link from "next/link";
import type { PortfolioHealthBoardItem } from "../../../lib/portfolio/types";
import {
  healthBadgeClass,
  healthBorderClass,
  healthLabelDisplay,
  autonomyModeDisplay,
} from "../../../lib/portfolio/health";

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function Pill({ children, variant = "neutral" }: {
  children: React.ReactNode;
  variant?: "danger" | "warning" | "info" | "neutral";
}) {
  const cls =
    variant === "danger"  ? "border-rose-800/50 bg-rose-950/60 text-rose-300"    :
    variant === "warning" ? "border-amber-800/50 bg-amber-950/60 text-amber-300" :
    variant === "info"    ? "border-sky-800/50 bg-sky-950/60 text-sky-300"       :
    "border-slate-700 bg-slate-800 text-slate-400";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      {children}
    </span>
  );
}

function HealthCard({ item }: { item: PortfolioHealthBoardItem }) {
  const borderLeft = healthBorderClass(item.healthLabel);
  const badgeCls   = healthBadgeClass(item.healthLabel);

  const roasStr = item.roas !== null ? `${item.roas.toFixed(2)}x` : "—";
  const cpaStr  = item.cpa  !== null ? fmt(item.cpa)               : "—";

  const pacingLabel =
    item.pacingStatus === "over_pacing"  ? `Over pacing (${Math.round(item.pacingPct ?? 0)}%)` :
    item.pacingStatus === "under_pacing" ? `Under pacing (${Math.round(item.pacingPct ?? 0)}%)` :
    item.pacingStatus === "on_pacing"    ? "On pacing"                                           :
    "No pacing data";

  const pacingVariant =
    item.pacingStatus === "over_pacing"  ? "warning" :
    item.pacingStatus === "under_pacing" ? "warning"  :
    "neutral";

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/40 border-l-4 ${borderLeft} flex flex-col gap-3 p-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{item.clientName}</p>
          {item.autonomyMode && (
            <p className="mt-0.5 text-xs text-slate-500">{autonomyModeDisplay(item.autonomyMode)}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${badgeCls}`}>
          {healthLabelDisplay(item.healthLabel)}
        </span>
      </div>

      {/* KPIs */}
      <div className="flex gap-4 text-xs">
        <div>
          <p className="text-slate-500">Spend</p>
          <p className="font-medium text-slate-300">{fmt(item.spend)}</p>
        </div>
        <div>
          <p className="text-slate-500">ROAS</p>
          <p className={`font-medium ${
            item.roas !== null && item.roasGoal !== null && item.roas >= item.roasGoal
              ? "text-emerald-400"
              : item.roas !== null && item.roasGoal !== null && item.roas < item.roasGoal * 0.7
              ? "text-rose-400"
              : "text-slate-300"
          }`}>{roasStr}</p>
        </div>
        <div>
          <p className="text-slate-500">CPA</p>
          <p className="font-medium text-slate-300">{cpaStr}</p>
        </div>
        <div>
          <p className="text-slate-500">Revenue</p>
          <p className="font-medium text-slate-300">{fmt(item.revenue)}</p>
        </div>
      </div>

      {/* Signal pills */}
      <div className="flex flex-wrap gap-1.5">
        {item.hasEmergencyStop && (
          <Pill variant="danger">🛑 Emergency stop</Pill>
        )}
        {item.highAlertCount > 0 && (
          <Pill variant="danger">{item.highAlertCount} high alert{item.highAlertCount !== 1 ? "s" : ""}</Pill>
        )}
        {item.alertCount > 0 && item.highAlertCount === 0 && (
          <Pill variant="warning">{item.alertCount} alert{item.alertCount !== 1 ? "s" : ""}</Pill>
        )}
        {item.approvalCount > 0 && (
          <Pill variant="warning">{item.approvalCount} pending approval{item.approvalCount !== 1 ? "s" : ""}</Pill>
        )}
        {item.activeExperimentsCount > 0 && (
          <Pill variant="info">{item.activeExperimentsCount} experiment{item.activeExperimentsCount !== 1 ? "s" : ""}</Pill>
        )}
        {item.pacingStatus !== "on_pacing" && item.pacingStatus !== "no_data" && (
          <Pill variant={pacingVariant}>{pacingLabel}</Pill>
        )}
        {item.hasStaleSync && (
          <Pill variant="warning">Stale sync</Pill>
        )}
        {item.alertCount === 0 && item.approvalCount === 0 && !item.hasEmergencyStop &&
         !item.hasStaleSync && item.pacingStatus === "on_pacing" && (
          <Pill>No active signals</Pill>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 border-t border-slate-800/60 pt-2">
        <Link
          href={item.links.commandCenter}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300
                     transition-colors hover:border-emerald-600 hover:text-emerald-300"
        >
          Command Center
        </Link>
        {item.approvalCount > 0 && (
          <Link
            href={item.links.approvals}
            className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-2.5 py-1 text-xs
                       text-amber-300 transition-colors hover:border-amber-600"
          >
            Open Approvals
          </Link>
        )}
        {item.hasEmergencyStop && (
          <Link
            href={item.links.governance}
            className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-2.5 py-1 text-xs
                       text-rose-300 transition-colors hover:border-rose-600"
          >
            Governance
          </Link>
        )}
        <Link
          href={item.links.client}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-400
                     transition-colors hover:border-slate-600 hover:text-slate-200"
        >
          Client Settings
        </Link>
      </div>
    </div>
  );
}

function EmptyHealthBoard() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-6 py-10 text-center">
      <p className="text-sm font-medium text-slate-400">No active client accounts</p>
      <p className="mt-1 text-xs text-slate-600">
        Add clients in Settings → Clients to populate the health board.
      </p>
    </div>
  );
}

export function HealthBoard({
  items,
  sortBy,
}: {
  items:  PortfolioHealthBoardItem[];
  sortBy: "health" | "spend" | "name";
}) {
  if (items.length === 0) return <EmptyHealthBoard />;

  const sorted = [...items].sort((a, b) => {
    if (sortBy === "spend")  return b.spend - a.spend;
    if (sortBy === "name")   return a.clientName.localeCompare(b.clientName);
    return a.healthScore - b.healthScore; // worst first
  });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sorted.map((item) => (
        <HealthCard key={item.clientId} item={item} />
      ))}
    </div>
  );
}
