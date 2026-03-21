// lib/onboarding/index.ts
export { buildGoLiveSummary } from "./summary";
export {
  evaluateIntegrationReadiness,
  evaluateSyncHealth,
  evaluateAttributionReadiness,
  evaluateGoalSetupReadiness,
  evaluateGovernanceReadiness,
} from "./readiness";
export { buildOnboardingChecklist } from "./checklist";
