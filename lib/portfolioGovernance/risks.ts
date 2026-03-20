// ─── Portfolio Governance — Risk Builder ──────────────────────────────────────
//
// Builds PortfolioRisk[] from an existing PortfolioPayload.
// No DB calls — consumes signals already computed by the portfolio aggregator.
// All scoring delegated to scoring.ts (pure).

import type { PortfolioPayload } from "../portfolio/types";
import type {
  PortfolioRisk,
  PortfolioRiskCategory,
  PortfolioActionReadiness,
  PortfolioGovernanceLinks,
} from "./types";
import { computeRiskPriorityScore } from "./scoring";

const NOW_ISO = () => new Date().toISOString();

// ── Helper: build standard links for a client ────────────────────────────────

function clientLinks(
  clientId: string,
  extras?: Partial<PortfolioGovernanceLinks>
): PortfolioGovernanceLinks {
  return {
    account:            `/clients/${clientId}`,
    commandCenter:      `/command-center?clientId=${clientId}`,
    approvalQueue:      `/automation?clientId=${clientId}`,
    governanceControls: `/automation/governance`,
    ...extras,
  };
}

// ── Helper: derive readiness for a risk ──────────────────────────────────────

function deriveRiskReadiness(params: {
  hasEmergencyStop: boolean;
  isRestricted:     boolean;
  hasStaleSync:     boolean;
  hasGoalData:      boolean;
}): { readiness: PortfolioActionReadiness; blockers: string[] } {
  const blockers: string[] = [];

  if (params.hasEmergencyStop) {
    // Emergency stop already blocks automation — but operator must still review
    blockers.push("Emergency stop is active — automated actions are blocked");
    return { readiness: "needs_review", blockers };
  }
  if (params.isRestricted) {
    blockers.push("Account is in restricted automation mode");
    return { readiness: "needs_review", blockers };
  }
  if (params.hasStaleSync && !params.hasGoalData) {
    blockers.push("Stale data and missing goals limit confidence in this signal");
    return { readiness: "low_confidence", blockers };
  }
  if (params.hasStaleSync) {
    blockers.push("Data sync is stale — verify signal before acting");
    return { readiness: "needs_review", blockers };
  }
  if (!params.hasGoalData) {
    blockers.push("No goal data set — set targets before interpreting risk severity");
    return { readiness: "low_confidence", blockers };
  }
  return { readiness: "ready", blockers: [] };
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildPortfolioRisks(payload: PortfolioPayload): PortfolioRisk[] {
  const risks: PortfolioRisk[] = [];
  const now = NOW_ISO();

  for (const item of payload.healthBoard) {
    const cid  = item.clientId;
    const name = item.clientName;

    const hasGoalData = item.roasGoal !== null || item.cpaGoal !== null;
    const approvalSnap = payload.approvalSnapshots.find((s) => s.clientId === cid);

    const baseParams = {
      hasEmergencyStop: item.hasEmergencyStop,
      isRestricted:     item.isRestricted,
      hasStaleSync:     item.hasStaleSync,
      hasGoalData,
    };

    // ── 1. Governance blocker — emergency stop ────────────────────────────────

    if (item.hasEmergencyStop) {
      const ps = computeRiskPriorityScore({
        category:           "governance_blocker",
        hasEmergencyStop:   true,
        isRestricted:       item.isRestricted,
        hasOverdueApproval: approvalSnap?.hasCritical ?? false,
        criticalPacing:     false,
        hasStaleSync:       item.hasStaleSync,
        roasMissRatio:      null,
        hasGoalData,
      });

      risks.push({
        id:       `gov-stop-${cid}`,
        clientId: cid,
        clientName: name,
        category: "governance_blocker",
        title:    `${name} — Emergency stop active`,
        description:
          "All automated execution is blocked for this account. " +
          "Manual review of governance controls is required before automation can resume.",
        supportingReasons: [
          "Emergency stop is in effect — no automated actions will execute",
          "Review the stop scope and reason in governance controls",
          "Operator action is required to lift or adjust the stop",
        ],
        downsideSignals: [
          { type: "emergency_stop", weight: 40, description: "Emergency stop blocks all auto-execution" },
        ],
        priorityScore:         ps,
        readiness:             "needs_review",
        blockers:              ["Emergency stop must be reviewed and lifted by an operator"],
        recommendedNextAction: "Open governance controls to review and manage the emergency stop",
        links: clientLinks(cid, { governanceControls: "/automation/governance" }),
        dataConfidence: "high",
        generatedAt: now,
      });
    }

    // ── 2. Automation restriction ─────────────────────────────────────────────

    if (item.isRestricted && !item.hasEmergencyStop) {
      const ps = computeRiskPriorityScore({
        category:           "automation_restriction",
        hasEmergencyStop:   false,
        isRestricted:       true,
        hasOverdueApproval: approvalSnap?.hasCritical ?? false,
        criticalPacing:     false,
        hasStaleSync:       item.hasStaleSync,
        roasMissRatio:      null,
        hasGoalData,
      });

      risks.push({
        id:       `gov-restricted-${cid}`,
        clientId: cid,
        clientName: name,
        category: "automation_restriction",
        title:    `${name} — Automation restricted`,
        description:
          "Automation policy for this account is set to restricted mode. " +
          "Review whether restriction is intentional or should be updated.",
        supportingReasons: [
          "Safety policy autonomy mode is set to restricted",
          "Automation capabilities are significantly limited in this mode",
        ],
        downsideSignals: [
          { type: "restricted_mode", weight: 18, description: "Restricted mode limits automation actions" },
        ],
        priorityScore:         ps,
        readiness:             "needs_review",
        blockers:              ["Review and confirm restriction is intentional"],
        recommendedNextAction: "Open governance controls to review automation policies for this account",
        links: clientLinks(cid, { governanceControls: "/automation/governance" }),
        dataConfidence: "high",
        generatedAt: now,
      });
    }

    // ── 3. Goal risk — ROAS significantly below target ────────────────────────

    const roasMissRatio =
      item.roas !== null && item.roasGoal !== null && item.roasGoal > 0
        ? 1 - item.roas / item.roasGoal
        : null;

    if (roasMissRatio !== null && roasMissRatio > 0.3) {
      const { readiness, blockers } = deriveRiskReadiness(baseParams);
      const ps = computeRiskPriorityScore({
        category:           "goal_risk",
        hasEmergencyStop:   item.hasEmergencyStop,
        isRestricted:       item.isRestricted,
        hasOverdueApproval: approvalSnap?.hasCritical ?? false,
        criticalPacing:     false,
        hasStaleSync:       item.hasStaleSync,
        roasMissRatio,
        hasGoalData:        true,
      });

      risks.push({
        id:       `gov-goal-${cid}`,
        clientId: cid,
        clientName: name,
        category: "goal_risk",
        title:    `${name} — ROAS below target`,
        description:
          `ROAS ${item.roas?.toFixed(2)}x vs goal ${item.roasGoal?.toFixed(2)}x ` +
          `(CRM, 7-day attribution). ${Math.round(roasMissRatio * 100)}% below goal.`,
        supportingReasons: [
          `ROAS is ${Math.round(roasMissRatio * 100)}% below goal (CRM source of truth, 7-day attribution)`,
          "This account is underperforming against its revenue efficiency target",
          roasMissRatio > 0.5
            ? "Severe miss — consider pausing or dramatically adjusting spend"
            : "Moderate miss — investigate campaign performance and creative quality",
        ],
        downsideSignals: [
          { type: "roas_below_goal", weight: 30, description: `ROAS ${item.roas?.toFixed(2)}x vs goal ${item.roasGoal?.toFixed(2)}x` },
        ],
        priorityScore:         ps,
        readiness,
        blockers,
        recommendedNextAction: "Open command center to review campaign performance and automation recommendations",
        links: clientLinks(cid),
        dataConfidence: item.hasStaleSync ? "low" : "high",
        generatedAt: now,
      });
    }

    // ── 4. Pacing risk — critically off target ────────────────────────────────

    const isCriticalPacing =
      (item.pacingStatus === "under_pacing" && (item.pacingPct ?? 100) < 60) ||
      (item.pacingStatus === "over_pacing"  && (item.pacingPct ?? 100) > 130);

    const isModPacing =
      !isCriticalPacing &&
      (item.pacingStatus === "under_pacing" || item.pacingStatus === "over_pacing");

    if (isCriticalPacing || isModPacing) {
      const { readiness, blockers } = deriveRiskReadiness(baseParams);
      const ps = computeRiskPriorityScore({
        category:           "pacing_risk",
        hasEmergencyStop:   item.hasEmergencyStop,
        isRestricted:       item.isRestricted,
        hasOverdueApproval: approvalSnap?.hasCritical ?? false,
        criticalPacing:     isCriticalPacing,
        hasStaleSync:       item.hasStaleSync,
        roasMissRatio:      null,
        hasGoalData,
      });

      const direction = item.pacingStatus === "over_pacing" ? "over-pacing" : "under-pacing";
      const pctStr    = item.pacingPct !== null ? `${Math.round(item.pacingPct)}%` : "unknown %";

      risks.push({
        id:       `gov-pacing-${cid}`,
        clientId: cid,
        clientName: name,
        category: "pacing_risk",
        title:    `${name} — ${isCriticalPacing ? "Critical" : "Moderate"} pacing risk (${direction})`,
        description:
          `Account is pacing at ${pctStr} of expected monthly spend. ` +
          (item.pacingStatus === "over_pacing"
            ? "Spend is significantly above expected monthly rate."
            : "Spend is significantly below expected monthly rate."),
        supportingReasons: [
          `Pacing at ${pctStr} of monthly target`,
          item.pacingStatus === "over_pacing"
            ? "Over-pacing may exhaust budget early and impact end-of-month delivery"
            : "Under-pacing risks under-delivery and leaves budget unused",
          isCriticalPacing ? "Severity is critical — immediate review recommended" : "Severity is moderate — monitor closely",
        ],
        downsideSignals: [
          { type: `${direction}_pacing`, weight: isCriticalPacing ? 28 : 18, description: `Pacing at ${pctStr}` },
        ],
        priorityScore:         ps,
        readiness,
        blockers,
        recommendedNextAction: "Open pacing view to review budget allocation and propose adjustments",
        links: clientLinks(cid, { account: `/pacing` }),
        dataConfidence: item.hasStaleSync ? "low" : item.pacingPct !== null ? "high" : "medium",
        generatedAt: now,
      });
    }

    // ── 5. Approval bottleneck ─────────────────────────────────────────────────

    if (approvalSnap?.hasCritical) {
      const { readiness, blockers } = deriveRiskReadiness(baseParams);
      const ps = computeRiskPriorityScore({
        category:           "approval_bottleneck",
        hasEmergencyStop:   item.hasEmergencyStop,
        isRestricted:       item.isRestricted,
        hasOverdueApproval: true,
        criticalPacing:     isCriticalPacing,
        hasStaleSync:       item.hasStaleSync,
        roasMissRatio:      null,
        hasGoalData,
      });

      risks.push({
        id:       `gov-approval-${cid}`,
        clientId: cid,
        clientName: name,
        category: "approval_bottleneck",
        title:    `${name} — Approval overdue (>48h)`,
        description:
          `${approvalSnap.count} action${approvalSnap.count !== 1 ? "s" : ""} ` +
          "awaiting approval. Oldest is overdue by more than 48 hours.",
        supportingReasons: [
          `${approvalSnap.count} proposed action${approvalSnap.count !== 1 ? "s" : ""} pending approval`,
          "Oldest pending action exceeds the 48-hour review window",
          "Delayed approvals can stall optimization and worsen outcomes",
        ],
        downsideSignals: [
          { type: "approval_overdue", weight: 20, description: `${approvalSnap.count} actions pending, oldest >48h` },
        ],
        priorityScore:         ps,
        readiness,
        blockers:              [...blockers, "Pending approvals must be reviewed before automated actions proceed"],
        recommendedNextAction: "Open the approval queue to review and act on pending actions",
        links: clientLinks(cid),
        dataConfidence: "high",
        generatedAt: now,
      });
    }

    // ── 6. Stale sync / fatigue risk ──────────────────────────────────────────

    if (item.hasStaleSync) {
      const ps = computeRiskPriorityScore({
        category:           "fatigue_risk",
        hasEmergencyStop:   item.hasEmergencyStop,
        isRestricted:       item.isRestricted,
        hasOverdueApproval: approvalSnap?.hasCritical ?? false,
        criticalPacing:     false,
        hasStaleSync:       true,
        roasMissRatio:      null,
        hasGoalData,
      });

      risks.push({
        id:       `gov-sync-${cid}`,
        clientId: cid,
        clientName: name,
        category: "fatigue_risk",
        title:    `${name} — Stale data sync`,
        description:
          "No successful data sync in the last 48 hours. " +
          "Performance metrics, pacing, and creative signals may be outdated.",
        supportingReasons: [
          "Last successful sync is older than 48 hours",
          "Stale data reduces confidence in all other risk and opportunity signals for this account",
          "Creative fatigue detection relies on up-to-date impression and frequency data",
        ],
        downsideSignals: [
          { type: "stale_sync", weight: 14, description: "No sync >48h — signals may be stale" },
        ],
        priorityScore:         ps,
        readiness:             "needs_review",
        blockers:              ["Data sync must succeed before relying on performance signals"],
        recommendedNextAction: "Open integrations to trigger a manual sync for this account",
        links: clientLinks(cid, { account: `/integrations` }),
        dataConfidence: "low",
        generatedAt: now,
      });
    }

    // ── 7. Performance decline — high alert count ─────────────────────────────

    if (item.highAlertCount >= 2 && !item.hasEmergencyStop) {
      const { readiness, blockers } = deriveRiskReadiness(baseParams);
      const ps = computeRiskPriorityScore({
        category:           "performance_decline",
        hasEmergencyStop:   false,
        isRestricted:       item.isRestricted,
        hasOverdueApproval: approvalSnap?.hasCritical ?? false,
        criticalPacing:     isCriticalPacing,
        hasStaleSync:       item.hasStaleSync,
        roasMissRatio,
        hasGoalData,
      });

      risks.push({
        id:       `gov-perf-${cid}`,
        clientId: cid,
        clientName: name,
        category: "performance_decline",
        title:    `${name} — ${item.highAlertCount} high-severity alert${item.highAlertCount !== 1 ? "s" : ""}`,
        description:
          `${item.highAlertCount} high-severity alert${item.highAlertCount !== 1 ? "s are" : " is"} ` +
          "active for this account. Multiple concurrent high alerts indicate systemic performance issues.",
        supportingReasons: [
          `${item.highAlertCount} high-severity alerts are currently active`,
          "Multiple concurrent high-severity alerts are correlated with performance degradation",
          item.highAlertCount >= 4
            ? "Alert count is severe — consider escalating to full account review"
            : "Review each alert and investigate root cause before applying fixes",
        ],
        downsideSignals: [
          { type: "high_alert_count", weight: 22, description: `${item.highAlertCount} high-severity alerts active` },
        ],
        priorityScore:         ps,
        readiness,
        blockers,
        recommendedNextAction: "Open the alerts view to review each high-severity alert and triage",
        links: clientLinks(cid, { account: `/alerts` }),
        dataConfidence: item.hasStaleSync ? "low" : "high",
        generatedAt: now,
      });
    }
  }

  // Sort: highest priority score first
  risks.sort((a, b) => b.priorityScore.score - a.priorityScore.score);
  return risks.slice(0, 30);
}
