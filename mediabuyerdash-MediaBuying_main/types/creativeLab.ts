// types/creativeLab.ts
// Typed models for the Creative Lab workflow foundation.
//
// Design rules:
//   - Pure TypeScript — no imports from lib/ to avoid circular deps.
//   - lib/creativelab/workflowUtils.ts bridges these with the evaluation,
//     fatigue, and performance module outputs.
//   - CreativeLabItem is the central entity driving the queue UI.
//   - CRM is the source of truth for ROAS/CPA — reflected in context types.

// ---------------------------------------------------------------------------
// Status — lifecycle of a work item through the Creative Lab queue
// ---------------------------------------------------------------------------

/**
 * Lifecycle state of a Creative Lab work item.
 * Ordered roughly by workflow progression.
 */
export type CreativeLabStatus =
  | "draft"           // created but not yet queued for review
  | "queued"          // in the active queue, awaiting a buyer's attention
  | "in_review"       // a buyer is actively reviewing this item
  | "approved"        // approved for the next step: brief, refresh, or scale action
  | "rejected"        // dismissed — not worth pursuing at this time
  | "needs_revision"  // returned: more context, creative assets, or changes needed
  | "blocked"         // waiting on an external dependency (asset, client sign-off)
  | "archived";       // completed or stale — removed from the active queue

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

/** How urgently this item needs buyer attention. */
export type CreativeLabPriority = "low" | "medium" | "high" | "urgent";

// ---------------------------------------------------------------------------
// Source type — what signal created this queue item?
// ---------------------------------------------------------------------------

export type CreativeLabSourceType =
  | "fatigued_creative"        // raised by creative fatigue detection
  | "underperforming_creative" // raised by performance evaluation below goal
  | "winning_creative"         // raised to capture a scaling opportunity
  | "manual_entry"             // manually added by a media buyer
  | "recommendation_engine";   // raised by the automation rule engine

// ---------------------------------------------------------------------------
// Review and approval state
// ---------------------------------------------------------------------------

/** Has a reviewer opened and engaged with this item? */
export type CreativeReviewState = "not_started" | "reviewing" | "reviewed";

/** What approval decision has been made? */
export type CreativeApprovalState = "pending" | "approved" | "rejected";

// ---------------------------------------------------------------------------
// Context snapshots
//
// Structured excerpts from existing evaluation/fatigue/performance modules.
// Defined as local types here to avoid circular imports. The workflowUtils
// module is responsible for mapping from module output to these shapes.
// ---------------------------------------------------------------------------

/**
 * Performance metrics displayed inside an item card and detail panel.
 * ROAS and CPA are always CRM-verified — never Meta self-reported.
 */
export type CreativeLabPerformanceContext = {
  spend:            number;
  impressions:      number;
  clicks:           number;
  avgCtr:           number;          // (clicks / impressions) × 100, as %
  avgFrequency:     number | null;
  campaignRoas:     number | null;   // CRM-verified; null = reconciliation not run
  campaignCpa:      number | null;   // CRM-verified; null = reconciliation not run
  evaluationStatus: string;          // CreativeEvaluationStatus value
  thumbnailUrl:     string | null;
  adCopy:           string | null;
  callToAction:     string | null;
};

/** Fatigue signals displayed inside an item detail panel. */
export type CreativeLabFatigueContext = {
  fatigueStatus:           string;  // CreativeFatigueStatus value
  fatigueSignals:          Array<{ label: string; severity: "warning" | "critical" }>;
  recommendedAction:       string | null;  // CreativeRefreshActionType value
  actionPriority:          "low" | "medium" | "high" | null;
  recommendationRationale: string | null;
};

/** Evaluation classification displayed inside an item detail panel. */
export type CreativeLabEvaluationContext = {
  status:             string;  // PerformanceStatus value
  confidence:         string;  // ConfidenceLevel value
  recommendationType: string | null;
  reason:             string;
  supportingData:     string | null;
};

// ---------------------------------------------------------------------------
// Activity log
//
// Placeholder for per-item action history.
// Stored in client-side state in this step.
// DB persistence is added in the Creative Refresh Queue step.
// ---------------------------------------------------------------------------

export type CreativeLabActivity = {
  id:        string;
  action:    string;      // e.g. "Marked as needs revision", "Approved for brief"
  note:      string | null;
  actor:     string | null;
  timestamp: string;      // ISO string
};

// ---------------------------------------------------------------------------
// Main entity — CreativeLabItem
// ---------------------------------------------------------------------------

/** A single unit of work in the Creative Lab queue. */
export type CreativeLabItem = {
  id: string;

  // Client context
  clientAccountId: string;
  clientName:      string;

  // Ad hierarchy — all optional; derived from performance source where available
  campaignId:   string | null;
  campaignName: string | null;
  adSetId:      string | null;
  adSetName:    string | null;
  adId:         string | null;
  adName:       string | null;
  creativeId:   string | null;
  creativeName: string | null;

  // Context linked from existing evaluation/fatigue/performance modules
  performanceContext: CreativeLabPerformanceContext | null;
  fatigueContext:     CreativeLabFatigueContext     | null;
  evaluationContext:  CreativeLabEvaluationContext  | null;

  // Workflow state
  status:        CreativeLabStatus;
  priority:      CreativeLabPriority;
  sourceType:    CreativeLabSourceType;
  reviewState:   CreativeReviewState;
  approvalState: CreativeApprovalState;

  // Buyer-facing recommendation
  recommendationHeadline:  string;
  recommendationRationale: string;
  suggestedNextAction:     string | null;

  // Notes
  notes: string | null;

  // Timestamps
  createdAt: string;  // ISO string
  updatedAt: string;  // ISO string

  // Activity history (in-memory in this step)
  activityLog: CreativeLabActivity[];
};

// ---------------------------------------------------------------------------
// Queue item — lightweight subset for list rendering
// ---------------------------------------------------------------------------

export type CreativeLabQueueItem = Pick<
  CreativeLabItem,
  | "id"
  | "clientAccountId"
  | "clientName"
  | "campaignId"
  | "campaignName"
  | "creativeId"
  | "creativeName"
  | "status"
  | "priority"
  | "sourceType"
  | "recommendationHeadline"
  | "createdAt"
  | "updatedAt"
  | "performanceContext"
  | "fatigueContext"
>;

// ---------------------------------------------------------------------------
// Summary — aggregate counts for stat cards
// ---------------------------------------------------------------------------

export type CreativeLabSummary = {
  total:         number;
  queued:        number;
  inReview:      number;
  approved:      number;
  needsRevision: number;
  rejected:      number;
  blocked:       number;
  highPriority:  number;  // high + urgent combined
  urgent:        number;
};

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

export type CreativeLabFilterState = {
  clientId:   string;
  status:     CreativeLabStatus | "all";
  campaignId: string;
  sourceType: CreativeLabSourceType | "all";
  priority:   CreativeLabPriority | "all";
};

// ---------------------------------------------------------------------------
// Opportunity — Creative Lab scoped, workflow-aware
//
// Extends the basic CreativeOpportunity from lib/creativelab/types.ts
// with workflow context for queue rendering.
// ---------------------------------------------------------------------------

export type CreativeLabOpportunity = {
  itemId:          string;
  opportunityType: "scale" | "refresh" | "iterate" | "retire";
  urgency:         "high" | "medium" | "low";
  headline:        string;
  description:     string;
  estimatedImpact: string | null;
};
