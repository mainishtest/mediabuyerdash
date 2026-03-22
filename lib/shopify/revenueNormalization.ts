// lib/shopify/revenueNormalization.ts
//
// Revenue normalization utilities for ROAS/CPA calculations.
// CRM/Shopify is the source of truth for business outcomes.
// netRevenue = totalPrice - refundTotal (computed per order on sync).
//
// This module provides aggregation queries that use netRevenue
// instead of totalPrice, ensuring refund-adjusted metrics.

import { prisma } from "../db";

// ── Types ───────────────────────────────────────────────────────────────────

export interface RevenueSummary {
  totalOrders:       number;
  grossRevenue:      number;  // sum of totalPrice
  totalRefunds:      number;  // sum of refundTotal
  netRevenue:        number;  // sum of netRevenue (grossRevenue - totalRefunds)
  cancelledOrders:   number;
  refundedOrders:    number;  // partially or fully refunded
  averageOrderValue: number;  // netRevenue / totalOrders (excluding cancelled)
}

export interface AttributedRevenueSummary extends RevenueSummary {
  facebookOrders:    number;
  facebookRevenue:   number;  // net revenue from Facebook-attributed orders
}

// ── Per-connection revenue summary ──────────────────────────────────────────

export async function getConnectionRevenueSummary(
  shopifyConnectionId: string,
  since?: Date
): Promise<RevenueSummary> {
  const dateFilter = since ? { orderCreatedAt: { gte: since } } : {};
  const where = { shopifyConnectionId, ...dateFilter };

  const [agg, cancelledCount, refundedCount] = await Promise.all([
    prisma.shopifyOrder.aggregate({
      where,
      _count: true,
      _sum: {
        totalPrice:  true,
        refundTotal: true,
        netRevenue:  true,
      },
    }),
    prisma.shopifyOrder.count({
      where: { ...where, cancelledAt: { not: null } },
    }),
    prisma.shopifyOrder.count({
      where: { ...where, refundTotal: { gt: 0 } },
    }),
  ]);

  const totalOrders = agg._count;
  const grossRevenue = agg._sum.totalPrice ?? 0;
  const totalRefunds = agg._sum.refundTotal ?? 0;
  const netRevenue = agg._sum.netRevenue ?? 0;
  const activeOrders = Math.max(1, totalOrders - cancelledCount);

  return {
    totalOrders,
    grossRevenue:      round2(grossRevenue),
    totalRefunds:      round2(totalRefunds),
    netRevenue:        round2(netRevenue),
    cancelledOrders:   cancelledCount,
    refundedOrders:    refundedCount,
    averageOrderValue: round2(netRevenue / activeOrders),
  };
}

// ── Per-client attributed revenue ───────────────────────────────────────────

export async function getClientAttributedRevenue(
  clientAccountId: string,
  since?: Date
): Promise<AttributedRevenueSummary> {
  const dateFilter = since ? { orderCreatedAt: { gte: since } } : {};
  const where = { clientAccountId, ...dateFilter };

  const [agg, cancelledCount, refundedCount, fbAgg] = await Promise.all([
    prisma.shopifyOrder.aggregate({
      where,
      _count: true,
      _sum: {
        totalPrice:  true,
        refundTotal: true,
        netRevenue:  true,
      },
    }),
    prisma.shopifyOrder.count({
      where: { ...where, cancelledAt: { not: null } },
    }),
    prisma.shopifyOrder.count({
      where: { ...where, refundTotal: { gt: 0 } },
    }),
    prisma.shopifyOrder.aggregate({
      where: {
        ...where,
        utmSource: { equals: "facebook", mode: "insensitive" },
      },
      _count: true,
      _sum: { netRevenue: true },
    }),
  ]);

  const totalOrders = agg._count;
  const grossRevenue = agg._sum.totalPrice ?? 0;
  const totalRefunds = agg._sum.refundTotal ?? 0;
  const netRevenue = agg._sum.netRevenue ?? 0;
  const activeOrders = Math.max(1, totalOrders - cancelledCount);

  return {
    totalOrders,
    grossRevenue:      round2(grossRevenue),
    totalRefunds:      round2(totalRefunds),
    netRevenue:        round2(netRevenue),
    cancelledOrders:   cancelledCount,
    refundedOrders:    refundedCount,
    averageOrderValue: round2(netRevenue / activeOrders),
    facebookOrders:    fbAgg._count,
    facebookRevenue:   round2(fbAgg._sum.netRevenue ?? 0),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Recompute netRevenue for a single order from its refund records.
 * Useful when a refund webhook arrives after the order was originally synced.
 */
export async function recomputeOrderNetRevenue(shopifyOrderId: string): Promise<void> {
  const order = await prisma.shopifyOrder.findUnique({
    where: { id: shopifyOrderId },
    select: { totalPrice: true },
  });
  if (!order) return;

  const refundAgg = await prisma.shopifyRefund.aggregate({
    where: { shopifyOrderId },
    _sum: { refundAmount: true },
  });

  const refundTotal = refundAgg._sum.refundAmount ?? 0;
  const netRevenue = Math.max(0, order.totalPrice - refundTotal);

  await prisma.shopifyOrder.update({
    where: { id: shopifyOrderId },
    data: {
      refundTotal,
      netRevenue,
      financialStatus: refundTotal >= order.totalPrice
        ? "refunded"
        : refundTotal > 0
        ? "partially_refunded"
        : undefined, // don't overwrite if no refunds
    },
  });
}
