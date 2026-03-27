// lib/campaignPerformance/recommendations.ts
// Deterministic recommendation generation from a CampaignHealthStatus.
// Pure functions — no DB access, no side effects.

import type {
  CampaignHealthStatus,
  CampaignActionType,
  CampaignRecommendationSummary,
  CampaignPerformanceSnapshot,
} from "./types";

// ── Action resolution ─────────────────────────────────────────────────────────

function resolveAction(
  healthStatus:  CampaignHealthStatus,
  meetsRoasGoal: boolean,
  meetsCpaGoal:  boolean
): { actionType: CampaignActionType; priority: "high" | "medium" | "low"; reason: string } {
  switch (healthStatus) {
    case "strong":
      return {
        actionType: "scale",
        priority:   "high",
        reason:     "Exceeding both ROAS and CPA targets — strong candidate for budget scaling",
      };

    case "on_target":
      return {
        actionType: "maintain",
        priority:   "low",
        reason:     "Meeting both ROAS and CPA targets — maintain current approach",
      };

    case "watch":
      if (meetsRoasGoal && !meetsCpaGoal) {
        return {
          actionType: "review",
          priority:   "medium",
          reason:     "ROAS on target but CPA above goal — review creative or audience efficiency",
        };
      }
      return {
        actionType: "review",
        priority:   "medium",
        reason:     "CPA on target but ROAS below goal — review revenue quality or offer strength",
      };

    case "below_goal":
      return {
        actionType: "reduce_spend",
        priority:   "high",
        reason:     "Below both ROAS and CPA targets — reduce spend until performance improves",
      };

    case "no_goal":
      return {
        actionType: "set_goal",
        priority:   "medium",
        reason:     "No ROAS or CPA targets configured — set goals to enable performance evaluation",
      };

    case "stale":
      return {
        actionType: "sync_now",
        priority:   "low",
        reason:     "No spend data in the synced window — run a sync to refresh campaign data",
      };

    case "no_data":
      return {
        actionType: "sync_now",
        priority:   "low",
        reason:     "No performance data available — run a Meta sync for this client",
      };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function summarizeCampaignRecommendation(
  healthStatus:  CampaignHealthStatus,
  meetsRoasGoal: boolean,
  meetsCpaGoal:  boolean,
  snapshot: Pick<
    CampaignPerformanceSnapshot,
    "evaluatedRoas" | "evaluatedCpa" | "roasGoalValue" | "cpaGoalValue"
  >
): CampaignRecommendationSummary {
  const { actionType, priority, reason } = resolveAction(
    healthStatus,
    meetsRoasGoal,
    meetsCpaGoal
  );

  // Build a compact metric comparison string for context
  let supportingMetrics: string | null = null;
  if (snapshot.evaluatedRoas > 0 || snapshot.evaluatedCpa > 0) {
    const parts: string[] = [];
    if (snapshot.evaluatedRoas > 0 && snapshot.roasGoalValue) {
      parts.push(
        `ROAS ${snapshot.evaluatedRoas.toFixed(2)}x vs ${snapshot.roasGoalValue.toFixed(2)}x goal`
      );
    }
    if (snapshot.evaluatedCpa > 0 && snapshot.cpaGoalValue) {
      parts.push(
        `CPA $${snapshot.evaluatedCpa.toFixed(2)} vs $${snapshot.cpaGoalValue.toFixed(2)} goal`
      );
    }
    supportingMetrics = parts.join(" · ") || null;
  }

  return { actionType, priority, reason, supportingMetrics };
}

// ── Opportunity/Risk text summaries ───────────────────────────────────────────

export interface OpportunityRiskSummary {
  opportunities: string[];  // scale / maintain candidates
  risks:         string[];  // reduce_spend / review candidates
}

/**
 * Returns the top 3 opportunity and top 3 risk lines for the dashboard strip.
 * Each line is a human-readable sentence ready for display.
 */
export function buildOpportunityRiskSummary(
  snapshots: CampaignPerformanceSnapshot[]
): OpportunityRiskSummary {
  const strong    = snapshots.filter((s) => s.healthStatus === "strong");
  const on_target = snapshots.filter((s) => s.healthStatus === "on_target");
  const below     = snapshots.filter((s) => s.healthStatus === "below_goal");
  const watch     = snapshots.filter((s) => s.healthStatus === "watch");
  const no_goal   = snapshots.filter((s) => s.healthStatus === "no_goal");

  const opportunities: string[] = [];
  const risks: string[] = [];

  if (strong.length > 0) {
    opportunities.push(
      `${strong.length} campaign${strong.length !== 1 ? "s" : ""} exceeding both goals — ready to scale`
    );
  }
  if (on_target.length > 0) {
    opportunities.push(
      `${on_target.length} campaign${on_target.length !== 1 ? "s" : ""} on target — maintain current approach`
    );
  }
  if (below.length > 0) {
    risks.push(
      `${below.length} campaign${below.length !== 1 ? "s" : ""} below both goals — review spend allocation`
    );
  }
  if (watch.length > 0) {
    risks.push(
      `${watch.length} campaign${watch.length !== 1 ? "s" : ""} hitting only one goal — needs attention`
    );
  }
  if (no_goal.length > 0) {
    risks.push(
      `${no_goal.length} campaign${no_goal.length !== 1 ? "s" : ""} with no goals configured`
    );
  }

  return {
    opportunities: opportunities.slice(0, 3),
    risks:         risks.slice(0, 3),
  };
}
