"use client";

// app/creative-lab/outcomes/CreativeOutcomeRouteCard.tsx
// Compact card for the outcome route list panel.

import type { CreativeOutcomeRoute } from "../../../types/creativeOutcomeRouting";
import {
  ROUTE_TYPE_LABEL,
  ROUTE_TYPE_COLOR,
  ROUTE_TYPE_BG,
  READINESS_STATE_LABEL,
  READINESS_STATE_COLOR,
} from "../../../types/creativeOutcomeRouting";

type Props = {
  route:      CreativeOutcomeRoute;
  isSelected: boolean;
  onSelect:   (id: string) => void;
};

export function CreativeOutcomeRouteCard({ route, isSelected, onSelect }: Props) {
  const liftStr = route.primaryLift != null
    ? `${route.primaryLift > 0 ? "+" : ""}${(route.primaryLift * 100).toFixed(1)}%`
    : null;

  const hasBlocker = route.reasons.some((r) => r.isBlocker);

  return (
    <button
      type="button"
      onClick={() => onSelect(route.id)}
      className={[
        "w-full rounded-lg border p-3 text-left transition-colors",
        isSelected
          ? "border-indigo-600/60 bg-indigo-950/40"
          : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-800/60",
      ].join(" ")}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className={`text-xs font-semibold truncate ${ROUTE_TYPE_COLOR[route.routeType]}`}>
          {ROUTE_TYPE_LABEL[route.routeType]}
        </span>
        <span className={`shrink-0 text-xs ${READINESS_STATE_COLOR[route.readinessState]}`}>
          {READINESS_STATE_LABEL[route.readinessState]}
        </span>
      </div>

      {/* Creative names */}
      <p className="text-xs font-medium text-slate-200 truncate">
        {route.challengerVariantTitle ?? "Challenger"}
        <span className="text-slate-500"> vs </span>
        {route.controlCreativeName ?? "Control"}
      </p>

      {/* Metric + lift */}
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        {route.primaryMetric && (
          <span className="capitalize">{route.primaryMetric.replace(/_/g, " ")}</span>
        )}
        {liftStr && (
          <span className={route.primaryLift! > 0 ? "text-emerald-400" : "text-rose-400"}>
            {liftStr}
          </span>
        )}
        {route.campaignName && (
          <span className="truncate text-slate-500">{route.campaignName}</span>
        )}
      </div>

      {/* Blockers pill */}
      {hasBlocker && (
        <div className="mt-1.5">
          <span className="inline-block rounded-full bg-rose-950/40 px-2 py-0.5 text-[10px] text-rose-400 border border-rose-800/40">
            blockers
          </span>
        </div>
      )}
    </button>
  );
}
