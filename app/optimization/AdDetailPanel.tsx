"use client";

// app/optimization/AdDetailPanel.tsx
// Slide-over panel shown when the buyer clicks an underperforming ad row.
// Displays the synced creative (image + copy + CTA) alongside performance
// metrics, then offers two actions:
//   • Send to Creative Lab → navigates to /creative-lab with the client
//   • Generate Variations  → navigates to /creative-lab/generate

import { useRouter }  from "next/navigation";
import type { GoalAwareEvaluationResult } from "../../types/goalAwareOptimization";
import type { AdCreativeData }            from "../../lib/optimization/realDataService";
import { Badge }                          from "../../components/ui";
import { formatCurrency, formatRoas }     from "../../lib/metricUtils";

// ---------------------------------------------------------------------------
// Display maps (scoped here to avoid circular imports with OptimizationView)
// ---------------------------------------------------------------------------

const STATUS_VARIANT = {
  strong:          "success",
  on_track:        "info",
  underperforming: "warning",
  critical:        "danger",
  watch:           "neutral",
  no_data:         "neutral",
} as const;

const STATUS_LABEL = {
  strong:          "Strong",
  on_track:        "On Track",
  underperforming: "Underperforming",
  critical:        "Critical",
  watch:           "Watch",
  no_data:         "No Data",
} as const;

const PRIORITY_VARIANT = {
  high:   "danger",
  medium: "warning",
  low:    "neutral",
} as const;

// ---------------------------------------------------------------------------
// Metric cell
// ---------------------------------------------------------------------------

function MetricCell({
  label,
  value,
  sub,
  met,
}: {
  label: string;
  value: string;
  sub:   string;
  met:   boolean | null;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <p
        className={`text-lg font-semibold ${
          met === true  ? "text-emerald-400" :
          met === false ? "text-rose-400"    : "text-slate-200"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-slate-600">{sub}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Props = {
  ev:       GoalAwareEvaluationResult;
  creative: AdCreativeData | undefined;
  clientId: string | null;
  onClose:  () => void;
};

export function AdDetailPanel({ ev, creative, clientId, onClose }: Props) {
  const router = useRouter();

  const clientParam = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";

  const hasImage = !!(creative?.imageUrl || creative?.thumbnailUrl);
  const hasBody  = !!creative?.body;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Ad detail: ${ev.entityName}`}
        className="fixed right-0 top-0 z-50 flex h-full w-full flex-col
                   overflow-hidden bg-slate-900 shadow-2xl
                   sm:w-[520px] border-l border-slate-800"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_VARIANT[ev.status]}>
                {STATUS_LABEL[ev.status]}
              </Badge>
              <Badge variant={PRIORITY_VARIANT[ev.priority]}>
                {ev.priority.charAt(0).toUpperCase() + ev.priority.slice(1)} Priority
              </Badge>
            </div>
            <h2 className="truncate text-base font-semibold text-white">
              {ev.entityName}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{ev.reason}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="mt-0.5 shrink-0 rounded-lg p-2 text-slate-400
                       hover:bg-slate-800 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Creative preview */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Creative Preview
            </p>
            {hasImage ? (
              <div className="overflow-hidden rounded-xl border border-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={creative!.imageUrl ?? creative!.thumbnailUrl!}
                  alt={creative!.creativeName ?? ev.entityName}
                  className="w-full max-h-64 object-cover"
                />
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center rounded-xl
                              border border-slate-800 bg-slate-900/40">
                <p className="text-sm text-slate-600">No image synced for this ad</p>
              </div>
            )}
            {creative?.creativeName && (
              <p className="mt-2 text-xs text-slate-600">
                Creative: {creative.creativeName}
              </p>
            )}
          </section>

          {/* Ad copy */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Ad Copy
            </p>
            {hasBody ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                  {creative!.body}
                </p>
                {creative!.callToAction && (
                  <div className="mt-3 border-t border-slate-800 pt-3">
                    <span className="inline-block rounded-md bg-indigo-600/20 px-3 py-1
                                     text-xs font-medium text-indigo-300">
                      CTA: {creative!.callToAction}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <p className="text-sm text-slate-600">No copy synced for this ad</p>
              </div>
            )}
          </section>

          {/* Performance metrics */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Performance <span className="normal-case font-normal text-slate-600">(CRM source of truth)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <MetricCell
                label="Actual ROAS"
                value={ev.actualRoas != null ? formatRoas(ev.actualRoas) : "—"}
                sub={`Goal: ${formatRoas(ev.roasGoalValue)}`}
                met={ev.meetsRoasGoal}
              />
              <MetricCell
                label="Actual CPA"
                value={ev.actualCpa != null ? formatCurrency(ev.actualCpa) : "—"}
                sub={`Goal: ${formatCurrency(ev.cpaGoalValue)}`}
                met={ev.meetsCpaGoal}
              />
            </div>
          </section>

          {/* Recommendation */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Recommendation
            </p>
            <div className="rounded-xl border border-amber-800/30 bg-amber-950/20 p-4">
              <p className="text-sm text-amber-200">{ev.reason}</p>
            </div>
          </section>

        </div>

        {/* Action buttons */}
        <div className="border-t border-slate-800 px-6 py-4 space-y-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Actions
          </p>

          {/* Primary: Send to Creative Lab */}
          <button
            onClick={() => router.push(`/creative-lab${clientParam}`)}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium
                       text-white hover:bg-indigo-500 transition-colors"
          >
            Send to Creative Lab
          </button>

          {/* Secondary: Generate Variations */}
          <button
            onClick={() => router.push(`/creative-lab/generate${clientParam}`)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3
                       text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Generate Variations
          </button>
        </div>
      </div>
    </>
  );
}
