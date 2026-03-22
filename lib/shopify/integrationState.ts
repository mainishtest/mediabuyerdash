// lib/shopify/integrationState.ts
// Server-side utilities for Shopify integration state, sync health, and checklist.
// Reuses existing DB/sync logic — no duplication.

import { prisma } from "../db";
import { getLatestShopifyConnection } from "./db";
import { getLatestSyncLog, getOrderSummary } from "./syncDb";
import { isShopifyConfigured } from "./config";
import { runShopifySync } from "./sync";
import type {
  ShopifyConnectionState,
  ShopifySyncSetupState,
  ShopifyRevenueSyncStatus,
  ShopifyIntegrationSummary,
  ShopifyIntegrationError,
  ShopifyReconnectState,
  ShopifySetupChecklistItem,
  ShopifyDataHealthState,
  ShopifyConnectionStatus,
  ShopifyRevenueSyncState,
} from "./types";

const STALE_HOURS = 48;

// ── Connection state ──────────────────────────────────────────────────────────

export async function getShopifyConnectionState(): Promise<ShopifyConnectionState> {
  const conn = await getLatestShopifyConnection().catch(() => null);

  if (!conn) {
    return {
      status: "not_connected",
      connectionId: null,
      shopDomain: null,
      connectionStatusRaw: null,
      connectedAt: null,
      scopes: null,
    };
  }

  const status: ShopifyConnectionStatus =
    conn.connectionStatus === "active" ? "connected" : "disconnected";

  return {
    status,
    connectionId: conn.id,
    shopDomain: conn.shopDomain,
    connectionStatusRaw: conn.connectionStatus,
    connectedAt: conn.createdAt.toISOString(),
    scopes: conn.scopes,
  };
}

// ── Sync setup state ──────────────────────────────────────────────────────────

export async function getShopifySyncSetupState(): Promise<ShopifySyncSetupState> {
  const conn = await getLatestShopifyConnection().catch(() => null);
  if (!conn) {
    return {
      status: "not_started",
      lastSyncAt: null,
      lastSyncStatus: null,
      ordersSynced: 0,
      lineItemsSynced: 0,
      totalOrderCount: 0,
      errorMessage: null,
    };
  }

  const [syncLog, summary] = await Promise.all([
    getLatestSyncLog(conn.id).catch(() => null),
    getOrderSummary(conn.id).catch(() => null),
  ]);

  if (!syncLog) {
    return {
      status: "not_started",
      lastSyncAt: null,
      lastSyncStatus: null,
      ordersSynced: 0,
      lineItemsSynced: 0,
      totalOrderCount: summary?.orderCount ?? 0,
      errorMessage: null,
    };
  }

  let status: ShopifyRevenueSyncState;
  if (syncLog.status === "failed") {
    status = "failed";
  } else if (syncLog.status === "partial") {
    status = "partial";
  } else if (syncLog.completedAt) {
    const hoursSince = (Date.now() - syncLog.completedAt.getTime()) / (1000 * 60 * 60);
    status = hoursSince > STALE_HOURS ? "stale" : "healthy";
  } else {
    status = "initializing";
  }

  return {
    status,
    lastSyncAt: syncLog.completedAt?.toISOString() ?? syncLog.startedAt.toISOString(),
    lastSyncStatus: syncLog.status,
    ordersSynced: syncLog.ordersSynced,
    lineItemsSynced: syncLog.lineItemsSynced,
    totalOrderCount: summary?.orderCount ?? 0,
    errorMessage: syncLog.errorMessages,
  };
}

// ── Revenue sync status ───────────────────────────────────────────────────────

export async function evaluateShopifySyncHealth(): Promise<ShopifyRevenueSyncStatus> {
  const syncState = await getShopifySyncSetupState();

  let staleSinceHours: number | null = null;
  if (syncState.lastSyncAt) {
    const hours = (Date.now() - new Date(syncState.lastSyncAt).getTime()) / (1000 * 60 * 60);
    if (hours > STALE_HOURS) staleSinceHours = Math.round(hours);
  }

  const messages: Record<ShopifyRevenueSyncState, string> = {
    not_started: "No sync has been run yet. Run a sync to import order data.",
    initializing: "Sync is in progress.",
    healthy: `Sync is healthy. ${syncState.totalOrderCount} orders in database.`,
    partial: "Last sync completed with some errors. Check sync logs.",
    stale: `Last sync was ${staleSinceHours ?? "?"}+ hours ago. Revenue data may be outdated.`,
    failed: "Last sync failed. Check configuration and retry.",
  };

  return {
    state: syncState.status,
    orderCount: syncState.totalOrderCount,
    lastSyncAt: syncState.lastSyncAt,
    staleSinceHours,
    message: messages[syncState.status],
  };
}

// ── Reconnect state ───────────────────────────────────────────────────────────

export async function getShopifyReconnectState(): Promise<ShopifyReconnectState> {
  const conn = await getLatestShopifyConnection().catch(() => null);

  if (!conn) {
    return { needsReconnect: false, reason: null, message: null, previousShopDomain: null };
  }

  if (conn.connectionStatus !== "active") {
    return {
      needsReconnect: true,
      reason: "connection_error",
      message: `Connection to ${conn.shopDomain} is inactive. Reconnect to resume syncing.`,
      previousShopDomain: conn.shopDomain,
    };
  }

  return { needsReconnect: false, reason: null, message: null, previousShopDomain: null };
}

// ── Data health ───────────────────────────────────────────────────────────────

export async function getShopifyDataHealth(connectionId: string): Promise<ShopifyDataHealthState> {
  const [orderCount, fbRevAgg, recentCount] = await Promise.all([
    prisma.shopifyOrder.count({ where: { shopifyConnectionId: connectionId } }),
    prisma.shopifyOrder.aggregate({
      where: {
        shopifyConnectionId: connectionId,
        utmSource: { equals: "facebook", mode: "insensitive" },
      },
      _sum: { totalPrice: true },
    }),
    prisma.shopifyOrder.count({
      where: {
        shopifyConnectionId: connectionId,
        orderCreatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const fbRevenue = fbRevAgg._sum.totalPrice ?? 0;
  const hasOrders = orderCount > 0;
  const hasRecent = recentCount > 0;
  const hasFb = fbRevenue > 0;

  let message = "No order data yet.";
  if (hasOrders && hasFb) message = `${orderCount} orders synced, $${fbRevenue.toFixed(2)} Facebook-attributed revenue.`;
  else if (hasOrders) message = `${orderCount} orders synced. No Facebook-attributed revenue detected yet.`;

  return {
    hasOrders,
    hasRecentOrders: hasRecent,
    hasFacebookAttributedRevenue: hasFb,
    orderCount,
    facebookRevenue: fbRevenue,
    message,
  };
}

// ── Integration summary ───────────────────────────────────────────────────────

export async function summarizeShopifyIntegrationState(): Promise<ShopifyIntegrationSummary> {
  const [connectionState, syncState, reconnectState] = await Promise.all([
    getShopifyConnectionState(),
    getShopifySyncSetupState(),
    getShopifyReconnectState(),
  ]);

  const revenueSyncStatus = await evaluateShopifySyncHealth();
  const errors: ShopifyIntegrationError[] = [];

  if (reconnectState.needsReconnect) {
    errors.push({
      code: "needs_reconnect",
      message: reconnectState.message ?? "Shopify needs to be reconnected.",
      recoveryAction: "Reconnect Shopify",
      recoveryHref: "/integrations/shopify",
      severity: "error",
    });
  }

  if (connectionState.status === "connected" && syncState.status === "not_started") {
    errors.push({
      code: "sync_not_started",
      message: "Store connected but no sync has been run. Run a sync to import orders.",
      recoveryAction: "Run Sync",
      recoveryHref: "/integrations/shopify/sync",
      severity: "warning",
    });
  }

  if (syncState.status === "failed") {
    errors.push({
      code: "sync_failed",
      message: syncState.errorMessage ?? "Last sync failed.",
      recoveryAction: "Retry Sync",
      recoveryHref: "/integrations/shopify/sync",
      severity: "error",
    });
  }

  if (syncState.status === "stale") {
    errors.push({
      code: "sync_stale",
      message: revenueSyncStatus.message,
      recoveryAction: "Run Sync",
      recoveryHref: "/integrations/shopify/sync",
      severity: "warning",
    });
  }

  let overallStatus: ShopifyConnectionStatus = connectionState.status;
  if (connectionState.status === "connected") {
    if (syncState.status === "failed") overallStatus = "sync_error";
    else if (syncState.status === "not_started") overallStatus = "setup_incomplete";
  }

  const isReady = connectionState.status === "connected"
    && (syncState.status === "healthy" || syncState.status === "partial");

  return {
    connectionState,
    syncSetupState: syncState,
    revenueSyncStatus,
    errors,
    overallStatus,
    isReady,
  };
}

// ── Setup checklist ───────────────────────────────────────────────────────────

export async function buildShopifySetupChecklist(): Promise<ShopifySetupChecklistItem[]> {
  const summary = await summarizeShopifyIntegrationState();

  return [
    {
      id: "shopify_configured",
      label: "Shopify credentials configured",
      description: "SHOPIFY_APP_KEY and SHOPIFY_APP_SECRET set, or client credentials available",
      done: isShopifyConfigured() || summary.connectionState.status === "connected",
    },
    {
      id: "shopify_connected",
      label: "Shopify store connected",
      description: summary.connectionState.shopDomain
        ? `Connected: ${summary.connectionState.shopDomain}`
        : "No store connected",
      done: summary.connectionState.status === "connected",
      actionLabel: summary.connectionState.status === "connected" ? undefined : "Connect Shopify",
      actionHref: summary.connectionState.status === "connected" ? undefined : "/integrations/shopify",
    },
    {
      id: "sync_completed",
      label: "Order sync completed",
      description: summary.syncSetupState.lastSyncAt
        ? `${summary.syncSetupState.totalOrderCount} orders, last sync: ${new Date(summary.syncSetupState.lastSyncAt).toLocaleString()}`
        : "No sync has run yet",
      done: summary.syncSetupState.status === "healthy" || summary.syncSetupState.status === "partial",
      actionLabel: summary.syncSetupState.status === "failed" ? "Retry Sync" : undefined,
      actionHref: summary.syncSetupState.status === "failed" ? "/integrations/shopify/sync" : undefined,
      severity: summary.syncSetupState.status === "failed" ? "error" : undefined,
    },
    {
      id: "revenue_healthy",
      label: "Revenue data healthy",
      description: summary.revenueSyncStatus.message,
      done: summary.revenueSyncStatus.state === "healthy",
      severity: summary.revenueSyncStatus.state === "stale" ? "warning" : undefined,
    },
  ];
}

// ── Sync initialization ───────────────────────────────────────────────────────

export async function initializeShopifyRevenueSync(): Promise<{ success: boolean; message: string }> {
  const conn = await getLatestShopifyConnection().catch(() => null);
  if (!conn) {
    return { success: false, message: "No Shopify connection found." };
  }

  try {
    const result = await runShopifySync(conn.id);
    if (result.status === "completed") {
      return { success: true, message: `Sync completed: ${result.ordersSynced} orders synced.` };
    }
    if (result.status === "partial") {
      return { success: true, message: `Sync partially completed with ${result.errors.length} error(s).` };
    }
    return { success: false, message: result.errors.join("; ") || "Sync failed." };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Sync failed unexpectedly." };
  }
}
