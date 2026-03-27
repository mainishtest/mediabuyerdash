// GET/POST /api/brand-intelligence/context?clientAccountId=xxx
// GET:  Load saved brand context for a client
// POST: Save/update brand context

import { NextRequest, NextResponse } from "next/server";
import { getBrandContext, saveBrandContext } from "../../../../lib/brandIntelligence/db";
import { summarizeBrandPromptSystem }        from "../../../../lib/brandIntelligence/brandContext";
import type { BrandMemoryData }              from "../../../../types/brandIntelligence";

export async function GET(req: NextRequest) {
  const clientAccountId = req.nextUrl.searchParams.get("clientAccountId");
  if (!clientAccountId) {
    return NextResponse.json({ error: "clientAccountId is required" }, { status: 400 });
  }

  const row = await getBrandContext(clientAccountId);
  if (!row) {
    return NextResponse.json({
      data:    null,
      summary: summarizeBrandPromptSystem(null),
    });
  }

  return NextResponse.json({
    data:      row.data,
    summary:   summarizeBrandPromptSystem(row.data),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    clientAccountId?: string;
    data?: BrandMemoryData;
    landingPageUrl?: string | null;
    landingPageData?: unknown;
  };

  if (!body.clientAccountId || !body.data) {
    return NextResponse.json(
      { error: "clientAccountId and data are required" },
      { status: 400 },
    );
  }

  const result = await saveBrandContext(
    body.clientAccountId,
    body.data,
    body.landingPageUrl,
    body.landingPageData as never,
  );

  const summary = summarizeBrandPromptSystem(body.data);

  return NextResponse.json({ id: result.id, summary });
}
