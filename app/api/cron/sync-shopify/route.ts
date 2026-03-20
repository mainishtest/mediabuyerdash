import { NextResponse } from "next/server";
import { getAllShopifyConnections } from "../../../../lib/shopify/db";
import { runShopifySync } from "../../../../lib/shopify/sync";

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await getAllShopifyConnections();
  if (connections.length === 0) {
    return NextResponse.json({ message: "No Shopify connections found" });
  }

  const results = await Promise.allSettled(
    connections.map((c: { id: string }) => runShopifySync(c.id))
  );

  const summaries = results.map((r, i) =>
    r.status === "fulfilled"
      ? { connectionId: connections[i].id, ...r.value }
      : { connectionId: connections[i].id, status: "failed", error: String((r as PromiseRejectedResult).reason) }
  );

  return NextResponse.json({ synced: connections.length, results: summaries });
}
