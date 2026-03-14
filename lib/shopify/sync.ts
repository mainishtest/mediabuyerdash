import { getShopifyConnectionById } from "./db";
import { fetchRecentOrders }        from "./api";
import { mapOrder, mapLineItemsForOrder } from "./mappers";
import { createSyncLog, completeSyncLog, upsertOrder, replaceLineItems } from "./syncDb";

export interface ShopifySyncSummary {
  status:         "completed" | "partial" | "failed";
  ordersSynced:   number;
  lineItemsSynced: number;
  errors:         string[];
  startedAt:      string;
  completedAt:    string;
}

/**
 * Orchestrate a full read-only Shopify order sync for a given connection.
 * - Fetches the last 30 days of orders via the GraphQL Admin API.
 * - Upserts each order and replaces its line items.
 * - Writes a ShopifySyncLog audit entry.
 * - Returns a summary that the UI can display without hitting the DB again.
 */
export async function runShopifySync(connectionId: string): Promise<ShopifySyncSummary> {
  const startedAt = new Date();

  const connection = await getShopifyConnectionById(connectionId);
  if (!connection) {
    return {
      status:         "failed",
      ordersSynced:   0,
      lineItemsSynced: 0,
      errors:         ["Connection not found"],
      startedAt:      startedAt.toISOString(),
      completedAt:    new Date().toISOString(),
    };
  }

  const syncLog = await createSyncLog(connectionId);
  const counts  = { ordersSynced: 0, lineItemsSynced: 0 };
  const errors: string[] = [];

  try {
    const rawOrders = await fetchRecentOrders(
      connection.shopDomain,
      connection.accessToken,
      30
    );

    for (const rawOrder of rawOrders) {
      try {
        const mapped = mapOrder(rawOrder, connectionId, connection.clientAccountId ?? null);
        const saved  = await upsertOrder(mapped);

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
  } catch (err) {
    errors.push(
      `Order fetch failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  await completeSyncLog(syncLog.id, counts, errors);

  return {
    status:         errors.length === 0 ? "completed" : counts.ordersSynced > 0 ? "partial" : "failed",
    ordersSynced:   counts.ordersSynced,
    lineItemsSynced: counts.lineItemsSynced,
    errors,
    startedAt:      startedAt.toISOString(),
    completedAt:    new Date().toISOString(),
  };
}
