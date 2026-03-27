import { NextResponse } from "next/server";
import { runMetaSync } from "../../../../lib/meta/sync";
import { isMetaConfigured } from "../../../../lib/meta/config";

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isMetaConfigured()) {
    return NextResponse.json(
      { error: "Meta credentials not configured" },
      { status: 503 }
    );
  }

  const summary = await runMetaSync(null);
  return NextResponse.json(summary);
}
