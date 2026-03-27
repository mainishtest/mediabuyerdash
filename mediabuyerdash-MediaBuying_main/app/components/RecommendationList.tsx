import type { Recommendation } from "../../lib/recommendationUtils";
import { RecommendationCard } from "./RecommendationCard";

type RecommendationListProps = {
  recommendations: Recommendation[];
};

export function RecommendationList({ recommendations }: RecommendationListProps) {
  return (
    <section>
      <h2 className="mb-1 text-xl font-semibold text-slate-50">
        Dayparting Recommendations
      </h2>
      <p className="mb-5 text-sm text-slate-400">
        Rule-based recommendations derived from hourly CPA and ROAS performance
        relative to averages for the selected range. AI-powered insights will be
        added in a future step.
      </p>

      {recommendations.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="text-sm text-slate-400">
            No recommendations available for the selected range. Not enough
            hourly variation to identify clear patterns.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {recommendations.map((rec) => (
            <RecommendationCard key={rec.id} recommendation={rec} />
          ))}
        </div>
      )}
    </section>
  );
}
