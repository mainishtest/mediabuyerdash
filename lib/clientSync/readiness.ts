// lib/clientSync/readiness.ts
// Evaluates whether a client has the required mappings and active connections
// to run each sync type.

import { prisma } from "../db";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClientReadiness {
  metaMapped:             boolean;
  shopifyMapped:          boolean;
  shopifySynced:          boolean;   // at least one completed/partial sync log
  shopifyOrderCount:      number;    // orders available as source-of-truth CRM data
  eligibleForMetaSync:    boolean;   // metaMapped && active Meta connection
  eligibleForShopifySync: boolean;   // shopifyMapped && active Shopify connection
  eligibleForFullSync:    boolean;   // both eligible
  metaAccountCount:       number;
  shopifyDomain:          string | null;
  blockers:               string[];  // human-readable reasons sync cannot run
}

// ── Query ─────────────────────────────────────────────────────────────────────

export async function getClientReadiness(
  clientId: string
): Promise<ClientReadiness> {
  const [metaAccounts, shopifyConnection] = await Promise.all([
    prisma.metaSelectedAdAccount.findMany({
      where:   { clientAccountId: clientId },
      include: { connection: { select: { connectionStatus: true } } },
    }),
    prisma.shopifyConnection.findFirst({
      where:  { clientAccountId: clientId },
      select: {
        shopDomain:       true,
        connectionStatus: true,
        syncLogs: {
          where:   { status: { in: ["completed", "partial"] } },
          orderBy: { completedAt: "desc" },
          take:    1,
          select:  { id: true },
        },
      },
    }),
  ]);

  const shopifyOrderCount = shopifyConnection
    ? await prisma.shopifyOrder.count({ where: { clientAccountId: clientId } })
    : 0;

  const activeMetaAccounts     = metaAccounts.filter(
    (a) => a.connection.connectionStatus === "active"
  );
  const metaMapped             = metaAccounts.length > 0;
  const shopifyMapped          = shopifyConnection !== null;
  const shopifySynced          = (shopifyConnection?.syncLogs?.length ?? 0) > 0;
  const eligibleForMetaSync    = activeMetaAccounts.length > 0;
  const eligibleForShopifySync =
    shopifyMapped && shopifyConnection!.connectionStatus === "active";

  const blockers: string[] = [];
  if (!metaMapped)
    blockers.push("No Meta ad accounts mapped to this client");
  else if (!eligibleForMetaSync)
    blockers.push("Meta connection is not active — reconnect in Integrations");
  if (!shopifyMapped)
    blockers.push("No Shopify store mapped to this client");
  else if (!eligibleForShopifySync)
    blockers.push("Shopify connection is not active — reconnect in Integrations");
  else if (!shopifySynced)
    blockers.push("Shopify has not been synced yet — run a sync to import orders");

  return {
    metaMapped,
    shopifyMapped,
    shopifySynced,
    shopifyOrderCount,
    eligibleForMetaSync,
    eligibleForShopifySync,
    eligibleForFullSync: eligibleForMetaSync && eligibleForShopifySync,
    metaAccountCount:    metaAccounts.length,
    shopifyDomain:       shopifyConnection?.shopDomain ?? null,
    blockers,
  };
}
