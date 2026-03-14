import { cookies }             from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyHmac, exchangeShopifyCode } from "../../../../lib/shopify/auth";
import { upsertShopifyConnection }               from "../../../../lib/shopify/db";

export async function GET(request: NextRequest) {
  const url    = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const base   = `${url.origin}/integrations/shopify`;

  const { code, state, shop, error } = params;

  // User denied access in Shopify's dialog
  if (error) {
    return NextResponse.redirect(`${base}?error=oauth_denied`);
  }

  if (!code || !state || !shop) {
    return NextResponse.redirect(`${base}?error=missing_params`);
  }

  const cookieStore = cookies();

  // Verify CSRF state
  const storedState = cookieStore.get("shopify_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${base}?error=invalid_state`);
  }

  // Verify the shop domain matches what we initiated the OAuth for
  const storedShop = cookieStore.get("shopify_oauth_shop")?.value;
  if (!storedShop || storedShop !== shop) {
    return NextResponse.redirect(`${base}?error=shop_mismatch`);
  }

  // Verify Shopify's HMAC signature
  if (!verifyShopifyHmac(params)) {
    return NextResponse.redirect(`${base}?error=invalid_hmac`);
  }

  try {
    const tokenData = await exchangeShopifyCode(shop, code);

    await upsertShopifyConnection({
      shopDomain:       shop,
      accessToken:      tokenData.access_token,
      connectionStatus: "active",
      scopes:           tokenData.scope,
    });

    const response = NextResponse.redirect(`${base}?connected=1`);
    // Clear the CSRF cookies
    response.cookies.set("shopify_oauth_state", "", { maxAge: 0, path: "/" });
    response.cookies.set("shopify_oauth_shop",  "", { maxAge: 0, path: "/" });
    return response;
  } catch (err) {
    console.error("[Shopify OAuth callback]", err);
    return NextResponse.redirect(`${base}?error=callback_failed`);
  }
}
