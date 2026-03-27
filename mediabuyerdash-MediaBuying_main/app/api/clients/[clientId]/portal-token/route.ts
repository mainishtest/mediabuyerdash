import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/db";
import crypto from "crypto";

type RouteContext = { params: { clientId: string } };

// POST /api/clients/[clientId]/portal-token
// Generates (or returns existing) shareable client portal token.
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = params;

  const account = await prisma.clientAccount.findUnique({
    where: { id: clientId },
    select: { id: true, clientPortalToken: true },
  });

  if (!account) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Return existing token or generate a new one.
  const token = account.clientPortalToken ?? crypto.randomBytes(24).toString("hex");

  if (!account.clientPortalToken) {
    await prisma.clientAccount.update({
      where: { id: clientId },
      data: { clientPortalToken: token },
    });
  }

  return NextResponse.json({ token });
}

// DELETE /api/clients/[clientId]/portal-token
// Revokes the shareable token.
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.clientAccount.update({
    where: { id: params.clientId },
    data: { clientPortalToken: null },
  });

  return NextResponse.json({ ok: true });
}
