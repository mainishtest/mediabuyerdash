import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { mapOrder, mapLineItemsForOrder, mapRefundsForOrder } from "../../../../lib/shopify/mappers";
import { upsertOrder, replaceLineItems, upsertRefunds } from "../../../../lib/shopify/syncDb";
import { recomputeOrderNetRevenue } from "../../../../lib/shopify/revenueNormalization";
import type { RawShopifyOrder } from "../../../../lib/shopify/api";

export const maxDuration = 30;

/**
 * POST /api/webhooks/shopify
 *
 * Handles Shopify webhook events for real-time order ingestion.
 * Supported topics: orders/create, orders/updated
 *
 * Shopify sends webhook payloads with HMAC-SHA256 signature in
 * X-Shopify-Hmac-Sha256 header for verification.
 */
export async function POST(request: Request) {
  const shopifyHmac = request.headers.get("x-shopify-hmac-sha256");
  const shopifyTopic = request.headers.get("x-shopify-topic");
  const shopifyDomain = request.headers.get("x-shopify-shop-domain");

  if (!shopifyHmac || !shopifyTopic || !shopifyDomain) {
    return NextResponse.json({ error: "Missing Shopify headers" }, { status: 400 });
  }

  // Handle order and refund events
  const supportedTopics = ["orders/create", "orders/updated", "refunds/create"];
  if (!supportedTopics.includes(shopifyTopic)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Read raw body for HMAC verification
  const rawBody = await request.text();

  // Verify HMAC
  const appSecret = process.env.SHOPIFY_APP_SECRET;
  if (!appSecret) {
    console.error("[Shopify webhook] SHOPIFY_APP_SECRET not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const expectedHmac = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  if (expectedHmac !== shopifyHmac) {
    console.warn("[Shopify webhook] HMAC verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse the order payload
  let orderPayload: WebhookOrderPayload;
  try {
    orderPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Find the connection for this shop domain
  const connection = await prisma.shopifyConnection.findUnique({
    where: { shopDomain: shopifyDomain },
    select: { id: true, clientAccountId: true, workspaceId: true },
  });

  if (!connection) {
    console.warn(`[Shopify webhook] No connection for domain: ${shopifyDomain}`);
    return NextResponse.json({ error: "Unknown shop" }, { status: 404 });
  }

  // Handle refunds/create separately
  if (shopifyTopic === "refunds/create") {
    try {
      const refundPayload = orderPayload as unknown as WebhookRefundPayload;
      // Find the order this refund belongs to
      const externalOrderId = `gid://shopify/Order/${refundPayload.order_id}`;
      const order = await prisma.shopifyOrder.findFirst({
        where: { shopifyConnectionId: connection.id, externalOrderId },
        select: { id: true },
      });

      if (!order) {
        console.warn(`[Shopify webhook] Refund for unknown order: ${refundPayload.order_id}`);
        return NextResponse.json({ ok: true, skipped: true, reason: "order_not_found" });
      }

      // Upsert the refund record
      const refundAmount = refundPayload.transactions?.reduce(
        (sum: number, t: { amount: string }) => sum + (parseFloat(t.amount) || 0), 0
      ) ?? 0;

      await prisma.shopifyRefund.upsert({
        where: {
          shopifyOrderId_externalRefundId: {
            shopifyOrderId: order.id,
            externalRefundId: `gid://shopify/Refund/${refundPayload.id}`,
          },
        },
        create: {
          shopifyOrderId: order.id,
          externalRefundId: `gid://shopify/Refund/${refundPayload.id}`,
          refundAmount,
          note: refundPayload.note ?? null,
          refundCreatedAt: new Date(refundPayload.created_at),
        },
        update: {
          refundAmount,
          note: refundPayload.note ?? null,
        },
      });

      // Recompute order netRevenue from all refund records
      await recomputeOrderNetRevenue(order.id);

      console.log(`[Shopify webhook] refunds/create: refund ${refundPayload.id} for order ${refundPayload.order_id} processed`);
      return NextResponse.json({ ok: true, refundId: refundPayload.id });
    } catch (err) {
      console.error("[Shopify webhook] Failed to process refund:", err);
      return NextResponse.json({ error: "Refund processing failed" }, { status: 500 });
    }
  }

  // Map webhook payload to our format and upsert (orders/create, orders/updated)
  try {
    const rawOrder = webhookPayloadToRawOrder(orderPayload);
    const mapped = mapOrder(
      rawOrder,
      connection.id,
      connection.clientAccountId ?? null,
      connection.workspaceId ?? null
    );
    const saved = await upsertOrder(mapped);
    const lineItems = mapLineItemsForOrder(rawOrder, saved.id);
    await replaceLineItems(saved.id, lineItems);

    // Process refunds if present in the order payload
    const refunds = mapRefundsForOrder(rawOrder);
    if (refunds.length > 0) {
      await upsertRefunds(saved.id, refunds);
    }

    console.log(`[Shopify webhook] ${shopifyTopic}: order ${orderPayload.name} upserted`);
    return NextResponse.json({ ok: true, orderId: saved.id });
  } catch (err) {
    console.error("[Shopify webhook] Failed to process order:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

// ── Webhook payload types ───────────────────────────────────────────────────

interface WebhookOrderPayload {
  id: number;
  admin_graphql_api_id: string; // "gid://shopify/Order/12345"
  name: string;
  created_at: string;
  currency: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  total_discounts: string;
  financial_status?: string;
  fulfillment_status?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  customer?: { id: number; email?: string };
  landing_site?: string;
  referring_site?: string;
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
  }>;
  refunds?: Array<{
    id: number;
    created_at: string;
    note?: string | null;
    transactions?: Array<{ amount: string }>;
  }>;
}

interface WebhookRefundPayload {
  id: number;
  order_id: number;
  created_at: string;
  note?: string | null;
  transactions?: Array<{ amount: string }>;
}

/**
 * Converts a Shopify REST webhook payload to the GraphQL RawShopifyOrder
 * format that our existing mappers expect.
 */
function webhookPayloadToRawOrder(p: WebhookOrderPayload): RawShopifyOrder {
  return {
    id:           p.admin_graphql_api_id,
    name:         p.name,
    createdAt:    p.created_at,
    currencyCode: p.currency,
    displayFinancialStatus:  p.financial_status?.toUpperCase() ?? null,
    displayFulfillmentStatus: p.fulfillment_status?.toUpperCase() ?? null,
    cancelledAt:  p.cancelled_at ?? null,
    cancelReason: p.cancel_reason ?? null,
    totalPriceSet:     { shopMoney: { amount: p.total_price } },
    subtotalPriceSet:  { shopMoney: { amount: p.subtotal_price } },
    totalTaxSet:       { shopMoney: { amount: p.total_tax } },
    totalDiscountsSet: { shopMoney: { amount: p.total_discounts } },
    customer: p.customer
      ? { id: `gid://shopify/Customer/${p.customer.id}`, email: p.customer.email }
      : undefined,
    // Webhook payloads don't include customerJourneySummary (UTM data).
    // UTM data is only available via GraphQL; the cron sync fills it in.
    customerJourneySummary: undefined,
    lineItems: {
      edges: p.line_items.map((li) => ({
        node: {
          id:    `gid://shopify/LineItem/${li.id}`,
          title: li.title,
          quantity: li.quantity,
          originalUnitPriceSet: { shopMoney: { amount: li.price } },
        },
      })),
    },
    // Map refunds from webhook payload to our format
    refunds: p.refunds?.map((r) => ({
      id:        `gid://shopify/Refund/${r.id}`,
      createdAt: r.created_at,
      note:      r.note ?? null,
      totalRefundedSet: {
        shopMoney: {
          amount: String(r.transactions?.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) ?? 0),
        },
      },
    })),
  };
}
