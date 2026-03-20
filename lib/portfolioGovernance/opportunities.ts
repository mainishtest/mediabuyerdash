// ─── Portfolio Governance — Opportunity Builder ───────────────────────────────
//
// Builds PortfolioOpportunity[] from an existing PortfolioPayload.
// No DB calls — consumes signals already computed by the portfolio aggregator.
// All scoring delegated to scoring.ts (pure).

import type { PortfolioPayload } from "../portfolio/types";
import type {
  PortfolioOpportunity,
  PortfolioOpportunityCategory,
  PortfolioActionReadiness,
  PortfolioGovernanceLinks,
} from "./types";
import { computeOpportunityPriorityScore } from "./scoring";

const NOW_ISO = () => new Date().toISOString();

// ── Helper: build standard links for a client ────────────────────────────────

function clientLinks(
  clientId: string,
  extras?: Partial<PortfolioGovernanceLinks>
): PortfolioGovernanceLinks {
  return {
    account:       `/clients/${clientId}`,
    commandCenter: `/command-center?clientId=${clientId}`,
    approvalQueue: `/automation?clientId=${clientId}`,
    governanceControls: `/automation/governance`,
    ...extras,
  };
}

// ── Helper: derive readiness from governance state ────────────────────────────

function deriveReadiness(params: {
  hasEmergencyStop: boolean;
  isRestricted:     boolean;
  hasStaleSync:     boolean;
  hasGoalData:      boolean;
  isBlockedByApproval?: boolean;
}): { readiness: PortfolioActionReadiness; blockers: string[] } {
  const blockers: string[] = [];

  if (params.hasEmergencyStop) {
    blockers.push("Emergency stop is active on this account");
    return { readiness: "blocked", blockers };
  }
  if (params.isRestricted) {
    blockers.push("Account is in restricted automation mode");
    return { readiness: "blocked", blockers };
  }
  if (params.isBlockedByApproval) {
    blockers.push("Pending approval must be resolved first");
    return { readiness: "needs_review", blockers };
  }
  if (params.hasStaleSync && !params.hasGoalData) {
    blockers.push("Stale data and missing goals limit confidence");
    return { readiness: "low_confidence", blockers };
  }
  if (params.hasStaleSync) {
    blockers.push("Data sync is stale — verify signals before acting");
    return { readiness: "needs_review", blockers };
  }
  if (!params.hasGoalData) {
    blockers.push("No goal data set — set goals before taking action");
    return { readiness: "low_confidence", blockers };
  }
  return { readiness: "ready", blockers: [] };
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildPortfolioOpportunities(
  payload: PortfolioPayload
): PortfolioOpportunity[] {
  const opportunities: PortfolioOpportunity[] = [];
  const now = NOW_ISO();

  for (const item of payload.healthBoard) {
    const cid  = item.clientId;
    const name = item.clientName;

    const hasGoalData = item.roasGoal !== null || item.cpaGoal !== null;
    const approvalSnap = payload.approvalSnapshots.find((s) => s.clientId === cid);
    const isBlockedByApproval = approvalSnap?.hasCritical ?? false;

    const baseReadinessParams = {
      hasEmergencyStop:    item.hasEmergencyStop,
      isRestricted:        item.isRestricted,
      hasStaleSync:        item.hasStaleSync,
      hasGoalData,
      isBlockedByApproval,
    };

    // ── 1. Winning experiment expansion ─────────────────────────────────────

    const winnerExps = payload.opportunities.filter(
      (o) => o.clientId === cid && o.opportunityType === "experiment_winner"
    );

    for (const opp of winnerExps) {
      const { readiness, blockers } = deriveReadiness(baseReadinessParams);
      const ps = computeOpportunityPriorityScore({
        category:             "winning_experiment_expansion",
        hasEmergencyStop:     item.hasEmergencyStop,
        isRestricted:         item.isRestricted,
        hasOverdueApproval:   isBlockedByApproval,
        roasOutperformRatio:
          item.roas !== null && item.roasGoal !== null && item.roasGoal > 0
            ? item.roas / item.roasGoal - 1
            : null,
        hasGoalData,
        hasStaleSync: item.hasStaleSync,
        isUnderBudget: item.pacingStatus === "under_pacing",
        hasExperimentWinner: true,
      });

      opportunities.push({
        id:               `gov-exp-${opp.id}`,
        clientId:         cid,
        clientName:       name,
        category:         "winning_experiment_expansion",
        title:            opp.title,
        description:      opp.description,
        supportingReasons: [
          "Experiment has a declared winner — the challenger variant outperformed control",
          "Deploying the winning variant typically improves account-level performance",
          ps.reasons[0] ?? "",
        ].filter(Boolean),
        upsideSignals: [
          { type: "experiment_winner", weight: 30, description: "Challenger wins — ready for deployment" },
        ],
        priorityScore:         ps,
        readiness,
        blockers,
        recommendedNextAction: blockers.length > 0
          ? "Resolve blockers, then open the experiment to deploy the winning variant"
          : "Open the experiment and deploy the winning variant",
        links: clientLinks(cid, { experiment: "/experiments" }),
        dataConfidence: item.hasStaleSync ? "low" : hasGoalData ? "high" : "medium",
        generatedAt: now,
      });
    }

    // ── 2. Account scaling candidate ─────────────────────────────────────────

    const isScalingCandidate =
      item.roas !== null &&
      item.roasGoal !== null &&
      item.roasGoal > 0 &&
      item.roas > item.roasGoal * 1.3 &&
      item.pacingStatus === "under_pacing" &&
      item.pacingPct !== null &&
      item.pacingPct > 40 &&
      item.pacingPct < 85;

    if (isScalingCandidate) {
      const { readiness, blockers } = deriveReadiness(baseReadinessParams);
      const roasOutperformRatio =
        item.roas !== null && item.roasGoal !== null ? item.roas / item.roasGoal - 1 : null;

      const ps = computeOpportunityPriorityScore({
        category:             "account_scaling_candidate",
        hasEmergencyStop:     item.hasEmergencyStop,
        isRestricted:         item.isRestricted,
        hasOverdueApproval:   isBlockedByApproval,
        roasOutperformRatio,
        hasGoalData,
        hasStaleSync: item.hasStaleSync,
        isUnderBudget: true,
        hasExperimentWinner: false,
      });

      opportunities.push({
        id:       `gov-scale-${cid}`,
        clientId: cid,
        clientName: name,
        category: "account_scaling_candidate",
        title:    `${name} — Scaling candidate`,
        description:
          `ROAS ${item.roas?.toFixed(2)}x vs goal ${item.roasGoal?.toFixed(2)}x ` +
          `(CRM, 7-day attribution). Pacing at ${Math.round(item.pacingPct ?? 0)}% of budget. ` +
          "Strong performance with budget headroom — consider increasing budget.",
        supportingReasons: [
          `ROAS is ${Math.round((roasOutperformRatio ?? 0) * 100)}% above goal`,
          `Account is under-pacing at ${Math.round(item.pacingPct ?? 0)}% — budget headroom exists`,
          "Scaling here may capture additional revenue while maintaining goal compliance",
        ],
        upsideSignals: [
          { type: "roas_above_goal",  weight: 25, description: `ROAS ${item.roas?.toFixed(2)}x > goal ${item.roasGoal?.toFixed(2)}x` },
          { type: "budget_headroom",  weight: 15, description: `${Math.round(item.pacingPct ?? 0)}% paced — headroom available` },
        ],
        priorityScore:         ps,
        readiness,
        blockers,
        recommendedNextAction: blockers.length > 0
          ? "Resolve blockers, then review budget with client and open command center"
          : "Review budget with client, then open command center to propose increase",
        links: clientLinks(cid),
        dataConfidence: item.hasStaleSync ? "low" : "high",
        generatedAt: now,
      });
    }

    // ── 3. Goal outperformance (not already flagged as scaling) ───────────────

    const isGoalOutperformer =
      !isScalingCandidate &&
      item.roas !== null &&
      item.roasGoal !== null &&
      item.roasGoal > 0 &&
      item.roas > item.roasGoal * 1.5;

    if (isGoalOutperformer) {
      const { readiness, blockers } = deriveReadiness(baseReadinessParams);
      const roasOutperformRatio =
        item.roas !== null && item.roasGoal !== null ? item.roas / item.roasGoal - 1 : null;

      const ps = computeOpportunityPriorityScore({
        category:             "goal_outperformance",
        hasEmergencyStop:     item.hasEmergencyStop,
        isRestricted:         item.isRestricted,
        hasOverdueApproval:   isBlockedByApproval,
        roasOutperformRatio,
        hasGoalData,
        hasStaleSync: item.hasStaleSync,
        isUnderBudget: item.pacingStatus === "under_pacing",
        hasExperimentWinner: false,
      });

      opportunities.push({
        id:       `gov-goal-${cid}`,
        clientId: cid,
        clientName: name,
        category: "goal_outperformance",
        title:    `${name} — Exceeding ROAS goal`,
        description:
          `ROAS ${item.roas?.toFixed(2)}x vs goal ${item.roasGoal?.toFixed(2)}x ` +
          "(CRM, 7-day attribution). Performance is strong.",
        supportingReasons: [
          `ROAS is ${Math.round((roasOutperformRatio ?? 0) * 100)}% above goal`,
          "Sustained goal outperformance is a signal to review for scaling or experiment planning",
        ],
        upsideSignals: [
          { type: "roas_above_goal", weight: 22, description: `ROAS ${item.roas?.toFixed(2)}x significantly above goal` },
        ],
        priorityScore:         ps,
        readiness,
        blockers,
        recommendedNextAction: "Review account performance and consider running a scaling experiment",
        links: clientLinks(cid, { experiment: "/experiments" }),
        dataConfidence: item.hasStaleSync ? "low" : "high",
        generatedAt: now,
      });
    }

    // ── 4. Creative refresh opportunity ───────────────────────────────────────

    const creativeOpp = payload.opportunities.find(
      (o) => o.clientId === cid && o.opportunityType === "creative_ready"
    );

    if (creativeOpp) {
      const { readiness, blockers } = deriveReadiness(baseReadinessParams);

      const ps = computeOpportunityPriorityScore({
        category:             "creative_refresh_opportunity",
        hasEmergencyStop:     item.hasEmergencyStop,
        isRestricted:         item.isRestricted,
        hasOverdueApproval:   isBlockedByApproval,
        roasOutperformRatio:  null,
        hasGoalData,
        hasStaleSync: item.hasStaleSync,
        isUnderBudget: false,
        hasExperimentWinner: false,
      });

      opportunities.push({
        id:       `gov-creative-${cid}`,
        clientId: cid,
        clientName: name,
        category: "creative_refresh_opportunity",
        title:    creativeOpp.title,
        description: creativeOpp.description,
        supportingReasons: [
          "Approved creative variants are ready and awaiting publication",
          "Refreshing creative helps prevent fatigue and sustain performance",
        ],
        upsideSignals: [
          { type: "creative_ready", weight: 16, description: "Approved variants awaiting launch to Meta" },
        ],
        priorityScore:         ps,
        readiness,
        blockers,
        recommendedNextAction: blockers.length > 0
          ? "Resolve blockers, then open Creative Lab to publish approved variants"
          : "Open Creative Lab to review and publish approved variants",
        links: clientLinks(cid, { creativeLab: "/creative-lab" }),
        dataConfidence: "high",
        generatedAt: now,
      });
    }

    // ── 5. Strong launch candidate (approved, ready to publish) ───────────────
    //    (only if no creative_refresh already added for this client)

    if (!creativeOpp) {
      const automSnap = payload.automationSnapshots.find((s) => s.clientId === cid);
      const isLaunchCandidate =
        (automSnap?.autoExecutionEnabled ?? false) &&
        item.roas !== null &&
        item.roasGoal !== null &&
        item.roas >= item.roasGoal * 0.9;

      if (isLaunchCandidate) {
        const { readiness, blockers } = deriveReadiness(baseReadinessParams);
        const ps = computeOpportunityPriorityScore({
          category:             "strong_launch_candidate",
          hasEmergencyStop:     item.hasEmergencyStop,
          isRestricted:         item.isRestricted,
          hasOverdueApproval:   isBlockedByApproval,
          roasOutperformRatio:  null,
          hasGoalData,
          hasStaleSync: item.hasStaleSync,
          isUnderBudget: item.pacingStatus === "under_pacing",
          hasExperimentWinner: false,
        });

        opportunities.push({
          id:       `gov-launch-${cid}`,
          clientId: cid,
          clientName: name,
          category: "strong_launch_candidate",
          title:    `${name} — Ready for new launch`,
          description:
            "Auto-execution is enabled, performance is near or above goal, and account is primed for new campaign activity.",
          supportingReasons: [
            "Auto-execution is enabled on this account",
            "Performance is at or above goal threshold",
          ],
          upsideSignals: [
            { type: "auto_exec_enabled", weight: 16, description: "Auto-execution enabled" },
          ],
          priorityScore:         ps,
          readiness,
          blockers,
          recommendedNextAction: "Open command center and review for new launch or campaign expansion",
          links: clientLinks(cid),
          dataConfidence: item.hasStaleSync ? "low" : hasGoalData ? "high" : "medium",
          generatedAt: now,
        });
      }
    }
  }

  // Sort: highest priority score first
  opportunities.sort((a, b) => b.priorityScore.score - a.priorityScore.score);
  return opportunities.slice(0, 30);
}
