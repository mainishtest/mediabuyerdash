// components/ui/EvaluationBadge.tsx
// Reusable evaluation signal badges for the Phase 3 evaluation engine.
//
// Components:
//   <EvaluationStatusBadge />    — colored chip for PerformanceStatus
//   <RecommendationBadge />      — colored chip for RecommendationType
//   <ConfidenceDot />            — small dot for ConfidenceLevel
//   <EvaluationSignal />         — compact combo: status + recommendation + confidence
//   <EvaluationCard />           — expanded evaluation detail card

import type {
  PerformanceStatus,
  RecommendationType,
  ConfidenceLevel,
  PerformanceEvaluation,
} from "../../lib/evaluation/types";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<PerformanceStatus, string> = {
  scaling:           "bg-emerald-800/60 text-emerald-300 border border-emerald-700/40",
  stable:            "bg-emerald-900/40 text-emerald-400 border border-emerald-900/30",
  watching:          "bg-amber-900/40  text-amber-300   border border-amber-800/40",
  fatigued:          "bg-violet-900/40 text-violet-300  border border-violet-800/40",
  losing:            "bg-rose-900/50   text-rose-300    border border-rose-800/40",
  insufficient_data: "bg-slate-800     text-slate-400   border border-slate-700",
};

const STATUS_LABELS: Record<PerformanceStatus, string> = {
  scaling:           "Scaling",
  stable:            "Stable",
  watching:          "Watching",
  fatigued:          "Fatigued",
  losing:            "Losing",
  insufficient_data: "Low Data",
};

export function EvaluationStatusBadge({
  status,
  size = "sm",
}: {
  status: PerformanceStatus;
  size?:  "xs" | "sm";
}) {
  const text = size === "xs" ? "text-[10px]" : "text-xs";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${text} ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Recommendation badge
// ---------------------------------------------------------------------------

const REC_STYLES: Record<RecommendationType, string> = {
  scale_budget_10_20: "bg-emerald-800/50 text-emerald-300 border border-emerald-700/30",
  hold:               "bg-slate-800      text-slate-400   border border-slate-700",
  reduce_budget:      "bg-amber-900/50   text-amber-300   border border-amber-800/40",
  pause_entity:       "bg-rose-900/60    text-rose-300    border border-rose-800/50",
  rotate_creative:    "bg-violet-900/40  text-violet-300  border border-violet-800/40",
  investigate_lp:     "bg-sky-900/40     text-sky-300     border border-sky-800/40",
};

const REC_LABELS: Record<RecommendationType, string> = {
  scale_budget_10_20: "Scale Budget",
  hold:               "Hold",
  reduce_budget:      "Reduce Budget",
  pause_entity:       "Pause",
  rotate_creative:    "Rotate Creative",
  investigate_lp:     "Check LP",
};

export function RecommendationBadge({
  type,
  size = "sm",
}: {
  type: RecommendationType;
  size?: "xs" | "sm";
}) {
  const text = size === "xs" ? "text-[10px]" : "text-xs";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${text} ${REC_STYLES[type]}`}
    >
      {REC_LABELS[type]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Confidence dot
// ---------------------------------------------------------------------------

const CONF_DOT: Record<ConfidenceLevel, string> = {
  high:   "bg-emerald-400",
  medium: "bg-amber-400",
  low:    "bg-slate-500",
};

const CONF_LABEL: Record<ConfidenceLevel, string> = {
  high:   "High confidence",
  medium: "Medium confidence",
  low:    "Low confidence",
};

export function ConfidenceDot({ confidence }: { confidence: ConfidenceLevel }) {
  return (
    <span
      title={CONF_LABEL[confidence]}
      className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${CONF_DOT[confidence]}`}
    />
  );
}

// ---------------------------------------------------------------------------
// EvaluationSignal — compact combo for table cells
// Shows: status badge · recommendation badge · confidence dot
// ---------------------------------------------------------------------------

export function EvaluationSignal({
  evaluation,
  showRec = true,
}: {
  evaluation: PerformanceEvaluation;
  showRec?:   boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <EvaluationStatusBadge status={evaluation.status} size="xs" />
      {showRec && evaluation.status !== "insufficient_data" && (
        <RecommendationBadge type={evaluation.recommendation.type} size="xs" />
      )}
      <ConfidenceDot confidence={evaluation.confidence} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// EvaluationCard — expanded evaluation detail (used in drill-downs / mobile)
// ---------------------------------------------------------------------------

export function EvaluationCard({ evaluation }: { evaluation: PerformanceEvaluation }) {
  const { status, recommendation, confidence, deltas, reasons } = evaluation;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <EvaluationStatusBadge status={status} />
        <RecommendationBadge   type={recommendation.type} />
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <ConfidenceDot confidence={confidence} />
          {confidence} confidence
        </span>
      </div>

      {/* Recommendation reason */}
      <p className="text-xs text-slate-300 leading-relaxed">
        {recommendation.reason}
      </p>

      {/* Supporting data */}
      {recommendation.supportingData && (
        <p className="text-xs text-slate-500 font-mono">
          {recommendation.supportingData}
        </p>
      )}

      {/* Deltas */}
      {(deltas.roasDelta != null || deltas.cpaDelta != null) && (
        <div className="flex gap-3 flex-wrap pt-0.5">
          {deltas.roasDelta != null && (
            <DeltaPill label="ROAS" delta={deltas.roasDelta} invert={false} />
          )}
          {deltas.cpaDelta != null && (
            <DeltaPill label="CPA" delta={deltas.cpaDelta} invert={true} />
          )}
          {deltas.ctrDelta != null && (
            <DeltaPill label="CTR" delta={deltas.ctrDelta} invert={false} />
          )}
          {deltas.cvrDelta != null && (
            <DeltaPill label="CVR" delta={deltas.cvrDelta} invert={false} />
          )}
        </div>
      )}

      {/* Reasons */}
      {reasons.length > 0 && (
        <ul className="space-y-0.5">
          {reasons.map((r, i) => (
            <li key={i} className="text-xs text-slate-400 flex gap-1.5">
              <span className="text-slate-600 flex-shrink-0">·</span>
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeltaPill — inline delta indicator
// ---------------------------------------------------------------------------

function DeltaPill({
  label,
  delta,
  invert,
}: {
  label:  string;
  delta:  number;
  invert: boolean; // true for CPA: positive delta is bad
}) {
  const good    = invert ? delta <= 0 : delta >= 0;
  const sign    = delta > 0 ? "+" : "";
  const color   = good
    ? "text-emerald-400"
    : Math.abs(delta) > 20
      ? "text-rose-400"
      : "text-amber-400";

  return (
    <span className="text-xs text-slate-500">
      {label}{" "}
      <span className={`font-medium ${color}`}>
        {sign}{delta.toFixed(1)}%
      </span>
    </span>
  );
}
