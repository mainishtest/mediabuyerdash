// app/api/cron/reconcile/route.ts
// Runs daily reconciliation for all active clients, producing per-day summaries
// that the executive dashboard aggregator can query for trends.
//
// Schedule: every 30 minutes (runs after sync crons have had time to pull data)
// Auth: Bearer CRON_SECRET

import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { runClientReconciliation } from "../../../../lib/reconciliation/runForClient";

export const maxDuration = 300;

export async function GET(request: Request) {
  // Vercel Cron sends the secret via x-vercel-cron-auth-token header (not Authorization)
  const cronToken = request.headers.get("authorization")?.replace("Bearer ", "")
    ?? request.headers.get("x-vercel-cron-auth-token");
  if (!cronToken || cronToken !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = await prisma.clientAccount.findMany({
    where: { status: "active" },
    select: { id: true, name: true },
  });

  if (clients.length === 0) {
    return NextResponse.json({ message: "No active clients", reconciled: 0 });
  }

  const results: Array<{ clientId: string; clientName: string; days: number; error?: string }> = [];

  for (const client of clients) {
    try {
      const daysReconciled = await runClientReconciliation(client.id);
      results.push({ clientId: client.id, clientName: client.name, days: daysReconciled });
    } catch (err) {
      console.error(`[reconcile cron] Error for client ${client.id}:`, err);
      results.push({
        clientId: client.id,
        clientName: client.name,
        days: 0,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    message: "Reconciliation complete",
    clientCount: clients.length,
    results,
  });
}
