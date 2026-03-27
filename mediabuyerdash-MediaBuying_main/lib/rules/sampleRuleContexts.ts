// Sample Rule Evaluation Contexts
//
// Performance data for the rule engine to evaluate against.
// Designed to trigger a variety of rules so all evaluation paths can be
// exercised and displayed on the Optimization Lab page.
//
// recentDailyMetrics is ordered most-recent first:
//   [0] = yesterday, [1] = 2 days ago, etc.
// Lookback rules compare against [0..N-1].
// Spike detection compares ctx.metrics (current) against [1..7] average.

import type { RuleEvaluationContext } from "../../types/optimizationRules";

export const sampleRuleContexts: RuleEvaluationContext[] = [

  // ── Campaigns ──────────────────────────────────────────────────────────────

  {
    // CPA has exceeded goal for 3 consecutive days → triggers CPA Control rule.
    entityId:    "camp_spring_promo",
    entityName:  "Spring Promo — Conversions",
    entityLevel: "campaign",
    metrics:     { cpa: 62, roas: 1.8, spend: 4200, frequency: 2.3, ctr: 1.4, conversions: 68 },
    goals:       { cpaGoalValue: 45, cpaGoalType: "low", roasGoalValue: 2.5, roasGoalType: "high" },
    recentDailyMetrics: [
      { date: "2025-03-12", cpa: 62, roas: 1.8, spend: 600, conversions: 10, ctr: 1.4, frequency: 2.3 },
      { date: "2025-03-11", cpa: 58, roas: 1.9, spend: 580, conversions: 10, ctr: 1.5, frequency: 2.2 },
      { date: "2025-03-10", cpa: 55, roas: 2.0, spend: 550, conversions: 10, ctr: 1.6, frequency: 2.1 },
      { date: "2025-03-09", cpa: 49, roas: 2.2, spend: 490, conversions: 10, ctr: 1.7, frequency: 2.0 },
      { date: "2025-03-08", cpa: 44, roas: 2.5, spend: 440, conversions: 10, ctr: 1.9, frequency: 1.9 }
    ]
  },

  {
    // ROAS has exceeded goal for 2 consecutive days → triggers ROAS Scale rule.
    entityId:    "camp_summer_scale",
    entityName:  "Summer Scale — Retargeting",
    entityLevel: "campaign",
    metrics:     { cpa: 38, roas: 4.2, spend: 3100, frequency: 2.1, ctr: 2.1, conversions: 82 },
    goals:       { cpaGoalValue: 45, cpaGoalType: "low", roasGoalValue: 3.0, roasGoalType: "high" },
    recentDailyMetrics: [
      { date: "2025-03-12", cpa: 38, roas: 4.2, spend: 440, conversions: 12, ctr: 2.1, frequency: 2.1 },
      { date: "2025-03-11", cpa: 40, roas: 3.8, spend: 430, conversions: 11, ctr: 2.0, frequency: 2.0 },
      { date: "2025-03-10", cpa: 42, roas: 3.5, spend: 420, conversions: 10, ctr: 1.9, frequency: 1.9 },
      { date: "2025-03-09", cpa: 46, roas: 2.9, spend: 415, conversions:  9, ctr: 1.8, frequency: 1.9 },
      { date: "2025-03-08", cpa: 44, roas: 3.1, spend: 405, conversions:  9, ctr: 1.8, frequency: 1.8 }
    ]
  },

  // ── Ad Sets ────────────────────────────────────────────────────────────────

  {
    // Healthy performance — no rules triggered.
    entityId:    "adset_broad_prospecting",
    entityName:  "Broad Prospecting — 25–44",
    entityLevel: "adset",
    metrics:     { cpa: 43, roas: 2.7, spend: 1800, frequency: 2.8, ctr: 1.6, conversions: 42 },
    goals:       { cpaGoalValue: 45, cpaGoalType: "low", roasGoalValue: 2.5, roasGoalType: "high" },
    recentDailyMetrics: [
      { date: "2025-03-12", cpa: 43, roas: 2.7, spend: 260, conversions: 6, ctr: 1.6, frequency: 2.8 },
      { date: "2025-03-11", cpa: 44, roas: 2.6, spend: 255, conversions: 6, ctr: 1.6, frequency: 2.7 },
      { date: "2025-03-10", cpa: 42, roas: 2.8, spend: 250, conversions: 6, ctr: 1.7, frequency: 2.7 }
    ]
  },

  {
    // CPA below goal + ROAS below goal for only 1 day — no lookback rules triggered.
    entityId:    "adset_lookalike_cold",
    entityName:  "Lookalike — Cold Traffic",
    entityLevel: "adset",
    metrics:     { cpa: 51, roas: 2.1, spend: 2200, frequency: 3.1, ctr: 1.3, conversions: 43 },
    goals:       { cpaGoalValue: 45, cpaGoalType: "low", roasGoalValue: 2.5, roasGoalType: "high" },
    recentDailyMetrics: [
      { date: "2025-03-12", cpa: 51, roas: 2.1, spend: 310, conversions: 6, ctr: 1.3, frequency: 3.1 },
      { date: "2025-03-11", cpa: 44, roas: 2.6, spend: 300, conversions: 7, ctr: 1.5, frequency: 3.0 },
      { date: "2025-03-10", cpa: 43, roas: 2.7, spend: 295, conversions: 7, ctr: 1.5, frequency: 2.9 }
    ]
  },

  // ── Ads ────────────────────────────────────────────────────────────────────

  {
    // frequency 5.4 → triggers Creative Fatigue (> 4) rule.
    entityId:    "ad_lifestyle_hook",
    entityName:  "Lifestyle Hook — Video V2",
    entityLevel: "ad",
    metrics:     { cpa: 51, roas: 2.2, spend: 920, frequency: 5.4, ctr: 1.1, conversions: 18 },
    goals:       { cpaGoalValue: 45, cpaGoalType: "low", roasGoalValue: 2.5, roasGoalType: "high" },
    recentDailyMetrics: [
      { date: "2025-03-12", cpa: 51, roas: 2.2, spend: 130, conversions: 3, ctr: 1.1, frequency: 5.4 },
      { date: "2025-03-11", cpa: 49, roas: 2.3, spend: 125, conversions: 3, ctr: 1.2, frequency: 4.8 },
      { date: "2025-03-10", cpa: 47, roas: 2.4, spend: 120, conversions: 3, ctr: 1.3, frequency: 4.2 }
    ]
  },

  {
    // frequency 7.1 → triggers both Creative Fatigue (> 4) and Mark Fatigued (> 6).
    entityId:    "ad_product_closeup",
    entityName:  "Product Close-Up — Static",
    entityLevel: "ad",
    metrics:     { cpa: 68, roas: 1.7, spend: 840, frequency: 7.1, ctr: 0.9, conversions: 12 },
    goals:       { cpaGoalValue: 45, cpaGoalType: "low", roasGoalValue: 2.5, roasGoalType: "high" },
    recentDailyMetrics: [
      { date: "2025-03-12", cpa: 68, roas: 1.7, spend: 120, conversions: 2, ctr: 0.9, frequency: 7.1 },
      { date: "2025-03-11", cpa: 64, roas: 1.8, spend: 115, conversions: 2, ctr: 1.0, frequency: 6.4 },
      { date: "2025-03-10", cpa: 60, roas: 2.0, spend: 110, conversions: 2, ctr: 1.1, frequency: 5.8 }
    ]
  },

  {
    // CPA spiked from ~$45 prior average to $82 today → triggers CPA Spike Alert.
    // Also CTR 0.6 < 0.8 → triggers Low CTR Alert.
    entityId:    "ad_discount_offer",
    entityName:  "Discount Offer — Static Image",
    entityLevel: "ad",
    metrics:     { cpa: 82, roas: 1.4, spend: 105, frequency: 3.1, ctr: 0.6, conversions: 1 },
    goals:       { cpaGoalValue: 45, cpaGoalType: "low", roasGoalValue: 2.5, roasGoalType: "high" },
    recentDailyMetrics: [
      { date: "2025-03-12", cpa: 82, roas: 1.4, spend: 105, conversions: 1, ctr: 0.6, frequency: 3.1 },
      { date: "2025-03-11", cpa: 46, roas: 2.5, spend:  98, conversions: 2, ctr: 1.2, frequency: 2.9 },
      { date: "2025-03-10", cpa: 44, roas: 2.6, spend:  95, conversions: 2, ctr: 1.3, frequency: 2.8 },
      { date: "2025-03-09", cpa: 47, roas: 2.4, spend:  93, conversions: 2, ctr: 1.2, frequency: 2.7 },
      { date: "2025-03-08", cpa: 43, roas: 2.8, spend:  90, conversions: 2, ctr: 1.4, frequency: 2.6 }
    ]
    // Prior avg (days [1..4]): (46+44+47+43)/4 = 45.0  →  82 is 82% above 45  →  spike ≥ 40% ✓
  },

  {
    // CTR 0.5 < 0.8 → triggers Low CTR Alert only.
    entityId:    "ad_plain_text",
    entityName:  "Plain Text Ad — Long Form",
    entityLevel: "ad",
    metrics:     { cpa: 47, roas: 2.3, spend: 560, frequency: 3.2, ctr: 0.5, conversions: 12 },
    goals:       { cpaGoalValue: 45, cpaGoalType: "low", roasGoalValue: 2.5, roasGoalType: "high" },
    recentDailyMetrics: [
      { date: "2025-03-12", cpa: 47, roas: 2.3, spend: 80, conversions: 2, ctr: 0.5, frequency: 3.2 },
      { date: "2025-03-11", cpa: 46, roas: 2.4, spend: 78, conversions: 2, ctr: 0.6, frequency: 3.1 },
      { date: "2025-03-10", cpa: 48, roas: 2.2, spend: 76, conversions: 2, ctr: 0.5, frequency: 3.0 }
    ]
  }
];
