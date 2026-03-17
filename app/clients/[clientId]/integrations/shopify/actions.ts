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
