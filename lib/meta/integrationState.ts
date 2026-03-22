// lib/meta/integrationState.ts
// Server-side utility functions for Meta integration state management.
// Builds typed state models from raw DB records. Reuses existing DB/validation logic.

import { prisma } from "../db";
import { getMetaConnection, getConnectionForSync } from "./db";
import { isMetaConfigured } from "./config";
import { runMetaSync } from "./sync";
import type {
  MetaConnectionState,
  MetaPermissionStatus,
  MetaSyncSetupState,
  MetaIntegrationSummary,
  MetaIntegrationError,
  MetaReconnectState,
  MetaSetupChecklistItem,
  MetaConnectionStatus,
  MetaPermissionState,
} from "./types";
import { REQUIRED_META_SCOPES } from "./types";

// ── Permission validation ─────────────────────────────────────────────────────

export function validateMetaPermissions(grantedScopesStr: string | null): MetaPermissionStatus {
  if (!grantedScopesStr) {
    return {
      state: "unknown",
      grantedScopes: [],
      requiredScopes: [...REQUIRED_META_SCOPES],
      missingScopes: [...REQUIRED_META_SCOPES],
      message: "Permission information is not available.",
    };
  }

  const granted = grantedScopesStr.split(",").map((s) => s.trim());
  const missing = REQUIRED_META_SCOPES.filter((s) => !granted.includes(s));

  let state: MetaPermissionState;
  let message: string;

  if (missing.length === 0) {
    state = "valid";
    message = "All required permissions are granted.";
  } else if (missing.length < REQUIRED_META_SCOPES.length) {
    state = "partially_valid";
    message = `Missing permissions: ${missing.join(", ")}. Reconnect and grant all required permissions.`;
  } else {
    state = "missing_required_permissions";
    message = "No required permissions are granted. Please reconnect your Meta account.";
  }

  return {
    state,
    grantedScopes: granted,
    requiredScopes: [...REQUIRED_META_SCOPES],
    missingScopes: [...missing],
    message,
  };
}

// ── Connection state ──────────────────────────────────────────────────────────

export async function getMetaConnectionState(): Promise<MetaConnectionState> {
  const conn = await getMetaConnection().catch(() => null);

  if (!conn) {
    return {
      status: "not_connected",
      connectionId: null,
      metaUserId: null,
      userDisplayName: null,
      tokenExpiresAt: null,
      isTokenExpired: false,
      connectedAt: null,
    };
  }

  const isTokenExpired = conn.tokenExpiresAt ? conn.tokenExpiresAt < new Date() : false;

  return {
    status: isTokenExpired ? "disconnected" : conn.connectionStatus === "active" ? "connected" : "disconnected",
    connectionId: conn.id,
    metaUserId: conn.metaUserId,
    userDisplayName: conn.userDisplayName,
    tokenExpiresAt: conn.tokenExpiresAt?.toISOString() ?? null,
    isTokenExpired,
    connectedAt: conn.createdAt.toISOString(),
  };
}

// ── Sync setup state ──────────────────────────────────────────────────────────

export async function getMetaSyncSetupState(): Promise<MetaSyncSetupState> {
  const conn = await getMetaConnection().catch(() => null);
  if (!conn) {
    return {
      status: "not_started",
      lastSyncAt: null,
      lastSyncStatus: null,
      accountsProcessed: 0,
      campaignsSynced: 0,
      errorMessage: null,
    };
  }

  const lastSync = await prisma.metaSyncLog.findFirst({
    where: { metaConnectionId: conn.id },
    orderBy: { startedAt: "desc" },
  });

  if (!lastSync) {
    return {
      status: "ready",
      lastSyncAt: null,
      lastSyncStatus: null,
      accountsProcessed: 0,
      campaignsSynced: 0,
      errorMessage: null,
    };
  }

  const status = lastSync.status === "completed" || lastSync.status === "partial"
    ? "completed"
    : lastSync.status === "failed"
    ? "failed"
    : "syncing";

  return {
    status,
    lastSyncAt: lastSync.completedAt?.toISOString() ?? lastSync.startedAt.toISOString(),
    lastSyncStatus: lastSync.status,
    accountsProcessed: lastSync.accountsProcessed,
    campaignsSynced: lastSync.campaignsSynced,
    errorMessage: lastSync.errorMessages,
  };
}

// ── Reconnect state ───────────────────────────────────────────────────────────

export async function getMetaReconnectState(): Promise<MetaReconnectState> {
  const conn = await getMetaConnection().catch(() => null);

  if (!conn) {
    return { needsReconnect: false, reason: null, message: null, previousUserDisplayName: null };
  }

  if (conn.tokenExpiresAt && conn.tokenExpiresAt < new Date()) {
    return {
      needsReconnect: true,
      reason: "token_expired",
      message: "Your Meta access token has expired. Reconnect to resume syncing.",
      previousUserDisplayName: conn.userDisplayName,
    };
  }

  if (conn.connectionStatus !== "active") {
    return {
      needsReconnect: true,
      reason: "user_disconnected",
      message: "Your Meta connection is inactive. Reconnect to resume syncing.",
      previousUserDisplayName: conn.userDisplayName,
    };
  }

  const permissions = validateMetaPermissions(conn.scopes ?? null);
  if (permissions.state !== "valid") {
    return {
      needsReconnect: true,
      reason: "permissions_changed",
      message: permissions.message,
      previousUserDisplayName: conn.userDisplayName,
    };
  }

  return { needsReconnect: false, reason: null, message: null, previousUserDisplayName: null };
}

// ── Integration summary ───────────────────────────────────────────────────────

export async function summarizeMetaIntegrationState(): Promise<MetaIntegrationSummary> {
  const [connectionState, syncState, reconnectState] = await Promise.all([
    getMetaConnectionState(),
    getMetaSyncSetupState(),
    getMetaReconnectState(),
  ]);

  const conn = await getMetaConnection().catch(() => null);
  const permissionStatus = validateMetaPermissions(conn?.scopes ?? null);

  const selectedCount = conn?.accessibleAccounts?.filter((a) => a.selectedAccount !== null).length ?? 0;
  const accessibleCount = conn?.accessibleAccounts?.length ?? 0;

  const errors: MetaIntegrationError[] = [];

  if (reconnectState.needsReconnect) {
    errors.push({
      code: "needs_reconnect",
      message: reconnectState.message ?? "Meta needs to be reconnected.",
      recoveryAction: "Reconnect Meta",
      recoveryHref: "/integrations/meta",
      severity: "error",
    });
  }

  if (connectionState.status === "connected" && accessibleCount === 0) {
    errors.push({
      code: "no_accounts",
      message: "Connected but no ad accounts found. Try refreshing accounts.",
      recoveryAction: "Refresh Accounts",
      recoveryHref: "/integrations/meta",
      severity: "error",
    });
  }

  if (connectionState.status === "connected" && accessibleCount > 0 && selectedCount === 0) {
    errors.push({
      code: "no_selection",
      message: "Ad accounts available but none selected. Select accounts to start syncing.",
      recoveryAction: "Select Accounts",
      recoveryHref: "/integrations/meta",
      severity: "warning",
    });
  }

  if (permissionStatus.state !== "valid" && permissionStatus.state !== "unknown") {
    errors.push({
      code: "permissions_incomplete",
      message: permissionStatus.message,
      recoveryAction: "Reconnect Meta",
      recoveryHref: "/integrations/meta",
      severity: "error",
    });
  }

  if (syncState.status === "failed") {
    errors.push({
      code: "sync_failed",
      message: syncState.errorMessage ?? "Last sync failed.",
      recoveryAction: "Retry Sync",
      recoveryHref: "/integrations/meta/sync",
      severity: "error",
    });
  }

  // Compute overall status
  let overallStatus: MetaConnectionStatus = connectionState.status;
  if (connectionState.status === "connected") {
    if (selectedCount === 0) overallStatus = "account_selection_required";
    else if (permissionStatus.state !== "valid" && permissionStatus.state !== "unknown") overallStatus = "permissions_incomplete";
    else if (syncState.status === "failed") overallStatus = "sync_error";
    else if (syncState.status === "syncing" || syncState.status === "initializing") overallStatus = "syncing";
  }

  const isReady = connectionState.status === "connected"
    && selectedCount > 0
    && (permissionStatus.state === "valid" || permissionStatus.state === "unknown")
    && syncState.status !== "failed";

  return {
    connectionState,
    permissionStatus,
    syncSetupState: syncState,
    selectedAccountCount: selectedCount,
    accessibleAccountCount: accessibleCount,
    errors,
    overallStatus,
    isReady,
  };
}

// ── Setup checklist ───────────────────────────────────────────────────────────

export async function buildMetaSetupChecklist(): Promise<MetaSetupChecklistItem[]> {
  const summary = await summarizeMetaIntegrationState();

  return [
    {
      id: "meta_configured",
      label: "Meta credentials configured",
      description: "META_APP_ID and META_APP_SECRET set in environment",
      done: isMetaConfigured(),
    },
    {
      id: "meta_connected",
      label: "Meta account connected",
      description: "OAuth completed and access token stored",
      done: summary.connectionState.status === "connected",
      actionLabel: summary.connectionState.status === "connected" ? undefined : "Connect Meta",
      actionHref: summary.connectionState.status === "connected" ? undefined : "/integrations/meta",
    },
    {
      id: "permissions_valid",
      label: "Permissions verified",
      description: "ads_read and business_management scopes granted",
      done: summary.permissionStatus.state === "valid",
      severity: summary.permissionStatus.state === "missing_required_permissions" ? "error" : undefined,
    },
    {
      id: "accounts_selected",
      label: "Ad accounts selected",
      description: `${summary.selectedAccountCount} of ${summary.accessibleAccountCount} accounts selected`,
      done: summary.selectedAccountCount > 0,
      actionLabel: summary.selectedAccountCount === 0 && summary.accessibleAccountCount > 0 ? "Select Accounts" : undefined,
      actionHref: summary.selectedAccountCount === 0 ? "/integrations/meta" : undefined,
    },
    {
      id: "sync_completed",
      label: "Initial sync completed",
      description: summary.syncSetupState.lastSyncAt
        ? `Last sync: ${new Date(summary.syncSetupState.lastSyncAt).toLocaleString()}`
        : "No sync has run yet",
      done: summary.syncSetupState.status === "completed",
      actionLabel: summary.syncSetupState.status === "failed" ? "Retry Sync" : undefined,
      actionHref: summary.syncSetupState.status === "failed" ? "/integrations/meta/sync" : undefined,
      severity: summary.syncSetupState.status === "failed" ? "error" : undefined,
    },
  ];
}

// ── Sync initialization ───────────────────────────────────────────────────────

/** Trigger initial sync after account selection. Returns sync summary or error. */
export async function initializeMetaSyncSetup(
  workspaceId: string | null = null,
): Promise<{ success: boolean; message: string }> {
  const conn = await getConnectionForSync();
  if (!conn) {
    return { success: false, message: "No Meta connection found." };
  }

  const selected = conn.selectedAccounts;
  if (selected.length === 0) {
    return { success: false, message: "No ad accounts selected. Select accounts first." };
  }

  try {
    const result = await runMetaSync(workspaceId);
    if (result.status === "completed") {
      return { success: true, message: `Sync completed: ${result.campaignsSynced} campaigns synced.` };
    }
    if (result.status === "partial") {
      return { success: true, message: `Sync partially completed with ${result.errors.length} error(s).` };
    }
    return { success: false, message: result.errors.join("; ") || "Sync failed." };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Sync failed unexpectedly." };
  }
}
