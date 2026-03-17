// middleware.ts
// Two concerns handled here:
// 1. Auth protection: redirect unauthenticated users to /login for protected routes.
// 2. Codespaces CSRF fix: rewrite x-forwarded-host to match origin so Next.js
//    server action CSRF check passes when running behind the Codespaces proxy.

import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/api/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  // Fix x-forwarded-host for Codespaces / reverse proxies so Next.js server
  // action CSRF check sees matching origin and host values.
  const origin = req.headers.get("origin");
  const requestHeaders = new Headers(req.headers);
  if (origin) {
    try {
      requestHeaders.set("x-forwarded-host", new URL(origin).host);
    } catch {
      // invalid origin, skip
    }
  }

  // Auth check for protected routes.
  if (!isPublic(req.nextUrl.pathname)) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    // Run on all routes except static assets
    "/((?!_next/static|_next/image|favicon\\.ico).*)",
  ],
};
