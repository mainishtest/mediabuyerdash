import { createHmac } from "crypto";
import type { NextRequest } from "next/server";

export function portalCookieName(token: string) {
  return `portal_auth_${token.slice(0, 16)}`;
}

export function makePortalCookieValue(token: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? "fallback-secret";
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function isPortalAuthenticated(req: NextRequest, token: string): boolean {
  const value = req.cookies.get(portalCookieName(token))?.value;
  return value === makePortalCookieValue(token);
}
