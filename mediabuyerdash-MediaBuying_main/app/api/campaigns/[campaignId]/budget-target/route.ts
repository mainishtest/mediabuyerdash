// app/api/campaigns/[campaignId]/budget-target/route.ts
// REST endpoint for campaign-level monthly budget targets.
// campaignId here is externalCampaignId (Meta's campaign ID).
//
// GET  → returns current target or { target: null }
// POST → upserts target; requires clientId in request body

import { NextRequest, NextResponse } from "next/server";
import {
  getCampaignBudgetTarget,
  upsertCampaignBudgetTarget,
} from "../../../../../lib/budgetPacing/service";

type RouteParams = { params: { campaignId: string } };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { campaignId } = params;
  const clientId = req.nextUrl.searchParams.get("clientId");

  if (!campaignId || !clientId) {
    return NextResponse.json(
      { error: "campaignId and clientId are required" },
      { status: 400 }
    );
  }

  try {
    const target = await getCampaignBudgetTarget(clientId, campaignId);
    return NextResponse.json({ target });
  } catch (err) {
    console.error("[campaign budget-target GET]", err);
    return NextResponse.json({ error: "Failed to load budget target" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { campaignId } = params;
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { clientId, monthlyBudget, dailyBudget } =
    (body ?? {}) as Record<string, unknown>;

  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "clientId is required in body" }, { status: 422 });
  }

  const monthly = Number(monthlyBudget);
  if (!isFinite(monthly) || monthly <= 0) {
    return NextResponse.json(
      { error: "monthlyBudget must be a positive number" },
      { status: 422 }
    );
  }

  const daily = dailyBudget !== undefined && dailyBudget !== null
    ? Number(dailyBudget)
    : null;

  if (daily !== null && (!isFinite(daily) || daily <= 0)) {
    return NextResponse.json(
      { error: "dailyBudget must be a positive number if provided" },
      { status: 422 }
    );
  }

  try {
    const target = await upsertCampaignBudgetTarget(clientId, campaignId, {
      monthlyBudget: monthly,
      dailyBudget:   daily,
    });
    return NextResponse.json({ target }, { status: 200 });
  } catch (err) {
    console.error("[campaign budget-target POST]", err);
    return NextResponse.json({ error: "Failed to save budget target" }, { status: 500 });
  }
}
