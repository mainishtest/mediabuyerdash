// app/api/integrations/disconnect/route.ts
// Handles disconnect for both Meta and Shopify connections.

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "../../../../lib/db";

export async function POST(req: NextRequest) {
  const { type, connectionId } = (await req.json()) as {
    type: "meta" | "shopify";
    connectionId: string;
  };

  if (!connectionId) {
    return NextResponse.json({ error: "Missing connectionId" }, { status: 400 });
  }

  try {
    if (type === "meta") {
      await prisma.metaConnection.delete({ where: { id: connectionId } });
    } else if (type === "shopify") {
      await prisma.shopifyConnection.delete({ where: { id: connectionId } });
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
