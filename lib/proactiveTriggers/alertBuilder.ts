// ─── Proactive Trigger — Alert Builder ────────────────────────────────────────
//
// Converts ProactiveTriggerCondition[] into AlertEventDraft[] for upsert
// into the existing AlertEvent pipeline. Same dedup, same lifecycle.
//
// Also provides a summary builder and a mapper from AlertEventRow to
// ProactiveAlert (for richer UI rendering).

import type { AlertEventDraft, AlertSeverity, AlertEventRow } from "../alerts/types";
import type {
  ProactiveTriggerCondition,
  ProactiveAlert,
  ProactiveAlertSummary,
  ProactiveAlertPriority,
  ProactiveAlertEvidence,
  ProactiveActionSuggestion,
  TriggerEvaluationResult,
} from "../../types/proactiveTriggers";

// ── Map priority to severity ────────────────────────────────────────────────

function priorityToSeverity(priority: ProactiveAlertPriority): AlertSeverity {
  switch (priority) {
    case "urgent": return "high";
    case "high":   return "high";
    case "medium": return "medium";
    case "low":    return "low";
  }
}

// ── Build AlertEventDrafts from trigger conditions ──────────────────────────

export function buildProactiveAlertDrafts(
  result: TriggerEvaluationResult,
  workspaceId: string | null,
): AlertEventDraft[] {
  return result.triggers.map((t): AlertEventDraft => ({
    clientAccountId:  t.clientId || "portfolio",
    clientName:       t.clientName,
    workspaceId,
    alertType:        t.triggerType,
    severity:         priorityToSeverity(t.priority),
    source:           "system",
    entityType:       t.entityType === "action" || t.entityType === "experiment" || t.entityType === "creative"
      ? "campaign" // AlertEvent only supports client|campaign|integration
      : t.entityType as "client" | "campaign" | "integration",
    entityId:         t.entityId,
    entityName:       t.entityName,
    summary:          t.reason,
    supportingMetrics: buildMetricsFromEvidence(t.evidence, t.action),
    deduplicationKey: `${t.clientId || "portfolio"}:${t.triggerType}:${t.entityId}`,
  }));
}

function buildMetricsFromEvidence(
  evidence: ProactiveAlertEvidence[],
  action: ProactiveActionSuggestion,
): Record<string, string | number> {
  const metrics: Record<string, string | number> = {};
  for (const e of evidence) {
    metrics[e.label] = e.value;
  }
  metrics["_actionLabel"] = action.label;
  metrics["_actionHref"]  = action.href;
  metrics["_actionDesc"]  = action.description;
  return metrics;
}

// ── Map AlertEventRow → ProactiveAlert (for UI) ─────────────────────────────

export function mapAlertToProactiveAlert(alert: AlertEventRow): ProactiveAlert | null {
  // Only map proactive trigger types
  const proactiveTypes = new Set([
    "scale_ready", "winner_detected", "loser_detected",
    "creative_fatigue_detected", "follow_up_test_needed",
    "action_blocked", "trust_state_warning", "sync_health_issue",
  ]);

  if (!proactiveTypes.has(alert.alertType)) return null;

  const metrics = alert.supportingMetrics;
  const evidence: ProactiveAlertEvidence[] = [];
  for (const [key, val] of Object.entries(metrics)) {
    if (key.startsWith("_")) continue;
    evidence.push({
      label: key,
      value: String(val),
      source: "Detection",
      direction: "neutral",
    });
  }

  const action: ProactiveActionSuggestion = {
    label:       String(metrics["_actionLabel"] ?? "View details"),
    description: String(metrics["_actionDesc"]  ?? alert.summary),
    href:        String(metrics["_actionHref"]  ?? "/alerts"),
    priority:    alert.severity === "high" ? "high" : "medium",
  };

  return {
    id:          alert.id,
    triggerType: alert.alertType as ProactiveAlert["triggerType"],
    title:       formatTriggerTitle(alert.alertType, alert.entityName),
    reason:      alert.summary,
    priority:    severityToPriority(alert.severity),
    state:       mapAlertStatus(alert.status),
    clientId:    alert.clientAccountId,
    clientName:  alert.clientName,
    entityId:    alert.entityId,
    entityName:  alert.entityName,
    evidence,
    action,
    detectedAt:  alert.detectedAt,
    href:        String(metrics["_actionHref"] ?? "/alerts"),
  };
}

function formatTriggerTitle(type: string, entityName: string): string {
  const labels: Record<string, string> = {
    scale_ready:               "Ready to Scale",
    winner_detected:           "Winner Detected",
    loser_detected:            "Loser Detected",
    creative_fatigue_detected: "Creative Fatigue",
    follow_up_test_needed:     "Follow-Up Test Needed",
    action_blocked:            "Action Blocked",
    trust_state_warning:       "Trust Warning",
    sync_health_issue:         "Sync Issue",
  };
  return `${labels[type] ?? type}: ${entityName}`;
}

function severityToPriority(severity: AlertSeverity): ProactiveAlertPriority {
  switch (severity) {
    case "high":   return "high";
    case "medium": return "medium";
    case "low":    return "low";
  }
}

function mapAlertStatus(status: string): ProactiveAlert["state"] {
  switch (status) {
    case "open":         return "active";
    case "acknowledged": return "acknowledged";
    case "resolved":     return "resolved";
    default:             return "active";
  }
}

// ── Summary builder ─────────────────────────────────────────────────────────

export function summarizeProactiveAlerts(alerts: ProactiveAlert[]): ProactiveAlertSummary {
  const active = alerts.filter((a) => a.state === "active");
  return {
    totalActive:    active.length,
    urgentCount:    active.filter((a) => a.priority === "urgent").length,
    highCount:      active.filter((a) => a.priority === "high").length,
    scaleReady:     active.filter((a) => a.triggerType === "scale_ready").length,
    winnersFound:   active.filter((a) => a.triggerType === "winner_detected").length,
    losersFound:    active.filter((a) => a.triggerType === "loser_detected").length,
    fatigueAlerts:  active.filter((a) => a.triggerType === "creative_fatigue_detected").length,
    blockedActions: active.filter((a) => a.triggerType === "action_blocked").length,
    trustWarnings:  active.filter((a) => a.triggerType === "trust_state_warning" || a.triggerType === "sync_health_issue").length,
  };
}
