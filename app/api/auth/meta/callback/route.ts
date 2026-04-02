import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, fetchMetaUserInfo } from "../../../../../lib/meta/auth";
import { fetchAccessibleAdAccounts }               from "../../../../../lib/meta/accounts";
import { upsertMetaConnection, syncAccessibleAdAccounts } from "../../../../../lib/meta/db";
import { META_SCOPES } from "../../../../../lib/meta/config";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const base = `${origin}/integrations/meta`;

  // User denied the OAuth dialog
  if (error) {
    return NextResponse.redirect(`${base}?error=oauth_denied`);
  }

  // CSRF state validation
  const storedState = request.cookies.get("meta_oauth_state")?.value;
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${base}?error=invalid_state`);
  }

  if (!code) {
    return NextResponse.redirect(`${base}?error=missing_code`);
  }

  try {
    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(code);

    // Fetch connected Meta user identity
    const userInfo = await fetchMetaUserInfo(tokenData.access_token);

    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : undefined;

    // Persist / update connection record
    const connection = await upsertMetaConnection({
      metaUserId:      userInfo.id,
      userDisplayName: userInfo.name,
      accessToken:     tokenData.access_token,
      tokenExpiresAt,
      scopes: META_SCOPES,
    });

    // Fetch and sync accessible ad accounts
    const accounts = await fetchAccessibleAdAccounts(tokenData.access_token);
    await syncAccessibleAdAccounts(connection.id, accounts);

    // Clear state cookie and redirect to success view
    const response = NextResponse.redirect(`${base}?connected=1`);
    response.cookies.set("meta_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (err) {
    console.error("[Meta OAuth callback error]", err);
    return NextResponse.redirect(`${base}?error=callback_failed`);
  }
}
