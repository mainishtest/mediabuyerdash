// POST /api/brand-intelligence/extract
// Extracts brand/offer signals from a landing page URL.
// Stateless — does not persist. Caller saves if desired.

import { NextRequest, NextResponse } from "next/server";
import { extractLandingPageContext } from "../../../../lib/brandIntelligence/landingPage";

export async function POST(req: NextRequest) {
  const body = await req.json() as { url?: string };

  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Basic URL validation
  try {
    const parsed = new URL(body.url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "URL must be http or https" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  const extraction = await extractLandingPageContext(body.url);

  return NextResponse.json(extraction);
}
