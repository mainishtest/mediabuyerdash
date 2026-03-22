import { NextResponse } from "next/server";
import { getAllShopifyConnections } from "../../../../lib/shopify/db";
import { runShopifySync } from "../../../../lib/shopify/sync";

export const maxDuration = 300;

/**
 * Cron-triggered Shopify sync endpoint.
 *
 * - Runs every 5 minutes (incremental mode)
 * - Syncs all active Shopify connections in parallel
 * - Skips connections with non-active status
 *
 * Auth: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  // Vercel Cron sends the secret via x-vercel-cron-auth-token header (not Authorization)
  const cronToken = request.headers.get("authorization")?.replace("Bearer ", "")
    ?? request.headers.get("x-vercel-cron-auth-token");
  if (!cronToken || cronToken !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await getAllShopifyConnections();
  const activeConnections = connections.filter(
    (c: { connectionStatus: string }) => c.connectionStatus === "active"
  );

  if (activeConnections.length === 0) {
    return NextResponse.json({ message: "No active Shopify connections", total: connections.length });
  }

  const results = await Promise.allSettled(
    activeConnections.map((c: { id: string }) => runShopifySync(c.id, "incremental"))
  );

  const summaries = results.map((r, i) =>
    r.status === "fulfilled"
      ? { connectionId: activeConnections[i].id, ...r.value }
      : { connectionId: activeConnections[i].id, status: "failed", error: String((r as PromiseRejectedResult).reason) }
  );

  return NextResponse.json({
    synced: activeConnections.length,
    skipped: connections.length - activeConnections.length,
    results: summaries,
  });
}
