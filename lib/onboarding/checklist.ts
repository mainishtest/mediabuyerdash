// lib/onboarding/checklist.ts
// Deterministic checklist generation from readiness evaluation results.
// No DB calls — takes evaluated readiness objects and returns checklist items.

import type {
  OnboardingChecklistItem,
  IntegrationReadiness,
  SyncHealthStatus,
  AttributionReadiness,
  GoalSetupReadiness,
  GovernanceReadiness,
} from "../../types/onboarding";

export function buildOnboardingChecklist({
  clientName,
  timezone,
  integration,
  syncHealth,
  attribution,
  goalSetup,
  governance,
}: {
  clientName:  string;
  timezone:    string;
  integration: IntegrationReadiness;
  syncHealth:  SyncHealthStatus;
  attribution: AttributionReadiness;
  goalSetup:   GoalSetupReadiness;
  governance:  GovernanceReadiness;
}): OnboardingChecklistItem[] {
  const items: OnboardingChecklistItem[] = [];

  // ── Account ────────────────────────────────────────────────────────────────

  items.push({
    id:       "account_name",
    label:    "Client account created",
    detail:   clientName,
    status:   "complete",
    required: true,
    category: "account",
  });

  items.push({
    id:       "account_timezone",
    label:    "Timezone configured",
    detail:   attribution.timezoneConfigured
                ? `${timezone} (custom)`
                : `${timezone} (default — verify this matches the ad account timezone)`,
    status:   attribution.timezoneConfigured ? "complete" : "warning",
    required: true,
    category: "account",
  });

  // ── Meta integration ───────────────────────────────────────────────────────

  items.push({
    id:       "meta_connected",
    label:    "Meta ad account connected",
    detail:   integration.meta.connected
                ? `${integration.meta.accountCount} account(s) linked`
                : "No Meta ad account linked",
    status:   integration.meta.connected ? "complete" : "incomplete",
    required: true,
    category: "integration",
  });

  items.push({
    id:       "meta_active",
    label:    "Meta connection active",
    detail:   integration.meta.connectionStatus === "active"
                ? "Connection is active"
                : integration.meta.connected
                  ? "Connection exists but is not active"
                  : "No connection",
    status:   integration.meta.connectionStatus === "active"
                ? "complete"
                : integration.meta.connected
                  ? "warning"
                  : "incomplete",
    required: true,
    category: "integration",
  });

  // ── Shopify / CRM integration ──────────────────────────────────────────────

  items.push({
    id:       "shopify_connected",
    label:    "Shopify store connected (CRM source of truth)",
    detail:   integration.shopify.connected
                ? integration.shopify.domain ?? "Store connected"
                : "No Shopify store connected — required for CRM-based ROAS and CPA",
    status:   integration.shopify.connected ? "complete" : "incomplete",
    required: true,
    category: "integration",
  });

  items.push({
    id:       "shopify_active",
    label:    "Shopify connection active",
    status:   integration.shopify.connectionStatus === "active"
                ? "complete"
                : integration.shopify.connected
                  ? "warning"
                  : "incomplete",
    required: true,
    category: "integration",
  });

  items.push({
    id:       "shopify_synced",
    label:    "Shopify orders imported",
    detail:   integration.shopify.synced
                ? `${integration.shopify.orderCount} orders available`
                : "No orders synced yet — run a Shopify sync to import order data",
    status:   integration.shopify.synced
                ? integration.shopify.orderCount > 0 ? "complete" : "warning"
                : "incomplete",
    required: true,
    category: "integration",
  });

  // ── Attribution ────────────────────────────────────────────────────────────

  items.push({
    id:       "attribution_window",
    label:    "Attribution window set to 7 days",
    detail:   "Fixed at 7 days per product rules",
    status:   "complete",
    required: true,
    category: "attribution",
  });

  items.push({
    id:       "attribution_dayparting",
    label:    "Dayparting uses ad account timezone",
    detail:   attribution.timezoneConfigured
                ? `Timezone set to ${attribution.timezone}`
                : "Set the client timezone to match the Meta ad account timezone",
    status:   attribution.timezoneConfigured ? "complete" : "warning",
    required: true,
    category: "attribution",
  });

  // ── Goals ──────────────────────────────────────────────────────────────────

  items.push({
    id:       "goals_configured",
    label:    "Default ROAS and CPA goals set",
    detail:   goalSetup.hasGoals
                ? [
                    goalSetup.roasTarget ? `ROAS target: ${goalSetup.roasTarget}x` : null,
                    goalSetup.cpaTarget  ? `CPA target: $${goalSetup.cpaTarget}`   : null,
                  ].filter(Boolean).join(" · ") || "Goals configured"
                : "No default goals set — required for optimization and alerting",
    status:   goalSetup.hasGoals ? "complete" : "incomplete",
    required: true,
    category: "goals",
  });

  items.push({
    id:       "goals_spend_cap",
    label:    "Max daily spend cap set",
    detail:   goalSetup.maxDailySpend
                ? `$${goalSetup.maxDailySpend}/day`
                : "Optional — set a spend cap for budget safety",
    status:   goalSetup.maxDailySpend ? "complete" : "optional",
    required: false,
    category: "goals",
  });

  // ── Governance ─────────────────────────────────────────────────────────────

  items.push({
    id:       "governance_auto_execution",
    label:    "Auto-execution settings configured",
    detail:   governance.hasAutoExecution
                ? governance.autoExecutionEnabled
                  ? "Auto-execution enabled"
                  : "Auto-execution configured but disabled (manual-approval mode)"
                : "Not configured — defaults to manual approval on all actions",
    status:   governance.hasAutoExecution ? "complete" : "optional",
    required: false,
    category: "governance",
  });

  // ── Sync health ────────────────────────────────────────────────────────────

  items.push({
    id:       "sync_meta",
    label:    "Meta sync has run successfully",
    detail:   syncHealth.metaSyncStatus === "healthy"
                ? `Last sync: ${syncHealth.lastMetaSyncAt?.toLocaleDateString()}`
                : syncHealth.metaSyncStatus === "stale"
                  ? "Last sync was more than 24h ago"
                  : syncHealth.metaSyncStatus === "failed"
                    ? "Last sync failed — check error log"
                    : "No Meta sync has run yet",
    status:   syncHealth.metaSyncStatus === "healthy"
                ? "complete"
                : syncHealth.metaSyncStatus === "stale"
                  ? "warning"
                  : "incomplete",
    required: true,
    category: "sync",
  });

  items.push({
    id:       "sync_shopify",
    label:    "Shopify sync has run successfully",
    detail:   syncHealth.shopifySyncStatus === "healthy"
                ? `Last sync: ${syncHealth.lastShopifySyncAt?.toLocaleDateString()}`
                : syncHealth.shopifySyncStatus === "stale"
                  ? "Last sync was more than 24h ago"
                  : syncHealth.shopifySyncStatus === "failed"
                    ? "Last sync failed — check error log"
                    : "No Shopify sync has run yet",
    status:   syncHealth.shopifySyncStatus === "healthy"
                ? "complete"
                : syncHealth.shopifySyncStatus === "stale"
                  ? "warning"
                  : "incomplete",
    required: true,
    category: "sync",
  });

  return items;
}
