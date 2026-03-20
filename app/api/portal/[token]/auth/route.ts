import { NextRequest, NextResponse }                     from "next/server";
import bcrypt                                            from "bcryptjs";
import { prisma }                                        from "../../../../../lib/db";
import { portalCookieName, makePortalCookieValue }       from "../../../../../lib/portalAuth";

type RouteContext = { params: { token: string } };

/**
 * POST /api/portal/[token]/auth
 * Body: { password: string }
 * Verifies the portal password and sets an HttpOnly auth cookie.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { token } = params;

  const account = await prisma.clientAccount.findUnique({
    where:  { clientPortalToken: token },
    select: { clientPortalPasswordHash: true },
  });

  if (!account) {
    return NextResponse.json({ error: "Invalid portal link" }, { status: 404 });
  }

  if (!account.clientPortalPasswordHash) {
    return NextResponse.json({ ok: true });
  }

  const { password } = await req.json() as { password?: string };
  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  const valid = await bcrypt.compare(password, account.clientPortalPasswordHash);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(portalCookieName(token), makePortalCookieValue(token), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     `/portal/${token}`,
    maxAge:   60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
