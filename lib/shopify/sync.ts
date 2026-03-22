import { prisma } from "../db";
import { getShopifyConnectionById, getClientShopifyConnection } from "./db";
import { streamOrdersSince }        from "./api";
import { mapOrder, mapLineItemsForOrder, mapRefundsForOrder } from "./mappers";
import { createSyncLog, completeSyncLog, getLatestOrderDate, upsertOrder, replaceLineItems, upsertRefunds } from "./syncDb";

export type ShopifySyncMode = "incremental" | "backfill";

export interface ShopifySyncSummary {
  status:          "completed" | "partial" | "failed" | "token_invalid";
  ordersSynced:    number;
  lineItemsSynced: number;
  refundsSynced:   number;
  errors:          string[];
  startedAt:       string;
  completedAt:     string;
  mode:            ShopifySyncMode;
}

/**
 * Orchestrate an incremental Shopify order sync for a given connection ID.
 * - Fetches orders since the latest already-synced order (fallback: 30 days).
 * - Streams page-by-page, writing to DB as each page arrives.
 * - Upserts each order (with workspaceId + clientAccountId) and replaces line items.
 * - Writes a ShopifySyncLog audit entry.
 * - Returns a summary for the UI.
 */
export async function runShopifySync(
  connectionId: string,
  mode: ShopifySyncMode = "incremental"
): Promise<ShopifySyncSummary> {
  const startedAt = new Date();

  const connection = await getShopifyConnectionById(connectionId);
  if (!connection) {
    return emptySummary("failed", ["Connection not found"], startedAt, mode);
  }

  // Validate connection status before syncing
  if (connection.connectionStatus !== "active") {
    return emptySummary("token_invalid", [
      `Connection is ${connection.connectionStatus}. Reconnect Shopify to resume syncing.`,
    ], startedAt, mode);
  }

  return _runSync(connection, startedAt, mode);
}

/**
 * Sync orders for the connection mapped to a specific client account.
 * Resolves the connection automatically from the clientAccountId.
 */
export async function runShopifySyncForClient(
  clientAccountId: string,
  mode: ShopifySyncMode = "incremental"
): Promise<ShopifySyncSummary> {
  const startedAt = new Date();

  const connection = await getClientShopifyConnection(clientAccountId);
  if (!connection) {
    return emptySummary("failed", ["No Shopify store mapped to this client"], startedAt, mode);
  }

  if (connection.connectionStatus !== "active") {
    return emptySummary("token_invalid", [
      `Connection is ${connection.connectionStatus}. Reconnect Shopify to resume syncing.`,
    ], startedAt, mode);
  }

  return _runSync(connection, startedAt, mode);
}

function emptySummary(
  status: ShopifySyncSummary["status"],
  errors: string[],
  startedAt: Date,
  mode: ShopifySyncMode
): ShopifySyncSummary {
  return {
    status,
    ordersSynced: 0,
    lineItemsSynced: 0,
    refundsSynced: 0,
    errors,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    mode,
  };
}

// ── Internal sync engine ───────────────────────────────────────────────────────

// Backfill window: 90 days for initial data load
const BACKFILL_DAYS = 90;
// Incremental fallback: 30 days when no orders exist
const INCREMENTAL_FALLBACK_DAYS = 30;

async function _runSync(
  connection: {
    id:               string;
    shopDomain:       string;
    accessToken:      string;
    clientAccountId:  string | null;
    connectionStatus: string;
    workspaceId?:     string | null;
  },
  startedAt: Date,
  mode: ShopifySyncMode = "incremental"
): Promise<ShopifySyncSummary> {
  const syncLog = await createSyncLog(connection.id);
  const counts  = { ordersSynced: 0, lineItemsSynced: 0, refundsSynced: 0 };
  const errors: string[] = [];
  let hasTokenError = false;

  // Determine sync window based on mode
  let since: Date;
  if (mode === "backfill") {
    since = new Date(Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000);
    console.log(`[Shopify sync] Backfill mode: fetching last ${BACKFILL_DAYS} days`);
  } else {
    // Incremental: start from 1 day before the latest order
    const latestOrderDate = await getLatestOrderDate(connection.id);
    since = latestOrderDate
      ? new Date(latestOrderDate.getTime() - 24 * 60 * 60 * 1000)
      : new Date(Date.now() - INCREMENTAL_FALLBACK_DAYS * 24 * 60 * 60 * 1000);
  }

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

            // Process refunds (upsert, not replace — refunds are append-only)
            const refunds = mapRefundsForOrder(rawOrder);
            if (refunds.length > 0) {
              await upsertRefunds(saved.id, refunds);
              counts.refundsSynced += refunds.length;
            }

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

    // Detect token/auth errors and mark connection
    if (err instanceof Error && (err as Error & { isTokenError?: boolean }).isTokenError) {
      hasTokenError = true;
      await markConnectionInvalid(connection.id);
    }
  }

  await completeSyncLog(syncLog.id, counts, errors);

  let status: ShopifySyncSummary["status"];
  if (hasTokenError) status = "token_invalid";
  else if (errors.length === 0) status = "completed";
  else if (counts.ordersSynced > 0) status = "partial";
  else status = "failed";

  return {
    status,
    ordersSynced:    counts.ordersSynced,
    lineItemsSynced: counts.lineItemsSynced,
    refundsSynced:   counts.refundsSynced,
    errors,
    startedAt:       startedAt.toISOString(),
    completedAt:     new Date().toISOString(),
    mode,
  };
}

/** Mark connection as error state so UI surfaces reconnection prompt. */
async function markConnectionInvalid(connectionId: string): Promise<void> {
  try {
    await prisma.shopifyConnection.update({
      where: { id: connectionId },
      data:  { connectionStatus: "error" },
    });
    console.warn("[Shopify sync] Token invalid, connection marked for reconnection");
  } catch (err) {
    console.error("[Shopify sync] Failed to mark connection as error", err);
  }
}
