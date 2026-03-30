"use server";

import { cookies }        from "next/headers";
import { redirect }       from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes }    from "crypto";

import { buildShopifyOAuthUrl }    from "../../../lib/shopify/auth";
import { normaliseShopDomain }     from "../../../lib/shopify/config";
import { deleteShopifyConnection } from "../../../lib/shopify/db";
import { prisma }                  from "../../../lib/db";

/** Shared OAuth start helper — optionally associates the new connection with a client. */
export async function startShopifyOAuthAction(formData: FormData) {
  const raw      = formData.get("shopDomain");
  const clientId = formData.get("clientId");
  const errorBase = "/integrations/shopify";

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

    cookieStore.set("shopify_oauth_state", state,      cookieOpts);
    cookieStore.set("shopify_oauth_shop",  shopDomain, cookieOpts);

    // If connecting from a client page, carry the clientId so the callback can auto-map
    if (typeof clientId === "string" && clientId.trim()) {
      cookieStore.set("shopify_oauth_client", clientId.trim(), cookieOpts);
    }

    redirect(oauthUrl);
  } catch {
    redirect(`${errorBase}?error=config_missing`);
  }
}

/**
 * Connect a Shopify store using the client_credentials OAuth grant.
 * POST /admin/oauth/access_token with grant_type=client_credentials.
 */
export async function connectShopifyClientCredentialsAction(
  formData: FormData
): Promise<{ error?: string }> {
  const rawDomain       = formData.get("shopDomain");
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
        // Shopify returns HTML for some errors — extract the plain-text message
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

    const json = await tokenRes.json() as { access_token?: string; scope?: string };
    if (!json.access_token) {
      return { error: `Shopify did not return an access token. Response: ${JSON.stringify(json)}` };
    }
    accessToken = json.access_token;
    scopes      = json.scope;
  } catch {
    return { error: `Could not reach ${shopDomain}. Check the domain and your internet connection.` };
  }

  // Verify the token works
  try {
    const verifyRes = await fetch(
      `https://${shopDomain}/admin/api/2024-10/shop.json`,
      { headers: { "X-Shopify-Access-Token": accessToken }, cache: "no-store" }
    );
    if (!verifyRes.ok) {
      return { error: `Got a token but the API rejected it (HTTP ${verifyRes.status}). The app may lack Admin API access.` };
    }
  } catch {
    return { error: "Got a token but could not verify it against the Shopify Admin API." };
  }

  try {
    await prisma.shopifyConnection.upsert({
      where:  { shopDomain },
      create: {
        shopDomain,
        accessToken,
        clientId:         clientIdVal,
        clientSecret:     clientSecret,
        connectionStatus: "active",
        scopes:           scopes ?? "client_credentials",
      },
      update: {
        accessToken,
        clientId:         clientIdVal,
        clientSecret:     clientSecret,
        connectionStatus: "active",
        scopes:           scopes ?? "client_credentials",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Database error: ${msg}` };
  }

  revalidatePath("/integrations/shopify");
  redirect("/integrations/shopify?connected=1");
}

/** Remove a Shopify connection from the database. */
export async function disconnectShopifyAction(formData: FormData) {
  const id = formData.get("connectionId");
  if (typeof id === "string" && id) {
    await deleteShopifyConnection(id).catch(() => null);
  }
  revalidatePath("/integrations/shopify");
  redirect("/integrations/shopify");
}
