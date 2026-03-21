// lib/onboarding/evaluator.ts
// Pure functions that evaluate readiness for each onboarding dimension.
//
// Design rules:
//  - No DB calls — takes pre-fetched data, returns typed results.
//  - Reuses existing types from clientIntegrations, clientSync, goals, governance.
//  - Deterministic and testable — same input always produces same output.

import type { ClientIntegrationStatus } from "../clientIntegrations";
import type { ClientSyncStatusSummary }  from "../clientSync/types";
import type { ClientReadiness }          from "../clientSync/readiness";
import type { ClientGoal }               from "../goals/types";
import type {
  IntegrationReadiness,
  SyncHealthStatus,
  AttributionReadiness,
  GoalSetupReadiness,
  GovernanceReadiness,
  OnboardingBlocker,
  GoLiveSummary,
  OnboardingReadinessState,
  OnboardingChecklistItem,
} from "../../types/onboarding";

// ── Integration readiness ───────────────────────────────────────────────────

export function evaluateIntegrationReadiness(
  integrations: ClientIntegrationStatus,
  clientId:     string,
): IntegrationReadiness {
  const blockers: OnboardingBlocker[] = [];

  const metaConnected    = integrations.metaState !== "not_connected";
  const metaMapped       = integrations.metaState === "mapped";
  const shopifyConnected = integrations.shopifyState !== "not_connected";
  const shopifyMapped    = integrations.shopifyState === "mapped";
  const readyForSync     = integrations.readyForSync;

  if (!metaConnected) {
    blockers.push({
      category:    "integration",
      message:     "Meta account is not connected. Connect a Meta (Facebook Ads) account to your workspace.",
      severity:    "required",
      actionLabel: "Connect Meta",
      actionHref:  "/integrations/meta",
    });
  } else if (!metaMapped) {
    blockers.push({
      category:    "integration",
      message:     "Meta account is connected but not mapped to this client.",
      severity:    "required",
      actionLabel: "Map Meta Account",
      actionHref:  `/clients/${clientId}#integrations`,
    });
  }

  if (!shopifyConnected) {
    blockers.push({
      category:    "integration",
      message:     "Shopify store is not connected. Shopify is the source of truth for ROAS and CPA.",
      severity:    "required",
      actionLabel: "Connect Shopify",
      actionHref:  "/integrations/shopify",
    });
  } else if (!shopifyMapped) {
    blockers.push({
      category:    "integration",
      message:     "Shopify store is connected but not mapped to this client.",
      severity:    "required",
      actionLabel: "Map Shopify Store",
      actionHref:  `/clients/${clientId}#integrations`,
    });
  }

  return { metaConnected, metaMapped, shopifyConnected, shopifyMapped, readyForSync, blockers };
}

// ── Sync health ─────────────────────────────────────────────────────────────

export function evaluateSyncHealth(
  syncStatus:      ClientSyncStatusSummary,
  syncReadiness:   ClientReadiness,
  clientId:        string,
): SyncHealthStatus {
  const blockers: OnboardingBlocker[] = [];

  const hasEverSynced = syncStatus.hasEverSynced;
  const lastRun       = syncStatus.lastSyncRun;
  const lastSyncSuccessful = lastRun !== null && lastRun.status !== "failed";
  const lastSyncAt    = lastRun?.completedAt ?? null;
  const dataFlowing   = hasEverSynced && lastSyncSuccessful;

  if (!hasEverSynced) {
    blockers.push({
      category:    "sync",
      message:     "No sync has been run yet. Run a first sync to import campaign and order data.",
      severity:    "required",
      actionLabel: "Run First Sync",
      actionHref:  `/clients/${clientId}/sync`,
    });
  } else if (!lastSyncSuccessful) {
    blockers.push({
      category:    "sync",
      message:     "Last sync failed. Retry the sync or check integration connections.",
      severity:    "required",
      actionLabel: "Retry Sync",
      actionHref:  `/clients/${clientId}/sync`,
    });
  }

  if (syncReadiness.shopifyMapped && !syncReadiness.shopifySynced) {
    blockers.push({
      category:    "sync",
      message:     "Shopify is mapped but has not been synced yet. Orders are needed as CRM source of truth.",
      severity:    "required",
      actionLabel: "Sync Shopify",
      actionHref:  `/clients/${clientId}/sync`,
    });
  }

  // Add sync readiness blockers from the existing module
  for (const msg of syncReadiness.blockers) {
    blockers.push({
      category:    "sync",
      message:     msg,
      severity:    "required",
      actionLabel: null,
      actionHref:  null,
    });
  }

  return {
    hasEverSynced,
    lastSyncSuccessful,
    lastSyncAt,
    dataFlowing,
    shopifyOrderCount: syncReadiness.shopifyOrderCount,
    blockers,
  };
}

// ── Attribution readiness ───────────────────────────────────────────────────

export function evaluateAttributionReadiness(
  timezone: string | null,
  clientId: string,
): AttributionReadiness {
  const blockers: OnboardingBlocker[] = [];

  const timezoneConfigured = timezone !== null && timezone.trim().length > 0;

  if (!timezoneConfigured) {
    blockers.push({
      category:    "attribution",
      message:     "Timezone is not configured. Dayparting uses the ad account timezone.",
      severity:    "required",
      actionLabel: "Set Timezone",
      actionHref:  `/clients/${clientId}/settings`,
    });
  }

  return {
    timezoneConfigured,
    timezone,
    attributionWindow: "7 days",
    crmIsSourceOfTruth: true,
    blockers,
  };
}

// ── Goal setup readiness ────────────────────────────────────────────────────

export function evaluateGoalSetupReadiness(
  clientGoal: ClientGoal | null,
  clientId:   string,
): GoalSetupReadiness {
  const blockers: OnboardingBlocker[] = [];

  const hasClientGoals     = clientGoal !== null;
  const hasTargetRoas      = clientGoal?.targetRoas !== null && clientGoal?.targetRoas !== undefined;
  const hasTargetCpa       = clientGoal?.targetCpa !== null && clientGoal?.targetCpa !== undefined;
  const usingSystemDefaults = !hasClientGoals;

  if (!hasClientGoals) {
    blockers.push({
      category:    "goals",
      message:     "No client-level goals are set. System defaults (ROAS 2.0x) will be used until you configure custom targets.",
      severity:    "optional",
      actionLabel: "Configure Goals",
      actionHref:  `/clients/${clientId}/settings`,
    });
  } else if (!hasTargetRoas && !hasTargetCpa) {
    blockers.push({
      category:    "goals",
      message:     "Client goals exist but no ROAS or CPA target is set. Add at least one performance target.",
      severity:    "optional",
      actionLabel: "Configure Goals",
      actionHref:  `/clients/${clientId}/settings`,
    });
  }

  return { hasClientGoals, hasTargetRoas, hasTargetCpa, usingSystemDefaults, blockers };
}

// ── Governance readiness ────────────────────────────────────────────────────

export interface GovernanceInput {
  automationPaused:    boolean;
  activeStopCount:     number;
  activeOverrideCount: number;
}

export function evaluateGovernanceReadiness(
  governance: GovernanceInput,
): GovernanceReadiness {
  const blockers: OnboardingBlocker[] = [];

  // Governance config exists if any governance state is present
  // or if automation is explicitly in a known state
  const hasGovernanceConfig = true; // governance defaults always exist

  if (governance.automationPaused) {
    blockers.push({
      category:    "governance",
      message:     "Automation is currently paused globally. New accounts will not receive automated actions.",
      severity:    "optional",
      actionLabel: "Review Governance",
      actionHref:  "/portfolio/governance",
    });
  }

  if (governance.activeStopCount > 0) {
    blockers.push({
      category:    "governance",
      message:     `${governance.activeStopCount} active emergency stop${governance.activeStopCount > 1 ? "s" : ""} in effect.`,
      severity:    "optional",
      actionLabel: "View Stops",
      actionHref:  "/portfolio/controls",
    });
  }

  return {
    hasGovernanceConfig,
    automationPaused:    governance.automationPaused,
    activeStopCount:     governance.activeStopCount,
    activeOverrideCount: governance.activeOverrideCount,
    blockers,
  };
}

// ── Go-live summary ─────────────────────────────────────────────────────────

export function buildGoLiveSummary(
  integration: IntegrationReadiness,
  syncHealth:  SyncHealthStatus,
  attribution: AttributionReadiness,
  goalSetup:   GoalSetupReadiness,
  governance:  GovernanceReadiness,
  isAlreadyLive: boolean,
  checklist:   OnboardingChecklistItem[],
): GoLiveSummary {
  // Collect all blockers
  const allBlockers = [
    ...integration.blockers,
    ...syncHealth.blockers,
    ...attribution.blockers,
    ...goalSetup.blockers,
    ...governance.blockers,
  ];

  const requiredBlockers = allBlockers.filter(b => b.severity === "required");
  const optionalBlockers = allBlockers.filter(b => b.severity === "optional");

  // Count checks
  const completedChecks = checklist.filter(c => c.status === "complete").length;
  const totalChecks     = checklist.filter(c => c.status !== "optional").length;

  const canGoLive = requiredBlockers.length === 0
    && integration.readyForSync
    && syncHealth.dataFlowing
    && attribution.timezoneConfigured;

  // Determine readiness state
  let readinessState: OnboardingReadinessState;

  if (isAlreadyLive) {
    readinessState = "live";
  } else if (canGoLive) {
    readinessState = "ready_for_go_live";
  } else if (requiredBlockers.length > 0 && completedChecks === 0) {
    readinessState = "not_started";
  } else if (requiredBlockers.some(b => b.category === "sync" && b.message.includes("failed"))) {
    readinessState = "blocked";
  } else if (canGoLive && optionalBlockers.length > 0) {
    readinessState = "needs_review";
  } else {
    readinessState = "in_progress";
  }

  // Label
  let readinessLabel: string;
  switch (readinessState) {
    case "live":              readinessLabel = "Live"; break;
    case "ready_for_go_live": readinessLabel = "Ready for Go-Live"; break;
    case "needs_review":      readinessLabel = "Needs Review"; break;
    case "blocked":           readinessLabel = "Blocked"; break;
    case "not_started":       readinessLabel = "Not Started"; break;
    default:                  readinessLabel = `${completedChecks}/${totalChecks} complete`;
  }

  // Recommended actions: incomplete checklist items
  const recommendedActions = checklist.filter(
    c => c.status === "incomplete" || c.status === "blocked"
  );

  return {
    readinessState,
    readinessLabel,
    completedChecks,
    totalChecks,
    requiredBlockers,
    optionalBlockers,
    canGoLive,
    recommendedActions,
  };
}
