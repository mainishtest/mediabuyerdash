// lib/onboarding/checklist.ts
// Deterministic checklist builder for onboarding readiness.
//
// Generates a flat list of checklist items from readiness evaluation results.
// Pure function — no DB calls.

import type {
  OnboardingChecklistItem,
  ChecklistItemStatus,
  IntegrationReadiness,
  SyncHealthStatus,
  AttributionReadiness,
  GoalSetupReadiness,
  GovernanceReadiness,
} from "../../types/onboarding";

// ── Helper ──────────────────────────────────────────────────────────────────

function item(
  id:          string,
  label:       string,
  description: string,
  done:        boolean,
  category:    string,
  actionLabel: string | null,
  actionHref:  string | null,
  isOptional?: boolean,
  isBlocked?:  boolean,
): OnboardingChecklistItem {
  let status: ChecklistItemStatus;
  if (done)            status = "complete";
  else if (isBlocked)  status = "blocked";
  else if (isOptional) status = "optional";
  else                 status = "incomplete";

  return { id, label, description, status, category, actionLabel, actionHref };
}

// ── Builder ─────────────────────────────────────────────────────────────────

export function buildOnboardingChecklist(
  clientId:    string,
  integration: IntegrationReadiness,
  syncHealth:  SyncHealthStatus,
  attribution: AttributionReadiness,
  goalSetup:   GoalSetupReadiness,
  governance:  GovernanceReadiness,
): OnboardingChecklistItem[] {
  const base = `/clients/${clientId}`;

  return [
    // ── Account basics ────────────────────────────────────────────────────
    item(
      "client_exists",
      "Client account created",
      "Client account exists in the workspace.",
      true, // always true if we got here
      "account",
      "View Client",
      base,
    ),

    // ── Integrations ──────────────────────────────────────────────────────
    item(
      "meta_connected",
      "Meta account connected",
      "A Meta (Facebook Ads) account is connected to the workspace.",
      integration.metaConnected,
      "integration",
      integration.metaConnected ? null : "Connect Meta",
      integration.metaConnected ? null : "/integrations/meta",
    ),
    item(
      "meta_mapped",
      "Meta account mapped to client",
      "A Meta ad account is assigned to this client for delivery analysis.",
      integration.metaMapped,
      "integration",
      integration.metaMapped ? null : "Map Meta Account",
      integration.metaMapped ? null : `${base}#integrations`,
      false,
      !integration.metaConnected, // blocked if not connected
    ),
    item(
      "shopify_connected",
      "Shopify store connected",
      "A Shopify store is connected to the workspace as CRM source of truth.",
      integration.shopifyConnected,
      "integration",
      integration.shopifyConnected ? null : "Connect Shopify",
      integration.shopifyConnected ? null : "/integrations/shopify",
    ),
    item(
      "shopify_mapped",
      "Shopify store mapped to client",
      "A Shopify store is assigned to this client for revenue attribution.",
      integration.shopifyMapped,
      "integration",
      integration.shopifyMapped ? null : "Map Shopify Store",
      integration.shopifyMapped ? null : `${base}#integrations`,
      false,
      !integration.shopifyConnected, // blocked if not connected
    ),

    // ── Attribution ───────────────────────────────────────────────────────
    item(
      "timezone_configured",
      "Timezone configured",
      "Ad account timezone is set for accurate dayparting.",
      attribution.timezoneConfigured,
      "attribution",
      attribution.timezoneConfigured ? null : "Set Timezone",
      attribution.timezoneConfigured ? null : `${base}/settings`,
    ),
    item(
      "attribution_window",
      "Attribution window set (7 days)",
      "Using 7-day attribution window with CRM as source of truth.",
      true, // always configured per product rules
      "attribution",
      null,
      null,
    ),

    // ── Sync ──────────────────────────────────────────────────────────────
    item(
      "first_sync",
      "First sync completed",
      "Initial data import from Meta and Shopify.",
      syncHealth.hasEverSynced && syncHealth.lastSyncSuccessful,
      "sync",
      syncHealth.hasEverSynced ? null : "Run First Sync",
      syncHealth.hasEverSynced ? null : `${base}/sync`,
      false,
      !integration.readyForSync, // blocked if integrations not ready
    ),
    item(
      "data_flowing",
      "Data is flowing",
      "Campaign and order data is being imported successfully.",
      syncHealth.dataFlowing,
      "sync",
      syncHealth.dataFlowing ? null : "Check Sync",
      syncHealth.dataFlowing ? null : `${base}/sync`,
      false,
      !syncHealth.hasEverSynced, // blocked if never synced
    ),

    // ── Goals ─────────────────────────────────────────────────────────────
    item(
      "goals_configured",
      "Performance goals configured",
      "Client-level ROAS and/or CPA targets are set.",
      goalSetup.hasClientGoals,
      "goals",
      goalSetup.hasClientGoals ? null : "Configure Goals",
      goalSetup.hasClientGoals ? null : `${base}/settings`,
      true, // optional — system defaults apply
    ),

    // ── Governance ────────────────────────────────────────────────────────
    item(
      "governance_clear",
      "No active emergency stops",
      "No emergency stops are blocking automation for this account.",
      !governance.automationPaused && governance.activeStopCount === 0,
      "governance",
      governance.activeStopCount > 0 ? "View Stops" : null,
      governance.activeStopCount > 0 ? "/portfolio/controls" : null,
      true, // optional — stops are a safety feature
    ),
  ];
}
