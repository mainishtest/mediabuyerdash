// lib/goals/defaults.ts
// System-level default goals.
// These are the fallback values when no campaign or client goal is set.
//
// Product rules (per spec):
//   target_roas = 2.0   — minimum acceptable return on ad spend
//   target_cpa  = null  — no universal default; too variable by business
//   target_ctr  = null  — benchmark varies too much by format and objective
//   target_cvr  = null  — benchmark varies by funnel stage
//   max_daily_spend = null — no universal cap; must be set explicitly

import type { ResolvedGoal } from "./types";

export const SYSTEM_DEFAULT_ROAS = 2.0;

export const SYSTEM_DEFAULT_GOAL: Readonly<ResolvedGoal> = {
  targetRoas:    SYSTEM_DEFAULT_ROAS,
  targetCpa:     null,
  targetCtr:     null,
  targetCvr:     null,
  maxDailySpend: null,
  source:        "system_default",
};

/**
 * Returns a mutable copy of the system default goal.
 * Used as the base for field-level resolution in mergeGoalFields().
 */
export function getSystemDefaultGoal(): ResolvedGoal {
  return { ...SYSTEM_DEFAULT_GOAL };
}
