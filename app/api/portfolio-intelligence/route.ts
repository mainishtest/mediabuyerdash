// app/api/portfolio-intelligence/route.ts
// GET: Build and return the portfolio intelligence summary.

import { NextResponse }              from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "../../../lib/auth";
import { buildPortfolioIntelligenceSummary } from "../../../lib/portfolioIntelligence/aggregator";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = session.user.workspaceId ?? null;

  try {
    const summary = await buildPortfolioIntelligenceSummary({ workspaceId });
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[portfolio-intelligence] Aggregation failed:", err);
    return NextResponse.json({ error: "Aggregation failed" }, { status: 500 });
  }
}
