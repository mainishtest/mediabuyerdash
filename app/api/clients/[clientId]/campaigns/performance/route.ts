// app/api/clients/[clientId]/campaigns/performance/route.ts
// GET /api/clients/:clientId/campaigns/performance
//
// Returns campaign performance snapshots, sparklines, and daily metrics
// for the given date range. Used by the client-side date picker to
// reload data without a full page navigation.
//
// Query params:
//   startDate  YYYY-MM-DD (required)
//   endDate    YYYY-MM-DD (required)
//
// Response:
//   { snapshots: CampaignPerformanceSnapshot[], sparklines: Record<string, SparkPoint[]>, clientDaily: DailyPoint[] }

import { NextRequest, NextResponse }           from "next/server";
import { buildCampaignPerformanceSnapshots }   from "../../../../../../lib/campaignPerformance/aggregator";
import { getCampaignSparklines,
         getClientDailyMetrics }               from "../../../../../../lib/charts/dataService";

type RouteParams = { params: { clientId: string } };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { clientId } = params;
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const sp        = req.nextUrl.searchParams;
  const startDate = sp.get("startDate") ?? "";
  const endDate   = sp.get("endDate")   ?? "";

  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return NextResponse.json(
      { error: "startDate and endDate are required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  if (startDate > endDate) {
    return NextResponse.json(
      { error: "startDate must be before or equal to endDate" },
      { status: 400 }
    );
  }

  try {
    const [snapshots, sparklines, clientDaily] = await Promise.all([
      buildCampaignPerformanceSnapshots(clientId, startDate, endDate),
      getCampaignSparklines(clientId, 30, startDate, endDate),
      getClientDailyMetrics(clientId, 30, startDate, endDate),
    ]);

    return NextResponse.json({ snapshots, sparklines, clientDaily });
  } catch (err) {
    console.error("[GET /api/clients/[clientId]/campaigns/performance]", err);
    return NextResponse.json({ error: "Failed to load performance data" }, { status: 500 });
  }
}
