// app/api/creatives/performance/route.ts
// GET /api/creatives/performance
//
// Returns creative-level (per-ad) performance data with CRM attribution.
//
// Query parameters:
//   clientId    — filter to a single ClientAccount.id (optional)
//   campaignId  — filter to a single externalCampaignId (optional)
//   dateFrom    — YYYY-MM-DD (required)
//   dateTo      — YYYY-MM-DD (required)
//   windowDays  — attribution lookback in days (default 7)
//
// Response:
//   200 { rows: CreativePerformanceRow[], summary: CreativePerformanceSummary }
//   400 { error: string }
//   500 { error: string }

import { NextRequest, NextResponse }          from "next/server";
import { getServerSession }                   from "next-auth";
import { authOptions }                        from "../../../../lib/auth";
import { getCreativePerformance }             from "../../../../lib/creativePerformance/query";
import { buildCreativePerformanceSummary }    from "../../../../lib/creativePerformance/aggregation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  // ── Parse query params ────────────────────────────────────────────────────
  const { searchParams } = req.nextUrl;
  const clientId   = searchParams.get("clientId")   ?? undefined;
  const campaignId = searchParams.get("campaignId") ?? undefined;
  const dateFrom   = searchParams.get("dateFrom");
  const dateTo     = searchParams.get("dateTo");
  const windowRaw  = searchParams.get("windowDays");
  const windowDays = windowRaw ? parseInt(windowRaw, 10) : 7;

  if (!dateFrom || !dateTo) {
    return NextResponse.json(
      { error: "dateFrom and dateTo are required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  // Basic date format validation
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(dateFrom) || !dateRe.test(dateTo)) {
    return NextResponse.json(
      { error: "dateFrom and dateTo must be in YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  if (dateFrom > dateTo) {
    return NextResponse.json(
      { error: "dateFrom must be on or before dateTo" },
      { status: 400 }
    );
  }

  if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 90) {
    return NextResponse.json(
      { error: "windowDays must be an integer between 1 and 90" },
      { status: 400 }
    );
  }

  // ── Execute ───────────────────────────────────────────────────────────────
  try {
    const rows = await getCreativePerformance({
      workspaceId,
      clientAccountId: clientId,
      campaignId,
      dateFrom,
      dateTo,
      windowDays,
    });

    const summary = buildCreativePerformanceSummary(rows);

    return NextResponse.json({ rows, summary });
  } catch (err) {
    console.error("[/api/creatives/performance] error:", err);
    return NextResponse.json(
      { error: "Failed to load creative performance data" },
      { status: 500 }
    );
  }
}
