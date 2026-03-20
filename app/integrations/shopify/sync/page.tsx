export const dynamic    = "force-dynamic";
export const maxDuration = 300;

import type { Metadata } from "next";
import { getLatestShopifyConnection } from "../../../../lib/shopify/db";
import { getLatestSyncLog, getOrderSummary } from "../../../../lib/shopify/syncDb";
import { ShopifySyncView } from "./ShopifySyncView";

export const metadata: Metadata = {
  title: "Shopify Sync — Media Buying Dashboard",
};

export default async function ShopifySyncPage() {
  const connection = await getLatestShopifyConnection().catch(() => null);

  const [syncLog, summary] = await Promise.all([
    connection ? getLatestSyncLog(connection.id).catch(() => null) : Promise.resolve(null),
    connection ? getOrderSummary(connection.id).catch(() => null)  : Promise.resolve(null),
  ]);

  return (
    <ShopifySyncView
      connection={
        connection
          ? {
              id:               connection.id,
              shopDomain:       connection.shopDomain,
              connectionStatus: connection.connectionStatus,
            }
          : null
      }
      syncLog={syncLog}
      orderCount={summary?.orderCount      ?? 0}
      lineItemCount={summary?.lineItemCount ?? 0}
      recentOrders={summary?.recentOrders   ?? []}
      recentLineItems={summary?.recentLineItems ?? []}
    />
  );
}
