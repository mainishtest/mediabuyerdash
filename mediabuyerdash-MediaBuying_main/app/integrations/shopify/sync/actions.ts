"use server";

import { revalidatePath } from "next/cache";
import { runShopifySync } from "../../../../lib/shopify/sync";
import type { ShopifySyncSummary } from "../../../../lib/shopify/sync";

/** Trigger a read-only Shopify order sync for the given connection ID. */
export async function runShopifySyncAction(
  connectionId: string
): Promise<ShopifySyncSummary> {
  const result = await runShopifySync(connectionId);
  revalidatePath("/integrations/shopify/sync");
  revalidatePath("/integrations/shopify");
  return result;
}
