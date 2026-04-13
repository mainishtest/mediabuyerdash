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
  const clientId = sp.get("clientId") ?? undefined;

  // Resolve client timezone so date defaults match MetaSyncedInsight's stored
  // dates (which use the ad account / client timezone, not UTC).
  let clientTz = "America/New_York";
  let adAccountFilter: object = {};
  if (clientId) {
    const clientAccount = await prisma.clientAccount.findUnique({
      where:  { id: clientId },
      select: { timezone: true },
    });
    if (clientAccount?.timezone) clientTz = clientAccount.timezone;

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

  const todayInTz = new Intl.DateTimeFormat("en-CA", {
    timeZone: clientTz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const dateFrom = sp.get("from") ?? todayInTz;
  const dateTo   = sp.get("to")   ?? dateFrom;

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
  // Convert date boundaries to the client's timezone so order bucketing matches
  function startOfDayInTz(dateStr: string, tzId: string): Date {
    const noon = new Date(dateStr + "T12:00:00.000Z");
    const localStr = noon.toLocaleString("en-US", { timeZone: tzId });
    const localDate = new Date(localStr);
    const offsetMs = noon.getTime() - localDate.getTime();
    const midnight = new Date(dateStr + "T00:00:00.000Z");
    return new Date(midnight.getTime() + offsetMs);
  }
  function endOfDayInTz(dateStr: string, tzId: string): Date {
    return new Date(startOfDayInTz(dateStr, tzId).getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  const shopifyAgg = await prisma.shopifyOrder.aggregate({
    where: {
      orderCreatedAt: {
        gte: startOfDayInTz(dateFrom, clientTz),
        lte: endOfDayInTz(dateTo, clientTz),
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
