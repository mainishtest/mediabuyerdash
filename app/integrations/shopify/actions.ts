"use server";

import { cookies }        from "next/headers";
import { redirect }       from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes }    from "crypto";

import { buildShopifyOAuthUrl }    from "../../../lib/shopify/auth";
import { normaliseShopDomain }     from "../../../lib/shopify/config";
import { deleteShopifyConnection } from "../../../lib/shopify/db";

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

/** Remove a Shopify connection from the database. */
export async function disconnectShopifyAction(formData: FormData) {
  const id = formData.get("connectionId");
  if (typeof id === "string" && id) {
    await deleteShopifyConnection(id).catch(() => null);
  }
  revalidatePath("/integrations/shopify");
  redirect("/integrations/shopify");
}
