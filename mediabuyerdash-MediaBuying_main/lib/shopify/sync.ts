import { getShopifyConnectionById, getClientShopifyConnection } from "./db";
import { streamOrdersSince }        from "./api";
import { mapOrder, mapLineItemsForOrder } from "./mappers";
import { createSyncLog, completeSyncLog, getLatestOrderDate, upsertOrder, replaceLineItems } from "./syncDb";

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
    errors.push(
      `Order fetch failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  await completeSyncLog(syncLog.id, counts, errors);

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
