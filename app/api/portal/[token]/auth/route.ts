import { NextRequest, NextResponse } from "next/server";
import bcrypt                        from "bcryptjs";
import { createHmac }                from "crypto";
import { prisma }                    from "../../../../../lib/db";

type RouteContext = { params: { token: string } };

function cookieName(token: string) {
  return `portal_auth_${token.slice(0, 16)}`;
}

/** Produce a verifiable cookie value tied to this token. */
function makeCookieValue(token: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? "fallback-secret";
  return createHmac("sha256", secret).update(token).digest("hex");
}

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
    // No password required — just confirm OK
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
  res.cookies.set(cookieName(token), makeCookieValue(token), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     `/portal/${token}`,
    maxAge:   60 * 60 * 24 * 7, // 7 days
  });
  return res;
}

/**
 * Utility — exported so the data route can reuse the same verification logic.
 */
export function verifyPortalCookie(req: NextRequest, token: string): boolean {
  const name  = cookieName(token);
  const value = req.cookies.get(name)?.value;
  return value === makeCookieValue(token);
}
