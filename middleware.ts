// middleware.ts
// Protect all app routes. Unauthenticated users are redirected to /login.
// Public paths: /login, /register, /forgot-password, /reset-password,
//               /api/auth/**, Next.js internals, static files.

import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/((?!login|register|forgot-password|reset-password|privacy|terms|portal|api/auth|api/portal|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
