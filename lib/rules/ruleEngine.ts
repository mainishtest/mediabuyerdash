// Optimization Rule Engine
//
// Pure, deterministic evaluation functions.
// Accepts performance context, evaluates rule conditions, returns
// recommendations. Does not execute any actions.

import type {
  OptimizationRule,
  RuleOperator,
  RuleMetric,
  RuleEvaluationContext,
  RuleConditionResult,
  RuleEvaluationResult,
  RuleRecommendation,
  RuleSetEvaluationOutput
} from "../../types/optimizationRules";

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveThreshold(
  metric:         RuleMetric,
  thresholdValue: number | "goal",
  ctx:            RuleEvaluationContext
): number {
  if (thresholdValue !== "goal") return thresholdValue;
  if (metric === "roas") return ctx.goals.roasGoalValue;
  if (metric === "cpa")  return ctx.goals.cpaGoalValue;
  return 0;
}

function compareValues(
  value:     number,
  operator:  RuleOperator,
  threshold: number
): boolean {
  switch (operator) {
    case "greater_than":    return value > threshold;
    case "less_than":       return value < threshold;
    case "equal_to":        return Math.abs(value - threshold) < 0.001;
    // increase_percent / decrease_percent reserved for future use
    case "increase_percent":
    case "decrease_percent":
    case "spike_percent":   return false; // handled in evaluateRuleCondition
    default:                return false;
  }
}

function confidenceFromDays(days: number): "low" | "medium" | "high" {
  if (days >= 3) return "high";
  if (days >= 2) return "medium";
  return "low";
}

// ── Core evaluation ───────────────────────────────────────────────────────────

export function evaluateRuleCondition(
  rule: OptimizationRule,
  ctx:  RuleEvaluationContext
): RuleConditionResult {
  const { metric, operator, thresholdValue, lookbackWindowDays } = rule.condition;
  const resolvedThreshold = resolveThreshold(metric, thresholdValue, ctx);
  const currentValue = ctx.metrics[metric];

  // Spike detection: current value vs prior period average.
  // Uses recentDailyMetrics[1..7] as the baseline (skipping index 0 / today).
  if (operator === "spike_percent") {
    const priorDays = ctx.recentDailyMetrics.slice(1, 8);
    if (priorDays.length === 0) {
      return { triggered: false, actualValue: currentValue, resolvedThreshold, daysTriggered: 0 };
    }
    const priorAvg  = priorDays.reduce((sum, d) => sum + d[metric], 0) / priorDays.length;
    const spikePct  = priorAvg > 0 ? ((currentValue - priorAvg) / priorAvg) * 100 : 0;
    const triggered = spikePct >= resolvedThreshold;
    // resolvedThreshold stored as the absolute CPA value that would constitute a spike
    const spikeAbsoluteThreshold = priorAvg * (1 + resolvedThreshold / 100);
    return {
      triggered,
      actualValue:       currentValue,
      resolvedThreshold: spikeAbsoluteThreshold,
      daysTriggered:     triggered ? 1 : 0
    };
  }

  // Lookback window: condition must hold for N consecutive recent days.
  if (lookbackWindowDays && ctx.recentDailyMetrics.length >= lookbackWindowDays) {
    const days = ctx.recentDailyMetrics.slice(0, lookbackWindowDays);
    let daysTriggered = 0;
    for (const day of days) {
      if (compareValues(day[metric], operator, resolvedThreshold)) {
        daysTriggered++;
      }
    }
    const triggered = daysTriggered >= lookbackWindowDays;
    return { triggered, actualValue: currentValue, resolvedThreshold, daysTriggered };
  }

  // Single-period evaluation against current aggregate metrics.
  const triggered = compareValues(currentValue, operator, resolvedThreshold);
  return {
    triggered,
    actualValue:       currentValue,
    resolvedThreshold,
    daysTriggered: triggered ? 1 : 0
  };
}

export function evaluateOptimizationRule(
  rule: OptimizationRule,
  ctx:  RuleEvaluationContext
): RuleEvaluationResult {
  const empty: RuleConditionResult = {
    triggered: false, actualValue: 0, resolvedThreshold: 0, daysTriggered: 0
  };
  const base = {
    ruleId: rule.id, ruleName: rule.name,
    entityId: ctx.entityId, entityName: ctx.entityName, entityLevel: ctx.entityLevel
  };

  if (!rule.enabled) return { ...base, triggered: false, conditionResult: empty };

  if (rule.entityLevel !== "any" && rule.entityLevel !== ctx.entityLevel) {
    return { ...base, triggered: false, conditionResult: empty };
  }

  const conditionResult = evaluateRuleCondition(rule, ctx);
  return { ...base, triggered: conditionResult.triggered, conditionResult };
}

function buildRecommendation(
  rule:   OptimizationRule,
  ctx:    RuleEvaluationContext,
  result: RuleConditionResult
): RuleRecommendation {
  const { metric, lookbackWindowDays } = rule.condition;
  const metricLabel = metric.toUpperCase();
  const pctDiff = result.resolvedThreshold > 0
    ? (((result.actualValue - result.resolvedThreshold) / result.resolvedThreshold) * 100).toFixed(0)
    : "N/A";

  let message = `${metricLabel} is ${result.actualValue.toFixed(2)}, threshold ${result.resolvedThreshold.toFixed(2)} (${pctDiff}% diff)`;
  if (lookbackWindowDays) {
    message += `. Triggered on ${result.daysTriggered} of last ${lookbackWindowDays} day(s).`;
  }

  let suggestedAction: string;
  switch (rule.actionType) {
    case "increase_budget":
      suggestedAction = `Increase budget by ${rule.actionValue ?? 0}%`;
      break;
    case "decrease_budget":
      suggestedAction = `Decrease budget by ${rule.actionValue ?? 0}%`;
      break;
    case "pause_ad":
      suggestedAction = "Pause this ad";
      break;
    case "mark_creative_fatigue":
      suggestedAction = "Mark creative as fatigued — rotate or refresh";
      break;
    case "send_alert":
      suggestedAction = "Send performance alert";
      break;
    case "recommend_creative_refresh":
      suggestedAction = "Recommend creative refresh";
      break;
    default:
      suggestedAction = rule.name;
  }

  return {
    ruleId:             rule.id,
    ruleName:           rule.name,
    entityId:           ctx.entityId,
    entityName:         ctx.entityName,
    entityLevel:        ctx.entityLevel,
    recommendationType: rule.actionType,
    message,
    suggestedAction,
    confidence:         confidenceFromDays(result.daysTriggered),
    supportingMetrics:  { [metric]: result.actualValue }
  };
}

// ── Batch evaluation ──────────────────────────────────────────────────────────

export function evaluateRuleSet(
  rules:    OptimizationRule[],
  contexts: RuleEvaluationContext[]
): RuleSetEvaluationOutput {
  const results:         RuleEvaluationResult[] = [];
  const recommendations: RuleRecommendation[]   = [];

  for (const ctx of contexts) {
    for (const rule of rules) {
      const evalResult = evaluateOptimizationRule(rule, ctx);
      results.push(evalResult);
      if (evalResult.triggered) {
        recommendations.push(buildRecommendation(rule, ctx, evalResult.conditionResult));
      }
    }
  }

  return { results, recommendations };
}
