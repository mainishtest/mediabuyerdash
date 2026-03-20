import { NextRequest, NextResponse } from "next/server";
import { getServerSession }         from "next-auth";
import bcrypt                        from "bcryptjs";
import { authOptions }               from "../../../../../lib/auth";
import { prisma }                    from "../../../../../lib/db";

type RouteContext = { params: { clientId: string } };

/**
 * POST /api/clients/[clientId]/portal-password
 * Body: { password: string }
 * Sets the portal password for the client (hashed). Pass empty string to clear.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { password } = await req.json() as { password?: string };

  if (!password || password.trim() === "") {
    // Clear password
    await prisma.clientAccount.update({
      where: { id: params.clientId },
      data:  { clientPortalPasswordHash: null },
    });
    return NextResponse.json({ cleared: true });
  }

  const hash = await bcrypt.hash(password.trim(), 10);
  await prisma.clientAccount.update({
    where: { id: params.clientId },
    data:  { clientPortalPasswordHash: hash },
  });

  return NextResponse.json({ set: true });
}

/**
 * DELETE /api/clients/[clientId]/portal-password
 * Clears the portal password so the portal is accessible without one.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.clientAccount.update({
    where: { id: params.clientId },
    data:  { clientPortalPasswordHash: null },
  });

  return NextResponse.json({ cleared: true });
}
