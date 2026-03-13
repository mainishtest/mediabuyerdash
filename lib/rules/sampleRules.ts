// Sample Optimization Rules
//
// Rule definitions for the rule engine foundation.
// In a future version these will be stored per-client in the database.
// Kept as typed constants for now so the engine can be exercised immediately.

import type { OptimizationRule } from "../../types/optimizationRules";

export const sampleOptimizationRules: OptimizationRule[] = [
  // ── Budget control ─────────────────────────────────────────────────────────

  {
    id:          "rule_cpa_control",
    name:        "CPA Control",
    description: "Reduce budget when CPA exceeds the campaign goal for 3 or more consecutive days.",
    entityLevel: "campaign",
    condition: {
      metric:             "cpa",
      operator:           "greater_than",
      thresholdValue:     "goal",
      lookbackWindowDays: 3
    },
    actionType:  "decrease_budget",
    actionValue: 20,
    enabled:     true
  },

  {
    id:          "rule_roas_scale",
    name:        "ROAS Scale",
    description: "Increase budget when ROAS exceeds the campaign goal for 2 or more consecutive days.",
    entityLevel: "campaign",
    condition: {
      metric:             "roas",
      operator:           "greater_than",
      thresholdValue:     "goal",
      lookbackWindowDays: 2
    },
    actionType:  "increase_budget",
    actionValue: 15,
    enabled:     true
  },

  // ── Creative health ────────────────────────────────────────────────────────

  {
    id:          "rule_creative_fatigue",
    name:        "Creative Fatigue",
    description: "Recommend creative refresh when frequency exceeds 4.",
    entityLevel: "ad",
    condition: {
      metric:         "frequency",
      operator:       "greater_than",
      thresholdValue: 4
    },
    actionType: "recommend_creative_refresh",
    enabled:    true
  },

  {
    id:          "rule_mark_fatigue",
    name:        "Mark Creative Fatigued",
    description: "Mark creative as fatigued when frequency exceeds 6.",
    entityLevel: "ad",
    condition: {
      metric:         "frequency",
      operator:       "greater_than",
      thresholdValue: 6
    },
    actionType: "mark_creative_fatigue",
    enabled:    true
  },

  // ── Alerting ───────────────────────────────────────────────────────────────

  {
    id:          "rule_cpa_spike_alert",
    name:        "CPA Spike Alert",
    description: "Send alert when CPA spikes 40% or more above the prior 7-day average.",
    entityLevel: "any",
    condition: {
      metric:         "cpa",
      operator:       "spike_percent",
      thresholdValue: 40
    },
    actionType: "send_alert",
    enabled:    true
  },

  {
    id:          "rule_low_ctr_alert",
    name:        "Low CTR Alert",
    description: "Send alert when CTR drops below 0.8%.",
    entityLevel: "ad",
    condition: {
      metric:         "ctr",
      operator:       "less_than",
      thresholdValue: 0.8
    },
    actionType: "send_alert",
    enabled:    true
  }
];
