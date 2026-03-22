// ─── Action History — Unified Typed Models ───────────────────────────────────
//
// Account-level action history that unifies all event sources:
//   - AutomationAuditLog      (automation lifecycle)
//   - ProposedAutomationAction (approval lifecycle)
//   - AutoExecutionLog         (execution records)
//   - CreativeLabActivityLog   (creative workflow transitions)
//   - CreativeOutcomeRouteRecord (outcome routing decisions)
//   - NotificationLog          (digest/alert delivery)
//
// Design: read-only aggregation over existing tables. No new event store.
// Reuses existing audit types where possible.

// ── Event types ─────────────────────────────────────────────────────────────

export type ActionHistoryEventType =
  // Automation lifecycle (maps from AutomationAuditLog)
  | "recommendation_created"
  | "approval_requested"
  | "approval_granted"
  | "approval_rejected"
  | "approval_deferred"
  // Scale / budget
  | "scale_plan_created"
  | "scale_executed"
  | "budget_changed"
  // Tests and creative
  | "test_created"
  | "test_launched"
  | "creative_refresh_sent"
  | "image_generation_completed"
  | "creative_status_changed"
  // Outcome routing
  | "outcome_routed"
  // Execution
  | "execution_succeeded"
  | "execution_failed"
  | "launch_failed"
  // Blockers
  | "action_blocked"
  | "emergency_stopped"
  // Retry
  | "retry_started"
  | "retry_succeeded"
  // Notifications
  | "digest_delivered"
  | "alert_delivered";

// ── Status ──────────────────────────────────────────────────────────────────

export type ActionHistoryStatus =
  | "success"
  | "failed"
  | "blocked"
  | "pending"
  | "in_progress"
  | "skipped";

// ── Actor ───────────────────────────────────────────────────────────────────

export type ActionHistoryActor = {
  type:   "system" | "operator" | "cron" | "api";
  id:     string;
  label:  string;
};

// ── Entity link — what this action relates to ───────────────────────────────

export type ActionHistoryEntityLink = {
  entityType: "campaign" | "client" | "ad_set" | "creative" | "experiment" | "brief" | "outcome" | "approval" | "workspace";
  entityId:   string;
  entityName: string;
  href:       string;
};

// ── Outcome link — what happened after ──────────────────────────────────────

export type ActionHistoryOutcomeLink = {
  outcomeId:    string;
  outcomeType:  "winner" | "loser" | "scale_opportunity" | "refresh_needed" | "retest_needed" | "monitoring" | "execution_result";
  label:        string;
  href:         string;
};

// ── Source — which data source provided this entry ──────────────────────────

export type ActionHistorySource =
  | "automation_audit"
  | "proposed_action"
  | "execution_log"
  | "creative_lab"
  | "outcome_route"
  | "notification_log";

// ── Full entry ──────────────────────────────────────────────────────────────

export type ActionHistoryEntry = {
  id:            string;
  eventType:     ActionHistoryEventType;
  status:        ActionHistoryStatus;
  title:         string;            // human-readable, e.g. "Approved scale plan for Brand X"
  description:   string;            // detail/rationale
  actor:         ActionHistoryActor;
  entity:        ActionHistoryEntityLink;
  outcomeLink:   ActionHistoryOutcomeLink | null;
  clientId:      string | null;
  clientName:    string | null;
  source:        ActionHistorySource;
  occurredAt:    string;            // ISO timestamp
  // Navigation
  href:          string;            // link to relevant detail page
  // Metadata
  metadata:      Record<string, unknown>;  // source-specific extra data
};

// ── Timeline item — entry with grouping context ─────────────────────────────

export type ActionHistoryTimelineItem = ActionHistoryEntry & {
  dateGroup:  string;   // YYYY-MM-DD for grouping
  timeLabel:  string;   // "2:34 PM" for display
};

// ── Group ───────────────────────────────────────────────────────────────────

export type ActionHistoryGroup = {
  date:     string;     // YYYY-MM-DD
  label:    string;     // "Today", "Yesterday", "Mar 20, 2026"
  items:    ActionHistoryTimelineItem[];
};

// ── Filter state ────────────────────────────────────────────────────────────

export type ActionHistoryFilterState = {
  clientId:   string;           // "" = all
  eventType:  ActionHistoryEventType | "";
  status:     ActionHistoryStatus | "";
  actor:      string;           // "" = all, "system" | "operator" | "cron" | "api"
  dateFrom:   string;           // YYYY-MM-DD or ""
  dateTo:     string;           // YYYY-MM-DD or ""
};

// ── Summary ─────────────────────────────────────────────────────────────────

export type ActionHistorySummary = {
  totalEntries:     number;
  successCount:     number;
  failedCount:      number;
  blockedCount:     number;
  pendingCount:     number;
  scaleActions:     number;
  testActions:      number;
  creativeActions:  number;
  outcomeRoutes:    number;
  periodFrom:       string | null;
  periodTo:         string | null;
};
