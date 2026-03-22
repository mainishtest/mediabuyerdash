import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import {
  getShopifySyncSetupState,
  getShopifyReconnectState,
  evaluateShopifySyncHealth,
} from "../../../../lib/shopify/integrationState";

/**
 * GET /api/shopify/sync-status
 *
 * Returns current Shopify sync status for the UI:
 * - Last sync time and result
 * - Sync health (healthy, stale, failed)
 * - Whether reconnection is needed
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [syncState, reconnectState, health] = await Promise.all([
    getShopifySyncSetupState(),
    getShopifyReconnectState(),
    evaluateShopifySyncHealth(),
  ]);

  return NextResponse.json({
    sync: syncState,
    reconnect: reconnectState,
    health,
  });
}
