import type { RawShopifyOrder, RawShopifyLineItem } from "./api";

// ── Mapped (Prisma-ready) types ────────────────────────────────────────────────

export interface MappedOrder {
  shopifyConnectionId: string;
  externalOrderId:     string;
  orderNumber:         string;
  processedAt:         Date;
  currency:            string;
  totalPrice:          number;
  subtotalPrice:       number;
  totalTax:            number;
  totalDiscount:       number;
  customerId:          string | null;
  utmSource:           string | null;
  utmMedium:           string | null;
  utmCampaign:         string | null;
  utmContent:          string | null;
  utmTerm:             string | null;
}

export interface MappedLineItem {
  shopifyOrderId: string; // filled in by syncDb after the order is upserted
  productId:      string | null;
  variantId:      string | null;
  title:          string;
  quantity:       number;
  price:          number;
}

// ── Mapper helpers ─────────────────────────────────────────────────────────────

function money(bag: { shopMoney: { amount: string } }): number {
  return parseFloat(bag.shopMoney.amount) || 0;
}

export function mapOrder(
  raw: RawShopifyOrder,
  shopifyConnectionId: string
): MappedOrder {
  return {
    shopifyConnectionId,
    externalOrderId: raw.id,
    orderNumber:     raw.name,
    processedAt:     new Date(raw.processedAt),
    currency:        raw.currencyCode,
    totalPrice:      money(raw.totalPriceSet),
    subtotalPrice:   money(raw.subtotalPriceSet),
    totalTax:        money(raw.totalTaxSet),
    totalDiscount:   money(raw.totalDiscountsSet),
    customerId:      raw.customer?.id          ?? null,
    utmSource:       raw.utmParameters?.source   ?? null,
    utmMedium:       raw.utmParameters?.medium   ?? null,
    utmCampaign:     raw.utmParameters?.campaign ?? null,
    utmContent:      raw.utmParameters?.content  ?? null,
    utmTerm:         raw.utmParameters?.term      ?? null,
  };
}

export function mapLineItemsForOrder(
  raw: RawShopifyOrder,
  shopifyOrderId: string
): MappedLineItem[] {
  return raw.lineItems.edges.map(({ node }: { node: RawShopifyLineItem }) => ({
    shopifyOrderId,
    productId: node.product?.id ?? null,
    variantId: node.variant?.id ?? null,
    title:     node.title,
    quantity:  node.quantity,
    price:     parseFloat(node.originalUnitPriceSet.shopMoney.amount) || 0,
  }));
}
