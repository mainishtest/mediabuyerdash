// Campaign Agent — Intent Parser
//
// Uses Anthropic to extract structured campaign intent from natural language.
// The LLM acts as a pure parser — no actions, just structure extraction.

import { callAnthropicJson } from "../videoAdGenerator/anthropic";
import type { CampaignIntent } from "./types";
import type { RiskMode, AccountPerformanceSnapshot } from "../agentFramework/types";

const INTENT_SYSTEM_PROMPT = `You are a campaign intent parser for a media buying dashboard.
Your job is to extract structured campaign parameters from natural language requests.

You will receive a media buyer's request and must return a JSON object with this exact schema:

{
  "campaignType": "prospecting" | "retargeting" | "lookalike" | "broad" | "custom",
  "brandOrProduct": string | null,
  "creativeSelection": {
    "strategy": "top_performing" | "specific" | "all_recent" | "by_name" | "none",
    "count": number | null,
    "lookbackDays": number | null,
    "metric": "roas" | "cpa" | "ctr" | "spend" | "conversions" | null,
    "nameFilter": string | null
  },
  "budget": {
    "dailyBudget": number | null,
    "lifetimeBudget": number | null,
    "currency": "USD"
  },
  "audience": {
    "includeRules": string[],
    "excludeRules": string[],
    "locations": string[],
    "ageMin": number | null,
    "ageMax": number | null,
    "gender": "all" | "male" | "female",
    "advantagePlus": boolean
  },
  "objective": string | null,
  "startDate": string | null,
  "endDate": string | null,
  "launchMode": "paused" | "active",
  "confidence": number,
  "assumptions": string[]
}

Rules:
- If the user says "retargeting" or mentions "non-purchasers", "past visitors", "engaged users", set campaignType to "retargeting"
- If they mention "top performing" or "best ads", set creativeSelection.strategy to "top_performing"
- Default lookbackDays to 30 if not specified
- Default metric to "roas" if not specified for top_performing
- Default locations to ["US"] if not specified
- Default gender to "all"
- Default launchMode to "paused" (safety first)
- Default advantagePlus to true unless they specify custom targeting
- Budget numbers should be in dollars (not cents)
- "non-purchasers" translates to excludeRules: ["purchasers"]
- If objective is not specified, infer from context: retargeting usually means "OUTCOME_SALES"
- confidence is 0-1: how sure you are about the interpretation
- assumptions is a list of things you inferred that the user didn't explicitly state
- When account performance context is provided, use it to inform budget suggestions (e.g., if average daily spend is $50, a $50 budget is reasonable)
- If no budget is specified, DO NOT set one — let the system apply risk-mode-adjusted defaults

Always return valid JSON. Never include explanations outside the JSON.`;

export async function parseCampaignIntent(
  prompt: string,
  options?: {
    riskMode?: RiskMode;
    accountSnapshot?: AccountPerformanceSnapshot | null;
  }
): Promise<CampaignIntent> {
  // Build context-aware user message
  let userMessage = prompt;
  if (options?.accountSnapshot) {
    const snap = options.accountSnapshot;
    userMessage += `\n\n[ACCOUNT CONTEXT — use this to inform your decisions]
- Average daily spend: $${snap.avgDailySpend.toFixed(2)}/day
- CRM-verified ROAS: ${snap.crmRoas.toFixed(2)}x
- CRM-verified CPA: $${snap.crmCpa.toFixed(2)}
- Active campaigns: ${snap.activeCampaignCount}
- Lookback: ${snap.lookbackDays} days, ${snap.dataPoints} data points`;
  }

  const result = await callAnthropicJson<Omit<CampaignIntent, "rawPrompt" | "riskMode">>({
    system: INTENT_SYSTEM_PROMPT,
    user: userMessage,
    maxTokens: 2048,
  });

  return {
    ...result,
    rawPrompt: prompt,
    riskMode: options?.riskMode ?? "balanced",
    // Ensure defaults
    campaignType: result.campaignType ?? "custom",
    confidence: result.confidence ?? 0.5,
    assumptions: result.assumptions ?? [],
    creativeSelection: {
      strategy: result.creativeSelection?.strategy ?? "none",
      count: result.creativeSelection?.count ?? null,
      lookbackDays: result.creativeSelection?.lookbackDays ?? 30,
      metric: result.creativeSelection?.metric ?? "roas",
      nameFilter: result.creativeSelection?.nameFilter ?? null,
    },
    budget: {
      dailyBudget: result.budget?.dailyBudget ?? null,
      lifetimeBudget: result.budget?.lifetimeBudget ?? null,
      currency: result.budget?.currency ?? "USD",
    },
    audience: {
      includeRules: result.audience?.includeRules ?? [],
      excludeRules: result.audience?.excludeRules ?? [],
      locations: result.audience?.locations ?? ["US"],
      ageMin: result.audience?.ageMin ?? 18,
      ageMax: result.audience?.ageMax ?? 65,
      gender: result.audience?.gender ?? "all",
      advantagePlus: result.audience?.advantagePlus ?? true,
    },
    objective: result.objective ?? null,
    startDate: result.startDate ?? null,
    endDate: result.endDate ?? null,
    launchMode: result.launchMode ?? "paused",
  };
}
