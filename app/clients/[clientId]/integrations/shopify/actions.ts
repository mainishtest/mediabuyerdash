"use server";

import { cookies }        from "next/headers";
import { redirect }       from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes }    from "crypto";

import { buildShopifyOAuthUrl }    from "../../../../../lib/shopify/auth";
import { normaliseShopDomain }     from "../../../../../lib/shopify/config";
import { deleteShopifyConnection } from "../../../../../lib/shopify/db";
import { runShopifySyncForClient } from "../../../../../lib/shopify/sync";
import type { ShopifySyncSummary } from "../../../../../lib/shopify/sync";
import { prisma }                  from "../../../../../lib/db";

/**
 * Connect a Shopify store using the client_credentials OAuth grant.
 * Shopify docs: POST https://{shop}/admin/oauth/access_token
 *   Content-Type: application/x-www-form-urlencoded
 *   grant_type=client_credentials&client_id=...&client_secret=...
 */
export async function connectShopifyClientCredentialsAction(
  clientId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const rawDomain = formData.get("shopDomain");
  const rawClientId     = formData.get("clientId");
  const rawClientSecret = formData.get("clientSecret");

  if (typeof rawDomain !== "string" || !rawDomain.trim()) {
    return { error: "Please enter a shop domain." };
  }
  if (typeof rawClientId !== "string" || !rawClientId.trim()) {
    return { error: "Please enter a client ID." };
  }
  if (typeof rawClientSecret !== "string" || !rawClientSecret.trim()) {
    return { error: "Please enter a client secret." };
  }

  const shopDomain   = normaliseShopDomain(rawDomain);
  const clientIdVal  = rawClientId.trim();
  const clientSecret = rawClientSecret.trim();

  // Exchange client credentials for an access token
  let accessToken: string;
  let scopes: string | undefined;
  try {
    const tokenRes = await fetch(
      `https://${shopDomain}/admin/oauth/access_token`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    new URLSearchParams({
          grant_type:    "client_credentials",
          client_id:     clientIdVal,
          client_secret: clientSecret,
        }),
        cache: "no-store",
      }
    );

    if (!tokenRes.ok) {
      const contentType = tokenRes.headers.get("content-type") ?? "";
      let shopifyError = "";

      if (contentType.includes("application/json")) {
        const errJson = await tokenRes.json().catch(() => ({})) as { error?: string; error_description?: string };
        shopifyError = errJson.error_description ?? errJson.error ?? "";
      } else {
        const html = await tokenRes.text().catch(() => "");
        const match = html.match(/Oauth error ([^<:]+):\s*([^<]+)/);
        shopifyError = match ? `${match[1].trim()}: ${match[2].trim()}` : "";
      }

      if (shopifyError.includes("app_not_installed")) {
        return {
          error:
            "This app is not installed on the store. Install the custom app on the store first (Shopify admin → Apps → Develop apps → Install), then try again.",
        };
      }

      return {
        error: `Shopify rejected the credentials (HTTP ${tokenRes.status})${shopifyError ? `: ${shopifyError}` : ". Check your client ID and secret."}`,
      };
    }

    const json = await tokenRes.json() as { access_token?: string; scope?: string; error_description?: string };
    if (!json.access_token) {
      return { error: `Shopify did not return an access token. Response: ${JSON.stringify(json)}` };
    }
    accessToken = json.access_token;
    scopes      = json.scope;
  } catch (err: unknown) {
    return { error: `Could not reach ${shopDomain}. Check the domain and your internet connection.` };
  }

  // Verify the token actually works
  try {
    const verifyRes = await fetch(
      `https://${shopDomain}/admin/api/2024-10/shop.json`,
      { headers: { "X-Shopify-Access-Token": accessToken }, cache: "no-store" }
    );
    if (!verifyRes.ok) {
      return { error: `Got a token but the API rejected it (HTTP ${verifyRes.status}). The credentials may lack Admin API access.` };
    }
  } catch {
    return { error: "Got a token but could not verify it against the Shopify Admin API." };
  }

  // Persist
  try {
    await prisma.shopifyConnection.upsert({
      where:  { shopDomain },
      create: {
        shopDomain,
        accessToken,
        connectionStatus: "active",
        scopes:           scopes ?? "client_credentials",
        clientAccountId:  clientId,
      },
      update: {
        accessToken,
        connectionStatus: "active",
        scopes:           scopes ?? "client_credentials",
        clientAccountId:  clientId,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Database error: ${msg}` };
  }

  revalidatePath(`/clients/${clientId}/integrations/shopify`);
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}/integrations/shopify?connected=1`);
}

/** Connect a Shopify store manually using a private-app access token (no OAuth). */
export async function connectShopifyManuallyAction(
  clientId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const rawDomain = formData.get("shopDomain");
  const rawToken  = formData.get("accessToken");

  if (typeof rawDomain !== "string" || !rawDomain.trim()) {
    return { error: "Please enter a shop domain." };
  }
  if (typeof rawToken !== "string" || !rawToken.trim()) {
    return { error: "Please enter an access token." };
  }

  const shopDomain  = normaliseShopDomain(rawDomain);
  const accessToken = rawToken.trim();

  // Quick sanity-check: verify the token works against the Shopify Admin REST API
  try {
    const res = await fetch(
      `https://${shopDomain}/admin/api/2024-10/shop.json`,
      { headers: { "X-Shopify-Access-Token": accessToken }, cache: "no-store" }
    );
    if (!res.ok) {
      return { error: `Shopify rejected the token (HTTP ${res.status}). Check the domain and token.` };
    }
  } catch {
    return { error: "Could not reach the Shopify store. Check the domain and your internet connection." };
  }

  try {
    await prisma.shopifyConnection.upsert({
      where:  { shopDomain },
      create: {
        shopDomain,
        accessToken,
        connectionStatus: "active",
        scopes:           "manual",
        clientAccountId:  clientId,
      },
      update: {
        accessToken,
        connectionStatus: "active",
        clientAccountId:  clientId,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Database error: ${msg}` };
  }

  revalidatePath(`/clients/${clientId}/integrations/shopify`);
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}/integrations/shopify?connected=1`);
}

/** Start Shopify OAuth from a client page. Carries clientId through OAuth. */
export async function startClientShopifyOAuthAction(
  clientId: string,
  formData: FormData
) {
  const raw       = formData.get("shopDomain");
  const errorBase = `/clients/${clientId}/integrations/shopify`;

  if (typeof raw !== "string" || !raw.trim()) {
    redirect(`${errorBase}?error=missing_domain`);
  }

  const shopDomain = normaliseShopDomain(raw);
  if (!shopDomain.includes(".")) {
    redirect(`${errorBase}?error=invalid_domain`);
  }

  const state = randomBytes(16).toString("hex");

  try {
    const oauthUrl    = buildShopifyOAuthUrl(shopDomain, state);
    const cookieStore = cookies();
    const cookieOpts  = { httpOnly: true, secure: true, path: "/", maxAge: 600 } as const;

    cookieStore.set("shopify_oauth_state",  state,      cookieOpts);
    cookieStore.set("shopify_oauth_shop",   shopDomain, cookieOpts);
    cookieStore.set("shopify_oauth_client", clientId,   cookieOpts);

    redirect(oauthUrl);
  } catch {
    redirect(`${errorBase}?error=config_missing`);
  }
}

/** Fully disconnect (delete) a Shopify connection from this client page. */
export async function disconnectShopifyFromClientAction(
  clientId: string,
  connectionId: string
) {
  await deleteShopifyConnection(connectionId).catch(() => null);
  revalidatePath(`/clients/${clientId}/integrations/shopify`);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/integrations/shopify");
  redirect(`/clients/${clientId}/integrations/shopify`);
}

/** Clear the clientAccountId mapping (does NOT delete the connection). */
export async function unmapShopifyFromClientPageAction(
  clientId: string,
  connectionId: string
) {
  await prisma.shopifyConnection.update({
    where: { id: connectionId },
    data:  { clientAccountId: null },
  });
  revalidatePath(`/clients/${clientId}/integrations/shopify`);
  revalidatePath(`/clients/${clientId}`);
}

/** Trigger a Shopify order sync scoped to this client. */
export async function runClientShopifySyncAction(
  clientId: string
): Promise<ShopifySyncSummary> {
  const result = await runShopifySyncForClient(clientId);
  revalidatePath(`/clients/${clientId}/integrations/shopify`);
  revalidatePath(`/clients/${clientId}`);
  return result;
}
