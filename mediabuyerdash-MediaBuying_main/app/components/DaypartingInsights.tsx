import type { DaypartingResult } from "../../lib/daypartingUtils";
import { HourInsightRow } from "./HourInsightRow";

type DaypartingInsightsProps = {
  result: DaypartingResult;
};

export function DaypartingInsights({ result }: DaypartingInsightsProps) {
  const { bestHours, weakHours } = result;
  const hasInsights = bestHours.length > 0 || weakHours.length > 0;
  const displayHours = [...bestHours, ...weakHours].sort(
    (a, b) => a.hour - b.hour
  );

  return (
    <section>
      <h2 className="mb-1 text-xl font-semibold text-slate-50">
        Dayparting Insights
      </h2>
      <p className="mb-5 text-sm text-slate-400">
        Hours are classified by comparing each hour&apos;s CPA and ROAS against
        the averages for the selected range. Best hours outperform on both; weak
        hours underperform on both.
      </p>

      <div className="mb-6 flex flex-wrap gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            Avg CPA
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-50">
            {result.formattedAverageCpa}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            Avg ROAS
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-50">
            {result.formattedAverageRoas}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-900/40">
        <div className="grid grid-cols-4 gap-4 border-b border-slate-700 pb-3 text-xs font-medium uppercase tracking-widest text-slate-400">
          <span>Hour</span>
          <span>CPA</span>
          <span>ROAS</span>
          <span>Status</span>
        </div>

        {hasInsights ? (
          displayHours.map((insight) => (
            <HourInsightRow
              key={insight.hour}
              formattedHour={insight.formattedHour}
              formattedCpa={insight.formattedCpa}
              formattedRoas={insight.formattedRoas}
              classification={insight.classification}
            />
          ))
        ) : (
          <p className="pt-4 text-sm text-slate-400">
            No hours clearly outperform or underperform the averages in the
            selected range.
          </p>
        )}
      </div>
    </section>
  );
}
