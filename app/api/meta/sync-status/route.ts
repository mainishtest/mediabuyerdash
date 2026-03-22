import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { getMetaSyncSetupState, getMetaReconnectState } from "../../../../lib/meta/integrationState";

/**
 * GET /api/meta/sync-status
 *
 * Returns current Meta sync status for the UI:
 * - Last sync time and result
 * - Whether reconnection is needed
 * - Error messages
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [syncState, reconnectState] = await Promise.all([
    getMetaSyncSetupState(),
    getMetaReconnectState(),
  ]);

  return NextResponse.json({
    sync: syncState,
    reconnect: reconnectState,
  });
}
