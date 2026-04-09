// Audit Agent — Spend Checks
//
// Zero-conversion detection, budget imbalance, and pacing anomalies.

import { getActiveCampaignMetrics } from "../agentFramework/dataAccess";
import { SPEND_THRESHOLDS } from "../agentFramework/constants";
import type { AuditCheck } from "../agentFramework/types";

export async function runSpendChecks(adAccountId: string): Promise<AuditCheck[]> {
  const checks: AuditCheck[] = [];
  const campaigns = await getActiveCampaignMetrics(adAccountId, 7);

  if (campaigns.length === 0) {
    checks.push({
      name: "Spend Analysis",
      category: "spend_efficiency",
      status: "warn",
      severity: "info",
      message: "No active campaigns with spend data to analyze.",
      details: {},
      penaltyPoints: 0,
    });
    return checks;
  }

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);

  // ── Zero-conversion campaigns ─────────────────────────────────────────

  const zeroConversion = campaigns.filter(
    (c) => c.spend >= SPEND_THRESHOLDS.zeroConversionMinSpend && c.crmRoas === 0 && c.crmCpa === 0
  );

  if (zeroConversion.length > 0) {
    const wastedSpend = zeroConversion.reduce((s, c) => s + c.spend, 0);
    checks.push({
      name: "Zero-Conversion Campaigns",
      category: "spend_efficiency",
      status: "fail",
      severity: "critical",
      message: `${zeroConversion.length} campaign(s) spent $${wastedSpend.toFixed(2)} with zero tracked CRM conversions. This could indicate tracking issues or poor targeting.`,
      details: {
        campaigns: zeroConversion.map((c) => ({ name: c.campaignName, spend: c.spend })),
        wastedSpend,
      },
      penaltyPoints: Math.min(zeroConversion.length * 5, 20),
    });
  } else {
    checks.push({
      name: "Zero-Conversion Campaigns",
      category: "spend_efficiency",
      status: "pass",
      severity: "info",
      message: "All campaigns with significant spend have tracked conversions.",
      details: {},
      penaltyPoints: 0,
    });
  }

  // ── Budget allocation imbalance ───────────────────────────────────────

  if (totalSpend > 0 && campaigns.length > 1) {
    const maxSpendCampaign = campaigns.reduce((a, b) => (a.spend > b.spend ? a : b));
    const maxSpendShare = maxSpendCampaign.spend / totalSpend;

    if (maxSpendShare > SPEND_THRESHOLDS.imbalancePercent / 100) {
      checks.push({
        name: "Budget Allocation",
        category: "spend_efficiency",
        status: "warn",
        severity: "warning",
        message: `"${maxSpendCampaign.campaignName}" consumes ${Math.round(maxSpendShare * 100)}% of total spend. Consider diversifying budget across campaigns.`,
        details: {
          dominantCampaign: maxSpendCampaign.campaignName,
          sharePercent: Math.round(maxSpendShare * 100),
          dominantSpend: maxSpendCampaign.spend,
          totalSpend,
        },
        penaltyPoints: 5,
      });
    } else {
      checks.push({
        name: "Budget Allocation",
        category: "spend_efficiency",
        status: "pass",
        severity: "info",
        message: "Budget is reasonably distributed across campaigns.",
        details: { totalSpend, campaignCount: campaigns.length },
        penaltyPoints: 0,
      });
    }
  }

  // ── Overall efficiency ────────────────────────────────────────────────

  const avgRoas = campaigns.filter((c) => c.crmRoas > 0).reduce((s, c) => s + c.crmRoas, 0) / Math.max(campaigns.filter((c) => c.crmRoas > 0).length, 1);

  if (avgRoas > 0) {
    if (avgRoas >= 2.0) {
      checks.push({
        name: "Account ROAS",
        category: "spend_efficiency",
        status: "pass",
        severity: "info",
        message: `Average CRM ROAS across active campaigns: ${avgRoas.toFixed(1)}x — above break-even.`,
        details: { avgRoas },
        penaltyPoints: 0,
      });
    } else if (avgRoas >= 1.0) {
      checks.push({
        name: "Account ROAS",
        category: "spend_efficiency",
        status: "warn",
        severity: "warning",
        message: `Average CRM ROAS: ${avgRoas.toFixed(1)}x — barely above break-even. Room for improvement.`,
        details: { avgRoas },
        penaltyPoints: 5,
      });
    } else {
      checks.push({
        name: "Account ROAS",
        category: "spend_efficiency",
        status: "fail",
        severity: "critical",
        message: `Average CRM ROAS: ${avgRoas.toFixed(1)}x — below break-even. Urgent optimization needed.`,
        details: { avgRoas },
        penaltyPoints: 15,
      });
    }
  }

  return checks;
}
