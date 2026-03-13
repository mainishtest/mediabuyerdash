// Goal-aware evaluation logic.
// Accepts plain inputs so the same core function works for campaigns,
// ad sets, and ads without duplicating logic.
//
// MEASUREMENT POLICY: actualRoas and actualCpa passed to evaluateEntity()
// must be sourced from CRM-verified data per the global measurement policy.
// See lib/measurementPolicy.ts — use buildEvaluationMetricSet() to derive
// these values so the CRM source-of-truth rule is enforced at the call site.

// --- Types -------------------------------------------------------------------

export type EvaluationStatus = "strong" | "on_target" | "watch" | "below_goal";

export interface BaseEvaluation {
  entityId: string;
  entityName: string;
  parentCampaignId?: string;
  parentCampaignName?: string;
  actualRoas: number;
  actualCpa: number;
  roasGoalType: "high" | "low";
  roasGoalValue: number;
  cpaGoalType: "high" | "low";
  cpaGoalValue: number;
  meetsRoasGoal: boolean;
  meetsCpaGoal: boolean;
  status: EvaluationStatus;
  shortReason: string;
}

export interface EvaluateEntityInput {
  entityId: string;
  entityName: string;
  parentCampaignId?: string;
  parentCampaignName?: string;
  actualRoas: number;
  actualCpa: number;
  roasGoalType: "high" | "low";
  roasGoalValue: number;
  cpaGoalType: "high" | "low";
  cpaGoalValue: number;
}

// --- Private helpers ---------------------------------------------------------

function meetsRoas(
  actual: number,
  goalType: "high" | "low",
  goalValue: number
): boolean {
  return goalType === "high" ? actual >= goalValue : actual <= goalValue;
}

function meetsCpa(
  actual: number,
  goalType: "high" | "low",
  goalValue: number
): boolean {
  return goalType === "low" ? actual <= goalValue : actual >= goalValue;
}

// "Strong" means both goals met AND performing meaningfully beyond them
// (>5% better on each dimension for typical high-ROAS / low-CPA setup).
function isStrong(
  actual: number,
  goalType: "high" | "low",
  goalValue: number,
  isCpa: boolean
): boolean {
  if (goalValue === 0) return false;
  if (!isCpa) {
    return goalType === "high"
      ? actual >= goalValue * 1.05
      : actual <= goalValue * 0.95;
  } else {
    return goalType === "low"
      ? actual <= goalValue * 0.95
      : actual >= goalValue * 1.05;
  }
}

function deriveStatus(
  roasOk: boolean,
  cpaOk: boolean,
  roasStrong: boolean,
  cpaStrong: boolean
): EvaluationStatus {
  if (roasOk && cpaOk && roasStrong && cpaStrong) return "strong";
  if (roasOk && cpaOk) return "on_target";
  if (roasOk || cpaOk) return "watch";
  return "below_goal";
}

function buildReason(
  roasOk: boolean,
  cpaOk: boolean,
  status: EvaluationStatus
): string {
  if (status === "strong") return "Exceeding both ROAS and CPA targets";
  if (status === "on_target") return "Meeting both ROAS and CPA targets";
  if (status === "watch") {
    return roasOk
      ? "ROAS on track — CPA needs attention"
      : "CPA on track — ROAS needs attention";
  }
  return "Below both ROAS and CPA targets";
}

// --- Public API --------------------------------------------------------------

export function evaluateEntity(input: EvaluateEntityInput): BaseEvaluation {
  const {
    actualRoas,
    actualCpa,
    roasGoalType,
    roasGoalValue,
    cpaGoalType,
    cpaGoalValue
  } = input;

  const roasOk     = meetsRoas(actualRoas, roasGoalType, roasGoalValue);
  const cpaOk      = meetsCpa(actualCpa, cpaGoalType, cpaGoalValue);
  const roasStrong = isStrong(actualRoas, roasGoalType, roasGoalValue, false);
  const cpaStrong  = isStrong(actualCpa, cpaGoalType, cpaGoalValue, true);

  const status      = deriveStatus(roasOk, cpaOk, roasStrong, cpaStrong);
  const shortReason = buildReason(roasOk, cpaOk, status);

  return {
    ...input,
    meetsRoasGoal: roasOk,
    meetsCpaGoal:  cpaOk,
    status,
    shortReason
  };
}
