// lib/automation/rules.ts
// Deterministic rule evaluation for the automation system.
//
// All functions are pure — they receive pre-loaded DetectionInput and return
// ProposedAutomationActionDraft[]. No DB access here.
//
// Built-in rules (v1):
//   pause_campaign_below_goal  — ROAS < goal * 0.6 + spend > $200 → propose reduce_budget
//   increase_budget_above_goal — ROAS > goal * 1.4 + spend < $2000 → propose increase_budget
//   stale_sync                 — last sync >48h → propose run_sync
//   missing_integration        — no Meta or no Shopify → propose investigate_client
//   weak_roas                  — ROAS < 1.0 across reconciled period → propose investigate_client
//   creative_fatigue           — spend up >30% but orders down >20% → propose review_creative
//
// IMPORTANT: Approval does NOT yet write back to Meta. Actions are
// recommendations only — they require human approval before any execution.

import type { DetectionInput }          from "../alerts/detectors";
import { normalizeUtmValue }            from "../reconciliation/utils";
import {
  buildAllClientsPacingSummaries,
}                                       from "../budgetPacing/service";
import type { ClientPacingSummary }     from "../budgetPacing/types";
import type {
  ProposedAutomationActionDraft,
  AutomationPriority,
} from "./types";

// ---------------------------------------------------------------------------
// Rule thresholds
// ---------------------------------------------------------------------------

const REDUCE_BUDGET_ROAS_FACTOR   = 0.60;  // ROAS < goal * 0.60
const REDUCE_BUDGET_MIN_SPEND     = 200;   // campaign must have spent ≥ $200 recently
const INCREASE_BUDGET_ROAS_FACTOR = 1.40;  // ROAS > goal * 1.40
const INCREASE_BUDGET_MAX_SPEND   = 2000;  // only propose scaling if spend < $2000/wk
const WEAK_ROAS_FLOOR             = 1.0;   // ROAS < 1.0 = losing money
const FATIGUE_SPEND_UP_THRESHOLD  = 0.30;  // spend up >30%
const FATIGUE_ORDERS_DOWN_THRES   = 0.20;  // orders down >20%
const STALE_HOURS                 = 48;
const MIN_SPEND_FOR_RULES         = 50;    // ignore campaigns with < $50 spend

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function dedupKey(
  clientId:   string,
  actionType: string,
  entityId:   string
): string {
  return `${clientId}:${actionType}:${entityId}`;
}

function expiresInDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// ---------------------------------------------------------------------------
// Rule: reduce_budget — campaign ROAS severely below goal
// ---------------------------------------------------------------------------

export function evaluateReduceBudgetRule(
  input: DetectionInput
): ProposedAutomationActionDraft[] {
  const drafts: ProposedAutomationActionDraft[] = [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const client of input.clients) {
    const campaigns = input.clientCampaigns.get(client.id) ?? [];
    const reconciledList = input.latestReconciledByClient.get(client.id) ?? [];

    for (const campaign of campaigns) {
      if (!campaign.goal) continue;

      const reconciled = reconciledList.find(
        (r) => r.externalCampaignId === campaign.externalCampaignId
      );
      if (!reconciled) continue;
      if (reconciled.calculatedRoas === null) continue;

      const goal = campaign.goal.roasGoalValue;
      if (goal <= 0) continue;

      // Recent spend check
      const recentSpend = input.insightRows
        .filter(
          (r) =>
            r.externalCampaignId === campaign.externalCampaignId &&
            new Date(r.dateStart) >= sevenDaysAgo
        )
        .reduce((sum, r) => sum + r.spend, 0);

      if (recentSpend < REDUCE_BUDGET_MIN_SPEND) continue;

      if (reconciled.calculatedRoas < goal * REDUCE_BUDGET_ROAS_FACTOR) {
        const pctBelow = Math.round(
          ((goal - reconciled.calculatedRoas) / goal) * 100
        );
        drafts.push({
          workspaceId:      client.workspaceId,
          clientAccountId:  client.id,
          clientName:       client.name,
          automationRuleId: null,
          actionType:       "reduce_budget",
          priority:         "high",
          entityType:       "campaign",
          entityId:         campaign.externalCampaignId,
          entityName:       campaign.name,
          rationale:        `Campaign ROAS (${reconciled.calculatedRoas.toFixed(2)}x) is ${pctBelow}% below goal (${goal.toFixed(2)}x). Reducing budget can limit losses while investigating.`,
          supportingData:   {
            calculatedRoas: reconciled.calculatedRoas,
            roasGoal:       goal,
            pctBelowGoal:   pctBelow,
            recentSpend:    Math.round(recentSpend),
          },
          deduplicationKey: dedupKey(client.id, "reduce_budget", campaign.externalCampaignId),
          expiresAt:        expiresInDays(7),
        });
      }
    }
  }

  return drafts;
}

// ---------------------------------------------------------------------------
// Rule: increase_budget — campaign ROAS well above goal with spend room
// ---------------------------------------------------------------------------

export function evaluateIncreaseBudgetRule(
  input: DetectionInput
): ProposedAutomationActionDraft[] {
  const drafts: ProposedAutomationActionDraft[] = [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const client of input.clients) {
    const campaigns      = input.clientCampaigns.get(client.id) ?? [];
    const reconciledList = input.latestReconciledByClient.get(client.id) ?? [];

    for (const campaign of campaigns) {
      if (!campaign.goal) continue;

      const reconciled = reconciledList.find(
        (r) => r.externalCampaignId === campaign.externalCampaignId
      );
      if (!reconciled) continue;
      if (reconciled.calculatedRoas === null) continue;

      const goal = campaign.goal.roasGoalValue;
      if (goal <= 0) continue;

      const recentSpend = input.insightRows
        .filter(
          (r) =>
            r.externalCampaignId === campaign.externalCampaignId &&
            new Date(r.dateStart) >= sevenDaysAgo
        )
        .reduce((sum, r) => sum + r.spend, 0);

      if (recentSpend < MIN_SPEND_FOR_RULES) continue;

      if (
        reconciled.calculatedRoas > goal * INCREASE_BUDGET_ROAS_FACTOR &&
        recentSpend < INCREASE_BUDGET_MAX_SPEND
      ) {
        const pctAbove = Math.round(
          ((reconciled.calculatedRoas - goal) / goal) * 100
        );
        drafts.push({
          workspaceId:      client.workspaceId,
          clientAccountId:  client.id,
          clientName:       client.name,
          automationRuleId: null,
          actionType:       "increase_budget",
          priority:         "medium",
          entityType:       "campaign",
          entityId:         campaign.externalCampaignId,
          entityName:       campaign.name,
          rationale:        `Campaign ROAS (${reconciled.calculatedRoas.toFixed(2)}x) is ${pctAbove}% above goal (${goal.toFixed(2)}x) with room to scale. Increasing budget may amplify returns.`,
          supportingData:   {
            calculatedRoas: reconciled.calculatedRoas,
            roasGoal:       goal,
            pctAboveGoal:   pctAbove,
            recentSpend:    Math.round(recentSpend),
          },
          deduplicationKey: dedupKey(client.id, "increase_budget", campaign.externalCampaignId),
          expiresAt:        expiresInDays(7),
        });
      }
    }
  }

  return drafts;
}

// ---------------------------------------------------------------------------
// Rule: run_sync — stale or failed sync
// ---------------------------------------------------------------------------

export function evaluateRunSyncRule(
  input: DetectionInput
): ProposedAutomationActionDraft[] {
  const drafts: ProposedAutomationActionDraft[] = [];
  const now = new Date();
  const staleMs = STALE_HOURS * 60 * 60 * 1000;

  for (const client of input.clients) {
    if (!input.clientsWithMeta.has(client.id)) continue;

    const sync = input.latestSyncByClient.get(client.id);

    let stale   = false;
    let failed  = false;
    let reason  = "";
    let priority: AutomationPriority = "medium";

    if (!sync) {
      stale   = true;
      reason  = "No sync has ever been run for this client.";
      priority = "high";
    } else if (sync.status === "failed") {
      failed  = true;
      reason  = "Last sync failed. Data may be outdated.";
      priority = "high";
    } else if (sync.completedAt) {
      const hoursAgo =
        (now.getTime() - sync.completedAt.getTime()) / (60 * 60 * 1000);
      if (hoursAgo > STALE_HOURS) {
        stale   = true;
        reason  = `Last sync completed ${Math.round(hoursAgo)}h ago — data is stale.`;
        priority = hoursAgo > 7 * 24 ? "high" : "medium";
      }
    }

    if (stale || failed) {
      drafts.push({
        workspaceId:      client.workspaceId,
        clientAccountId:  client.id,
        clientName:       client.name,
        automationRuleId: null,
        actionType:       "run_sync",
        priority,
        entityType:       "client",
        entityId:         client.id,
        entityName:       client.name,
        rationale:        reason,
        supportingData:   {
          syncStatus:    sync?.status ?? "never_synced",
          completedAt:   sync?.completedAt?.toISOString() ?? "",
        },
        deduplicationKey: dedupKey(client.id, "run_sync", client.id),
        expiresAt:        expiresInDays(3),
      });
    }
  }

  return drafts;
}

// ---------------------------------------------------------------------------
// Rule: investigate_client — missing integrations
// ---------------------------------------------------------------------------

export function evaluateMissingIntegrationRule(
  input: DetectionInput
): ProposedAutomationActionDraft[] {
  const drafts: ProposedAutomationActionDraft[] = [];

  for (const client of input.clients) {
    const hasMeta    = input.clientsWithMeta.has(client.id);
    const hasShopify = input.clientsWithShopify.has(client.id);

    if (!hasMeta || !hasShopify) {
      const missing: string[] = [];
      if (!hasMeta)    missing.push("Meta ad account");
      if (!hasShopify) missing.push("Shopify connection");

      drafts.push({
        workspaceId:      client.workspaceId,
        clientAccountId:  client.id,
        clientName:       client.name,
        automationRuleId: null,
        actionType:       "investigate_client",
        priority:         "high",
        entityType:       "client",
        entityId:         client.id,
        entityName:       client.name,
        rationale:        `Client is missing: ${missing.join(", ")}. Reconciliation and alerting cannot run without complete integrations.`,
        supportingData:   {
          hasMeta:    hasMeta ? 1 : 0,
          hasShopify: hasShopify ? 1 : 0,
        },
        deduplicationKey: dedupKey(client.id, "investigate_client", client.id),
        expiresAt:        null,
      });
    }
  }

  return drafts;
}

// ---------------------------------------------------------------------------
// Rule: investigate_client — ROAS below 1.0 (losing money)
// ---------------------------------------------------------------------------

export function evaluateWeakRoasRule(
  input: DetectionInput
): ProposedAutomationActionDraft[] {
  const drafts: ProposedAutomationActionDraft[] = [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const client of input.clients) {
    const reconciledList = input.latestReconciledByClient.get(client.id) ?? [];

    for (const reconciled of reconciledList) {
      if (reconciled.calculatedRoas === null) continue;
      if (reconciled.calculatedRoas >= WEAK_ROAS_FLOOR) continue;

      // Confirm there was real spend
      const recentSpend = input.insightRows
        .filter(
          (r) =>
            r.externalCampaignId === reconciled.externalCampaignId &&
            new Date(r.dateStart) >= sevenDaysAgo
        )
        .reduce((sum, r) => sum + r.spend, 0);

      if (recentSpend < MIN_SPEND_FOR_RULES) continue;

      drafts.push({
        workspaceId:      client.workspaceId,
        clientAccountId:  client.id,
        clientName:       client.name,
        automationRuleId: null,
        actionType:       "investigate_client",
        priority:         "high",
        entityType:       "campaign",
        entityId:         reconciled.externalCampaignId,
        entityName:       reconciled.campaignName,
        rationale:        `Campaign ROAS is ${reconciled.calculatedRoas.toFixed(2)}x — below 1.0 (spending more than earning). Immediate review recommended.`,
        supportingData:   {
          calculatedRoas: reconciled.calculatedRoas,
          recentSpend:    Math.round(recentSpend),
        },
        deduplicationKey: dedupKey(
          client.id,
          "investigate_client",
          reconciled.externalCampaignId
        ),
        expiresAt: expiresInDays(5),
      });
    }
  }

  return drafts;
}

// ---------------------------------------------------------------------------
// Rule: review_creative — spend up but orders down (creative fatigue signal)
// ---------------------------------------------------------------------------

export function evaluateCreativeFatigueRule(
  input: DetectionInput
): ProposedAutomationActionDraft[] {
  const drafts: ProposedAutomationActionDraft[] = [];
  const now = new Date();
  const sevenDaysAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  for (const client of input.clients) {
    const campaigns = input.clientCampaigns.get(client.id) ?? [];

    for (const campaign of campaigns) {
      // --- Spend comparison (recent 7d vs baseline 7–14d)
      const recentSpend = input.insightRows
        .filter(
          (r) =>
            r.externalCampaignId === campaign.externalCampaignId &&
            new Date(r.dateStart) >= sevenDaysAgo
        )
        .reduce((sum, r) => sum + r.spend, 0);

      const baselineSpend = input.insightRows
        .filter((r) => {
          const d = new Date(r.dateStart);
          return (
            r.externalCampaignId === campaign.externalCampaignId &&
            d >= fourteenDaysAgo &&
            d < sevenDaysAgo
          );
        })
        .reduce((sum, r) => sum + r.spend, 0);

      if (baselineSpend < MIN_SPEND_FOR_RULES) continue;
      if (recentSpend < MIN_SPEND_FOR_RULES) continue;

      const spendDelta = (recentSpend - baselineSpend) / baselineSpend;
      if (spendDelta < FATIGUE_SPEND_UP_THRESHOLD) continue;

      // --- Order comparison
      const normalizedName = normalizeUtmValue(campaign.name);

      const recentOrders = input.orderRows.filter(
        (o) =>
          o.clientAccountId === client.id &&
          o.orderCreatedAt >= sevenDaysAgo &&
          normalizeUtmValue(o.utmCampaign ?? "") === normalizedName
      ).length;

      const baselineOrders = input.orderRows.filter((o) => {
        return (
          o.clientAccountId === client.id &&
          o.orderCreatedAt >= fourteenDaysAgo &&
          o.orderCreatedAt < sevenDaysAgo &&
          normalizeUtmValue(o.utmCampaign ?? "") === normalizedName
        );
      }).length;

      if (baselineOrders < 3) continue;

      const orderDelta =
        (recentOrders - baselineOrders) / Math.max(baselineOrders, 1);
      if (orderDelta > -FATIGUE_ORDERS_DOWN_THRES) continue;

      const spendUpPct  = Math.round(spendDelta * 100);
      const orderDownPct = Math.round(Math.abs(orderDelta) * 100);

      drafts.push({
        workspaceId:      client.workspaceId,
        clientAccountId:  client.id,
        clientName:       client.name,
        automationRuleId: null,
        actionType:       "review_creative",
        priority:         "medium",
        entityType:       "campaign",
        entityId:         campaign.externalCampaignId,
        entityName:       campaign.name,
        rationale:        `Spend increased ${spendUpPct}% while orders dropped ${orderDownPct}% — a signal of creative fatigue. Refreshing the ad creative may restore efficiency.`,
        supportingData:   {
          recentSpend:    Math.round(recentSpend),
          baselineSpend:  Math.round(baselineSpend),
          spendUpPct,
          recentOrders,
          baselineOrders,
          orderDownPct,
        },
        deduplicationKey: dedupKey(
          client.id,
          "review_creative",
          campaign.externalCampaignId
        ),
        expiresAt: expiresInDays(7),
      });
    }
  }

  return drafts;
}

// ---------------------------------------------------------------------------
// Run all rules
// ---------------------------------------------------------------------------

export function evaluateAutomationRules(
  input: DetectionInput
): ProposedAutomationActionDraft[] {
  const allDrafts = [
    ...evaluateReduceBudgetRule(input),
    ...evaluateIncreaseBudgetRule(input),
    ...evaluateRunSyncRule(input),
    ...evaluateMissingIntegrationRule(input),
    ...evaluateWeakRoasRule(input),
    ...evaluateCreativeFatigueRule(input),
    ...evaluateSetGoalsRule(input),
  ];

  // Deduplicate: if two rules produce the same deduplicationKey, keep highest priority.
  const priorityRank: Record<string, number> = { low: 0, medium: 1, high: 2 };
  const seen = new Map<string, ProposedAutomationActionDraft>();

  for (const draft of allDrafts) {
    const existing = seen.get(draft.deduplicationKey);
    if (
      !existing ||
      priorityRank[draft.priority] > priorityRank[existing.priority]
    ) {
      seen.set(draft.deduplicationKey, draft);
    }
  }

  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// Rule: set_goals — campaign has no ROAS/CPA goals configured
// ---------------------------------------------------------------------------

export function evaluateSetGoalsRule(
  input: DetectionInput
): ProposedAutomationActionDraft[] {
  const drafts: ProposedAutomationActionDraft[] = [];

  for (const client of input.clients) {
    const campaigns = input.clientCampaigns.get(client.id) ?? [];

    for (const campaign of campaigns) {
      if (campaign.goal !== null) continue;

      // Only flag if there's some spend — avoids noise for paused campaigns.
      const hasSpend = input.insightRows.some(
        (r) => r.externalCampaignId === campaign.externalCampaignId && r.spend > 0
      );
      if (!hasSpend) continue;

      drafts.push({
        workspaceId:      client.workspaceId,
        clientAccountId:  client.id,
        clientName:       client.name,
        automationRuleId: null,
        actionType:       "set_goals",
        priority:         "medium",
        entityType:       "campaign",
        entityId:         campaign.externalCampaignId,
        entityName:       campaign.name,
        rationale:        `Campaign has spend but no ROAS or CPA goal set. Without goals, rule-based optimisation cannot evaluate performance or trigger budget actions.`,
        supportingData:   {},
        deduplicationKey: dedupKey(client.id, "set_goals", campaign.externalCampaignId),
        expiresAt:        null,
      });
    }
  }

  return drafts;
}

// ---------------------------------------------------------------------------
// Rule: review_pacing — client is materially over- or under-pacing this month
// ---------------------------------------------------------------------------

export function evaluateReviewPacingRule(
  input:           DetectionInput,
  pacingSummaries: ClientPacingSummary[]
): ProposedAutomationActionDraft[] {
  const drafts: ProposedAutomationActionDraft[] = [];

  for (const summary of pacingSummaries) {
    const { clientSnapshot } = summary;
    const status = clientSnapshot.pacingStatus;

    if (status !== "over_pacing" && status !== "under_pacing") continue;

    // Find matching client info for workspaceId
    const client = input.clients.find((c) => c.id === summary.clientId);
    const workspaceId = client?.workspaceId ?? null;

    const pct       = clientSnapshot.pacingPercent;
    const deviation = Math.abs(pct - 100);

    const priority: AutomationPriority = deviation >= 30 ? "high" : "medium";

    const statusLabel = status === "over_pacing" ? "over-pacing" : "under-pacing";
    const rationale =
      status === "over_pacing"
        ? `Client is ${pct.toFixed(0)}% paced this month — ${deviation.toFixed(0)}% above target. At this rate the monthly budget will be exhausted early.`
        : `Client is ${pct.toFixed(0)}% paced this month — ${deviation.toFixed(0)}% below target. Underdelivery risks leaving budget unspent.`;

    drafts.push({
      workspaceId,
      clientAccountId:  summary.clientId,
      clientName:       summary.clientName,
      automationRuleId: null,
      actionType:       "review_pacing",
      priority,
      entityType:       "client",
      entityId:         summary.clientId,
      entityName:       summary.clientName,
      rationale,
      supportingData:   {
        pacingStatus:    statusLabel,
        pacingPercent:   Math.round(pct),
        spendToDate:     Math.round(clientSnapshot.spendToDate),
        monthlyBudget:   Math.round(clientSnapshot.monthlyBudget ?? 0),
        daysElapsed:     clientSnapshot.daysElapsed,
        daysInPeriod:    clientSnapshot.daysInPeriod,
      },
      deduplicationKey: dedupKey(summary.clientId, "review_pacing", summary.clientId),
      expiresAt:        expiresInDays(5),
    });
  }

  return drafts;
}

// ---------------------------------------------------------------------------
// buildProposedAutomationActions — async top-level orchestrator
//   Loads all necessary data in parallel, runs every rule (including pacing),
//   deduplicates, and returns the complete draft list ready for persistence.
// ---------------------------------------------------------------------------

export async function buildProposedAutomationActions(
  workspaceId: string | null
): Promise<ProposedAutomationActionDraft[]> {
  const [input, pacingSummaries] = await Promise.all([
    loadDetectionInput(workspaceId),
    buildAllClientsPacingSummaries(workspaceId),
  ]);

  const allDrafts = [
    ...evaluateAutomationRules(input),                    // pure rules (includes set_goals)
    ...evaluateReviewPacingRule(input, pacingSummaries),  // pacing rule
  ];

  // Final dedup across all rules (same key → keep highest priority)
  const priorityRank: Record<string, number> = { low: 0, medium: 1, high: 2 };
  const seen = new Map<string, ProposedAutomationActionDraft>();

  for (const draft of allDrafts) {
    const existing = seen.get(draft.deduplicationKey);
    if (
      !existing ||
      priorityRank[draft.priority] > priorityRank[existing.priority]
    ) {
      seen.set(draft.deduplicationKey, draft);
    }
  }

  return Array.from(seen.values());
}

// Public re-export of loader so callers only need this module.
export { loadDetectionInput } from "../alerts/detectors";
