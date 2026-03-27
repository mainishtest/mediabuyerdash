import type { BaseEvaluation, EvaluationStatus } from "../../lib/evaluationUtils";
import { formatCurrency, formatRoas } from "../../lib/metricUtils";

type Props = {
  evaluations: BaseEvaluation[];
  showParent?: boolean;
};

const TH = "px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400";
const TD = "px-4 py-3 text-sm text-slate-300";

function statusBadgeClass(status: EvaluationStatus): string {
  switch (status) {
    case "strong":     return "bg-emerald-900/60 text-emerald-300";
    case "on_target":  return "bg-sky-900/60 text-sky-300";
    case "watch":      return "bg-amber-900/60 text-amber-300";
    case "below_goal": return "bg-rose-900/60 text-rose-300";
  }
}

function statusLabel(status: EvaluationStatus): string {
  switch (status) {
    case "strong":     return "Strong";
    case "on_target":  return "On Target";
    case "watch":      return "Watch";
    case "below_goal": return "Below Goal";
  }
}

export function EvaluationTable({ evaluations, showParent = false }: Props) {
  if (evaluations.length === 0) {
    return (
      <p className="rounded-xl border border-slate-800 bg-slate-900/60 px-6 py-8 text-sm text-slate-500">
        No evaluation data available.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm shadow-slate-900/40">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className={TH}>Name</th>
            {showParent && <th className={TH}>Campaign</th>}
            <th className={TH}>Actual ROAS</th>
            <th className={TH}>ROAS Goal</th>
            <th className={TH}>Actual CPA</th>
            <th className={TH}>CPA Goal</th>
            <th className={TH}>Status</th>
            <th className={TH}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {evaluations.map((ev, i) => (
            <tr
              key={ev.entityId}
              className={i < evaluations.length - 1 ? "border-b border-slate-800" : ""}
            >
              <td className={`${TD} font-medium text-slate-200`}>{ev.entityName}</td>
              {showParent && (
                <td className={TD}>{ev.parentCampaignName ?? "—"}</td>
              )}
              <td className={TD}>
                <span className={ev.meetsRoasGoal ? "text-emerald-400" : "text-rose-400"}>
                  {formatRoas(ev.actualRoas)}
                </span>
              </td>
              <td className={`${TD} text-slate-500`}>
                {formatRoas(ev.roasGoalValue)}{" "}
                <span className="text-xs opacity-60">({ev.roasGoalType})</span>
              </td>
              <td className={TD}>
                <span className={ev.meetsCpaGoal ? "text-emerald-400" : "text-rose-400"}>
                  {formatCurrency(ev.actualCpa)}
                </span>
              </td>
              <td className={`${TD} text-slate-500`}>
                {formatCurrency(ev.cpaGoalValue)}{" "}
                <span className="text-xs opacity-60">({ev.cpaGoalType})</span>
              </td>
              <td className={TD}>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(ev.status)}`}
                >
                  {statusLabel(ev.status)}
                </span>
              </td>
              <td className={`${TD} text-slate-400`}>{ev.shortReason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
