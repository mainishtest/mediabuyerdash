// lib/launchedAssetResults/batchIngestor.ts
// Batch ingestion for all active/evaluating creative test results.
//
// Designed to run on a cron schedule (e.g. every 30 minutes).
// Processes tests in states: active, evaluating, pending_launch (if linked).
// Detects and marks stale tests.
//
// Reuses:
//   - lib/creativeTestResults/ingestor.ts (ingestCreativeTestResults)
//   - lib/creativeTestResults/db.ts (loadCreativeTestResults, updateCreativeTestResult)

import { prisma } from "../db";
import { ingestCreativeTestResults } from "../creativeTestResults/ingestor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BatchIngestionResult = {
  totalProcessed:    number;
  succeeded:         number;
  failed:            number;
  skipped:           number;
  staleDetected:     number;
  errors:            Array<{ testResultId: string; error: string }>;
};

// ---------------------------------------------------------------------------
// Batch ingest all active/evaluating tests
// ---------------------------------------------------------------------------

export async function ingestAllActiveResults(): Promise<BatchIngestionResult> {
  const result: BatchIngestionResult = {
    totalProcessed: 0,
    succeeded:      0,
    failed:         0,
    skipped:        0,
    staleDetected:  0,
    errors:         [],
  };

  // Load all tests that need ingestion
  const db = prisma as Record<string, any>;
  const records = await db.creativeTestResultRecord.findMany({
    where: {
      trackingState: { in: ["active", "evaluating", "pending_launch"] },
      archivedAt:    null,
    },
    select: {
      id:                      true,
      trackingState:           true,
      experimentId:            true,
      launchPlanId:            true,
      controlAdExternalId:     true,
      challengerAdExternalId:  true,
      windowStartedAt:         true,
      windowEndsAt:            true,
      evaluationWindowDays:    true,
      updatedAt:               true,
    },
    orderBy: { updatedAt: "asc" }, // oldest first
    take: 100, // batch limit
  });

  for (const record of records) {
    result.totalProcessed++;

    // Skip pending_launch tests with no experiment/launch plan link
    if (record.trackingState === "pending_launch" && !record.experimentId && !record.launchPlanId) {
      result.skipped++;
      continue;
    }

    // Skip tests with no ad external IDs (can't load data)
    if (!record.controlAdExternalId && !record.challengerAdExternalId) {
      result.skipped++;
      continue;
    }

    // Detect stale tests (no update in 14+ days and window should have ended)
    if (isStale(record)) {
      await markStale(record.id);
      result.staleDetected++;
      continue;
    }

    // Ingest results
    try {
      await ingestCreativeTestResults(record.id);
      result.succeeded++;
    } catch (err) {
      result.failed++;
      result.errors.push({
        testResultId: record.id,
        error: err instanceof Error ? err.message : String(err),
      });
      console.error(`[BatchIngestor] Failed to ingest ${record.id}:`, err);
    }
  }

  console.log(
    `[BatchIngestor] Processed ${result.totalProcessed}: ` +
    `${result.succeeded} ok, ${result.failed} failed, ` +
    `${result.skipped} skipped, ${result.staleDetected} stale`
  );

  return result;
}

// ---------------------------------------------------------------------------
// Stale detection
// ---------------------------------------------------------------------------

const STALE_DAYS = 14;

function isStale(record: {
  windowEndsAt:        Date | null;
  evaluationWindowDays: number;
  updatedAt:           Date;
  windowStartedAt:     Date | null;
}): boolean {
  const now = Date.now();

  // If window has an explicit end date and it's past + stale buffer
  if (record.windowEndsAt) {
    const staleCutoff = record.windowEndsAt.getTime() + STALE_DAYS * 86_400_000;
    if (now > staleCutoff) return true;
  }

  // If no window dates but last update was > (windowDays + STALE_DAYS) ago
  if (!record.windowStartedAt && !record.windowEndsAt) {
    const lastUpdate = record.updatedAt.getTime();
    const maxAge = (record.evaluationWindowDays + STALE_DAYS) * 86_400_000;
    if (now - lastUpdate > maxAge) return true;
  }

  return false;
}

async function markStale(testResultId: string): Promise<void> {
  const db = prisma as Record<string, any>;
  await db.creativeTestResultRecord.update({
    where: { id: testResultId },
    data: { trackingState: "stale" },
  });
  console.log(`[BatchIngestor] Marked test ${testResultId} as stale`);
}
