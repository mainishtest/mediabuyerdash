export const dynamic    = "force-dynamic";
export const maxDuration = 300;

import { notFound }              from "next/navigation";
import { prisma }                from "../../../../../lib/db";
import { isShopifyConfigured }   from "../../../../../lib/shopify/config";
import { getClientShopifyConnection } from "../../../../../lib/shopify/db";
import { getClientOrderSummary } from "../../../../../lib/shopify/syncDb";
import { ClientShopifyView }     from "./ClientShopifyView";

type PageProps = { params: { clientId: string } };

export async function generateMetadata({ params }: PageProps) {
  const account = await prisma.clientAccount.findUnique({
    where:  { id: params.clientId },
    select: { name: true },
  });
  return {
    title: account
      ? `Shopify — ${account.name} — Media Buying Dashboard`
      : "Shopify Integration",
  };
}

export default async function ClientShopifyPage({ params }: PageProps) {
  const { clientId } = params;

  const account = await prisma.clientAccount.findUnique({
    where:  { id: clientId },
    select: { id: true, name: true },
  });
  if (!account) notFound();

  const configured  = isShopifyConfigured();
  const connection  = await getClientShopifyConnection(clientId).catch(() => null);
  const syncLog     = connection?.syncLogs?.[0] ?? null;
  const orderData   = connection
    ? await getClientOrderSummary(clientId).catch(() => null)
    : null;

  return (
    <ClientShopifyView
      clientId={clientId}
      clientName={account.name}
      isConfigured={configured}
      connection={
        connection
          ? {
              id:               connection.id,
              shopDomain:       connection.shopDomain,
              connectionStatus: connection.connectionStatus,
              scopes:           connection.scopes ?? null,
              installedAt:      connection.installedAt,
            }
          : null
      }
      syncLog={syncLog}
      orderCount={orderData?.orderCount    ?? 0}
      lineItemCount={orderData?.lineItemCount ?? 0}
      facebookRevenue={orderData?.facebookRevenue ?? 0}
      recentOrders={
        (orderData?.recentOrders ?? []).map((o) => ({
          id:             o.id,
          orderNumber:    o.orderNumber,
          orderCreatedAt: o.orderCreatedAt,
          currency:       o.currency,
          totalPrice:     o.totalPrice,
          customerEmail:  o.customerEmail ?? null,
          utmSource:      o.utmSource     ?? null,
          utmMedium:      o.utmMedium     ?? null,
          utmCampaign:    o.utmCampaign   ?? null,
          utmContent:     o.utmContent    ?? null,
          utmTerm:        o.utmTerm       ?? null,
          lineItemCount:  (o as { lineItems?: { id: string }[] }).lineItems?.length ?? 0,
        }))
      }
    />
  );
}
