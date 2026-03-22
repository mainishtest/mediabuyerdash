import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { mapOrder, mapLineItemsForOrder } from "../../../../lib/shopify/mappers";
import { upsertOrder, replaceLineItems } from "../../../../lib/shopify/syncDb";
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

  // Only handle order events
  if (shopifyTopic !== "orders/create" && shopifyTopic !== "orders/updated") {
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

  // Map webhook payload to our format and upsert
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
  customer?: { id: number; email?: string };
  landing_site?: string;
  referring_site?: string;
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
  }>;
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
  };
}
