// lib/clientIntegrations.ts
// Read-only query helpers for client integration status.
// Only reads — no mutations. All mutations live in app/clients/[clientId]/actions.ts.

import { prisma } from "./db";

// ── Public types (use `import type` in client components) ─────────────────────

export type MappedMetaAccount = {
  selectedAccountId:   string; // MetaSelectedAdAccount.id
  externalAdAccountId: string;
  accountName:         string;
  currency:            string;
  timezoneName:        string;
  connectionStatus:    string; // from MetaConnection
  userDisplayName:     string; // from MetaConnection
};

export type AvailableMetaAccount = {
  selectedAccountId:     string;
  externalAdAccountId:   string;
  accountName:           string;
  currency:              string;
  timezoneName:          string;
  connectionStatus:      string;
  userDisplayName:       string;
  mappedToClientId:      string | null; // null = unmapped, string = another client's id
  mappedToClientName:    string | null;
};

export type ShopifyConnectionSummary = {
  id:               string;
  shopDomain:       string;
  connectionStatus: string;
  installedAt:      string; // ISO string
  mappedToClientId:   string | null;
  mappedToClientName: string | null;
};

/** Integration states for display logic */
export type IntegrationState =
  | "not_connected"   // no workspace-level connection exists
  | "available"       // workspace connection exists, not mapped to this client
  | "mapped";         // at least one account is mapped to this client

export type ClientIntegrationStatus = {
  metaState:    IntegrationState;
  shopifyState: IntegrationState;
  readyForSync: boolean;

  // Currently mapped to THIS client
  mappedMetaAccounts:      MappedMetaAccount[];
  mappedShopifyConnection: ShopifyConnectionSummary | null;

  // Available to assign (includes mapped-to-other-client items for transparency)
  availableMetaAccounts:       AvailableMetaAccount[];
  availableShopifyConnections: ShopifyConnectionSummary[];
};

// ── Query ─────────────────────────────────────────────────────────────────────

export async function getClientIntegrationStatus(
  clientId: string
): Promise<ClientIntegrationStatus> {
  // ── Meta ───────────────────────────────────────────────────────────────────
  const metaSelected = await prisma.metaSelectedAdAccount.findMany({
    include: {
      accessibleAdAccount: true,
      connection: {
        select: { userDisplayName: true, connectionStatus: true },
      },
      clientAccount: {
        select: { id: true, name: true },
      },
    },
  });

  const mappedMetaAccounts: MappedMetaAccount[] = metaSelected
    .filter((a) => a.clientAccountId === clientId)
    .map((a) => ({
      selectedAccountId:   a.id,
      externalAdAccountId: a.accessibleAdAccount.externalAdAccountId,
      accountName:         a.accessibleAdAccount.accountName,
      currency:            a.accessibleAdAccount.currency,
      timezoneName:        a.accessibleAdAccount.timezoneName,
      connectionStatus:    a.connection.connectionStatus,
      userDisplayName:     a.connection.userDisplayName,
    }));

  const availableMetaAccounts: AvailableMetaAccount[] = metaSelected
    .filter((a) => a.clientAccountId !== clientId) // exclude already-mapped
    .map((a) => ({
      selectedAccountId:   a.id,
      externalAdAccountId: a.accessibleAdAccount.externalAdAccountId,
      accountName:         a.accessibleAdAccount.accountName,
      currency:            a.accessibleAdAccount.currency,
      timezoneName:        a.accessibleAdAccount.timezoneName,
      connectionStatus:    a.connection.connectionStatus,
      userDisplayName:     a.connection.userDisplayName,
      mappedToClientId:    a.clientAccountId,
      mappedToClientName:  a.clientAccount?.name ?? null,
    }));

  const metaState: IntegrationState =
    mappedMetaAccounts.length > 0
      ? "mapped"
      : metaSelected.length > 0
      ? "available"
      : "not_connected";

  // ── Shopify ────────────────────────────────────────────────────────────────
  const shopifyConnections = await prisma.shopifyConnection.findMany({
    include: { clientAccount: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const mappedShopifyRaw = shopifyConnections.find(
    (c) => c.clientAccountId === clientId
  );
  const mappedShopifyConnection: ShopifyConnectionSummary | null = mappedShopifyRaw
    ? {
        id:               mappedShopifyRaw.id,
        shopDomain:       mappedShopifyRaw.shopDomain,
        connectionStatus: mappedShopifyRaw.connectionStatus,
        installedAt:      mappedShopifyRaw.installedAt.toISOString(),
        mappedToClientId:   mappedShopifyRaw.clientAccountId,
        mappedToClientName: mappedShopifyRaw.clientAccount?.name ?? null,
      }
    : null;

  const availableShopifyConnections: ShopifyConnectionSummary[] = shopifyConnections
    .filter((c) => c.clientAccountId !== clientId) // exclude already-mapped
    .map((c) => ({
      id:               c.id,
      shopDomain:       c.shopDomain,
      connectionStatus: c.connectionStatus,
      installedAt:      c.installedAt.toISOString(),
      mappedToClientId:   c.clientAccountId ?? null,
      mappedToClientName: c.clientAccount?.name ?? null,
    }));

  const shopifyState: IntegrationState =
    mappedShopifyConnection !== null
      ? "mapped"
      : shopifyConnections.length > 0
      ? "available"
      : "not_connected";

  return {
    metaState,
    shopifyState,
    readyForSync: metaState === "mapped" && shopifyState === "mapped",

    mappedMetaAccounts,
    mappedShopifyConnection,
    availableMetaAccounts,
    availableShopifyConnections,
  };
}
