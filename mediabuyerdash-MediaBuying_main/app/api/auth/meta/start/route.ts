import { NextRequest, NextResponse } from "next/server";
import { buildMetaOAuthUrl }  from "../../../../../lib/meta/auth";
import { isMetaConfigured }   from "../../../../../lib/meta/config";

/**
 * GET /api/auth/meta/start
 *
 * Initiates the Meta OAuth flow.
 * - Generates a random CSRF state token
 * - Sets an httpOnly cookie with that state
 * - Redirects the browser to the Meta Login Dialog
 *
 * Using a GET route (rather than a server action) avoids allowedOrigins
 * restrictions in next.config.mjs and works reliably in all environments
 * including GitHub Codespaces and proxied deployments.
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const base = `${origin}/integrations/meta`;

  if (!isMetaConfigured()) {
    return NextResponse.redirect(`${base}?error=not_configured`);
  }

  const state = crypto.randomUUID();

  let metaUrl: string;
  try {
    metaUrl = buildMetaOAuthUrl(state);
  } catch {
    return NextResponse.redirect(`${base}?error=not_configured`);
  }

  const response = NextResponse.redirect(metaUrl);

  response.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   600, // 10 minutes
    path:     "/",
  });

  return response;
}
