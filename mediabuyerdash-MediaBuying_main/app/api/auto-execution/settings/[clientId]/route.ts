// app/api/auto-execution/settings/[clientId]/route.ts
// GET  — load auto-execution settings for a client (creates defaults if missing).
// POST — update auto-execution settings for a client.

import { NextResponse }       from "next/server";
import { getServerSession }   from "next-auth";
import { authOptions }        from "../../../../../lib/auth";
import {
  getOrCreateAutoExecutionSettings,
  updateAutoExecutionSettings,
}                             from "../../../../../lib/autoExecution";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId ?? null;
  const settings    = await getOrCreateAutoExecutionSettings(
    params.clientId,
    workspaceId
  );

  return NextResponse.json({ settings });
}

export async function POST(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const workspaceId = session.user.workspaceId ?? null;

  // Ensure the settings row exists before updating
  await getOrCreateAutoExecutionSettings(params.clientId, workspaceId);

  const allowedFields = [
    "enabled",
    "allowRunSync",
    "allowPauseCampaign",
    "maxDailyExecutions",
    "maxSpendThreshold",
    "minRoasThreshold",
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field];
  }

  const settings = await updateAutoExecutionSettings(params.clientId, updates as Parameters<typeof updateAutoExecutionSettings>[1]);

  return NextResponse.json({ ok: true, settings });
}
