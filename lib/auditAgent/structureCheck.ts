// Audit Agent — Structure Checks
//
// Validates naming conventions, goal coverage, targeting overlap,
// and configuration completeness.

import { getFullAccountStructure, getNamingPatterns, getCampaignsWithoutGoals } from "../agentFramework/dataAccess";
import type { AuditCheck } from "../agentFramework/types";

export async function runStructureChecks(adAccountId: string): Promise<AuditCheck[]> {
  const checks: AuditCheck[] = [];
  const structure = await getFullAccountStructure(adAccountId);

  // ── Naming consistency ────────────────────────────────────────────────

  const patterns = await getNamingPatterns(adAccountId);
  const namingCheck = analyzeNamingConsistency(patterns);
  checks.push(namingCheck);

  // ── Campaign goal coverage ────────────────────────────────────────────

  const missingGoals = await getCampaignsWithoutGoals();
  if (missingGoals.length > 0) {
    checks.push({
      name: "Campaign Goal Coverage",
      category: "structure",
      status: missingGoals.length > 3 ? "fail" : "warn",
      severity: missingGoals.length > 3 ? "critical" : "warning",
      message: `${missingGoals.length} campaign(s) have no ROAS/CPA goals configured. Without goals, optimization recommendations cannot be generated.`,
      details: { campaigns: missingGoals.map((c) => c.name) },
      penaltyPoints: Math.min(missingGoals.length * 3, 15),
    });
  } else {
    checks.push({
      name: "Campaign Goal Coverage",
      category: "structure",
      status: "pass",
      severity: "info",
      message: "All campaigns have ROAS/CPA goals configured.",
      details: {},
      penaltyPoints: 0,
    });
  }

  // ── Account size ──────────────────────────────────────────────────────

  if (structure.campaigns.length === 0) {
    checks.push({
      name: "Campaign Count",
      category: "structure",
      status: "warn",
      severity: "warning",
      message: "No synced campaigns found. Run a Meta sync to populate account data.",
      details: {},
      penaltyPoints: 10,
    });
  } else {
    const active = structure.campaigns.filter((c) => c.status === "ACTIVE").length;
    checks.push({
      name: "Campaign Count",
      category: "structure",
      status: "pass",
      severity: "info",
      message: `${structure.campaigns.length} campaign(s) synced (${active} active), ${structure.adSets.length} ad set(s), ${structure.ads.length} ad(s).`,
      details: {
        campaigns: structure.campaigns.length,
        activeCampaigns: active,
        adSets: structure.adSets.length,
        ads: structure.ads.length,
      },
      penaltyPoints: 0,
    });
  }

  // ── Targeting overlap (simplified) ────────────────────────────────────

  // Check if multiple ad sets in the same campaign exist (potential overlap)
  const adSetsPerCampaign = new Map<string, number>();
  for (const adSet of structure.adSets) {
    const count = adSetsPerCampaign.get(adSet.externalCampaignId) ?? 0;
    adSetsPerCampaign.set(adSet.externalCampaignId, count + 1);
  }
  const overloadedCampaigns = [...adSetsPerCampaign.entries()].filter(([, count]) => count > 5);

  if (overloadedCampaigns.length > 0) {
    const campaignNames = overloadedCampaigns.map(([id]) => {
      const campaign = structure.campaigns.find((c) => c.externalCampaignId === id);
      return campaign?.name ?? id;
    });
    checks.push({
      name: "Ad Set Density",
      category: "structure",
      status: "warn",
      severity: "warning",
      message: `${overloadedCampaigns.length} campaign(s) have >5 ad sets, which may cause audience overlap and increased costs.`,
      details: { campaigns: campaignNames },
      penaltyPoints: overloadedCampaigns.length * 2,
    });
  } else {
    checks.push({
      name: "Ad Set Density",
      category: "structure",
      status: "pass",
      severity: "info",
      message: "Ad set distribution looks healthy across campaigns.",
      details: {},
      penaltyPoints: 0,
    });
  }

  return checks;
}

// ── Naming analysis ─────────────────────────────────────────────────────────

function analyzeNamingConsistency(patterns: {
  campaignNames: string[];
  adSetNames: string[];
  adNames: string[];
}): AuditCheck {
  const { campaignNames } = patterns;

  if (campaignNames.length === 0) {
    return {
      name: "Naming Convention",
      category: "structure",
      status: "warn",
      severity: "info",
      message: "No campaigns to analyze naming conventions.",
      details: {},
      penaltyPoints: 0,
    };
  }

  // Check if names follow a delimiter pattern (e.g., "Brand — Type — Date")
  const withDelimiter = campaignNames.filter((n) => n.includes("—") || n.includes("|") || n.includes("-")).length;
  const consistency = campaignNames.length > 0 ? withDelimiter / campaignNames.length : 0;

  if (consistency >= 0.8) {
    return {
      name: "Naming Convention",
      category: "structure",
      status: "pass",
      severity: "info",
      message: `${Math.round(consistency * 100)}% of campaigns follow a structured naming pattern.`,
      details: { consistency: Math.round(consistency * 100), total: campaignNames.length },
      penaltyPoints: 0,
    };
  } else if (consistency >= 0.5) {
    return {
      name: "Naming Convention",
      category: "structure",
      status: "warn",
      severity: "warning",
      message: `Only ${Math.round(consistency * 100)}% of campaigns follow a structured naming pattern. Inconsistent naming makes analysis harder.`,
      details: { consistency: Math.round(consistency * 100), total: campaignNames.length },
      penaltyPoints: 5,
    };
  } else {
    return {
      name: "Naming Convention",
      category: "structure",
      status: "fail",
      severity: "warning",
      message: `Only ${Math.round(consistency * 100)}% of campaigns follow a structured naming pattern. Adopt a consistent convention like "Brand — Type — Date".`,
      details: { consistency: Math.round(consistency * 100), total: campaignNames.length },
      penaltyPoints: 10,
    };
  }
}
