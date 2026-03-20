// app/api/governance/summary/route.ts
// GET — workspace-level governance control summary.

import { NextResponse }              from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "../../../../lib/auth";
import { summarizeGovernanceControls } from "../../../../lib/governance";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId ?? null;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace found" }, { status: 400 });
  }

  const summary = await summarizeGovernanceControls(workspaceId);
  return NextResponse.json({ summary });
}
