// ── Executive Quick-View API ──────────────────────────────────────────────────
//
// Returns the 5 core KPIs (FB Spend, Shopify Revenue, Orders, ROAS, CPA)
// for a given date range. Designed for the quick-view toggle on the exec report.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "../../../../lib/auth";
import { prisma }                    from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp       = req.nextUrl.searchParams;
  const dateFrom = sp.get("from") ?? new Date().toISOString().slice(0, 10);
  const dateTo   = sp.get("to")   ?? dateFrom;
  const clientId = sp.get("clientId") ?? undefined;

  // ── Resolve ad-account IDs for client filtering on insights ────────────────
  let adAccountFilter: object = {};
  if (clientId) {
    const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
      where: { clientAccountId: clientId },
      include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
    });
    const externalIds = selectedAccounts
      .map((a) => a.accessibleAdAccount.externalAdAccountId)
      .filter(Boolean);
    if (externalIds.length > 0) {
      adAccountFilter = { externalAdAccountId: { in: externalIds } };
    } else {
      // No ad accounts linked — spend will be 0
      adAccountFilter = { externalAdAccountId: "__none__" };
    }
  }

  // ── Facebook spend from MetaSyncedInsight ──────────────────────────────────
  const insightAgg = await prisma.metaSyncedInsight.aggregate({
    where: {
      dateStart: { gte: dateFrom, lte: dateTo },
      ...adAccountFilter,
    },
    _sum: { spend: true },
  });
  const fbSpend = insightAgg._sum.spend ?? 0;

  // ── Shopify revenue + orders (Facebook-attributed via UTM) ────────────────
  const shopifyAgg = await prisma.shopifyOrder.aggregate({
    where: {
      orderCreatedAt: {
        gte: new Date(dateFrom + "T00:00:00Z"),
        lte: new Date(dateTo + "T23:59:59Z"),
      },
      OR: [
        { utmSource: { contains: "facebook", mode: "insensitive" } },
        { utmSource: { contains: "fb", mode: "insensitive" } },
        { utmSource: { equals: "meta", mode: "insensitive" } },
      ],
      ...(clientId ? { clientAccountId: clientId } : {}),
    },
    _sum:   { totalPrice: true },
    _count: { id: true },
  });

  const shopifyRevenue = shopifyAgg._sum.totalPrice ?? 0;
  const orderCount     = shopifyAgg._count.id ?? 0;

  // ── Derived metrics ────────────────────────────────────────────────────────
  const roas = fbSpend > 0 ? shopifyRevenue / fbSpend : null;
  const cpa  = orderCount > 0 ? fbSpend / orderCount : null;

  return NextResponse.json({
    dateFrom,
    dateTo,
    fbSpend,
    shopifyRevenue,
    orderCount,
    roas,
    cpa,
  });
}
