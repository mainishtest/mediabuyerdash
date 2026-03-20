import Link from "next/link";
import type { PortfolioBudgetGovernanceItem } from "../../../../lib/portfolioGovernance/types";
import {
  budgetRecommendationLabel,
  budgetRecommendationBadgeClass,
  readinessBadgeClass,
  readinessLabel,
  governancePriorityBadgeClass,
} from "../../../../lib/portfolioGovernance/scoring";
import { autonomyModeDisplay } from "../../../../lib/portfolio/health";

function fmt(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style:    "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtRatio(r: number | null, invert = false): { label: string; cls: string } {
  if (r === null) return { label: "—", cls: "text-slate-500" };
  // invert = true for CPA (lower ratio = better)
  const good = invert ? r <= 1 : r >= 1;
  const pct  = Math.round(Math.abs(r - 1) * 100);
  const dir  = invert ? (r <= 1 ? "better" : "worse") : (r >= 1 ? "above" : "below");
  const label = r === 1 ? "On target" : `${pct}% ${dir}`;
  return {
    label,
    cls: good ? "text-emerald-400" : r < 0.8 || r > 1.2 ? "text-rose-400" : "text-amber-400",
  };
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-5 py-6 text-center">
      <p className="text-sm font-medium text-slate-400">No budget governance data available</p>
      <p className="mt-1 text-xs text-slate-600">
        Add client goals and pacing targets to enable budget guidance.
      </p>
    </div>
  );
}

// ── Desktop table row ─────────────────────────────────────────────────────────

function TableRow({ item }: { item: PortfolioBudgetGovernanceItem }) {
  const roasFmt = fmtRatio(item.roasVsGoalRatio);
  const cpaFmt  = fmtRatio(item.cpaVsGoalRatio, true);
  const pacingColor =
    item.pacingStatus === "over_pacing"  ? "text-amber-400" :
    item.pacingStatus === "under_pacing" ? "text-rose-400"  :
    item.pacingPct === null              ? "text-slate-500"  :
    "text-emerald-400";

  return (
    <tr className="border-t border-slate-800/60 hover:bg-slate-800/30 transition-colors">
      {/* Client */}
      <td className="px-3 py-2.5 text-sm font-medium text-white">{item.clientName}</td>

      {/* Spend */}
      <td className="px-3 py-2.5 text-xs text-slate-300 tabular-nums">
        {fmt(item.currentSpend, item.currency)}
      </td>

      {/* Pacing */}
      <td className={`px-3 py-2.5 text-xs tabular-nums ${pacingColor}`}>
        {item.pacingPct !== null ? `${Math.round(item.pacingPct)}%` : "—"}
      </td>

      {/* ROAS vs goal */}
      <td className={`px-3 py-2.5 text-xs tabular-nums ${roasFmt.cls}`}>
        {item.roas !== null ? item.roas.toFixed(2) : "—"}
        {item.roasGoal !== null && (
          <span className="text-slate-600"> / {item.roasGoal.toFixed(2)}</span>
        )}
        {item.roasVsGoalRatio !== null && (
          <span className="ml-1 text-xs opacity-70">({roasFmt.label})</span>
        )}
      </td>

      {/* CPA vs goal */}
      <td className={`px-3 py-2.5 text-xs tabular-nums ${cpaFmt.cls}`}>
        {item.cpa !== null ? fmt(item.cpa, item.currency) : "—"}
        {item.cpaGoal !== null && (
          <span className="text-slate-600"> / {fmt(item.cpaGoal, item.currency)}</span>
        )}
        {item.cpaVsGoalRatio !== null && (
          <span className="ml-1 text-xs opacity-70">({cpaFmt.label})</span>
        )}
      </td>

      {/* Budget recommendation */}
      <td className="px-3 py-2.5">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${budgetRecommendationBadgeClass(item.budgetRecommendation)}`}>
          {budgetRecommendationLabel(item.budgetRecommendation)}
        </span>
      </td>

      {/* Readiness */}
      <td className="px-3 py-2.5">
        <span className={`rounded-full border px-2 py-0.5 text-xs ${readinessBadgeClass(item.readiness)}`}>
          {readinessLabel(item.readiness)}
        </span>
      </td>

      {/* Autonomy mode */}
      <td className="px-3 py-2.5 text-xs text-slate-400">
        {autonomyModeDisplay(item.autonomyMode)}
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={item.links.commandCenter}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
          >
            Command Center
          </Link>
          {item.hasEmergencyStop && item.links.governanceControls && (
            <Link
              href={item.links.governanceControls}
              className="rounded border border-rose-800/60 bg-rose-950/40 px-2 py-0.5 text-xs text-rose-300 hover:border-rose-700 transition-colors"
            >
              Governance
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Mobile card ───────────────────────────────────────────────────────────────

function BudgetCard({ item }: { item: PortfolioBudgetGovernanceItem }) {
  const roasFmt = fmtRatio(item.roasVsGoalRatio);
  const pacingColor =
    item.pacingStatus === "over_pacing"  ? "text-amber-400" :
    item.pacingStatus === "under_pacing" ? "text-rose-400"  :
    item.pacingPct === null              ? "text-slate-500"  :
    "text-emerald-400";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-white">{item.clientName}</p>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${budgetRecommendationBadgeClass(item.budgetRecommendation)}`}>
          {budgetRecommendationLabel(item.budgetRecommendation)}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <span className="text-slate-500">Spend </span>
          <span className="text-slate-300 tabular-nums">{fmt(item.currentSpend, item.currency)}</span>
        </div>
        <div>
          <span className="text-slate-500">Pacing </span>
          <span className={`tabular-nums ${pacingColor}`}>
            {item.pacingPct !== null ? `${Math.round(item.pacingPct)}%` : "—"}
          </span>
        </div>
        <div>
          <span className="text-slate-500">ROAS </span>
          <span className={`tabular-nums ${roasFmt.cls}`}>
            {item.roas !== null ? `${item.roas.toFixed(2)}x` : "—"}
            {item.roasGoal !== null && <span className="text-slate-600"> / {item.roasGoal.toFixed(2)}x goal</span>}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Readiness </span>
          <span className={`${readinessBadgeClass(item.readiness)} rounded px-1.5`}>
            {readinessLabel(item.readiness)}
          </span>
        </div>
      </div>

      {/* Governance reason */}
      <p className="mt-2 text-xs text-slate-400">{item.governanceReason.summary}</p>

      {/* Blockers */}
      {item.blockers.length > 0 && (
        <div className="mt-2 rounded-lg border border-rose-900/40 bg-rose-950/20 px-3 py-1.5">
          {item.blockers.map((b, i) => (
            <p key={i} className="text-xs text-rose-300">• {b}</p>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={item.links.commandCenter}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
        >
          Command Center
        </Link>
        <Link
          href={item.links.account}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
        >
          Open Account
        </Link>
        {item.hasEmergencyStop && item.links.governanceControls && (
          <Link
            href={item.links.governanceControls}
            className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-2.5 py-1 text-xs text-rose-300 hover:border-rose-700 transition-colors"
          >
            Governance
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BudgetGovernancePanel({
  items,
}: {
  items: PortfolioBudgetGovernanceItem[];
}) {
  if (items.length === 0) return <EmptyState />;

  return (
    <>
      {/* Mobile: cards */}
      <div className="space-y-2 lg:hidden">
        {items.map((item) => (
          <BudgetCard key={item.clientId} item={item} />
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-max text-left">
          <thead>
            <tr className="border-b border-slate-800">
              {[
                "Client",
                "Spend (Period)",
                "Pacing",
                "ROAS vs Goal",
                "CPA vs Goal",
                "Budget Guidance",
                "Readiness",
                "Automation Mode",
                "Actions",
              ].map((h) => (
                <th key={h} className="px-3 py-2 text-xs font-medium text-slate-500">
                  {h}
                </th>
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
