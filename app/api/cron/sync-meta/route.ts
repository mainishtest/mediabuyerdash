import { NextResponse } from "next/server";
import { runMetaSync } from "../../../../lib/meta/sync";
import { isMetaConfigured } from "../../../../lib/meta/config";
import type { SyncMode } from "../../../../lib/meta/sync";

export const maxDuration = 300;

/**
 * Cron-triggered Meta sync endpoint.
 *
 * - Runs every 5 minutes (recent mode, 7-day window)
 * - Automatically runs daily_full mode (30-day window) once per day
 *   between 05:00–05:05 UTC to backfill historical accuracy
 *
 * Auth: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  // Vercel Cron sends the secret via x-vercel-cron-auth-token header (not Authorization)
  const cronToken = request.headers.get("authorization")?.replace("Bearer ", "")
    ?? request.headers.get("x-vercel-cron-auth-token");
  if (!cronToken || cronToken !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isMetaConfigured()) {
    return NextResponse.json(
      { error: "Meta credentials not configured" },
      { status: 503 }
    );
  }

  // Determine sync mode: daily_full during 05:00–05:05 UTC window
  const hour = new Date().getUTCHours();
  const minute = new Date().getUTCMinutes();
  const mode: SyncMode = (hour === 5 && minute < 5) ? "daily_full" : "recent";

  const summary = await runMetaSync(null, mode);

  // Surface token errors as 401 so monitoring can detect them
  if (summary.status === "token_expired") {
    return NextResponse.json(summary, { status: 401 });
  }

  return NextResponse.json(summary);
}
