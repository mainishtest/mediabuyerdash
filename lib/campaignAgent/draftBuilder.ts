// Campaign Agent — Draft Builder
//
// Assembles a complete campaign draft from parsed intent + retrieved data.
// Includes agent reasoning so the user understands every decision.
// Enhanced with risk mode, playbook naming, preflight, and account context.

import type { CampaignIntent, IntentData, CampaignDraft } from "./types";
import type { AccountPerformanceSnapshot } from "../agentFramework/types";
import { RISK_MULTIPLIERS, DEFAULT_PLAYBOOK } from "../agentFramework/constants";
import { runPreflightChecks } from "../agentFramework/preflight";

function generateId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildCampaignDraft(
  intent: CampaignIntent,
  data: IntentData,
  accountSnapshot?: AccountPerformanceSnapshot | null
): CampaignDraft {
  const brandName = intent.brandOrProduct ?? "Campaign";
  const typeLabel = capitalize(intent.campaignType);
  const riskConfig = RISK_MULTIPLIERS[intent.riskMode];

  // Naming (playbook convention)
  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const campaignName = DEFAULT_PLAYBOOK.namingConvention.campaign
    .replace("{brand}", brandName)
    .replace("{type}", typeLabel)
    .replace("{date}", dateStr);
  const adSetName = DEFAULT_PLAYBOOK.namingConvention.adSet
    .replace("{brand}", brandName)
    .replace("{audience}", data.audience.audienceDescription.slice(0, 50));

  // Objective mapping
  const objective = resolveObjective(intent);
  const optimizationGoal = resolveOptimizationGoal(intent, objective);
  const conversionEvent = resolveConversionEvent(intent);

  // Budget — risk-mode-adjusted from account data or intent
  const dailyBudget = resolveBudget(intent, accountSnapshot, riskConfig.budgetMultiplier);

  // Build ads from resolved creatives — pull copy/headline/URL from synced data
  const defaultCta = intent.campaignType === "retargeting" ? "SHOP_NOW" : "LEARN_MORE";
  const ads = data.creatives.map((creative, i) => ({
    adName: DEFAULT_PLAYBOOK.namingConvention.ad
      .replace("{brand}", brandName)
      .replace("{creative}", creative.name)
      .replace("{index}", String(i + 1)),
    creative,
    primaryText: creative.body ?? "",
    headline: creative.headline ?? creative.name,
    ctaType: creative.callToAction ?? defaultCta,
    destinationUrl: creative.destinationUrl ?? "",
  }));

  // Build reasoning
  const reasoning = buildReasoning(intent, data, accountSnapshot, riskConfig.budgetMultiplier);

  // Assemble draft
  const draft: CampaignDraft = {
    id: generateId(),
    status: "ready_for_review",
    campaignName,
    objective,
    specialAdCategories: ["NONE"],
    dailyBudget,
    startDate: intent.startDate,
    endDate: intent.endDate,
    launchMode: riskConfig.forcePaused ? "paused" : intent.launchMode,
    adSetName,
    optimizationGoal,
    billingEvent: "IMPRESSIONS",
    conversionEvent,
    targeting: data.audience,
    ads,
    adAccount: data.adAccount,
    page: data.page,
    pixel: data.pixel,
    reasoning,
    preflightResults: [], // populated below
    riskMode: intent.riskMode,
    accountSnapshot: accountSnapshot ?? null,
    intent,
    createdAt: new Date().toISOString(),
  };

  // Run preflight checks
  draft.preflightResults = runPreflightChecks(draft);

  return draft;
}

// ── Budget resolution ───────────────────────────────────────────────────────

function resolveBudget(
  intent: CampaignIntent,
  snapshot: AccountPerformanceSnapshot | null | undefined,
  multiplier: number
): number {
  // User explicitly set a budget
  if (intent.budget.dailyBudget) {
    return intent.budget.dailyBudget;
  }

  // Derive from account average daily spend × risk multiplier
  if (snapshot && snapshot.avgDailySpend > 0) {
    const derived = Math.round(snapshot.avgDailySpend * multiplier);
    const min = DEFAULT_PLAYBOOK.budgetMinimums[intent.campaignType] ?? 10;
    return Math.max(derived, min);
  }

  // Fallback: playbook minimum for campaign type
  return DEFAULT_PLAYBOOK.budgetMinimums[intent.campaignType] ?? 20;
}

// ── Reasoning builder ────────────────────────────────────────────────────────

function buildReasoning(
  intent: CampaignIntent,
  data: IntentData,
  snapshot: AccountPerformanceSnapshot | null | undefined,
  budgetMultiplier: number
) {
  const assumptions = [...intent.assumptions];
  const warnings = [...data.dataWarnings];

  // Creative logic
  let creativeLogic = "";
  if (intent.creativeSelection.strategy === "top_performing") {
    const lookback = intent.creativeSelection.lookbackDays ?? 30;
    const metric = intent.creativeSelection.metric ?? "roas";
    const count = intent.creativeSelection.count ?? 3;
    creativeLogic = `Selected the top ${count} ads by ${metric.toUpperCase()} from the last ${lookback} days.`;
    if (intent.brandOrProduct) {
      creativeLogic += ` Filtered to ads matching "${intent.brandOrProduct}".`;
    }
    if (data.creatives.length > 0 && data.creatives[0].performanceData) {
      const best = data.creatives[0].performanceData;
      creativeLogic += ` Top performer: "${best.name}" ($${best.spend.toFixed(2)} spend, ${best.ctr}% CTR).`;
    }
  } else if (intent.creativeSelection.strategy === "by_name") {
    creativeLogic = `Selected assets matching "${intent.creativeSelection.nameFilter}".`;
  } else {
    creativeLogic = "Using available assets from the creative library.";
  }

  if (data.creatives.length === 0) {
    creativeLogic += " No creatives found — you'll need to add media before launching.";
    warnings.push("No creatives attached. Add media in the review step.");
  }

  // Audience logic
  let audienceLogic = data.audience.audienceDescription;
  if (intent.audience.excludeRules.length > 0) {
    audienceLogic += `\nExclusions: ${data.audience.exclusions.join("; ")}`;
  }
  if (intent.audience.advantagePlus) {
    audienceLogic += "\nAdvantage+ audience is enabled — Meta will optimize targeting.";
    if (!intent.audience.includeRules.length && !intent.audience.excludeRules.length) {
      assumptions.push("Enabled Advantage+ audience since no specific targeting was requested.");
    }
  }

  // Budget logic — enhanced with account context
  let budgetLogic = "";
  if (intent.budget.dailyBudget) {
    budgetLogic = `Daily budget set to $${intent.budget.dailyBudget}/day as requested.`;
  } else if (snapshot && snapshot.avgDailySpend > 0) {
    const derived = Math.round(snapshot.avgDailySpend * budgetMultiplier);
    budgetLogic = `Daily budget set to $${derived}/day based on account average ($${snapshot.avgDailySpend.toFixed(2)}/day) × ${budgetMultiplier}x ${intent.riskMode} risk multiplier.`;
    assumptions.push(`Budget derived from account average daily spend ($${snapshot.avgDailySpend.toFixed(2)}) with ${intent.riskMode} risk mode.`);
  } else {
    budgetLogic = `No budget specified and no account data available — defaulting to $${DEFAULT_PLAYBOOK.budgetMinimums[intent.campaignType] ?? 20}/day.`;
    assumptions.push("Defaulted daily budget since no budget was specified and no account data is available.");
  }

  // Account context
  if (snapshot) {
    budgetLogic += `\n\nAccount context (${snapshot.lookbackDays}d): $${snapshot.totalSpend.toFixed(2)} total spend, ${snapshot.crmRoas.toFixed(2)}x CRM ROAS, $${snapshot.crmCpa.toFixed(2)} CPA.`;
  }

  budgetLogic += "\nCampaign will launch in PAUSED state for safety.";

  // Default assumptions
  if (!intent.objective) {
    const inferredObj = intent.campaignType === "retargeting" ? "Sales" : "Traffic";
    assumptions.push(`Inferred objective as "${inferredObj}" based on campaign type "${intent.campaignType}".`);
  }

  return {
    creativeLogic,
    audienceLogic,
    budgetLogic,
    assumptions,
    warnings,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveObjective(intent: CampaignIntent): string {
  if (intent.objective) {
    const map: Record<string, string> = {
      sales: "OUTCOME_SALES",
      conversions: "OUTCOME_SALES",
      leads: "OUTCOME_LEADS",
      traffic: "OUTCOME_TRAFFIC",
      engagement: "OUTCOME_ENGAGEMENT",
      awareness: "OUTCOME_AWARENESS",
    };
    return map[intent.objective.toLowerCase()] ?? "OUTCOME_SALES";
  }
  switch (intent.campaignType) {
    case "retargeting": return "OUTCOME_SALES";
    case "prospecting": return "OUTCOME_SALES";
    case "lookalike": return "OUTCOME_SALES";
    case "broad": return "OUTCOME_TRAFFIC";
    default: return "OUTCOME_SALES";
  }
}

function resolveOptimizationGoal(_intent: CampaignIntent, objective: string): string {
  switch (objective) {
    case "OUTCOME_SALES": return "OFFSITE_CONVERSIONS";
    case "OUTCOME_LEADS": return "LEAD_GENERATION";
    case "OUTCOME_TRAFFIC": return "LANDING_PAGE_VIEWS";
    case "OUTCOME_ENGAGEMENT": return "IMPRESSIONS";
    case "OUTCOME_AWARENESS": return "REACH";
    default: return "OFFSITE_CONVERSIONS";
  }
}

function resolveConversionEvent(intent: CampaignIntent): string | null {
  if (intent.campaignType === "retargeting") return "PURCHASE";
  if (intent.objective?.toLowerCase().includes("lead")) return "LEAD";
  if (intent.objective?.toLowerCase().includes("purchase")) return "PURCHASE";
  return "PURCHASE";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
