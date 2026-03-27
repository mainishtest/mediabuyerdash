// Loads available clients with their copywriting prompts for the Quick Generate page.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth";
import { prisma }       from "../../../../../lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  const clients = await prisma.clientAccount.findMany({
    where:   workspaceId ? { workspaceId } : {},
    select:  { id: true, name: true, copywritingPrompt: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ ok: true, clients });
}
