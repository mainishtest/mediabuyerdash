import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { runMetaSync } from "../../../../lib/meta/sync";
import { isMetaConfigured } from "../../../../lib/meta/config";

export const maxDuration = 300;

/**
 * POST /api/meta/retry-sync
 *
 * Manual retry endpoint for Meta sync. Requires authenticated session.
 * Accepts optional `mode` body parameter ("recent" | "daily_full").
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isMetaConfigured()) {
    return NextResponse.json(
      { error: "Meta credentials not configured" },
      { status: 503 }
    );
  }

  let mode: "recent" | "daily_full" = "recent";
  try {
    const body = await request.json().catch(() => ({}));
    if (body.mode === "daily_full") mode = "daily_full";
  } catch {
    // Default to recent
  }

  const workspaceId = session.user.workspaceId ?? null;
  const summary = await runMetaSync(workspaceId, mode);

  const statusCode = summary.status === "token_expired" ? 401 : 200;
  return NextResponse.json(summary, { status: statusCode });
}
