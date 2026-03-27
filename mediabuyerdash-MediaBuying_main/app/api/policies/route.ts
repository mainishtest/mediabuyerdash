// app/api/policies/route.ts
// GET — load all active action safety policies for the current workspace,
//        along with the full effective permission summary for each client scope.

import { NextResponse }     from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "../../../lib/auth";
import { loadWorkspacePolicies } from "../../../lib/policy";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId ?? null;
  if (!workspaceId) {
    return NextResponse.json({ policies: [] });
  }

  const policies = await loadWorkspacePolicies(workspaceId);
  return NextResponse.json({ policies });
}
