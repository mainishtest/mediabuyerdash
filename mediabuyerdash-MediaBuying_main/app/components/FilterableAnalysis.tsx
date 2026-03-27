"use client";

import { useState } from "react";
import { FilterBar } from "./FilterBar";
import { DaypartingInsights } from "./DaypartingInsights";
import { DaypartingTable } from "./DaypartingTable";
import { RecommendationList } from "./RecommendationList";
import { hourlyMetrics } from "../../lib/sampleMetrics";
import { filterHourlyMetrics, type DateRange } from "../../lib/filterUtils";
import { analyzeDayparting, groupByWeekdayAndHour } from "../../lib/daypartingUtils";
import { generateRecommendations } from "../../lib/recommendationUtils";

export function FilterableAnalysis() {
  const [range, setRange] = useState<DateRange>("30");

  const filtered = filterHourlyMetrics(hourlyMetrics, range);
  const daypartingResult = analyzeDayparting(filtered);
  const weekdayGroups = groupByWeekdayAndHour(filtered);
  const recommendations = generateRecommendations(weekdayGroups);

  return (
    <div className="space-y-10">
      {/* Filter control */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-300">
          Hourly Analysis
        </h2>
        <FilterBar selected={range} onChange={setRange} />
      </div>

      {/* Dayparting insights summary */}
      <DaypartingInsights result={daypartingResult} />

      {/* Full weekday × hour breakdown */}
      <DaypartingTable groups={weekdayGroups} />

      {/* Rule-based recommendations */}
      <RecommendationList recommendations={recommendations} />
    </div>
  );
}
