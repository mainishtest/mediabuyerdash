"use server";

import { cookies }        from "next/headers";
import { redirect }       from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes }    from "crypto";

import { buildShopifyOAuthUrl }  from "../../../lib/shopify/auth";
import { normaliseShopDomain }   from "../../../lib/shopify/config";
import { deleteShopifyConnection } from "../../../lib/shopify/db";

/**
 * Called when the user submits the "Connect Shopify" form.
 * Validates the shop domain, sets CSRF cookies, and redirects to Shopify OAuth.
 */
export async function startShopifyOAuthAction(formData: FormData) {
  const raw = formData.get("shopDomain");
  if (typeof raw !== "string" || !raw.trim()) {
    redirect("/integrations/shopify?error=missing_domain");
  }

  const shopDomain = normaliseShopDomain(raw);

  // Basic domain sanity check
  if (!shopDomain.includes(".")) {
    redirect("/integrations/shopify?error=invalid_domain");
  }

  const state = randomBytes(16).toString("hex");

  try {
    const oauthUrl = buildShopifyOAuthUrl(shopDomain, state);

    const cookieStore = cookies();
    const cookieOpts  = { httpOnly: true, secure: true, path: "/", maxAge: 600 } as const;
    cookieStore.set("shopify_oauth_state", state,      cookieOpts);
    cookieStore.set("shopify_oauth_shop",  shopDomain, cookieOpts);

    redirect(oauthUrl);
  } catch {
    redirect("/integrations/shopify?error=config_missing");
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
