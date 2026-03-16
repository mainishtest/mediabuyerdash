// lib/clientSync/db.ts
// CRUD helpers for ClientSyncRun and ClientSyncRunStep.
// All mutations return serialized records safe to pass as props.

import { prisma } from "../db";
import type {
  SyncType,
  SyncStatus,
  ClientSyncRunRecord,
  ClientSyncRunStepRecord,
  ClientSyncStatusSummary,
} from "./types";

// ── Serializers ───────────────────────────────────────────────────────────────

function serializeStep(
  step: {
    id: string;
    clientSyncRunId: string;
    stepType: string;
    status: string;
    summaryJson: string | null;
    errorMessage: string | null;
    startedAt: Date;
    completedAt: Date | null;
  }
): ClientSyncRunStepRecord {
  return {
    id:              step.id,
    clientSyncRunId: step.clientSyncRunId,
    stepType:        step.stepType,
    status:          step.status as SyncStatus,
    summaryJson:     step.summaryJson,
    errorMessage:    step.errorMessage,
    startedAt:       step.startedAt.toISOString(),
    completedAt:     step.completedAt?.toISOString() ?? null,
  };
}

function serializeRun(
  run: {
    id: string;
    clientAccountId: string;
    syncType: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    errorMessage: string | null;
    steps: Parameters<typeof serializeStep>[0][];
  }
): ClientSyncRunRecord {
  return {
    id:              run.id,
    clientAccountId: run.clientAccountId,
    syncType:        run.syncType as SyncType,
    status:          run.status as SyncStatus,
    startedAt:       run.startedAt.toISOString(),
    completedAt:     run.completedAt?.toISOString() ?? null,
    errorMessage:    run.errorMessage,
    steps:           run.steps.map(serializeStep),
  };
}

// ── Run lifecycle ─────────────────────────────────────────────────────────────

export async function createClientSyncRun(
  clientAccountId: string,
  syncType: SyncType
): Promise<ClientSyncRunRecord> {
  const run = await prisma.clientSyncRun.create({
    data: { clientAccountId, syncType, status: "running", startedAt: new Date() },
    include: { steps: true },
  });
  return serializeRun(run);
}

export async function completeClientSyncRun(
  runId: string,
  status: SyncStatus,
  errorMessage?: string
): Promise<void> {
  await prisma.clientSyncRun.update({
    where: { id: runId },
    data:  { status, completedAt: new Date(), errorMessage: errorMessage ?? null },
  });
}

// ── Step lifecycle ────────────────────────────────────────────────────────────

export async function createClientSyncRunStep(
  clientSyncRunId: string,
  stepType: string
): Promise<ClientSyncRunStepRecord> {
  const step = await prisma.clientSyncRunStep.create({
    data: { clientSyncRunId, stepType, status: "running", startedAt: new Date() },
  });
  return serializeStep(step);
}

export async function completeClientSyncRunStep(
  stepId: string,
  status: SyncStatus,
  summaryJson: string | null,
  errorMessage?: string
): Promise<void> {
  await prisma.clientSyncRunStep.update({
    where: { id: stepId },
    data:  {
      status,
      summaryJson,
      completedAt:  new Date(),
      errorMessage: errorMessage ?? null,
    },
  });
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Most-recent sync run per type for a client, used on the client detail page. */
export async function getClientSyncStatusSummary(
  clientAccountId: string
): Promise<ClientSyncStatusSummary> {
  const runs = await prisma.clientSyncRun.findMany({
    where:   { clientAccountId },
    orderBy: { startedAt: "desc" },
    take:    20,
    include: { steps: { orderBy: { startedAt: "asc" } } },
  });

  if (runs.length === 0) {
    return {
      lastSyncRun:     null,
      lastMetaSync:    null,
      lastShopifySync: null,
      hasEverSynced:   false,
    };
  }

  const lastMetaSync    = runs.find((r) => r.syncType === "meta" || r.syncType === "full") ?? null;
  const lastShopifySync = runs.find((r) => r.syncType === "shopify" || r.syncType === "full") ?? null;

  return {
    lastSyncRun:     serializeRun(runs[0]),
    lastMetaSync:    lastMetaSync    ? serializeRun(lastMetaSync)    : null,
    lastShopifySync: lastShopifySync ? serializeRun(lastShopifySync) : null,
    hasEverSynced:   true,
  };
}

/** Full history for the sync history page — last 50 runs. */
export async function getClientSyncHistory(
  clientAccountId: string
): Promise<ClientSyncRunRecord[]> {
  const runs = await prisma.clientSyncRun.findMany({
    where:   { clientAccountId },
    orderBy: { startedAt: "desc" },
    take:    50,
    include: { steps: { orderBy: { startedAt: "asc" } } },
  });
  return runs.map(serializeRun);
}
