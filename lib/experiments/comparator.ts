// lib/experiments/comparator.ts
// Pure functions for computing metric deltas between control and challenger.
// No API calls, no DB access.

import type {
  ExperimentMetricSnapshot,
  ExperimentComparison,
  ExperimentMetricDelta,
  ExperimentPlan,
} from "../../types/experiment";

// ---------------------------------------------------------------------------
// Compute a single metric delta
// ---------------------------------------------------------------------------

export function computeMetricDelta(
  controlValue:    number,
  challengerValue: number,
): ExperimentMetricDelta {
  const delta = challengerValue - controlValue;
  const lift  = controlValue !== 0 ? delta / controlValue : 0;
  return { delta, lift };
}

// ---------------------------------------------------------------------------
// Extract named metric value from a snapshot
// ---------------------------------------------------------------------------

function getMetricValue(
  snapshot: ExperimentMetricSnapshot,
  metric:   string,
): number {
  switch (metric) {
    case "roas_7d":  return snapshot.roas;
    case "cpa_7d":   return snapshot.cpa;
    case "orders":   return snapshot.orders;
    case "revenue":  return snapshot.revenue;
    case "ctr":      return snapshot.ctr;
    case "cpm":      return snapshot.cpm;
    case "spend":    return snapshot.spend;
    default:         return 0;
  }
}

// ---------------------------------------------------------------------------
// Guardrail checks — safety signals that can block a clean win declaration
// ---------------------------------------------------------------------------

function evaluateGuardrails(
  control:    ExperimentMetricSnapshot,
  challenger: ExperimentMetricSnapshot,
  plan:       Pick<ExperimentPlan, "minSpendPerVariant" | "minConversionsPerVariant">,
): string[] {
  const breaches: string[] = [];

  if (control.spend < plan.minSpendPerVariant) {
    breaches.push(`Control spend ($${control.spend.toFixed(0)}) below minimum ($${plan.minSpendPerVariant})`);
  }
  if (challenger.spend < plan.minSpendPerVariant) {
    breaches.push(`Challenger spend ($${challenger.spend.toFixed(0)}) below minimum ($${plan.minSpendPerVariant})`);
  }
  if (control.orders < plan.minConversionsPerVariant) {
    breaches.push(`Control conversions (${control.orders}) below minimum (${plan.minConversionsPerVariant})`);
  }
  if (challenger.orders < plan.minConversionsPerVariant) {
    breaches.push(`Challenger conversions (${challenger.orders}) below minimum (${plan.minConversionsPerVariant})`);
  }
  if (!control.isComplete) {
    breaches.push("Control data is incomplete — missing fields: " + control.missingFields.join(", "));
  }
  if (!challenger.isComplete) {
    breaches.push("Challenger data is incomplete — missing fields: " + challenger.missingFields.join(", "));
  }

  return breaches;
}

// ---------------------------------------------------------------------------
// Public API: compareExperimentVariants
// ---------------------------------------------------------------------------

export function compareExperimentVariants(
  control:    ExperimentMetricSnapshot,
  challenger: ExperimentMetricSnapshot,
  plan: Pick<
    ExperimentPlan,
    "primaryMetric" | "secondaryMetrics" | "successThreshold"
    | "minSpendPerVariant" | "minConversionsPerVariant"
  >,
): ExperimentComparison {
  const primaryDelta = computeMetricDelta(
    getMetricValue(control, plan.primaryMetric),
    getMetricValue(challenger, plan.primaryMetric),
  );

  const secondaryDeltas: Record<string, ExperimentMetricDelta> = {};
  for (const metric of plan.secondaryMetrics) {
    secondaryDeltas[metric] = computeMetricDelta(
      getMetricValue(control, metric),
      getMetricValue(challenger, metric),
    );
  }

  const guardrailBreaches = evaluateGuardrails(control, challenger, plan);
  const isStatisticallyMeaningful = Math.abs(primaryDelta.lift) >= plan.successThreshold;

  // Confidence note — plain language description
  let confidenceNote: string;
  if (guardrailBreaches.length > 0) {
    confidenceNote = "Guardrail failures prevent a reliable conclusion.";
  } else if (!isStatisticallyMeaningful) {
    confidenceNote = `Lift (${(primaryDelta.lift * 100).toFixed(1)}%) is below the ${(plan.successThreshold * 100).toFixed(0)}% threshold — difference is within noise.`;
  } else {
    confidenceNote = `Lift of ${(primaryDelta.lift * 100).toFixed(1)}% on ${plan.primaryMetric} meets the ${(plan.successThreshold * 100).toFixed(0)}% threshold.`;
  }

  return {
    primaryMetric:  plan.primaryMetric,
    primaryDelta,
    secondaryDeltas,
    guardrailBreaches,
    isStatisticallyMeaningful,
    confidenceNote,
  };
}
