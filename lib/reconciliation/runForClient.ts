// lib/reconciliation/runForClient.ts
// Shared helper that runs per-day reconciliation for a single client.
// Used by both the cron job and the manual sync action.

import {
  buildMetaUTMRowsForClient,
  buildCRMOrderRowsForClient,
} from "./realDataService";
import { reconcileMetaRowsWithShopifyOrders } from "./matchEngine";
import { summarizeReconciliationResults } from "./summarize";
import {
  persistReconciliationMatches,
  persistReconciliationSummary,
} from "./persist";

function dateStr(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10);
}

/**
 * Run per-day reconciliation for a client over the last N days (default 7).
 * Produces individual per-day ReconciliationSummary rows that the
 * executive dashboard aggregator can query for trends.
 *
 * Returns the number of days that had data and were reconciled.
 */
export async function runClientReconciliation(
  clientAccountId: string,
  daysBack = 7
): Promise<number> {
  let daysReconciled = 0;

  for (let daysAgo = 1; daysAgo <= daysBack; daysAgo++) {
    const day = dateStr(daysAgo);

    const [metaRows, crmOrders] = await Promise.all([
      buildMetaUTMRowsForClient(clientAccountId, day, day),
      buildCRMOrderRowsForClient(clientAccountId, day, day),
    ]);

    // Skip days with no data on either side
    if (metaRows.length === 0 && crmOrders.length === 0) continue;

    const matchRows = reconcileMetaRowsWithShopifyOrders(metaRows, crmOrders, clientAccountId);
    const summary = summarizeReconciliationResults(matchRows, clientAccountId);

    await Promise.all([
      persistReconciliationMatches(matchRows),
      persistReconciliationSummary(summary),
    ]);

    daysReconciled++;
  }

  return daysReconciled;
}
