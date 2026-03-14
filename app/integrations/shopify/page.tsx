export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { isShopifyConfigured }      from "../../../lib/shopify/config";
import { getLatestShopifyConnection } from "../../../lib/shopify/db";
import { getLatestSyncLog, getOrderSummary } from "../../../lib/shopify/syncDb";
import { ShopifyIntegrationView }   from "./ShopifyIntegrationView";

export const metadata: Metadata = {
  title: "Shopify Integration — Media Buying Dashboard",
};

export default async function ShopifyIntegrationPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const configured  = isShopifyConfigured();
  const connection  = await getLatestShopifyConnection().catch(() => null);

  const syncLog     = connection
    ? await getLatestSyncLog(connection.id).catch(() => null)
    : null;
  const orderSummary = connection
    ? await getOrderSummary(connection.id).catch(() => null)
    : null;

  const errorParam   = searchParams.error;
  const errorMessage = typeof errorParam === "string" ? errorParam : null;
  const connected    = searchParams.connected === "1";

  return (
    <ShopifyIntegrationView
      isConfigured={configured}
      connection={
        connection
          ? {
              id:               connection.id,
              shopDomain:       connection.shopDomain,
              connectionStatus: connection.connectionStatus,
              scopes:           connection.scopes,
              installedAt:      connection.installedAt,
              clientAccountId:  connection.clientAccountId ?? null,
              clientAccount:    connection.clientAccount
                ? { id: connection.clientAccount.id, name: connection.clientAccount.name }
                : null,
            }
          : null
      }
      syncLog={syncLog}
      orderCount={orderSummary?.orderCount ?? 0}
      errorMessage={errorMessage}
      justConnected={connected}
    />
  );
}
