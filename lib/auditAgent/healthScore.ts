// Audit Agent — Health Score
//
// Computes a 0-100 composite health score from audit checks.

import type { AuditCheck, AccountHealthScore, AuditCategory, AuditResult } from "../agentFramework/types";
import { HEALTH_SCORE_WEIGHTS } from "../agentFramework/constants";
import { runStructureChecks } from "./structureCheck";
import { runSpendChecks } from "./spendCheck";

export async function runFullAudit(adAccountId: string): Promise<AuditResult> {
  // Run all check categories in parallel
  const [structureChecks, spendChecks] = await Promise.all([
    runStructureChecks(adAccountId),
    runSpendChecks(adAccountId),
  ]);

  // Configuration and creative health checks (lighter weight, inline)
  const configChecks = runConfigurationChecks(structureChecks);
  const creativeChecks = runCreativeHealthChecks(spendChecks);

  const allChecks = [...structureChecks, ...spendChecks, ...configChecks, ...creativeChecks];
  const healthScore = computeHealthScore(allChecks);
  const summary = buildSummary(allChecks, healthScore);

  return { checks: allChecks, healthScore, summary };
}

// ── Configuration checks ────────────────────────────────────────────────────

function runConfigurationChecks(structureChecks: AuditCheck[]): AuditCheck[] {
  const checks: AuditCheck[] = [];

  // Check if there are any campaigns at all (proxy for Meta connection)
  const campaignCountCheck = structureChecks.find((c) => c.name === "Campaign Count");
  const hasCampaigns = campaignCountCheck?.status === "pass";

  if (!hasCampaigns) {
    checks.push({
      name: "Meta Connection",
      category: "configuration",
      status: "warn",
      severity: "warning",
      message: "No campaigns synced. Ensure Meta is connected and a recent sync has been run.",
      details: {},
      penaltyPoints: 10,
    });
  } else {
    checks.push({
      name: "Meta Connection",
      category: "configuration",
      status: "pass",
      severity: "info",
      message: "Meta account connected and data synced.",
      details: {},
      penaltyPoints: 0,
    });
  }

  return checks;
}

// ── Creative health checks ──────────────────────────────────────────────────

function runCreativeHealthChecks(spendChecks: AuditCheck[]): AuditCheck[] {
  const checks: AuditCheck[] = [];

  // Derive from spend checks — if zero conversion campaigns exist, creative health is at risk
  const zeroConvCheck = spendChecks.find((c) => c.name === "Zero-Conversion Campaigns");
  if (zeroConvCheck?.status === "fail") {
    checks.push({
      name: "Creative Effectiveness",
      category: "creative_health",
      status: "warn",
      severity: "warning",
      message: "Some campaigns have zero conversions — review creative assets and messaging.",
      details: {},
      penaltyPoints: 5,
    });
  } else {
    checks.push({
      name: "Creative Effectiveness",
      category: "creative_health",
      status: "pass",
      severity: "info",
      message: "Active campaigns are generating conversions.",
      details: {},
      penaltyPoints: 0,
    });
  }

  return checks;
}

// ── Score computation ───────────────────────────────────────────────────────

function computeHealthScore(checks: AuditCheck[]): AccountHealthScore {
  const categories: AuditCategory[] = ["structure", "spend_efficiency", "configuration", "creative_health"];

  const breakdown: Record<AuditCategory, { score: number; maxScore: number }> = {} as AccountHealthScore["breakdown"];

  for (const category of categories) {
    const maxScore = HEALTH_SCORE_WEIGHTS[category];
    const categoryChecks = checks.filter((c) => c.category === category);
    const penalty = categoryChecks.reduce((s, c) => s + c.penaltyPoints, 0);
    const score = Math.max(0, maxScore - penalty);
    breakdown[category] = { score, maxScore };
  }

  const overall = Object.values(breakdown).reduce((s, b) => s + b.score, 0);

  return { overall, breakdown };
}

// ── Summary builder ─────────────────────────────────────────────────────────

function buildSummary(checks: AuditCheck[], healthScore: AccountHealthScore): string {
  const passed = checks.filter((c) => c.status === "pass").length;
  const warnings = checks.filter((c) => c.status === "warn").length;
  const failed = checks.filter((c) => c.status === "fail").length;

  let grade = "Excellent";
  if (healthScore.overall < 90) grade = "Good";
  if (healthScore.overall < 70) grade = "Needs Attention";
  if (healthScore.overall < 50) grade = "Critical";

  let summary = `Account Health: ${healthScore.overall}/100 (${grade}). `;
  summary += `${passed} passed, ${warnings} warning(s), ${failed} issue(s).`;

  // Highlight worst category
  const worst = Object.entries(healthScore.breakdown)
    .map(([cat, { score, maxScore }]) => ({ cat, ratio: score / maxScore }))
    .sort((a, b) => a.ratio - b.ratio)[0];

  if (worst && worst.ratio < 0.7) {
    const labels: Record<string, string> = {
      structure: "Account Structure",
      spend_efficiency: "Spend Efficiency",
      configuration: "Configuration",
      creative_health: "Creative Health",
    };
    summary += ` Weakest area: ${labels[worst.cat] ?? worst.cat}.`;
  }

  return summary;
}
