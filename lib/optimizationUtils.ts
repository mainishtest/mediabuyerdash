// Converts evaluation results into deterministic optimization opportunities.
// Kept intentionally separate from evaluationUtils so each layer stays small
// and the recommendation logic can evolve independently.

import type { BaseEvaluation, EvaluationStatus } from "./evaluationUtils";

// --- Types -------------------------------------------------------------------

export type OptimizationAction   = "scale" | "maintain" | "review" | "reduce_spend" | "pause";
export type OptimizationPriority = "high" | "medium" | "low";
export type EntityType           = "campaign" | "adSet" | "ad";

export interface OptimizationOpportunity {
  recommendationId:   string;
  entityType:         EntityType;
  entityId:           string;
  entityName:         string;
  parentCampaignName?: string;
  action:             OptimizationAction;
  priority:           OptimizationPriority;
  reason:             string;
  actualRoas:         number;
  actualCpa:          number;
  roasGoalValue:      number;
  cpaGoalValue:       number;
}

// --- Private helpers ---------------------------------------------------------

type ActionResult = {
  action:   OptimizationAction;
  priority: OptimizationPriority;
  reason:   string;
};

function resolveAction(
  status:      EvaluationStatus,
  meetsRoas:   boolean,
  meetsCpa:    boolean,
  entityType:  EntityType
): ActionResult {
  switch (status) {
    case "strong":
      return {
        action:   "scale",
        priority: "high",
        reason:   "Exceeding both ROAS and CPA targets — strong candidate for budget scaling"
      };

    case "on_target":
      return {
        action:   "maintain",
        priority: "low",
        reason:   "Meeting ROAS and CPA targets — maintain current strategy"
      };

    case "watch":
      if (meetsRoas && !meetsCpa) {
        return {
          action:   "review",
          priority: "medium",
          reason:   "ROAS on target but CPA is above goal — review audience or creative efficiency"
        };
      }
      return {
        action:   "review",
        priority: "medium",
        reason:   "CPA on target but ROAS is below goal — review revenue quality or offer strength"
      };

    case "below_goal":
      if (entityType === "ad") {
        return {
          action:   "pause",
          priority: "high",
          reason:   "Ad is underperforming on both metrics — pause and test a new creative"
        };
      }
      return {
        action:   "reduce_spend",
        priority: "high",
        reason:   "Below both ROAS and CPA targets — reduce budget allocation until performance improves"
      };
  }
}

// --- Public API --------------------------------------------------------------

export function generateOpportunities(
  evaluations: BaseEvaluation[],
  entityType:  EntityType
): OptimizationOpportunity[] {
  return evaluations.map((ev) => {
    const { action, priority, reason } = resolveAction(
      ev.status,
      ev.meetsRoasGoal,
      ev.meetsCpaGoal,
      entityType
    );

    return {
      recommendationId:   `${entityType}_${ev.entityId}_opp`,
      entityType,
      entityId:           ev.entityId,
      entityName:         ev.entityName,
      parentCampaignName: ev.parentCampaignName,
      action,
      priority,
      reason,
      actualRoas:         ev.actualRoas,
      actualCpa:          ev.actualCpa,
      roasGoalValue:      ev.roasGoalValue,
      cpaGoalValue:       ev.cpaGoalValue
    };
  });
}
