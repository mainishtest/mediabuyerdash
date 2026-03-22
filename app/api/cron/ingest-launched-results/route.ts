// app/api/cron/ingest-launched-results/route.ts
// Cron-triggered batch ingestion for launched creative test results.
//
// Runs on a schedule (e.g. every 30 minutes) to:
//   1. Find all active/evaluating creative test results
//   2. Ingest Meta delivery + CRM revenue data for each
//   3. Evaluate outcomes (winner/loser/in_progress)
//   4. Update tracking states and detect stale tests
//
// Auth: Bearer CRON_SECRET

import { NextResponse } from "next/server";
import { ingestAllActiveResults } from "../../../../lib/launchedAssetResults/batchIngestor";

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[cron/ingest-launched-results] Starting batch ingestion");

  try {
    const result = await ingestAllActiveResults();

    console.log(
      `[cron/ingest-launched-results] Complete: ${result.succeeded}/${result.totalProcessed} succeeded`
    );

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("[cron/ingest-launched-results] Fatal error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
