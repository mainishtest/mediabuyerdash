// Campaign Agent — Type Definitions
//
// Contracts for the intent → data → draft → review → launch pipeline.

import type { RiskMode, PreflightCheck, AccountPerformanceSnapshot } from "../agentFramework/types";

// ── Parsed Intent ────────────────────────────────────────────────────────────
// Output of the Anthropic intent parser. Structured representation of
// what the user wants, extracted from natural language.

export interface CampaignIntent {
  campaignType: "prospecting" | "retargeting" | "lookalike" | "broad" | "custom";
  brandOrProduct: string | null;
  creativeSelection: {
    strategy: "top_performing" | "specific" | "all_recent" | "by_name" | "none";
    count: number | null;
    lookbackDays: number | null;
    metric: "roas" | "cpa" | "ctr" | "spend" | "conversions" | null;
    nameFilter: string | null;
  };
  budget: {
    dailyBudget: number | null;
    lifetimeBudget: number | null;
    currency: string;
  };
  audience: {
    includeRules: string[];
    excludeRules: string[];
    locations: string[];
    ageMin: number | null;
    ageMax: number | null;
    gender: "all" | "male" | "female";
    advantagePlus: boolean;
  };
  objective: string | null;
  startDate: string | null;
  endDate: string | null;
  launchMode: "paused" | "active";
  riskMode: RiskMode;
  rawPrompt: string;
  confidence: number; // 0-1, how confident the parser is
  assumptions: string[]; // things the agent assumed/inferred
}

// ── Retrieved Data ───────────────────────────────────────────────────────────
// Data fetched from the database/Meta to fulfill the intent.

export interface PerformingAd {
  id: string;
  name: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  conversions?: number;
  roas?: number;
  cpa?: number;
  rank: number;
  reasonSelected: string;
}

export interface ResolvedCreative {
  id: string;
  name: string;
  type: "image" | "video";
  url: string | null;
  thumbnailUrl: string | null;
  source: "meta_synced" | "internal_asset" | "concept";
  performanceData?: PerformingAd;
}

export interface ResolvedAudience {
  targeting: {
    locations: string[];
    ageMin: number;
    ageMax: number;
    gender: "all" | "male" | "female";
    advantagePlus: boolean;
  };
  exclusions: string[];
  audienceDescription: string;
}

export interface IntentData {
  creatives: ResolvedCreative[];
  audience: ResolvedAudience;
  adAccount: { id: string; externalId: string; name: string; currency: string } | null;
  page: { id: string; name: string } | null;
  pixel: { id: string; name: string } | null;
  performanceSnapshot: PerformingAd[];
  dataWarnings: string[];
}

// ── Campaign Draft ───────────────────────────────────────────────────────────
// Full draft ready for review. Includes the agent's reasoning.

export interface CampaignDraft {
  // Identity
  id: string; // client-generated for tracking
  status: "planning" | "ready_for_review" | "approved" | "launching" | "launched" | "failed";

  // Campaign level
  campaignName: string;
  objective: string;
  specialAdCategories: string[];
  dailyBudget: number;
  startDate: string | null;
  endDate: string | null;
  launchMode: "paused" | "active";

  // Ad set level
  adSetName: string;
  optimizationGoal: string;
  billingEvent: string;
  conversionEvent: string | null;
  targeting: ResolvedAudience;

  // Creative / Ad level
  ads: Array<{
    adName: string;
    creative: ResolvedCreative;
    primaryText: string;
    headline: string;
    ctaType: string;
    destinationUrl: string;
  }>;

  // Meta connection
  adAccount: { id: string; externalId: string; name: string } | null;
  page: { id: string; name: string } | null;
  pixel: { id: string; name: string } | null;

  // Agent reasoning (always shown to user)
  reasoning: {
    creativeLogic: string;
    audienceLogic: string;
    budgetLogic: string;
    assumptions: string[];
    warnings: string[];
  };

  // Preflight validation
  preflightResults: PreflightCheck[];

  // Risk mode
  riskMode: RiskMode;

  // Account context
  accountSnapshot: AccountPerformanceSnapshot | null;

  // Metadata
  intent: CampaignIntent;
  createdAt: string;
}

// ── Agent Step States ────────────────────────────────────────────────────────

export type AgentStep =
  | "idle"
  | "parsing"
  | "retrieving_data"
  | "building_draft"
  | "ready_for_review"
  | "editing"
  | "approving"
  | "launching"
  | "launched"
  | "failed";

export interface AgentMessage {
  role: "user" | "agent";
  content: string;
  timestamp: string;
  step?: AgentStep;
  draft?: CampaignDraft;
}
