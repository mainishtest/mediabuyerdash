// app/api/clients/[clientId]/budget-target/route.ts
// REST endpoint for client-level monthly budget targets.
//
// GET  → returns current target or { target: null }
// POST → upserts target (create or replace)

import { NextRequest, NextResponse } from "next/server";
import {
  getClientBudgetTarget,
  upsertClientBudgetTarget,
} from "../../../../../lib/budgetPacing/service";

type RouteParams = { params: { clientId: string } };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { clientId } = params;
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  try {
    const target = await getClientBudgetTarget(clientId);
    return NextResponse.json({ target });
  } catch (err) {
    console.error("[budget-target GET]", err);
    return NextResponse.json({ error: "Failed to load budget target" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { clientId } = params;
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { monthlyBudget, dailyBudget } = (body ?? {}) as Record<string, unknown>;

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
    const target = await upsertClientBudgetTarget(clientId, {
      monthlyBudget: monthly,
      dailyBudget:   daily,
    });
    return NextResponse.json({ target }, { status: 200 });
  } catch (err) {
    console.error("[budget-target POST]", err);
    return NextResponse.json({ error: "Failed to save budget target" }, { status: 500 });
  }
}
