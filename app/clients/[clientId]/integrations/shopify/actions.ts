"use server";

import { cookies }        from "next/headers";
import { redirect }       from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes }    from "crypto";

import { buildShopifyOAuthUrl }    from "../../../../../lib/shopify/auth";
import { normaliseShopDomain }     from "../../../../../lib/shopify/config";
import { runShopifySyncForClient } from "../../../../../lib/shopify/sync";
import type { ShopifySyncSummary } from "../../../../../lib/shopify/sync";
import { prisma }                  from "../../../../../lib/db";

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
