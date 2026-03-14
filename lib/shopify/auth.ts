import { createHmac } from "crypto";
import { getShopifyConfig, SHOPIFY_SCOPES } from "./config";

/**
 * Build the Shopify OAuth authorisation URL.
 * The user is redirected here to approve the app installation.
 */
export function buildShopifyOAuthUrl(shopDomain: string, state: string): string {
  const config = getShopifyConfig();
  if (!config) throw new Error("Shopify credentials are not configured.");

  const params = new URLSearchParams({
    client_id:     config.appKey,
    scope:         SHOPIFY_SCOPES,
    redirect_uri:  config.redirectUri,
    state,
  });

  return `https://${shopDomain}/admin/oauth/authorize?${params}`;
}

/**
 * Exchange the one-time authorisation code for a permanent access token.
 */
export async function exchangeShopifyCode(
  shopDomain: string,
  code: string
): Promise<{ access_token: string; scope: string }> {
  const config = getShopifyConfig();
  if (!config) throw new Error("Shopify credentials are not configured.");

  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id:     config.appKey,
      client_secret: config.appSecret,
      code,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Shopify token exchange failed (${res.status}): ${JSON.stringify(body)}`);
  }

  return res.json() as Promise<{ access_token: string; scope: string }>;
}

/**
 * Verify the HMAC signature Shopify attaches to OAuth callbacks.
 * https://shopify.dev/docs/apps/build/authentication-authorization/get-access-tokens/authorization-code-grant/implement-authorization-code-grant#verify-a-request
 */
export function verifyShopifyHmac(
  queryParams: Record<string, string>
): boolean {
  const config = getShopifyConfig();
  if (!config) return false;

  const { hmac, ...rest } = queryParams;
  if (!hmac) return false;

  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join("&");

  const digest = createHmac("sha256", config.appSecret)
    .update(message)
    .digest("hex");

  return digest === hmac;
}
