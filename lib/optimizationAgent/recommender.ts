// Optimization Agent — Recommender
//
// Converts analysis results into structured AgentRecommendations
// with confidence scores and actionable suggestions.

import type { AgentRecommendation, ConfidenceScore, RecommendationCategory } from "../agentFramework/types";
import { deriveConfidenceLevel } from "../agentFramework/constants";
import type { OptimizationAnalysis } from "./types";

export function generateOptimizationRecommendations(
  analysis: OptimizationAnalysis
): AgentRecommendation[] {
  const recommendations: AgentRecommendation[] = [];
  let recId = 0;

  const makeId = () => `opt_rec_${Date.now()}_${++recId}`;

  // ── Budget recommendations from campaign metrics ────────────────────────

  for (const campaign of analysis.campaigns) {
    // Strong performers: recommend budget increase
    if (campaign.crmRoas >= 2.0 && campaign.spend > 0) {
      recommendations.push({
        id: makeId(),
        agentType: "optimization",
        category: "budget_increase",
        title: `Scale "${campaign.campaignName}"`,
        description: `This campaign is delivering ${campaign.crmRoas.toFixed(1)}x CRM ROAS with $${campaign.spend.toFixed(2)} spend over 7 days. Consider increasing budget to capture more conversions.`,
        confidence: buildConfidence(campaign.spend, 7, `Strong CRM ROAS of ${campaign.crmRoas.toFixed(1)}x over 7 days`),
        assumptions: ["CRM ROAS is verified against Shopify orders", "Performance is expected to hold at increased spend"],
        supportingData: {
          crmRoas: campaign.crmRoas,
          spend: campaign.spend,
          ctr: campaign.ctr,
        },
        suggestedAction: `Increase daily budget by 15-25%`,
        impact: campaign.crmRoas >= 3.0 ? "high" : "medium",
        requiresApproval: false,
      });
    }

    // Underperformers: recommend pause or budget decrease
    if (campaign.spend > 50 && campaign.crmRoas < 1.0 && campaign.crmRoas > 0) {
      recommendations.push({
        id: makeId(),
        agentType: "optimization",
        category: "budget_decrease",
        title: `Review "${campaign.campaignName}" — Below Break-Even`,
        description: `This campaign has spent $${campaign.spend.toFixed(2)} but is delivering only ${campaign.crmRoas.toFixed(1)}x CRM ROAS (below 1.0x break-even). Consider reducing budget or pausing.`,
        confidence: buildConfidence(campaign.spend, 7, "Below break-even ROAS with significant spend"),
        assumptions: ["CRM ROAS below 1.0x means spending more than earning"],
        supportingData: {
          crmRoas: campaign.crmRoas,
          crmCpa: campaign.crmCpa,
          spend: campaign.spend,
        },
        suggestedAction: campaign.crmRoas < 0.5 ? "Pause this campaign" : "Decrease daily budget by 30-50%",
        impact: "high",
        requiresApproval: false,
      });
    }

    // Zero conversion campaigns with spend
    if (campaign.spend > 50 && campaign.crmRoas === 0 && campaign.crmCpa === 0) {
      recommendations.push({
        id: makeId(),
        agentType: "optimization",
        category: "pause_underperformer",
        title: `"${campaign.campaignName}" — No CRM Conversions`,
        description: `$${campaign.spend.toFixed(2)} spent with zero tracked CRM conversions. Check UTM tracking, pixel configuration, or pause to stop waste.`,
        confidence: buildConfidence(campaign.spend, 7, "Significant spend with zero conversions"),
        assumptions: ["Zero CRM conversions may indicate a tracking issue rather than poor performance"],
        supportingData: {
          spend: campaign.spend,
          clicks: campaign.clicks,
          ctr: campaign.ctr,
        },
        suggestedAction: "Investigate UTM tracking, then pause if confirmed zero conversions",
        impact: "high",
        requiresApproval: false,
      });
    }
  }

  // ── Fatigue recommendations ────────────────────────────────────────────

  for (const signal of analysis.fatigueSignals) {
    recommendations.push({
      id: makeId(),
      agentType: "optimization",
      category: "creative_fatigue",
      title: `Creative Fatigue: "${signal.adName}"`,
      description: signal.reason,
      confidence: buildConfidence(
        signal.ctrTrend.length,
        signal.ctrTrend.length,
        signal.reason
      ),
      assumptions: ["Frequency above threshold typically correlates with declining performance"],
      supportingData: {
        frequency: signal.frequency,
        ctrTrend: signal.ctrTrend,
        campaignName: signal.campaignName,
      },
      suggestedAction: signal.frequency >= 4.5
        ? "Replace this creative with a fresh variant"
        : "Monitor closely — consider creative refresh soon",
      impact: signal.frequency >= 4.5 ? "high" : "medium",
      requiresApproval: false,
    });
  }

  // Sort by impact: high → medium → low
  const impactOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

  return recommendations;
}

// ── Generate summary ────────────────────────────────────────────────────────

export function generateOptimizationSummary(
  analysis: OptimizationAnalysis,
  recommendations: AgentRecommendation[]
): string {
  const activeCampaigns = analysis.campaigns.length;
  const totalSpend = analysis.campaigns.reduce((s, c) => s + c.spend, 0);
  const highImpact = recommendations.filter((r) => r.impact === "high").length;
  const fatigued = analysis.fatigueSignals.length;

  let summary = `Analyzed ${activeCampaigns} active campaign(s) with $${totalSpend.toFixed(2)} total spend (7d).`;

  if (recommendations.length === 0) {
    summary += " No immediate actions recommended — account looks healthy.";
  } else {
    summary += ` Found ${recommendations.length} recommendation(s)`;
    if (highImpact > 0) {
      summary += ` (${highImpact} high-impact)`;
    }
    summary += ".";
  }

  if (fatigued > 0) {
    summary += ` ${fatigued} ad(s) showing fatigue signals.`;
  }

  return summary;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildConfidence(
  dataPoints: number,
  lookbackDays: number,
  reasoning: string
): ConfidenceScore {
  return {
    level: deriveConfidenceLevel(dataPoints, lookbackDays),
    reasoning,
    dataPoints,
    lookbackDays,
  };
}
