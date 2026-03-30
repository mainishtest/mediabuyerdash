import { getShopifyConnectionById, getClientShopifyConnection, updateConnectionStatus } from "./db";
import { streamOrdersSince }        from "./api";
import { mapOrder, mapLineItemsForOrder } from "./mappers";
import { createSyncLog, completeSyncLog, getLatestOrderDate, getRecentSyncLogs, upsertOrder, replaceLineItems } from "./syncDb";
import { prisma }                    from "../db";

export interface ShopifySyncSummary {
  status:          "completed" | "partial" | "failed";
  ordersSynced:    number;
  lineItemsSynced: number;
  errors:          string[];
  startedAt:       string;
  completedAt:     string;
}

/**
 * Orchestrate an incremental Shopify order sync for a given connection ID.
 * - Fetches orders since the latest already-synced order (fallback: 30 days).
 * - Streams page-by-page, writing to DB as each page arrives.
 * - Upserts each order (with workspaceId + clientAccountId) and replaces line items.
 * - Writes a ShopifySyncLog audit entry.
 * - Returns a summary for the UI.
 */
export async function runShopifySync(connectionId: string): Promise<ShopifySyncSummary> {
  const startedAt = new Date();

  const connection = await getShopifyConnectionById(connectionId);
  if (!connection) {
    return {
      status:          "failed",
      ordersSynced:    0,
      lineItemsSynced: 0,
      errors:          ["Connection not found"],
      startedAt:       startedAt.toISOString(),
      completedAt:     new Date().toISOString(),
    };
  }

  return _runSync(connection, startedAt);
}

/**
 * Sync orders for the connection mapped to a specific client account.
 * Resolves the connection automatically from the clientAccountId.
 */
export async function runShopifySyncForClient(
  clientAccountId: string
): Promise<ShopifySyncSummary> {
  const startedAt = new Date();

  const connection = await getClientShopifyConnection(clientAccountId);
  if (!connection) {
    return {
      status:          "failed",
      ordersSynced:    0,
      lineItemsSynced: 0,
      errors:          ["No Shopify store mapped to this client"],
      startedAt:       startedAt.toISOString(),
      completedAt:     new Date().toISOString(),
    };
  }

  return _runSync(connection, startedAt);
}

// ── Internal sync engine ───────────────────────────────────────────────────────

async function _runSync(
  connection: {
    id:               string;
    shopDomain:       string;
    accessToken:      string;
    clientAccountId:  string | null;
    workspaceId?:     string | null;
  },
  startedAt: Date
): Promise<ShopifySyncSummary> {
  const syncLog = await createSyncLog(connection.id);
  const counts  = { ordersSynced: 0, lineItemsSynced: 0 };
  const errors: string[] = [];

  // Incremental window: start from 1 day before the latest order so we
  // catch any late-arriving updates, falling back to 30 days on first sync.
  const latestOrderDate = await getLatestOrderDate(connection.id);
  const since = latestOrderDate
    ? new Date(latestOrderDate.getTime() - 24 * 60 * 60 * 1000)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  let isAuthError = false;

  try {
    await streamOrdersSince(
      connection.shopDomain,
      connection.accessToken,
      since,
      async (pageOrders) => {
        for (const rawOrder of pageOrders) {
          try {
            const mapped = mapOrder(
              rawOrder,
              connection.id,
              connection.clientAccountId ?? null,
              connection.workspaceId     ?? null
            );
            const saved = await upsertOrder(mapped);

            const lineItems = mapLineItemsForOrder(rawOrder, saved.id);
            await replaceLineItems(saved.id, lineItems);

            counts.ordersSynced   += 1;
            counts.lineItemsSynced += lineItems.length;
          } catch (err) {
            errors.push(
              `Order ${rawOrder.id}: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Order fetch failed: ${msg}`);

    // Detect auth/token errors — only mark connection as error for definitive auth failures
    // Match "HTTP 401" or "HTTP 403" at the start of Shopify error messages, not substring matches
    if (/Shopify GraphQL HTTP (401|403)/i.test(msg) || /\b(unauthorized|forbidden)\b/i.test(msg)) {
      isAuthError = true;
    }
  }

  await completeSyncLog(syncLog.id, counts, errors);

  // Update connection health status
  // Only mark as error for definitive auth failures, not transient errors
  if (isAuthError) {
    // Try to auto-refresh the token if client credentials are stored
    const fullConn = await prisma.shopifyConnection.findUnique({
      where: { id: connection.id },
      select: { clientId: true, clientSecret: true, shopDomain: true },
    }).catch(() => null);

    if (fullConn?.clientId && fullConn?.clientSecret) {
      const refreshed = await refreshShopifyToken(
        fullConn.shopDomain,
        fullConn.clientId,
        fullConn.clientSecret,
        connection.id,
      );
      if (refreshed) {
        // Token refreshed — don't mark as error, next sync will use new token
        errors.push("Token expired — auto-refreshed. Next sync will use the new token.");
      } else {
        // Refresh failed — check consecutive failures before marking error
        const recentLogs = await getRecentSyncLogs(connection.id, 3).catch(() => []);
        const recentFailures = recentLogs.filter((l) => l.status === "failed").length;
        if (recentFailures >= 2) {
          await updateConnectionStatus(connection.id, "error").catch(() => {});
        }
      }
    } else {
      // No client credentials stored — check consecutive failures
      const recentLogs = await getRecentSyncLogs(connection.id, 3).catch(() => []);
      const recentFailures = recentLogs.filter((l) => l.status === "failed").length;
      if (recentFailures >= 2) {
        await updateConnectionStatus(connection.id, "error").catch(() => {});
      }
    }
  } else if (counts.ordersSynced > 0 || errors.length === 0) {
    // Successful sync — ensure status is active (repairs previously errored connections)
    await updateConnectionStatus(connection.id, "active").catch(() => {});
  }

  return {
    status:
      errors.length === 0         ? "completed"
      : counts.ordersSynced > 0   ? "partial"
      : "failed",
    ordersSynced:    counts.ordersSynced,
    lineItemsSynced: counts.lineItemsSynced,
    errors,
    startedAt:       startedAt.toISOString(),
    completedAt:     new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Auto-refresh Shopify client credentials token
// ---------------------------------------------------------------------------

async function refreshShopifyToken(
  shopDomain: string,
  clientId: string,
  clientSecret: string,
  connectionId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store",
    });

    if (!res.ok) return false;

    const data = await res.json() as { access_token?: string };
    if (!data.access_token) return false;

    // Update the stored token
    await prisma.shopifyConnection.update({
      where: { id: connectionId },
      data:  { accessToken: data.access_token, connectionStatus: "active" },
    });

    console.log(`[shopify-sync] Auto-refreshed token for ${shopDomain}`);
    return true;
  } catch {
    return false;
  }
}
