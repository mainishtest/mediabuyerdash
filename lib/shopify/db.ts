import { prisma } from "../db";

// ── ShopifyConnection CRUD ─────────────────────────────────────────────────────

export async function getAllShopifyConnections() {
  return prisma.shopifyConnection.findMany({
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

/** Find the most-recently created active connection (used by pages). */
export async function getLatestShopifyConnection() {
  return prisma.shopifyConnection.findFirst({
    orderBy:  { createdAt: "desc" },
    include:  { clientAccount: true },
  });
}

export async function upsertShopifyConnection(data: {
  shopDomain:       string;
  accessToken:      string;
  connectionStatus: string;
  scopes?:          string;
  clientAccountId?: string;
}) {
  return prisma.shopifyConnection.upsert({
    where:  { shopDomain: data.shopDomain },
    create: data,
    update: {
      accessToken:      data.accessToken,
      connectionStatus: data.connectionStatus,
      scopes:           data.scopes,
    },
  });
}

export async function deleteShopifyConnection(id: string) {
  return prisma.shopifyConnection.delete({ where: { id } });
}
