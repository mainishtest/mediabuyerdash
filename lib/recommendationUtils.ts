import type { Weekday } from "../types/media";
import type { WeekdayHourGroup } from "./daypartingUtils";

export type RecommendationType = "increase" | "decrease";

export interface Recommendation {
  id: string;
  type: RecommendationType;
  weekday: Weekday;
  hour: number;
  formattedHour: string;
  formattedCpa: string;
  formattedRoas: string;
  reason: string;
}

function buildReason(
  type: RecommendationType,
  formattedCpa: string,
  formattedRoas: string
): string {
  if (type === "increase") {
    return (
      `CPA of ${formattedCpa} is below average and ROAS of ${formattedRoas} ` +
      `is above average. Consider increasing spend priority during this hour.`
    );
  }
  return (
    `CPA of ${formattedCpa} is above average and ROAS of ${formattedRoas} ` +
    `is below average. Consider reducing spend priority during this hour.`
  );
}

export function generateRecommendations(
  groups: WeekdayHourGroup[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const group of groups) {
    if (group.classification === "neutral") continue;

    const type: RecommendationType =
      group.classification === "best" ? "increase" : "decrease";

    recommendations.push({
      id: `${group.weekday}-${group.hour}`,
      type,
      weekday: group.weekday,
      hour: group.hour,
      formattedHour: group.formattedHour,
      formattedCpa: group.formattedCpa,
      formattedRoas: group.formattedRoas,
      reason: buildReason(type, group.formattedCpa, group.formattedRoas)
    });
  }

  return recommendations;
}
