import type { Recommendation, RecommendationType } from "../../lib/recommendationUtils";

type RecommendationCardProps = {
  recommendation: Recommendation;
};

const typeConfig: Record<
  RecommendationType,
  { label: string; badge: string; accent: string }
> = {
  increase: {
    label: "Increase Priority",
    badge: "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50",
    accent: "border-l-emerald-500"
  },
  decrease: {
    label: "Reduce Priority",
    badge: "bg-rose-900/60 text-rose-300 border border-rose-700/50",
    accent: "border-l-rose-500"
  }
};

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const { label, badge, accent } = typeConfig[recommendation.type];

  return (
    <div
      className={`rounded-xl border border-slate-800 border-l-4 ${accent} bg-slate-900/60 p-5 shadow-sm shadow-slate-900/40`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge}`}>
          {label}
        </span>
        <span className="text-sm font-medium text-slate-200">
          {recommendation.weekday} &middot; {recommendation.formattedHour}
        </span>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-slate-300">
        {recommendation.reason}
      </p>

      <div className="flex gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">CPA</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-50">{recommendation.formattedCpa}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">ROAS</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-50">{recommendation.formattedRoas}</p>
        </div>
      </div>
    </div>
  );
}
