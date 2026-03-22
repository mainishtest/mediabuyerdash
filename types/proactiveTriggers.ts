// ─── Proactive AI Trigger System — Typed Models ──────────────────────────────
//
// Extends the existing AlertEvent system with higher-level trigger conditions.
// Proactive triggers detect scale readiness, winners, losers, fatigue,
// blocked actions, trust warnings — and generate actionable alerts.
//
// Uses the same AlertEvent pipeline: same lifecycle, dedup, command center.

// ── Trigger types (maps to new AlertType values) ────────────────────────────

export type ProactiveTriggerType =
  | "scale_ready"
  | "winner_detected"
  | "loser_detected"
  | "creative_fatigue_detected"
  | "follow_up_test_needed"
  | "action_blocked"
  | "trust_state_warning"
  | "sync_health_issue";

// ── Priority ────────────────────────────────────────────────────────────────

export type ProactiveAlertPriority = "low" | "medium" | "high" | "urgent";

// ── Alert state (extends existing AlertStatus) ──────────────────────────────

export type ProactiveAlertState =
  | "active"
  | "acknowledged"
  | "resolved"
  | "dismissed"
  | "expired";

// ── Evidence ────────────────────────────────────────────────────────────────

export type ProactiveAlertEvidence = {
  label:      string;
  value:      string;
  source:     string;
  direction:  "positive" | "negative" | "neutral";
};

// ── Action suggestion ───────────────────────────────────────────────────────

export type ProactiveActionSuggestion = {
  label:       string;         // "Review scale plan"
  description: string;         // why this action makes sense
  href:        string;         // workflow route
  priority:    ProactiveAlertPriority;
};

// ── Trigger condition (what was detected) ───────────────────────────────────

export type ProactiveTriggerCondition = {
  triggerType:  ProactiveTriggerType;
  clientId:     string;
  clientName:   string;
  entityId:     string;
  entityName:   string;
  entityType:   "client" | "campaign" | "creative" | "experiment" | "action";
  reason:       string;           // human-readable why
  evidence:     ProactiveAlertEvidence[];
  priority:     ProactiveAlertPriority;
  action:       ProactiveActionSuggestion;
};

// ── Full proactive alert (for UI rendering) ─────────────────────────────────

export type ProactiveAlert = {
  id:           string;
  triggerType:  ProactiveTriggerType;
  title:        string;
  reason:       string;
  priority:     ProactiveAlertPriority;
  state:        ProactiveAlertState;
  clientId:     string;
  clientName:   string;
  entityId:     string;
  entityName:   string;
  evidence:     ProactiveAlertEvidence[];
  action:       ProactiveActionSuggestion;
  detectedAt:   string;
  href:         string;
};

// ── Trigger evaluation result ───────────────────────────────────────────────

export type TriggerEvaluationResult = {
  triggers:     ProactiveTriggerCondition[];
  evaluatedAt:  string;
  inputSources: string[];
  warnings:     string[];
};

// ── Summary ─────────────────────────────────────────────────────────────────

export type ProactiveAlertSummary = {
  totalActive:    number;
  urgentCount:    number;
  highCount:      number;
  scaleReady:     number;
  winnersFound:   number;
  losersFound:    number;
  fatigueAlerts:  number;
  blockedActions: number;
  trustWarnings:  number;
};
