// lib/meta/types.ts
// Typed state models for the Meta ad account connection and sync setup flow.
// Client-safe — no server imports. Used by UI components and onboarding.

// ── Connection states ─────────────────────────────────────────────────────────

export type MetaConnectionStatus =
  | "not_connected"
  | "connecting"
  | "connected"
  | "account_selection_required"
  | "permissions_incomplete"
  | "sync_initializing"
  | "syncing"
  | "sync_error"
  | "disconnected";

// ── Permission states ─────────────────────────────────────────────────────────

export type MetaPermissionState =
  | "valid"
  | "missing_required_permissions"
  | "partially_valid"
  | "unknown";

export const REQUIRED_META_SCOPES = ["ads_read", "business_management"] as const;

// ── MetaConnectionState ───────────────────────────────────────────────────────

export type MetaConnectionState = {
  status: MetaConnectionStatus;
  connectionId: string | null;
  metaUserId: string | null;
  userDisplayName: string | null;
  tokenExpiresAt: string | null;
  isTokenExpired: boolean;
  connectedAt: string | null;
};

// ── MetaOAuthSession ──────────────────────────────────────────────────────────

export type MetaOAuthSession = {
  state: string;
  redirectUrl: string;
  initiatedAt: string;
  expiresAt: string;
};

// ── MetaAdAccountOption ───────────────────────────────────────────────────────

export type MetaAdAccountOption = {
  id: string;
  externalAdAccountId: string;
  accountName: string;
  accountStatus: number;
  accountStatusLabel: string;
  currency: string;
  timezoneName: string;
  isSelected: boolean;
  clientAccountId: string | null;
};

// ── MetaConnectedAdAccount ────────────────────────────────────────────────────

export type MetaConnectedAdAccount = {
  id: string;
  externalAdAccountId: string;
  accountName: string;
  currency: string;
  timezoneName: string;
  clientAccountId: string | null;
  clientAccountName: string | null;
};

// ── MetaPermissionStatus ──────────────────────────────────────────────────────

export type MetaPermissionStatus = {
  state: MetaPermissionState;
  grantedScopes: string[];
  requiredScopes: string[];
  missingScopes: string[];
  message: string;
};

// ── MetaSyncSetupState ────────────────────────────────────────────────────────

export type MetaSyncSetupState = {
  status: "not_started" | "initializing" | "ready" | "syncing" | "completed" | "failed";
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  accountsProcessed: number;
  campaignsSynced: number;
  errorMessage: string | null;
};

// ── MetaIntegrationError ──────────────────────────────────────────────────────

export type MetaIntegrationError = {
  code: string;
  message: string;
  recoveryAction: string;
  recoveryHref: string;
  severity: "error" | "warning" | "info";
};

// ── MetaIntegrationSummary ────────────────────────────────────────────────────

export type MetaIntegrationSummary = {
  connectionState: MetaConnectionState;
  permissionStatus: MetaPermissionStatus;
  syncSetupState: MetaSyncSetupState;
  selectedAccountCount: number;
  accessibleAccountCount: number;
  errors: MetaIntegrationError[];
  overallStatus: MetaConnectionStatus;
  isReady: boolean;
};

// ── MetaReconnectState ────────────────────────────────────────────────────────

export type MetaReconnectState = {
  needsReconnect: boolean;
  reason: "token_expired" | "token_revoked" | "permissions_changed" | "user_disconnected" | null;
  message: string | null;
  previousUserDisplayName: string | null;
};

// ── MetaSetupChecklistItem ────────────────────────────────────────────────────

export type MetaSetupChecklistItem = {
  id: string;
  label: string;
  description: string;
  done: boolean;
  actionLabel?: string;
  actionHref?: string;
  severity?: "error" | "warning" | "info";
};
