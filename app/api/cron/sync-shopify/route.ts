import { NextResponse } from "next/server";
import { prisma }      from "../../../../lib/db";
import { runShopifySync } from "../../../../lib/shopify/sync";

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sync all active connections
  const activeConnections = await prisma.shopifyConnection.findMany({
    where:   { connectionStatus: "active" },
    select:  { id: true, shopDomain: true },
    orderBy: { createdAt: "desc" },
  });

  // Also retry errored connections once per hour (check if last sync was > 1hr ago)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const erroredConnections = await prisma.shopifyConnection.findMany({
    where: {
      connectionStatus: "error",
      updatedAt: { lt: oneHourAgo },
    },
    select: { id: true, shopDomain: true },
  });

  const allConnections = [...activeConnections, ...erroredConnections];

  if (allConnections.length === 0) {
    return NextResponse.json({ message: "No Shopify connections to sync" });
  }

  const results = await Promise.allSettled(
    allConnections.map((c) => runShopifySync(c.id))
  );

  const summaries = results.map((r, i) =>
    r.status === "fulfilled"
      ? { connectionId: allConnections[i].id, domain: allConnections[i].shopDomain, ...r.value }
      : { connectionId: allConnections[i].id, domain: allConnections[i].shopDomain, status: "failed", error: String((r as PromiseRejectedResult).reason) }
  );

  return NextResponse.json({
    synced:  activeConnections.length,
    retried: erroredConnections.length,
    results: summaries,
  });
}
