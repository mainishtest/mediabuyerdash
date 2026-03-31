// app/api/clients/[clientId]/stats/route.ts
// GET handler for the Stats hierarchical view.
//
// Supports:
//   ?level=campaign&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
//   ?level=adset&parentId=<externalCampaignId>&startDate=...&endDate=...
//   ?level=ad&parentId=<externalAdSetId>&startDate=...&endDate=...
//   ?search=<term>&startDate=...&endDate=...    (deep search mode)
//
// Optional: &activeOnly=true  &search=<name filter>

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import {
  getCampaignStats,
  getAdSetStats,
  getAdStats,
  searchAllLevels,
} from "../../../../../lib/stats/statsService";

export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const { clientId } = params;
  const sp = req.nextUrl.searchParams;

  const level = sp.get("level") as "campaign" | "adset" | "ad" | null;
  const parentId = sp.get("parentId") ?? undefined;
  const startDate = sp.get("startDate");
  const endDate = sp.get("endDate");
  const activeOnly = sp.get("activeOnly") === "true";
  const search = sp.get("search") ?? undefined;
  const deepSearch = sp.get("deepSearch") === "true";

  // Validate required params
  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  if (!deepSearch && !level) {
    return NextResponse.json(
      { error: "level is required (campaign | adset | ad)" },
      { status: 400 },
    );
  }

  // Get client timezone
  const client = await prisma.clientAccount.findUnique({
    where: { id: clientId },
    select: { timezone: true },
  });
  const timezone = client?.timezone || "America/New_York";

  try {
    // Deep search mode: search across all levels
    if (deepSearch && search) {
      const result = await searchAllLevels(clientId, search, startDate, endDate, {
        activeOnly,
        timezone,
      });
      return NextResponse.json(result);
    }

    // Standard level-based queries
    const options = { activeOnly, search, timezone };

    switch (level) {
      case "campaign": {
        const result = await getCampaignStats(clientId, startDate, endDate, options);
        return NextResponse.json(result);
      }

      case "adset": {
        if (!parentId) {
          return NextResponse.json(
            { error: "parentId (externalCampaignId) is required for adset level" },
            { status: 400 },
          );
        }
        const result = await getAdSetStats(clientId, parentId, startDate, endDate, options);
        return NextResponse.json(result);
      }

      case "ad": {
        if (!parentId) {
          return NextResponse.json(
            { error: "parentId (externalAdSetId) is required for ad level" },
            { status: 400 },
          );
        }
        const result = await getAdStats(clientId, parentId, startDate, endDate, options);
        return NextResponse.json(result);
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
