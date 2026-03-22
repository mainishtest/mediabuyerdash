import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { getAllShopifyConnections } from "../../../../lib/shopify/db";
import { runShopifySync } from "../../../../lib/shopify/sync";
import type { ShopifySyncMode } from "../../../../lib/shopify/sync";

export const maxDuration = 300;

/**
 * POST /api/shopify/retry-sync
 *
 * Manual retry endpoint for Shopify sync. Requires authenticated session.
 * Accepts optional body: { connectionId?, mode? "incremental" | "backfill" }
 *
 * If connectionId is omitted, syncs all active connections.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let connectionId: string | undefined;
  let mode: ShopifySyncMode = "incremental";
  try {
    const body = await request.json().catch(() => ({}));
    if (body.connectionId) connectionId = body.connectionId;
    if (body.mode === "backfill") mode = "backfill";
  } catch {
    // Defaults are fine
  }

  if (connectionId) {
    const summary = await runShopifySync(connectionId, mode);
    return NextResponse.json(summary);
  }

  // Sync all connections
  const connections = await getAllShopifyConnections();
  if (connections.length === 0) {
    return NextResponse.json({ error: "No Shopify connections found" }, { status: 404 });
  }

  const results = await Promise.allSettled(
    connections.map((c: { id: string }) => runShopifySync(c.id, mode))
  );

  const summaries = results.map((r, i) =>
    r.status === "fulfilled"
      ? { connectionId: connections[i].id, ...r.value }
      : { connectionId: connections[i].id, status: "failed", error: String((r as PromiseRejectedResult).reason) }
  );

  return NextResponse.json({ synced: connections.length, results: summaries });
}
