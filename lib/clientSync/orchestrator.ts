// lib/clientSync/orchestrator.ts
// Client-scoped sync orchestration.
// Validates mappings, runs Meta and/or Shopify sync for a specific client,
// and persists ClientSyncRun + ClientSyncRunStep audit records.

import { prisma }                    from "../db";
import { runMetaSyncForAccounts }    from "../meta/sync";
import { runShopifySync }            from "../shopify/sync";
import {
  createClientSyncRun,
  completeClientSyncRun,
  createClientSyncRunStep,
  completeClientSyncRunStep,
} from "./db";
import type {
  SyncType,
  SyncStatus,
  ClientSyncResult,
  MetaStepSummary,
  ShopifyStepSummary,
} from "./types";

// ── Internal helpers ──────────────────────────────────────────────────────────

async function getClientMetaAccounts(clientId: string) {
  return prisma.metaSelectedAdAccount.findMany({
    where:   { clientAccountId: clientId },
    include: {
      accessibleAdAccount: { select: { externalAdAccountId: true } },
      connection:          { select: { id: true, accessToken: true, connectionStatus: true } },
    },
  });
}

async function getClientShopifyConnectionId(clientId: string): Promise<string | null> {
  const conn = await prisma.shopifyConnection.findFirst({
    where:  { clientAccountId: clientId },
    select: { id: true },
  });
  return conn?.id ?? null;
}

// ── Meta step ─────────────────────────────────────────────────────────────────

async function runMetaStep(
  clientId: string,
  syncRunId: string,
  workspaceId: string | null
): Promise<{ summary: MetaStepSummary; errors: string[] }> {
  const step = await createClientSyncRunStep(syncRunId, "meta_account");

  const accounts = await getClientMetaAccounts(clientId);

  if (accounts.length === 0) {
    await completeClientSyncRunStep(
      step.id,
      "failed",
      null,
      "No Meta ad accounts mapped to this client"
    );
    return {
      summary: {
        accountsProcessed: 0,
        campaignsSynced:   0,
        adSetsSynced:      0,
        adsSynced:         0,
        creativesSynced:   0,
        insightRowsSynced: 0,
      },
      errors: ["No Meta ad accounts mapped to this client"],
    };
  }

  // Group accounts by connection so we reuse access tokens correctly.
  // In practice most clients will have one connection.
  const byConnection = new Map<string, { externalAdAccountId: string; accessToken: string }[]>();
  for (const a of accounts) {
    if (a.connection.connectionStatus !== "active") continue;
    const list = byConnection.get(a.connection.id) ?? [];
    list.push({
      externalAdAccountId: a.accessibleAdAccount.externalAdAccountId,
      accessToken:         a.connection.accessToken,
    });
    byConnection.set(a.connection.id, list);
  }

  const allErrors: string[] = [];
  const totals: MetaStepSummary = {
    accountsProcessed: 0,
    campaignsSynced:   0,
    adSetsSynced:      0,
    adsSynced:         0,
    creativesSynced:   0,
    insightRowsSynced: 0,
  };

  for (const [connectionId, adAccounts] of byConnection) {
    const result = await runMetaSyncForAccounts(adAccounts, connectionId, workspaceId);
    totals.accountsProcessed += result.accountsProcessed;
    totals.campaignsSynced   += result.campaignsSynced;
    totals.adSetsSynced      += result.adSetsSynced;
    totals.adsSynced         += result.adsSynced;
    totals.creativesSynced   += result.creativesSynced;
    totals.insightRowsSynced += result.insightRowsSynced;
    allErrors.push(...result.errors);
  }

  const stepStatus: SyncStatus = allErrors.length === 0 ? "completed" : "partial";
  await completeClientSyncRunStep(
    step.id,
    stepStatus,
    JSON.stringify(totals),
    allErrors.length > 0 ? allErrors.join("; ") : undefined
  );

  return { summary: totals, errors: allErrors };
}

// ── Shopify step ──────────────────────────────────────────────────────────────

async function runShopifyStep(
  clientId: string,
  syncRunId: string
): Promise<{ summary: ShopifyStepSummary; errors: string[] }> {
  const step = await createClientSyncRunStep(syncRunId, "shopify_orders");

  const connectionId = await getClientShopifyConnectionId(clientId);

  if (!connectionId) {
    await completeClientSyncRunStep(
      step.id,
      "failed",
      null,
      "No Shopify store mapped to this client"
    );
    return {
      summary: { ordersSynced: 0, lineItemsSynced: 0 },
      errors:  ["No Shopify store mapped to this client"],
    };
  }

  const result = await runShopifySync(connectionId);

  const summary: ShopifyStepSummary = {
    ordersSynced:    result.ordersSynced,
    lineItemsSynced: result.lineItemsSynced,
  };

  const stepStatus: SyncStatus =
    result.status === "completed" ? "completed"
    : result.status === "partial" ? "partial"
    : "failed";

  await completeClientSyncRunStep(
    step.id,
    stepStatus,
    JSON.stringify(summary),
    result.errors.length > 0 ? result.errors.join("; ") : undefined
  );

  return { summary, errors: result.errors };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runClientSync(
  clientId: string,
  syncType: SyncType
): Promise<ClientSyncResult> {
  const startedAt  = new Date();

  // Resolve workspaceId so synced records are correctly scoped.
  const clientRecord = await prisma.clientAccount.findUnique({
    where:  { id: clientId },
    select: { workspaceId: true },
  });
  const workspaceId = clientRecord?.workspaceId ?? null;

  const syncRun    = await createClientSyncRun(clientId, syncType);
  const allErrors: string[] = [];

  let metaSummary:    MetaStepSummary | null    = null;
  let shopifySummary: ShopifyStepSummary | null = null;

  try {
    if (syncType === "meta" || syncType === "full") {
      const res = await runMetaStep(clientId, syncRun.id, workspaceId);
      metaSummary = res.summary;
      allErrors.push(...res.errors);
    }

    if (syncType === "shopify" || syncType === "full") {
      const res = await runShopifyStep(clientId, syncRun.id);
      shopifySummary = res.summary;
      allErrors.push(...res.errors);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    allErrors.push(msg);
    console.error("[ClientSync] Unexpected error", err);
  }

  const finalStatus: SyncStatus =
    allErrors.length === 0                   ? "completed"
    : (metaSummary !== null || shopifySummary !== null) ? "partial"
    : "failed";

  await completeClientSyncRun(
    syncRun.id,
    finalStatus,
    allErrors.length > 0 ? allErrors.join("; ") : undefined
  );

  return {
    syncRunId:      syncRun.id,
    status:         finalStatus,
    syncType,
    metaSummary,
    shopifySummary,
    errors:         allErrors,
    startedAt:      startedAt.toISOString(),
    completedAt:    new Date().toISOString(),
  };
}
