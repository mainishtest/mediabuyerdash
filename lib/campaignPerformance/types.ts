// lib/campaignPerformance/types.ts
// All domain types for the campaign-level live performance layer.

// ── Health status ─────────────────────────────────────────────────────────────

export type CampaignHealthStatus =
  | "strong"      // exceeding both ROAS and CPA targets (>5% better on each)
  | "on_target"   // meeting both targets
  | "watch"       // meeting only one target
  | "below_goal"  // meeting neither target
  | "no_goal"     // no goals configured for this campaign
  | "stale"       // synced but no spend in the data window
  | "no_data";    // campaign not synced or no insight data at all

// ── Recommendation ────────────────────────────────────────────────────────────

export type CampaignActionType =
  | "scale"         // strong performer — increase budget
  | "maintain"      // on target — keep current approach
  | "review"        // mixed signals — needs attention
  | "reduce_spend"  // below both goals — cut budget
  | "watch"         // borderline — monitor closely
  | "set_goal"      // no goals configured
  | "sync_now";     // stale / no data — run a sync

export interface CampaignRecommendationSummary {
  actionType:        CampaignActionType;
  priority:          "high" | "medium" | "low";
  reason:            string;
  supportingMetrics: string | null;  // human-readable metric comparison
}

// ── Goal source ───────────────────────────────────────────────────────────────

// Where the active goal came from (resolution order):
//   explicit       → MetaCampaignGoal set directly on this campaign
//   client_default → ClientGoalDefaults falling back for this client
//   none           → no goal configured at any level
export type GoalSource = "explicit" | "client_default" | "none";

// ── Main snapshot ─────────────────────────────────────────────────────────────

export interface CampaignPerformanceSnapshot {
  // Identity
  clientAccountId:    string;
  campaignId:         string;   // MetaSyncedCampaign internal id
  externalCampaignId: string;   // Meta's campaign id
  campaignName:       string;
  campaignStatus:     string;   // "ACTIVE" | "PAUSED" | etc. (from Meta)

  // Delivery (source: Meta)
  metaSpend:    number;

  // Business outcomes (source: Shopify/CRM — source of truth for ROAS and CPA)
  crmRevenue:   number;
  crmOrders:    number;

  // Evaluated metrics — CRM is source of truth per product rules
  evaluatedCpa:  number;  // metaSpend / crmOrders   (0 if no orders)
  evaluatedRoas: number;  // crmRevenue / metaSpend  (0 if no spend)

  // Goals — resolved from explicit campaign goal or client default (null if neither)
  roasGoalValue: number | null;
  roasGoalType:  "high" | "low" | null;
  cpaGoalValue:  number | null;
  cpaGoalType:   "high" | "low" | null;

  // Evaluation results
  meetsRoasGoal: boolean;
  meetsCpaGoal:  boolean;
  healthStatus:  CampaignHealthStatus;
  recommendation: CampaignRecommendationSummary;

  // Metadata
  hasGoal:        boolean;
  goalSource:     GoalSource;  // where the active goal came from
  dataWindowDays: number;      // attribution window used (7 days per product rules)
}

// ── Aggregate counts ──────────────────────────────────────────────────────────

export interface CampaignHealthCounts {
  strong:     number;
  on_target:  number;
  watch:      number;
  below_goal: number;
  no_goal:    number;
  stale:      number;
  no_data:    number;
  total:      number;
}
