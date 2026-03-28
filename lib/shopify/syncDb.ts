import { prisma } from "../db";
import type { MappedOrder, MappedLineItem } from "./mappers";

// ── Sync log ───────────────────────────────────────────────────────────────────

export async function createSyncLog(shopifyConnectionId: string) {
  return prisma.shopifySyncLog.create({
    data: { shopifyConnectionId, status: "running" },
  });
}

export async function completeSyncLog(
  id: string,
  counts: { ordersSynced: number; lineItemsSynced: number },
  errors: string[]
) {
  const total = counts.ordersSynced;
  const status =
    errors.length === 0 ? "completed"
    : total > 0         ? "partial"
    : "failed";

  return prisma.shopifySyncLog.update({
    where: { id },
    data: {
      status,
      ordersSynced:    counts.ordersSynced,
      lineItemsSynced: counts.lineItemsSynced,
      errorMessages:   errors.length > 0 ? JSON.stringify(errors) : null,
      completedAt:     new Date(),
    },
  });
}

export async function getLatestSyncLog(shopifyConnectionId: string) {
  return prisma.shopifySyncLog.findFirst({
    where:   { shopifyConnectionId },
    orderBy: { startedAt: "desc" },
  });
}

/** Returns the N most recent sync logs for this connection. */
export async function getRecentSyncLogs(shopifyConnectionId: string, count: number) {
  return prisma.shopifySyncLog.findMany({
    where:   { shopifyConnectionId },
    orderBy: { startedAt: "desc" },
    take:    count,
    select:  { status: true, startedAt: true },
  });
}

/** Returns the most recent orderCreatedAt for this connection, or null if no orders exist. */
export async function getLatestOrderDate(shopifyConnectionId: string): Promise<Date | null> {
  const latest = await prisma.shopifyOrder.findFirst({
    where:   { shopifyConnectionId },
    orderBy: { orderCreatedAt: "desc" },
    select:  { orderCreatedAt: true },
  });
  return latest?.orderCreatedAt ?? null;
}

// ── Order + line-item writes ───────────────────────────────────────────────────

export async function upsertOrder(order: MappedOrder) {
  return prisma.shopifyOrder.upsert({
    where: {
      shopifyConnectionId_externalOrderId: {
        shopifyConnectionId: order.shopifyConnectionId,
        externalOrderId:     order.externalOrderId,
      },
    },
    create: order,
    update: {
      workspaceId:     order.workspaceId,
      orderNumber:     order.orderNumber,
      orderCreatedAt:  order.orderCreatedAt,
      clientAccountId: order.clientAccountId,
      totalPrice:      order.totalPrice,
      subtotalPrice:   order.subtotalPrice,
      totalTax:        order.totalTax,
      totalDiscount:   order.totalDiscount,
      customerId:      order.customerId,
      customerEmail:   order.customerEmail,
      utmSource:       order.utmSource,
      utmMedium:       order.utmMedium,
      utmCampaign:     order.utmCampaign,
      utmContent:      order.utmContent,
      utmTerm:         order.utmTerm,
      landingPage:     order.landingPage,
      referringSite:   order.referringSite,
    },
  });
}

/** Delete all existing line items for the order then bulk-insert fresh ones. */
export async function replaceLineItems(
  shopifyOrderId: string,
  lineItems: MappedLineItem[]
) {
  await prisma.shopifyOrderLineItem.deleteMany({ where: { shopifyOrderId } });
  if (lineItems.length === 0) return;
  await prisma.shopifyOrderLineItem.createMany({ data: lineItems });
}

// ── Summary data for the UI ────────────────────────────────────────────────────

/** Summary scoped to a connection (used by global integrations page). */
export async function getOrderSummary(shopifyConnectionId: string) {
  const [orderCount, lineItemCount, recentOrders, recentLineItems] =
    await Promise.all([
      prisma.shopifyOrder.count({ where: { shopifyConnectionId } }),
      prisma.shopifyOrderLineItem.count({
        where: { order: { shopifyConnectionId } },
      }),
      prisma.shopifyOrder.findMany({
        where:   { shopifyConnectionId },
        orderBy: { orderCreatedAt: "desc" },
        take:    20,
      }),
      prisma.shopifyOrderLineItem.findMany({
        where:   { order: { shopifyConnectionId } },
        orderBy: { createdAt: "desc" },
        take:    20,
        include: { order: { select: { orderNumber: true } } },
      }),
    ]);

  return { orderCount, lineItemCount, recentOrders, recentLineItems };
}

/** Summary scoped to a client account (used by client-scoped pages). */
export async function getClientOrderSummary(clientAccountId: string) {
  const [orderCount, lineItemCount, recentOrders, facebookRevenueAgg] = await Promise.all([
    prisma.shopifyOrder.count({ where: { clientAccountId } }),
    prisma.shopifyOrderLineItem.count({
      where: { order: { clientAccountId } },
    }),
    prisma.shopifyOrder.findMany({
      where:   { clientAccountId },
      orderBy: { orderCreatedAt: "desc" },
      take:    20,
      include: {
        lineItems: { select: { id: true } },
      },
    }),
    prisma.shopifyOrder.aggregate({
      where: {
        clientAccountId,
        utmSource: { equals: "facebook", mode: "insensitive" },
      },
      _sum: { totalPrice: true },
    }),
  ]);

  const facebookRevenue = facebookRevenueAgg._sum.totalPrice ?? 0;

  return { orderCount, lineItemCount, recentOrders, facebookRevenue };
}
