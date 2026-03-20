// ─── Portfolio Governance — Budget Governance Builder ─────────────────────────
//
// Builds PortfolioBudgetGovernanceItem[] from an existing PortfolioPayload.
// No DB calls. No automated budget movements.
// This is decision support only — it surfaces guidance for operators,
// not silent capital reallocation.

import type { PortfolioPayload } from "../portfolio/types";
import type {
  PortfolioBudgetGovernanceItem,
  PortfolioBudgetRecommendation,
  PortfolioGovernanceReason,
  PortfolioActionReadiness,
  PortfolioGovernanceLinks,
} from "./types";

// ── Helper: build standard links ─────────────────────────────────────────────

function clientLinks(clientId: string): PortfolioGovernanceLinks {
  return {
    account:            `/clients/${clientId}`,
    commandCenter:      `/command-center?clientId=${clientId}`,
    approvalQueue:      `/automation?clientId=${clientId}`,
    governanceControls: `/automation/governance`,
  };
}

// ── Helper: derive recommendation ────────────────────────────────────────────

function deriveBudgetRecommendation(params: {
  pacingPct:         number | null;
  pacingStatus:      string;
  roasVsGoalRatio:   number | null; // actual/goal, >1 = beating
  cpaVsGoalRatio:    number | null; // actual/goal, <1 = beating (lower CPA is better)
  hasGoalData:       boolean;
  hasEmergencyStop:  boolean;
  isRestricted:      boolean;
  hasStaleSync:      boolean;
}): PortfolioBudgetRecommendation {
  // No data → insufficient
  if (!params.hasGoalData || params.pacingPct === null) return "insufficient_data";

  // Blocked states → pause candidate
  if (params.hasEmergencyStop) return "pause_candidate";

  // Stale sync → cannot reliably recommend
  if (params.hasStaleSync) return "monitor_closely";

  const pct   = params.pacingPct;
  const roas  = params.roasVsGoalRatio;   // >1 = good
  const cpa   = params.cpaVsGoalRatio;    // <1 = good

  // Goal performance signals
  const isBeatingRoas = roas !== null && roas >= 1.0;
  const isWellAboveRoas = roas !== null && roas >= 1.3;
  const isBelowRoas  = roas !== null && roas < 0.7;
  const isBeatingCpa = cpa  !== null && cpa  <= 1.0;

  // Strong performance + under budget → increase candidate
  if (
    (pct >= 40 && pct < 85) &&
    (isWellAboveRoas || (isBeatingRoas && isBeatingCpa))
  ) {
    return "increase_candidate";
  }

  // Good performance + on track → hold
  if (pct >= 85 && pct <= 115 && (isBeatingRoas || isBeatingCpa)) {
    return "hold";
  }

  // On track + no goal data on performance side → hold
  if (pct >= 85 && pct <= 115) return "hold";

  // Over pacing + weak performance → reduce candidate
  if (pct > 115 && isBelowRoas) return "reduce_candidate";

  // Very over paced → reduce candidate regardless of goal data
  if (pct > 130) return "reduce_candidate";

  // Severely under pacing + bad performance → pause candidate
  if (pct < 40 && isBelowRoas) return "pause_candidate";

  // Severely under pacing → monitor closely (may be intentional)
  if (pct < 40) return "monitor_closely";

  // Mixed signals
  return "monitor_closely";
}

// ── Helper: build governance reason ──────────────────────────────────────────

function buildGovernanceReason(params: {
  recommendation:    PortfolioBudgetRecommendation;
  pacingPct:         number | null;
  pacingStatus:      string;
  roasVsGoalRatio:   number | null;
  cpaVsGoalRatio:    number | null;
  hasEmergencyStop:  boolean;
  isRestricted:      boolean;
  hasStaleSync:      boolean;
  hasGoalData:       boolean;
}): PortfolioGovernanceReason {
  const details: string[] = [];

  if (params.hasEmergencyStop) {
    details.push("Emergency stop is active — no budget actions should be taken");
  }
  if (params.isRestricted) {
    details.push("Account is in restricted automation mode");
  }
  if (params.hasStaleSync) {
    details.push("Data sync is stale — signals may not reflect current state");
  }
  if (!params.hasGoalData) {
    details.push("No goal data configured — set ROAS or CPA targets to enable guidance");
  }

  const pctStr = params.pacingPct !== null ? `${Math.round(params.pacingPct)}%` : "unknown";
  if (params.pacingPct !== null) {
    details.push(`Pacing at ${pctStr} of expected monthly spend (${params.pacingStatus.replace(/_/g, " ")})`);
  }

  if (params.roasVsGoalRatio !== null) {
    const pct = Math.round((params.roasVsGoalRatio - 1) * 100);
    if (pct >= 0) {
      details.push(`ROAS is ${pct}% above goal (CRM source of truth, 7-day attribution)`);
    } else {
      details.push(`ROAS is ${Math.abs(pct)}% below goal (CRM source of truth, 7-day attribution)`);
    }
  }

  if (params.cpaVsGoalRatio !== null) {
    const pct = Math.round((1 - params.cpaVsGoalRatio) * 100);
    if (pct >= 0) {
      details.push(`CPA is ${pct}% better than goal (lower than target)`);
    } else {
      details.push(`CPA is ${Math.abs(pct)}% worse than goal (higher than target)`);
    }
  }

  const SUMMARY: Record<PortfolioBudgetRecommendation, string> = {
    increase_candidate: "Strong performance with budget headroom — eligible for increase consideration",
    hold:               "Performance and pacing are on target — hold current budget",
    monitor_closely:    "Mixed or uncertain signals — monitor before taking budget action",
    reduce_candidate:   "Over-pacing or weak performance — consider reducing budget",
    pause_candidate:    "Critical signals — consider pausing spend for this account",
    insufficient_data:  "Insufficient data to generate budget guidance",
  };

  return {
    summary: SUMMARY[params.recommendation],
    details,
  };
}

// ── Helper: derive readiness for budget item ─────────────────────────────────

function deriveReadiness(params: {
  hasEmergencyStop: boolean;
  isRestricted:     boolean;
  hasStaleSync:     boolean;
  hasGoalData:      boolean;
}): { readiness: PortfolioActionReadiness; blockers: string[] } {
  const blockers: string[] = [];

  if (params.hasEmergencyStop) {
    blockers.push("Emergency stop is active — budget actions are blocked");
    return { readiness: "blocked", blockers };
  }
  if (params.isRestricted) {
    blockers.push("Account is in restricted mode");
    return { readiness: "needs_review", blockers };
  }
  if (params.hasStaleSync && !params.hasGoalData) {
    blockers.push("Stale data and no goal data — confidence too low");
    return { readiness: "low_confidence", blockers };
  }
  if (params.hasStaleSync) {
    blockers.push("Data sync is stale — verify current state before acting");
    return { readiness: "needs_review", blockers };
  }
  if (!params.hasGoalData) {
    blockers.push("No goal data — set targets before interpreting budget guidance");
    return { readiness: "low_confidence", blockers };
  }
  return { readiness: "ready", blockers: [] };
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildPortfolioBudgetGovernanceItems(
  payload: PortfolioPayload
): PortfolioBudgetGovernanceItem[] {
  const items: PortfolioBudgetGovernanceItem[] = [];

  for (const item of payload.healthBoard) {
    const cid = item.clientId;
    const hasGoalData = item.roasGoal !== null || item.cpaGoal !== null;

    // ROAS vs goal ratio (>1 = beating goal)
    const roasVsGoalRatio =
      item.roas !== null && item.roasGoal !== null && item.roasGoal > 0
        ? item.roas / item.roasGoal
        : null;

    // CPA vs goal ratio (<1 = beating goal, lower CPA is better)
    const cpaVsGoalRatio =
      item.cpa !== null && item.cpaGoal !== null && item.cpaGoal > 0
        ? item.cpa / item.cpaGoal
        : null;

    const recommendation = deriveBudgetRecommendation({
      pacingPct:        item.pacingPct,
      pacingStatus:     item.pacingStatus,
      roasVsGoalRatio,
      cpaVsGoalRatio,
      hasGoalData,
      hasEmergencyStop: item.hasEmergencyStop,
      isRestricted:     item.isRestricted,
      hasStaleSync:     item.hasStaleSync,
    });

    const governanceReason = buildGovernanceReason({
      recommendation,
      pacingPct:       item.pacingPct,
      pacingStatus:    item.pacingStatus,
      roasVsGoalRatio,
      cpaVsGoalRatio,
      hasEmergencyStop: item.hasEmergencyStop,
      isRestricted:     item.isRestricted,
      hasStaleSync:     item.hasStaleSync,
      hasGoalData,
    });

    const { readiness, blockers } = deriveReadiness({
      hasEmergencyStop: item.hasEmergencyStop,
      isRestricted:     item.isRestricted,
      hasStaleSync:     item.hasStaleSync,
      hasGoalData,
    });

    items.push({
      clientId:             cid,
      clientName:           item.clientName,
      currency:             item.currency,
      monthlyBudget:        null, // not available on HealthBoardItem; shown as N/A
      currentSpend:         item.spend,
      pacingPct:            item.pacingPct,
      pacingStatus:         item.pacingStatus,
      roas:                 item.roas,
      roasGoal:             item.roasGoal,
      roasVsGoalRatio,
      cpa:                  item.cpa,
      cpaGoal:              item.cpaGoal,
      cpaVsGoalRatio,
      budgetRecommendation: recommendation,
      governanceReason,
      readiness,
      blockers,
      autonomyMode:         item.autonomyMode,
      hasEmergencyStop:     item.hasEmergencyStop,
      links:                clientLinks(cid),
    });
  }

  // Sort: pause/reduce first, then increase candidates, then hold/monitor
  const SORT_ORDER: Record<PortfolioBudgetRecommendation, number> = {
    pause_candidate:    0,
    reduce_candidate:   1,
    monitor_closely:    2,
    increase_candidate: 3,
    hold:               4,
    insufficient_data:  5,
  };

  items.sort((a, b) => SORT_ORDER[a.budgetRecommendation] - SORT_ORDER[b.budgetRecommendation]);
  return items;
}
