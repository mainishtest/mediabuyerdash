"use client";

// app/creative-lab/launch/LaunchPlanCard.tsx
// Compact card for the experiment launch plan list.
// Responsive: full width on mobile, scannable row on desktop.

import type { CreativeExperimentLaunchPlan } from "../../../types/experimentLaunch";
import {
  READINESS_STATE_LABEL,
  READINESS_STATE_COLOR,
  READINESS_STATE_BG,
} from "../../../types/experimentLaunch";

type Props = {
  plan:       CreativeExperimentLaunchPlan;
  isSelected: boolean;
  onSelect:   (id: string) => void;
};

export function LaunchPlanCard({ plan, isSelected, onSelect }: Props) {
  const { readiness } = plan;
  const stateLabel = READINESS_STATE_LABEL[readiness.state];
  const stateColor = READINESS_STATE_COLOR[readiness.state];
  const stateBg    = READINESS_STATE_BG[readiness.state];

  const challengerName = plan.challenger.variantTitle ?? plan.challenger.label;
  const controlName    = plan.control.creativeName    ?? plan.control.label;
  const campaign       = plan.mapping.campaignName    ?? plan.mapping.campaignExternalId ?? "—";
  const adSet          = plan.mapping.adSetName       ?? plan.mapping.adSetExternalId    ?? "—";

  return (
    <button
      type="button"
      onClick={() => onSelect(plan.id)}
      className={`w-full rounded-xl border p-4 text-left transition-colors
        ${isSelected
          ? "border-indigo-600/60 bg-indigo-950/30"
          : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/60"
        }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-white">{plan.name}</p>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${stateBg} ${stateColor}`}>
          {stateLabel}
        </span>
      </div>

      {/* Challenger vs Control */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
        <span className="rounded bg-emerald-950/40 px-1.5 py-0.5 text-emerald-400 border border-emerald-800/30">
          ◈ {challengerName}
        </span>
        <span className="text-slate-600">vs</span>
        <span className="rounded bg-sky-950/40 px-1.5 py-0.5 text-sky-400 border border-sky-800/30">
          ◇ {controlName}
        </span>
      </div>

      {/* Campaign / ad set */}
      {(plan.mapping.campaignName || plan.mapping.adSetName) && (
        <p className="mt-1.5 truncate text-xs text-slate-500">
          {campaign}{adSet !== "—" ? ` / ${adSet}` : ""}
        </p>
      )}

      {/* Blockers preview */}
      {readiness.blockers.length > 0 && (
        <p className="mt-1.5 text-xs text-rose-400">
          {readiness.blockers.length} blocker{readiness.blockers.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Primary metric pill */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
          {plan.successCriteria.primaryMetric}
        </span>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
          {plan.successCriteria.evaluationWindowDays}d window
        </span>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
          ≥{(plan.successCriteria.successThreshold * 100).toFixed(0)}% lift
        </span>
      </div>
    </button>
  );
}
