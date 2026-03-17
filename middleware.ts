// middleware.ts
// Protect all app routes. Unauthenticated users are redirected to /login.
// Public paths: /login, /api/auth/**, Next.js internals, static files.

import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - /login                  (auth page)
     *   - /register               (registration page)
     *   - /api/auth/**            (NextAuth endpoints)
     *   - /_next/static/**        (Next.js static assets)
     *   - /_next/image/**         (Next.js image optimization)
     *   - /favicon.ico            (browser favicon)
     */
    "/((?!login|register|api/auth|api/debug-headers|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
