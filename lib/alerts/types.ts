// lib/alerts/types.ts
// Typed models for the alerting and anomaly detection system.

export type AlertType =
  // Anomaly detection (existing)
  | "roas_drop"
  | "cpa_spike"
  | "spend_drop"
  | "spend_spike"
  | "stale_sync"
  | "no_data"
  | "campaign_below_goal"
  | "campaign_above_goal"
  | "integration_failure"
  // Proactive triggers (new)
  | "scale_ready"
  | "winner_detected"
  | "loser_detected"
  | "creative_fatigue_detected"
  | "follow_up_test_needed"
  | "action_blocked"
  | "trust_state_warning"
  | "sync_health_issue";

export type AlertSeverity = "low" | "medium" | "high";

export type AlertStatus = "open" | "acknowledged" | "resolved";

export type AlertSource = "meta" | "shopify" | "reconciled" | "system";

// In-memory draft produced by detector functions — not yet persisted.
export type AlertEventDraft = {
  clientAccountId:  string;
  clientName:       string;
  workspaceId:      string | null;
  alertType:        AlertType;
  severity:         AlertSeverity;
  source:           AlertSource;
  entityType:       "client" | "campaign" | "integration";
  entityId:         string;
  entityName:       string;
  summary:          string;
  supportingMetrics: Record<string, string | number>;
  deduplicationKey: string;   // "{clientId}:{alertType}:{entityId}"
};

// A persisted AlertEvent — matches the Prisma model shape but with typed fields.
export type AlertEventRow = {
  id:               string;
  workspaceId:      string | null;
  clientAccountId:  string;
  clientName:       string;
  alertType:        AlertType;
  severity:         AlertSeverity;
  status:           AlertStatus;
  source:           AlertSource;
  entityType:       "client" | "campaign" | "integration";
  entityId:         string;
  entityName:       string;
  summary:          string;
  supportingMetrics: Record<string, string | number>;
  deduplicationKey: string;
  detectedAt:       string;     // ISO datetime
  lastDetectedAt:   string;
  acknowledgedAt:   string | null;
  resolvedAt:       string | null;
};

// Counts used for summary cards.
export type AlertSummary = {
  openCount:         number;
  highSeverityCount: number;
  acknowledgedCount: number;
  resolvedCount:     number;
  totalCount:        number;
};
