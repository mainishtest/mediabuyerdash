import { cookies }                  from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyHmac, exchangeShopifyCode } from "../../../../../lib/shopify/auth";
import { upsertShopifyConnection }               from "../../../../../lib/shopify/db";
import { prisma }                                from "../../../../../lib/db";

export async function GET(request: NextRequest) {
  const url    = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());

  const { code, state, shop, error } = params;

  const cookieStore    = cookies();
  const clientId       = cookieStore.get("shopify_oauth_client")?.value ?? null;

  // Success redirect: client-scoped page if clientId is known, global otherwise
  const successBase =
    clientId
      ? `${url.origin}/clients/${clientId}/integrations/shopify`
      : `${url.origin}/integrations/shopify`;

  const errorBase = `${url.origin}/integrations/shopify`;

  // User denied access in Shopify's dialog
  if (error) {
    return NextResponse.redirect(`${errorBase}?error=oauth_denied`);
  }

  if (!code || !state || !shop) {
    return NextResponse.redirect(`${errorBase}?error=missing_params`);
  }

  // Verify CSRF state
  const storedState = cookieStore.get("shopify_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${errorBase}?error=invalid_state`);
  }

  // Verify the shop domain matches what we initiated the OAuth for
  const storedShop = cookieStore.get("shopify_oauth_shop")?.value;
  if (!storedShop || storedShop !== shop) {
    return NextResponse.redirect(`${errorBase}?error=shop_mismatch`);
  }

  // Verify Shopify's HMAC signature
  if (!verifyShopifyHmac(params)) {
    return NextResponse.redirect(`${errorBase}?error=invalid_hmac`);
  }

  try {
    const tokenData = await exchangeShopifyCode(shop, code);

    // Resolve workspaceId from clientId if available
    let workspaceId: string | undefined;
    if (clientId) {
      const account = await prisma.clientAccount.findUnique({
        where:  { id: clientId },
        select: { workspaceId: true },
      });
      workspaceId = account?.workspaceId ?? undefined;
    }

    await upsertShopifyConnection({
      shopDomain:       shop,
      accessToken:      tokenData.access_token,
      connectionStatus: "active",
      scopes:           tokenData.scope,
      ...(clientId    && { clientAccountId: clientId }),
      ...(workspaceId && { workspaceId }),
    });

    const response = NextResponse.redirect(`${successBase}?connected=1`);

    // Clear all CSRF + context cookies
    const clearOpts = { maxAge: 0, path: "/" } as const;
    response.cookies.set("shopify_oauth_state",  "", clearOpts);
    response.cookies.set("shopify_oauth_shop",   "", clearOpts);
    response.cookies.set("shopify_oauth_client", "", clearOpts);

    return response;
  } catch (err) {
    console.error("[Shopify OAuth callback]", err);
    return NextResponse.redirect(`${errorBase}?error=callback_failed`);
  }
}
