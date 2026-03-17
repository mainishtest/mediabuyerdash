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
    "/((?!login|register|api/auth|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
