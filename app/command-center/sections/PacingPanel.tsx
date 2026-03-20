import Link from "next/link";
import type { CommandCenterPacingItem } from "../../../lib/commandCenter/types";

function fmt(v: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency, maximumFractionDigits: 0,
  }).format(v);
}

function PacingBar({ pct, status }: { pct: number; status: CommandCenterPacingItem["status"] }) {
  const barPct   = Math.min(Math.max(pct, 0), 200); // cap display at 200%
  const barColor =
    status === "over_pacing"  ? "bg-rose-500"   :
    status === "under_pacing" ? "bg-amber-500"  : "bg-emerald-500";
  const trackWidth = Math.min(barPct / 2, 100); // scale to 100% for display
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className={`h-full rounded-full transition-all ${barColor}`}
        style={{ width: `${trackWidth}%` }}
      />
    </div>
  );
}

function PacingRow({ item }: { item: CommandCenterPacingItem }) {
  const pct = Math.round(item.pacingPct);
  const statusLabel =
    item.status === "over_pacing"  ? "Over pacing"  :
    item.status === "under_pacing" ? "Under pacing" : "On pacing";
  const statusBadge =
    item.status === "over_pacing"  ? "border-rose-800/50 bg-rose-950/60 text-rose-300"   :
    item.status === "under_pacing" ? "border-amber-800/50 bg-amber-950/60 text-amber-300" :
    "border-emerald-800/50 bg-emerald-950/60 text-emerald-300";

  return (
    <div className="border-b border-slate-800/60 px-4 py-3 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-slate-200">{item.clientName}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {fmt(item.spendSoFar, item.currency)} spent · {fmt(item.expectedSpend, item.currency)} expected ·{" "}
            {fmt(item.monthlyBudget, item.currency)} budget
          </p>
          <PacingBar pct={item.pacingPct} status={item.status} />
          <p className="mt-1 text-xs text-slate-600">{pct}% of expected pace</p>
        </div>
        <Link
          href={item.href}
          className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5
                     text-xs font-medium text-slate-300 transition-colors
                     hover:border-slate-600 hover:text-slate-200"
        >
          Pacing
        </Link>
      </div>
    </div>
  );
}

export function PacingPanel({ pacingItems }: { pacingItems: CommandCenterPacingItem[] }) {
  if (pacingItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <p className="text-3xl">◈</p>
        <p className="mt-2 text-sm font-medium text-slate-300">No pacing risks</p>
        <p className="mt-1 text-xs text-slate-500">
          Clients on pacing are not shown here. Set budget targets in Pacing to enable tracking.
        </p>
        <Link
          href="/pacing"
          className="mt-3 rounded-lg border border-slate-700 px-3 py-1.5
                     text-xs text-slate-400 hover:border-slate-600 hover:text-slate-200"
        >
          Go to Pacing
        </Link>
      </div>
    );
  }

  // over_pacing first (higher risk), then under_pacing
  const sorted = [...pacingItems].sort((a, b) => {
    if (a.status === b.status) return b.pacingPct - a.pacingPct;
    return a.status === "over_pacing" ? -1 : 1;
  });

  return (
    <div>
      {sorted.map((p) => (
        <PacingRow key={p.id} item={p} />
      ))}
    </div>
  );
}
