import { prisma } from "../db";

// ── ShopifyConnection CRUD ─────────────────────────────────────────────────────

export async function getAllShopifyConnections() {
  return prisma.shopifyConnection.findMany({
    where:   { connectionStatus: "active" },
    include: { clientAccount: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getShopifyConnectionById(id: string) {
  return prisma.shopifyConnection.findUnique({
    where: { id },
    include: { clientAccount: true },
  });
}

export async function getShopifyConnectionByDomain(shopDomain: string) {
  return prisma.shopifyConnection.findUnique({ where: { shopDomain } });
}

/** Find the most-recently created connection (used by global integrations page). */
export async function getLatestShopifyConnection() {
  return prisma.shopifyConnection.findFirst({
    orderBy:  { createdAt: "desc" },
    include:  { clientAccount: true },
  });
}

/** Get the connection mapped to a specific client, including latest sync log. */
export async function getClientShopifyConnection(clientAccountId: string) {
  return prisma.shopifyConnection.findFirst({
    where:   { clientAccountId },
    include: {
      clientAccount: true,
      syncLogs: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });
}

/** Get all connections scoped to a workspace. */
export async function getShopifyConnectionsByWorkspace(workspaceId: string) {
  return prisma.shopifyConnection.findMany({
    where:   { workspaceId },
    include: { clientAccount: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function upsertShopifyConnection(data: {
  shopDomain:       string;
  accessToken:      string;
  connectionStatus: string;
  scopes?:          string;
  clientAccountId?: string;
  workspaceId?:     string;
}) {
  return prisma.shopifyConnection.upsert({
    where:  { shopDomain: data.shopDomain },
    create: data,
    update: {
      accessToken:      data.accessToken,
      connectionStatus: data.connectionStatus,
      scopes:           data.scopes,
      ...(data.workspaceId     && { workspaceId:     data.workspaceId }),
      ...(data.clientAccountId && { clientAccountId: data.clientAccountId }),
    },
  });
}

/** Update the connectionStatus (e.g., to "error" on repeated sync failure). */
export async function updateConnectionStatus(id: string, connectionStatus: string) {
  return prisma.shopifyConnection.update({
    where: { id },
    data:  { connectionStatus },
  });
}

export async function deleteShopifyConnection(id: string) {
  return prisma.shopifyConnection.delete({ where: { id } });
}
