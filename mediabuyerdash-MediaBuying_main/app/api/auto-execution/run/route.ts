// app/api/auto-execution/run/route.ts
// POST — trigger a guarded auto-execution run for the current workspace.
// Evaluates all approved automation actions against guardrails and executes
// only those that pass. Returns a summary of the run.

import { NextResponse }         from "next/server";
import { getServerSession }     from "next-auth";
import { authOptions }          from "../../../../lib/auth";
import { runEligibleAutoExecutions } from "../../../../lib/autoExecution";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId ?? null;

  try {
    const summary = await runEligibleAutoExecutions(workspaceId);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error("[auto-execution/run]", err);
    return NextResponse.json(
      { ok: false, error: "Auto-execution run failed. Check server logs." },
      { status: 500 }
    );
  }
}
