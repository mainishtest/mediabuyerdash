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
  return prisma.shopifySyncLog.update({
    where: { id },
    data: {
      status:         errors.length === 0 ? "completed" : errors.length >= counts.ordersSynced ? "failed" : "partial",
      ordersSynced:   counts.ordersSynced,
      lineItemsSynced: counts.lineItemsSynced,
      errorMessages:  errors.length > 0 ? JSON.stringify(errors) : null,
      completedAt:    new Date(),
    },
  });
}

export async function getLatestSyncLog(shopifyConnectionId: string) {
  return prisma.shopifySyncLog.findFirst({
    where:   { shopifyConnectionId },
    orderBy: { startedAt: "desc" },
  });
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
      orderNumber:  order.orderNumber,
      processedAt:  order.processedAt,
      totalPrice:   order.totalPrice,
      subtotalPrice: order.subtotalPrice,
      totalTax:     order.totalTax,
      totalDiscount: order.totalDiscount,
      customerId:   order.customerId,
      utmSource:    order.utmSource,
      utmMedium:    order.utmMedium,
      utmCampaign:  order.utmCampaign,
      utmContent:   order.utmContent,
      utmTerm:      order.utmTerm,
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

  await prisma.shopifyOrderLineItem.createMany({
    data: lineItems,
  });
}

// ── Summary data for UI ────────────────────────────────────────────────────────

export async function getOrderSummary(shopifyConnectionId: string) {
  const [orderCount, lineItemCount, recentOrders] = await Promise.all([
    prisma.shopifyOrder.count({ where: { shopifyConnectionId } }),
    prisma.shopifyOrderLineItem.count({
      where: { order: { shopifyConnectionId } },
    }),
    prisma.shopifyOrder.findMany({
      where:   { shopifyConnectionId },
      orderBy: { processedAt: "desc" },
      take:    20,
    }),
  ]);

  return { orderCount, lineItemCount, recentOrders };
}
