// lib/alerts/index.ts
export { loadDetectionInput, runAllDetectors } from "./detectors";
export {
  detectRoasDropAlerts,
  detectCpaSpikeAlerts,
  detectSpendDropAlerts,
  detectSpendSpikeAlerts,
  detectStaleSyncAlerts,
  detectIntegrationFailureAlerts,
  detectCampaignGoalAlerts,
} from "./detectors";
export {
  upsertAlerts,
  loadAlerts,
  loadTopOpenAlerts,
  acknowledgeAlert,
  resolveAlert,
} from "./persist";
export { buildAlertSummary }                   from "./summary";
export type {
  AlertType,
  AlertSeverity,
  AlertStatus,
  AlertSource,
  AlertEventDraft,
  AlertEventRow,
  AlertSummary,
} from "./types";
