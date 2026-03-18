// lib/budgetPacing/types.ts
// Domain types for the budget pacing tracker.
//
// Spend source: MetaSyncedInsight (same as campaign performance aggregator).
// Period: current calendar month by default.
// Budget targets: stored in BudgetPacingTarget (separate from goal tables).

// ── Status ────────────────────────────────────────────────────────────────────

export type BudgetPacingStatus =
  | "on_pacing"      // within ±10% of expected linear spend
  | "under_pacing"   // spending less than 90% of expected
  | "over_pacing"    // spending more than 110% of expected
  | "no_budget_set"; // no monthly target configured

// ── Recommendation ────────────────────────────────────────────────────────────

export type BudgetPacingRecommendation =
  | "increase_daily_spend"    // under pacing — push harder to hit monthly
  | "reduce_daily_spend"      // over pacing — slow down to avoid overspend
  | "maintain_current_spend"  // on track — keep the current rate
  | "set_budget_target";      // no target set — configure one

// ── Entity type ───────────────────────────────────────────────────────────────

export type BudgetEntityType = "client" | "campaign";

// ── Main snapshot ─────────────────────────────────────────────────────────────

export interface BudgetPacingSnapshot {
  // Identity
  entityType:      BudgetEntityType;
  entityId:        string;   // clientAccountId or externalCampaignId
  entityName:      string;
  clientAccountId: string;

  // Budget targets (null = no target set)
  monthlyBudget:       number | null;
  dailyBudget:         number | null;   // explicit; null = use impliedDailyBudget
  impliedDailyBudget:  number | null;   // monthlyBudget / daysInPeriod

  // Actuals
  spendToDate: number;

  // Pacing calculations
  expectedSpendToDate:        number;  // 0 if no budget
  pacingPercent:              number;  // 0 if no budget or no expected spend
  projectedEndOfPeriodSpend:  number;  // 0 if no spend yet

  // Status + recommendation
  pacingStatus:   BudgetPacingStatus;
  recommendation: BudgetPacingRecommendation;

  // Period metadata
  daysElapsed:   number;
  daysInPeriod:  number;
  daysRemaining: number;
  periodLabel:   string;  // e.g. "June 2025"
}

// ── Client pacing summary ─────────────────────────────────────────────────────

export interface ClientPacingSummary {
  clientId:          string;
  clientName:        string;
  clientSnapshot:    BudgetPacingSnapshot;   // always present (no_budget_set if no target)
  campaignSnapshots: BudgetPacingSnapshot[]; // empty if no campaign targets set
}

// ── Aggregate counts ──────────────────────────────────────────────────────────

export interface PacingHealthCounts {
  on_pacing:     number;
  under_pacing:  number;
  over_pacing:   number;
  no_budget_set: number;
  total:         number;
}
