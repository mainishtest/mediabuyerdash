// lib/alerts/summary.ts
import type { AlertEventRow, AlertSummary } from "./types";

export function buildAlertSummary(alerts: AlertEventRow[]): AlertSummary {
  return {
    openCount:         alerts.filter((a) => a.status === "open").length,
    highSeverityCount: alerts.filter((a) => a.severity === "high" && a.status !== "resolved").length,
    acknowledgedCount: alerts.filter((a) => a.status === "acknowledged").length,
    resolvedCount:     alerts.filter((a) => a.status === "resolved").length,
    totalCount:        alerts.length,
  };
}
