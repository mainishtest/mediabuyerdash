// lib/readiness/evaluate.ts
// Server-side readiness evaluation. Composes signals from existing modules
// into a unified account readiness summary. No data duplication.

import { prisma } from "../db";
import { getMetaConnectionState, getMetaSyncSetupState } from "../meta/integrationState";
import { getShopifyConnectionState, getShopifySyncSetupState, evaluateShopifySyncHealth } from "../shopify/integrationState";
import type {
  AccountReadinessCheck,
  AccountReadinessBlocker,
  AccountReadinessSummary,
  GoLiveStatus,
  GoLiveRecommendation,
  IntegrationReadinessState,
  ConfigurationReadinessState,
  ReadinessState,
} from "./types";

// ── Main entry point ──────────────────────────────────────────────────────────

export async function buildAccountReadinessSummary(
  workspaceId: string,
): Promise<AccountReadinessSummary> {
  const [checks, integrationState, configurationState] = await Promise.all([
    evaluateAccountReadinessChecks(workspaceId),
    evaluateIntegrationReadiness(workspaceId),
    evaluateConfigurationReadiness(workspaceId),
  ]);

  const blockers = detectAccountReadinessBlockers(checks);
  const goLiveStatus = computeGoLiveStatus(checks);
  const recommendations = buildGoLiveRecommendations(checks, blockers);

  return {
    checks,
    blockers,
    goLiveStatus,
    recommendations,
    integrationState,
    configurationState,
  };
}

// ── Check evaluation ──────────────────────────────────────────────────────────

export async function evaluateAccountReadinessChecks(
  workspaceId: string,
): Promise<AccountReadinessCheck[]> {
  const [
    workspace,
    onboardingState,
    metaConn,
    metaSync,
    shopifyConn,
    shopifySync,
    shopifyHealth,
    clientCount,
    goalCount,
    autoExecCount,
  ] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, brandName: true, timezone: true },
    }),
    prisma.onboardingState.findUnique({
      where: { workspaceId },
      select: { completedAt: true, currentStep: true },
    }),
    getMetaConnectionState(),
    getMetaSyncSetupState(),
    getShopifyConnectionState(),
    getShopifySyncSetupState(),
    evaluateShopifySyncHealth(),
    prisma.clientAccount.count({ where: { workspaceId } }),
    prisma.clientGoalDefaults.count({
      where: { clientAccount: { workspaceId } },
    }),
    prisma.autoExecutionSettings.count({
      where: { workspaceId },
    }),
  ]);

  const checks: AccountReadinessCheck[] = [];

  // ── Workspace setup ─────────────────────────────────────────────────────

  checks.push({
    id: "workspace_exists",
    category: "workspace_setup",
    label: "Workspace created",
    description: workspace ? `"${workspace.name}"` : "No workspace found",
    status: workspace ? "pass" : "fail",
    required: true,
    actionHref: workspace ? undefined : "/onboarding",
    actionLabel: workspace ? undefined : "Start Onboarding",
  });

  checks.push({
    id: "onboarding_complete",
    category: "workspace_setup",
    label: "Onboarding completed",
    description: onboardingState?.completedAt
      ? "Onboarding finished"
      : onboardingState
      ? `In progress (${onboardingState.currentStep})`
      : "Not started",
    status: onboardingState?.completedAt ? "pass" : "warning",
    required: false,
    actionHref: onboardingState?.completedAt ? undefined : "/onboarding",
    actionLabel: onboardingState?.completedAt ? undefined : "Continue Onboarding",
  });

  checks.push({
    id: "business_profile",
    category: "workspace_setup",
    label: "Business profile completed",
    description: workspace?.brandName ? `Brand: ${workspace.brandName}` : "Brand name not set",
    status: workspace?.brandName ? "pass" : "warning",
    required: false,
    actionHref: workspace?.brandName ? undefined : "/onboarding",
    actionLabel: workspace?.brandName ? undefined : "Complete Profile",
  });

  // ── Client setup ────────────────────────────────────────────────────────

  checks.push({
    id: "clients_exist",
    category: "client_setup",
    label: "At least one client created",
    description: clientCount > 0 ? `${clientCount} client(s)` : "No clients yet",
    status: clientCount > 0 ? "pass" : "fail",
    required: true,
    actionHref: clientCount > 0 ? undefined : "/clients",
    actionLabel: clientCount > 0 ? undefined : "Add Client",
  });

  // ── Meta connection ─────────────────────────────────────────────────────

  const metaConnected = metaConn.status === "connected";
  checks.push({
    id: "meta_connected",
    category: "meta_connection",
    label: "Meta account connected",
    description: metaConnected
      ? `Connected as ${metaConn.userDisplayName}`
      : metaConn.isTokenExpired ? "Token expired — reconnect needed" : "Not connected",
    status: metaConnected ? "pass" : "fail",
    required: true,
    actionHref: metaConnected ? undefined : "/integrations/meta",
    actionLabel: metaConnected ? undefined : "Connect Meta",
  });

  const metaSelectedAccounts = metaConnected
    ? await prisma.metaSelectedAdAccount.count({ where: { connection: { connectionStatus: "active" } } })
    : 0;

  checks.push({
    id: "meta_accounts_selected",
    category: "meta_connection",
    label: "Ad accounts selected",
    description: metaSelectedAccounts > 0
      ? `${metaSelectedAccounts} account(s) selected`
      : "No accounts selected",
    status: metaSelectedAccounts > 0 ? "pass" : metaConnected ? "fail" : "skipped",
    required: true,
    actionHref: metaSelectedAccounts > 0 ? undefined : "/integrations/meta",
    actionLabel: metaSelectedAccounts > 0 ? undefined : "Select Accounts",
  });

  checks.push({
    id: "meta_sync_healthy",
    category: "meta_connection",
    label: "Meta sync healthy",
    description: metaSync.status === "completed"
      ? `Last sync: ${metaSync.campaignsSynced} campaigns`
      : metaSync.status === "failed"
      ? "Last sync failed"
      : "No sync completed yet",
    status: metaSync.status === "completed" ? "pass" : metaSync.status === "failed" ? "fail" : "warning",
    required: true,
    actionHref: metaSync.status !== "completed" ? "/integrations/meta" : undefined,
    actionLabel: metaSync.status === "failed" ? "Retry Sync" : metaSync.status !== "completed" ? "Run Sync" : undefined,
  });

  // ── Shopify connection ──────────────────────────────────────────────────

  const shopifyConnected = shopifyConn.status === "connected";
  checks.push({
    id: "shopify_connected",
    category: "shopify_connection",
    label: "Shopify store connected",
    description: shopifyConnected
      ? `Connected: ${shopifyConn.shopDomain}`
      : "Not connected",
    status: shopifyConnected ? "pass" : "fail",
    required: true,
    actionHref: shopifyConnected ? undefined : "/integrations/shopify",
    actionLabel: shopifyConnected ? undefined : "Connect Shopify",
  });

  checks.push({
    id: "shopify_sync_healthy",
    category: "shopify_connection",
    label: "Revenue sync healthy",
    description: shopifyHealth.message,
    status: shopifyHealth.state === "healthy" ? "pass"
      : shopifyHealth.state === "stale" || shopifyHealth.state === "partial" ? "warning"
      : shopifyHealth.state === "failed" ? "fail"
      : "warning",
    required: true,
    actionHref: shopifyHealth.state !== "healthy" ? "/integrations/shopify" : undefined,
    actionLabel: shopifyHealth.state === "failed" ? "Retry Sync"
      : shopifyHealth.state === "not_started" ? "Run Sync" : undefined,
  });

  // ── Sync health ─────────────────────────────────────────────────────────

  const bothSyncsHealthy = metaSync.status === "completed" &&
    (shopifySync.status === "healthy" || shopifySync.status === "partial");

  checks.push({
    id: "sync_overall",
    category: "sync_health",
    label: "Overall sync health",
    description: bothSyncsHealthy
      ? "Both Meta and Shopify syncs are healthy"
      : "One or more syncs need attention",
    status: bothSyncsHealthy ? "pass" : "warning",
    required: true,
  });

  // ── Timezone ────────────────────────────────────────────────────────────

  const tzSet = workspace?.timezone && workspace.timezone !== "America/New_York"; // non-default means explicitly set
  checks.push({
    id: "timezone_set",
    category: "timezone_configuration",
    label: "Timezone configured",
    description: workspace?.timezone
      ? `Set to ${workspace.timezone.replace(/_/g, " ")}`
      : "Using default (America/New_York)",
    status: workspace?.timezone ? "pass" : "warning",
    required: true,
  });

  // ── Goals ───────────────────────────────────────────────────────────────

  checks.push({
    id: "goals_configured",
    category: "goals_configuration",
    label: "Performance goals configured",
    description: goalCount > 0
      ? `${goalCount} client(s) with goals`
      : "No client goals set — ROAS/CPA targets need defaults",
    status: goalCount > 0 ? "pass" : "warning",
    required: false,
    actionHref: goalCount === 0 && clientCount > 0 ? "/clients" : undefined,
    actionLabel: goalCount === 0 && clientCount > 0 ? "Configure Goals" : undefined,
  });

  // ── Governance ──────────────────────────────────────────────────────────

  checks.push({
    id: "governance_configured",
    category: "governance_defaults",
    label: "Automation & governance configured",
    description: autoExecCount > 0
      ? `${autoExecCount} client(s) with automation settings`
      : "No automation settings configured (optional for go-live)",
    status: autoExecCount > 0 ? "pass" : "skipped",
    required: false,
    actionHref: autoExecCount === 0 ? "/automation/auto-execution" : undefined,
    actionLabel: autoExecCount === 0 ? "Configure Automation" : undefined,
  });

  return checks;
}

// ── Blocker detection ─────────────────────────────────────────────────────────

export function detectAccountReadinessBlockers(
  checks: AccountReadinessCheck[],
): AccountReadinessBlocker[] {
  return checks
    .filter((c) => c.required && c.status === "fail")
    .map((c) => ({
      id: c.id,
      category: c.category,
      message: `${c.label}: ${c.description}`,
      severity: "critical" as const,
      actionLabel: c.actionLabel ?? "Fix",
      actionHref: c.actionHref ?? "/onboarding",
    }));
}

// ── Go-live status ────────────────────────────────────────────────────────────

export function computeGoLiveStatus(checks: AccountReadinessCheck[]): GoLiveStatus {
  const required = checks.filter((c) => c.required);
  const optional = checks.filter((c) => !c.required);

  const requiredPass = required.filter((c) => c.status === "pass").length;
  const optionalPass = optional.filter((c) => c.status === "pass").length;
  const hasBlockers = required.some((c) => c.status === "fail");
  const hasWarnings = required.some((c) => c.status === "warning");

  let state: ReadinessState;
  if (requiredPass === 0) state = "not_started";
  else if (hasBlockers) state = "blocked";
  else if (hasWarnings) state = "needs_review";
  else state = "ready_for_go_live";

  const readyToOperate = !hasBlockers;

  let message: string;
  switch (state) {
    case "not_started": message = "Account setup has not started. Complete onboarding to begin."; break;
    case "blocked": message = `${required.length - requiredPass} required item(s) need attention before go-live.`; break;
    case "needs_review": message = "Required items pass but some have warnings. Review before going live."; break;
    case "ready_for_go_live": message = "All required checks pass. Your account is ready to operate."; break;
    default: message = "Evaluating readiness...";
  }

  return {
    state,
    readyToOperate,
    requiredPassCount: requiredPass,
    requiredTotalCount: required.length,
    optionalPassCount: optionalPass,
    optionalTotalCount: optional.length,
    message,
  };
}

// ── Recommendations ───────────────────────────────────────────────────────────

export function buildGoLiveRecommendations(
  checks: AccountReadinessCheck[],
  blockers: AccountReadinessBlocker[],
): GoLiveRecommendation[] {
  const recs: GoLiveRecommendation[] = [];

  // Required failures first
  for (const b of blockers) {
    recs.push({
      priority: "required",
      label: b.message.split(":")[0],
      description: b.message,
      actionLabel: b.actionLabel,
      actionHref: b.actionHref,
    });
  }

  // Required warnings
  for (const c of checks.filter((c) => c.required && c.status === "warning" && c.actionHref)) {
    recs.push({
      priority: "recommended",
      label: c.label,
      description: c.description,
      actionLabel: c.actionLabel ?? "Fix",
      actionHref: c.actionHref!,
    });
  }

  // Optional incomplete
  for (const c of checks.filter((c) => !c.required && c.status !== "pass" && c.actionHref)) {
    recs.push({
      priority: "optional",
      label: c.label,
      description: c.description,
      actionLabel: c.actionLabel ?? "Configure",
      actionHref: c.actionHref!,
    });
  }

  return recs;
}

// ── Integration readiness ─────────────────────────────────────────────────────

async function evaluateIntegrationReadiness(
  workspaceId: string,
): Promise<IntegrationReadinessState> {
  const [metaConn, metaSync, shopifyConn, shopifySync] = await Promise.all([
    getMetaConnectionState(),
    getMetaSyncSetupState(),
    getShopifyConnectionState(),
    getShopifySyncSetupState(),
  ]);

  const metaSelectedAccounts = await prisma.metaSelectedAdAccount.count({
    where: { connection: { connectionStatus: "active" } },
  });

  return {
    metaConnected: metaConn.status === "connected",
    metaAccountsSelected: metaSelectedAccounts > 0,
    metaSyncHealthy: metaSync.status === "completed",
    shopifyConnected: shopifyConn.status === "connected",
    shopifySyncHealthy: shopifySync.status === "healthy" || shopifySync.status === "partial",
    shopifyHasOrders: shopifySync.totalOrderCount > 0,
  };
}

// ── Configuration readiness ───────────────────────────────────────────────────

async function evaluateConfigurationReadiness(
  workspaceId: string,
): Promise<ConfigurationReadinessState> {
  const [workspace, onboarding, clientCount, goalCount] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { timezone: true },
    }),
    prisma.onboardingState.findUnique({
      where: { workspaceId },
      select: { completedAt: true },
    }),
    prisma.clientAccount.count({ where: { workspaceId } }),
    prisma.clientGoalDefaults.count({ where: { clientAccount: { workspaceId } } }),
  ]);

  const autoExecCount = await prisma.autoExecutionSettings.count({ where: { workspaceId } });

  return {
    timezoneConfigured: !!workspace?.timezone,
    goalsConfigured: goalCount > 0,
    governanceConfigured: autoExecCount > 0,
    clientsExist: clientCount > 0,
    onboardingComplete: !!onboarding?.completedAt,
  };
}
