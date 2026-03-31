// app/api/clients/[clientId]/stats/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// GET handler for the Stats hierarchical view.
//
// USAGE:
//   Campaign list:  ?level=campaign&startDate=2026-03-01&endDate=2026-03-31
//   Ad sets:        ?level=adset&parentId=<campaignId>&startDate=...&endDate=...
//   Ads:            ?level=ad&parentId=<adSetId>&startDate=...&endDate=...
//   Deep search:    ?deepSearch=true&search=<term>&startDate=...&endDate=...
//
// OPTIONAL PARAMS:
//   &activeOnly=true   — filter to ACTIVE status only
//   &search=<term>     — name substring filter (level-scoped or deep)
//
// RESPONSE:
//   Level queries   → StatsApiResponse { rows: StatsRow[], totals: StatsTotals }
//   Deep search     → StatsSearchResult { campaigns, adSets, ads, ancestorMap }
//
// TIMEZONE:
//   Automatically resolved from the client's account timezone setting.
//   All date boundaries are computed in the account timezone.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import {
  getCampaignStats,
  getAdSetStats,
  getAdStats,
  searchAllLevels,
} from "../../../../../lib/stats/statsService";

// ── Date validation ─────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const { clientId } = params;
  const sp = req.nextUrl.searchParams;

  // Parse query parameters
  const level      = sp.get("level") as "campaign" | "adset" | "ad" | null;
  const parentId   = sp.get("parentId") ?? undefined;
  const startDate  = sp.get("startDate");
  const endDate    = sp.get("endDate");
  const activeOnly = sp.get("activeOnly") === "true";
  const search     = sp.get("search") ?? undefined;
  const deepSearch = sp.get("deepSearch") === "true";

  // ── Validate required params ─────────────────────────────────────────────

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return NextResponse.json(
      { error: "Invalid date format. Expected YYYY-MM-DD." },
      { status: 400 },
    );
  }

  if (startDate > endDate) {
    return NextResponse.json(
      { error: "startDate must be before or equal to endDate" },
      { status: 400 },
    );
  }

  if (!deepSearch && !level) {
    return NextResponse.json(
      { error: "level is required (campaign | adset | ad) unless deepSearch=true" },
      { status: 400 },
    );
  }

  if (!deepSearch && level && !["campaign", "adset", "ad"].includes(level)) {
    return NextResponse.json(
      { error: "level must be one of: campaign, adset, ad" },
      { status: 400 },
    );
  }

  // ── Resolve client timezone ──────────────────────────────────────────────
  // All date boundary calculations use the account timezone so that
  // "today" and "yesterday" align with the user's local calendar.

  const client = await prisma.clientAccount.findUnique({
    where: { id: clientId },
    select: { timezone: true },
  });

  if (!client) {
    return NextResponse.json(
      { error: "Client not found" },
      { status: 404 },
    );
  }

  const timezone = client.timezone || "America/New_York";

  try {
    const startMs = Date.now();

    // Historical data (endDate < today) is immutable — safe to cache.
    // Today's data changes as syncs run, so no caching.
    const todayStr = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(new Date());
    const isHistorical = endDate < todayStr;

    function withCacheHeaders(response: NextResponse): NextResponse {
      if (isHistorical) {
        // Historical: cache for 5 min in browser, 1 hour on CDN
        response.headers.set("Cache-Control", "private, max-age=300, stale-while-revalidate=3600");
      } else {
        // Live: no cache
        response.headers.set("Cache-Control", "private, no-cache");
      }
      return response;
    }

    // ── Deep search mode ─────────────────────────────────────────────────
    if (deepSearch && search) {
      const result = await searchAllLevels(clientId, search, startDate, endDate, {
        activeOnly,
        timezone,
      });
      console.log(`[Stats API] deep search "${search}" completed in ${Date.now() - startMs}ms`);
      return withCacheHeaders(NextResponse.json(result));
    }

    // ── Standard level-based queries ─────────────────────────────────────
    const options = { activeOnly, search, timezone };

    switch (level) {
      case "campaign": {
        const result = await getCampaignStats(clientId, startDate, endDate, options);
        console.log(`[Stats API] campaign stats: ${result.rows.length} rows in ${Date.now() - startMs}ms`);
        return withCacheHeaders(NextResponse.json(result));
      }

      case "adset": {
        if (!parentId) {
          return NextResponse.json(
            { error: "parentId (externalCampaignId) is required for adset level" },
            { status: 400 },
          );
        }
        const result = await getAdSetStats(clientId, parentId, startDate, endDate, options);
        console.log(`[Stats API] adset stats: ${result.rows.length} rows in ${Date.now() - startMs}ms`);
        return withCacheHeaders(NextResponse.json(result));
      }

      case "ad": {
        if (!parentId) {
          return NextResponse.json(
            { error: "parentId (externalAdSetId) is required for ad level" },
            { status: 400 },
          );
        }
        const result = await getAdStats(clientId, parentId, startDate, endDate, options);
        console.log(`[Stats API] ad stats: ${result.rows.length} rows in ${Date.now() - startMs}ms`);
        return withCacheHeaders(NextResponse.json(result));
      }

      default:
        return NextResponse.json(
          { error: "Invalid level. Must be campaign, adset, or ad" },
          { status: 400 },
        );
    }
  } catch (err) {
    console.error("[Stats API] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
