// lib/shopify/types.ts
// Typed state models for Shopify store connection and revenue sync setup flow.
// Client-safe — no server imports.

// ── Connection states ─────────────────────────────────────────────────────────

export type ShopifyConnectionStatus =
  | "not_connected"
  | "connecting"
  | "connected"
  | "setup_incomplete"
  | "sync_initializing"
  | "syncing"
  | "sync_error"
  | "disconnected";

// ── Revenue sync states ───────────────────────────────────────────────────────

export type ShopifyRevenueSyncState =
  | "not_started"
  | "initializing"
  | "healthy"
  | "partial"
  | "stale"
  | "failed";

// ── ShopifyConnectionState ────────────────────────────────────────────────────

export type ShopifyConnectionState = {
  status: ShopifyConnectionStatus;
  connectionId: string | null;
  shopDomain: string | null;
  connectionStatusRaw: string | null; // DB value: "active" | "disconnected" | "error"
  connectedAt: string | null;
  scopes: string | null;
};

// ── ShopifyStoreIdentity ──────────────────────────────────────────────────────

export type ShopifyStoreIdentity = {
  shopDomain: string;
  connectionStatus: string;
  installedAt: string;
  scopes: string | null;
  clientAccountId: string | null;
  clientAccountName: string | null;
};

// ── ShopifyConnectedStore ─────────────────────────────────────────────────────

export type ShopifyConnectedStore = {
  id: string;
  shopDomain: string;
  connectionStatus: string;
  scopes: string | null;
  installedAt: string;
  clientAccountId: string | null;
  clientAccountName: string | null;
  workspaceId: string | null;
};

// ── ShopifySyncSetupState ─────────────────────────────────────────────────────

export type ShopifySyncSetupState = {
  status: ShopifyRevenueSyncState;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  ordersSynced: number;
  lineItemsSynced: number;
  totalOrderCount: number;
  errorMessage: string | null;
};

// ── ShopifyRevenueSyncStatus ──────────────────────────────────────────────────

export type ShopifyRevenueSyncStatus = {
  state: ShopifyRevenueSyncState;
  orderCount: number;
  lastSyncAt: string | null;
  staleSinceHours: number | null; // null if not stale
  message: string;
};

// ── ShopifyIntegrationError ───────────────────────────────────────────────────

export type ShopifyIntegrationError = {
  code: string;
  message: string;
  recoveryAction: string;
  recoveryHref: string;
  severity: "error" | "warning" | "info";
};

// ── ShopifyIntegrationSummary ─────────────────────────────────────────────────

export type ShopifyIntegrationSummary = {
  connectionState: ShopifyConnectionState;
  syncSetupState: ShopifySyncSetupState;
  revenueSyncStatus: ShopifyRevenueSyncStatus;
  errors: ShopifyIntegrationError[];
  overallStatus: ShopifyConnectionStatus;
  isReady: boolean;
};

// ── ShopifyReconnectState ─────────────────────────────────────────────────────

export type ShopifyReconnectState = {
  needsReconnect: boolean;
  reason: "token_invalid" | "connection_error" | "user_disconnected" | null;
  message: string | null;
  previousShopDomain: string | null;
};

// ── ShopifySetupChecklistItem ─────────────────────────────────────────────────

export type ShopifySetupChecklistItem = {
  id: string;
  label: string;
  description: string;
  done: boolean;
  actionLabel?: string;
  actionHref?: string;
  severity?: "error" | "warning" | "info";
};

// ── ShopifyDataHealthState ────────────────────────────────────────────────────

export type ShopifyDataHealthState = {
  hasOrders: boolean;
  hasRecentOrders: boolean; // orders within last 7 days
  hasFacebookAttributedRevenue: boolean;
  orderCount: number;
  facebookRevenue: number;
  message: string;
};
