// lib/budgetPacing/calculations.ts
// Pure pacing calculation functions — zero DB dependency.
// Used by the service layer and reusable in automation rules.
//
// Pacing model: linear spend across the calendar month.
//   Expected spend = monthlyBudget × (daysElapsed / daysInPeriod)
//   Pacing %       = actualSpend / expectedSpend × 100
//   Projected EOM  = (actualSpend / daysElapsed) × daysInPeriod
//
// Thresholds (v1):
//   > 110% → over_pacing
//   90–110% → on_pacing
//   < 90%   → under_pacing

import type {
  BudgetPacingStatus,
  BudgetPacingRecommendation,
  BudgetPacingSnapshot,
  BudgetEntityType,
  PacingHealthCounts,
} from "./types";

// ── Pacing thresholds ─────────────────────────────────────────────────────────

const OVER_PACING_THRESHOLD  = 110; // percent
const UNDER_PACING_THRESHOLD =  90; // percent

// ── Period helpers ────────────────────────────────────────────────────────────

export interface MonthPeriod {
  year:          number;
  month:         number;  // 0-indexed (JS Date convention)
  daysInPeriod:  number;
  daysElapsed:   number;  // at least 1
  daysRemaining: number;
  periodLabel:   string;  // "June 2025"
}

export function getCurrentMonthPeriod(now: Date = new Date()): MonthPeriod {
  const year  = now.getFullYear();
  const month = now.getMonth();
  const daysInPeriod  = new Date(year, month + 1, 0).getDate();
  const daysElapsed   = Math.max(1, now.getDate());
  const daysRemaining = daysInPeriod - daysElapsed;
  const periodLabel   = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  return { year, month, daysInPeriod, daysElapsed, daysRemaining, periodLabel };
}

/**
 * Returns ISO date strings for the first and last day of the current month.
 * Used to filter MetaSyncedInsight rows by dateStart.
 */
export function getCurrentMonthDateStrings(now: Date = new Date()): {
  fromDate: string;
  toDate:   string;
} {
  const year  = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    fromDate: `${year}-${pad(month + 1)}-01`,
    toDate:   `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  };
}

// ── Core pacing calculations ──────────────────────────────────────────────────

/**
 * How much should have been spent by this point in the month (linear model).
 */
export function calculateExpectedSpendToDate(
  monthlyBudget: number,
  daysElapsed:   number,
  daysInPeriod:  number
): number {
  if (daysInPeriod === 0) return 0;
  return (monthlyBudget * daysElapsed) / daysInPeriod;
}

/**
 * Percentage of expected spend that has been achieved.
 * Returns 0 when expectedSpendToDate is 0 (avoids division by zero).
 */
export function calculatePacingPercent(
  spendToDate:         number,
  expectedSpendToDate: number
): number {
  if (expectedSpendToDate === 0) return 0;
  return (spendToDate / expectedSpendToDate) * 100;
}

/**
 * Projects end-of-month spend at the current daily average rate.
 * Returns 0 if no spend yet (can't extrapolate from zero).
 */
export function calculateProjectedEndOfPeriodSpend(
  spendToDate:  number,
  daysElapsed:  number,
  daysInPeriod: number
): number {
  if (daysElapsed === 0 || spendToDate === 0) return 0;
  return (spendToDate / daysElapsed) * daysInPeriod;
}

/**
 * Classifies pacing status from the pacing percentage.
 */
export function getPacingStatus(
  pacingPercent: number,
  hasBudget:     boolean
): BudgetPacingStatus {
  if (!hasBudget)                          return "no_budget_set";
  if (pacingPercent > OVER_PACING_THRESHOLD)  return "over_pacing";
  if (pacingPercent < UNDER_PACING_THRESHOLD) return "under_pacing";
  return "on_pacing";
}

/**
 * Returns the recommended action for a given pacing status.
 */
export function getPacingRecommendation(
  status: BudgetPacingStatus
): BudgetPacingRecommendation {
  if (status === "under_pacing") return "increase_daily_spend";
  if (status === "over_pacing")  return "reduce_daily_spend";
  if (status === "on_pacing")    return "maintain_current_spend";
  return "set_budget_target";
}

// ── Snapshot builder ──────────────────────────────────────────────────────────

/**
 * Builds a BudgetPacingSnapshot from a budget target + actual spend figure.
 * All calculations are performed here — callers just supply the raw inputs.
 */
export function buildBudgetPacingSnapshot({
  entityType,
  entityId,
  entityName,
  clientAccountId,
  monthlyBudget,
  dailyBudget,
  spendToDate,
  now = new Date(),
}: {
  entityType:      BudgetEntityType;
  entityId:        string;
  entityName:      string;
  clientAccountId: string;
  monthlyBudget:   number | null;
  dailyBudget:     number | null;
  spendToDate:     number;
  now?:            Date;
}): BudgetPacingSnapshot {
  const { daysElapsed, daysInPeriod, daysRemaining, periodLabel } =
    getCurrentMonthPeriod(now);

  const hasBudget = monthlyBudget !== null && monthlyBudget > 0;

  const impliedDailyBudget = hasBudget
    ? monthlyBudget! / daysInPeriod
    : null;

  const expectedSpendToDate = hasBudget
    ? calculateExpectedSpendToDate(monthlyBudget!, daysElapsed, daysInPeriod)
    : 0;

  const pacingPercent = hasBudget
    ? calculatePacingPercent(spendToDate, expectedSpendToDate)
    : 0;

  const projectedEndOfPeriodSpend = calculateProjectedEndOfPeriodSpend(
    spendToDate,
    daysElapsed,
    daysInPeriod
  );

  const pacingStatus   = getPacingStatus(pacingPercent, hasBudget);
  const recommendation = getPacingRecommendation(pacingStatus);

  return {
    entityType,
    entityId,
    entityName,
    clientAccountId,
    monthlyBudget,
    dailyBudget,
    impliedDailyBudget,
    spendToDate,
    expectedSpendToDate,
    pacingPercent,
    projectedEndOfPeriodSpend,
    pacingStatus,
    recommendation,
    daysElapsed,
    daysInPeriod,
    daysRemaining,
    periodLabel,
  };
}

// ── Aggregate counts ──────────────────────────────────────────────────────────

export function countPacingByStatus(
  snapshots: BudgetPacingSnapshot[]
): PacingHealthCounts {
  const counts: PacingHealthCounts = {
    on_pacing: 0, under_pacing: 0, over_pacing: 0,
    no_budget_set: 0, total: snapshots.length,
  };
  for (const s of snapshots) counts[s.pacingStatus]++;
  return counts;
}
