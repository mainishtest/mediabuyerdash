// app/api/clients/[clientId]/reconciliation/run/route.ts
// Runs the reconciliation engine for a client over a date range,
// persists the results, and returns the match rows + summary.
//
// POST /api/clients/[clientId]/reconciliation/run
//   Body (optional): { dateFrom?: string, dateTo?: string }
//   → { matchRows: ReconciliationMatchRow[], summary: ReconciliationComputedSummary }
//
// If no date range is provided, defaults to the last 30 days.
// Protected by NextAuth middleware (all /api routes require auth).

import { NextRequest, NextResponse }         from "next/server";
import { prisma }                             from "../../../../../../lib/db";
import {
  buildMetaUTMRowsForClient,
  buildCRMOrderRowsForClient,
}                                             from "../../../../../../lib/reconciliation/realDataService";
import { reconcileMetaRowsWithShopifyOrders } from "../../../../../../lib/reconciliation/matchEngine";
import { summarizeReconciliationResults }     from "../../../../../../lib/reconciliation/summarize";
import {
  persistReconciliationMatches,
  persistReconciliationSummary,
}                                             from "../../../../../../lib/reconciliation/persist";

type RouteParams = { params: { clientId: string } };

function defaultDateRange(): { dateFrom: string; dateTo: string } {
  const now  = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo:   now.toISOString().slice(0, 10),
  };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { clientId } = params;

  // Verify the client exists.
  const client = await prisma.clientAccount.findUnique({
    where:  { id: clientId },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Parse optional date range from body.
  let dateFrom: string;
  let dateTo:   string;

  try {
    const body = await req.json().catch(() => ({}));
    const defaults = defaultDateRange();
    dateFrom = typeof body?.dateFrom === "string" ? body.dateFrom : defaults.dateFrom;
    dateTo   = typeof body?.dateTo   === "string" ? body.dateTo   : defaults.dateTo;
  } catch {
    const defaults = defaultDateRange();
    dateFrom = defaults.dateFrom;
    dateTo   = defaults.dateTo;
  }

  try {
    // 1. Load source data in parallel.
    const [metaRows, crmOrders] = await Promise.all([
      buildMetaUTMRowsForClient(clientId, dateFrom, dateTo),
      buildCRMOrderRowsForClient(clientId, dateFrom, dateTo),
    ]);

    // 2. Run reconciliation engine.
    const matchRows = reconcileMetaRowsWithShopifyOrders(
      metaRows,
      crmOrders,
      clientId
    );

    // 3. Compute summary.
    const summary = summarizeReconciliationResults(matchRows, clientId);

    // 4. Persist results (upserts — safe to re-run).
    await Promise.all([
      persistReconciliationMatches(matchRows),
      persistReconciliationSummary(summary),
    ]);

    // 5. Return serialisable results (strip any non-serialisable values).
    return NextResponse.json({ matchRows, summary }, { status: 200 });
  } catch (err) {
    console.error("[reconciliation/run POST]", err);
    return NextResponse.json({ error: "Reconciliation run failed" }, { status: 500 });
  }
}
