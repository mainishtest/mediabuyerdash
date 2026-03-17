import type { RawShopifyOrder, RawShopifyLineItem } from "./api";

// ── Mapped (Prisma-ready) types ────────────────────────────────────────────────

export interface MappedOrder {
  workspaceId:         string | null;
  shopifyConnectionId: string;
  clientAccountId:     string | null;
  externalOrderId:     string;
  orderNumber:         string;
  orderCreatedAt:      Date;
  currency:            string;
  totalPrice:          number;
  subtotalPrice:       number;
  totalTax:            number;
  totalDiscount:       number;
  customerId:          string | null;
  customerEmail:       string | null;
  utmSource:           string | null;
  utmMedium:           string | null;
  utmCampaign:         string | null;
  utmContent:          string | null;
  utmTerm:             string | null;
  landingPage:         string | null;
  referringSite:       string | null;
}

export interface MappedLineItem {
  shopifyOrderId: string;
  productId:      string | null;
  variantId:      string | null;
  sku:            string | null;
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
  shopifyConnectionId: string,
  clientAccountId: string | null = null,
  workspaceId: string | null = null
): MappedOrder {
  return {
    workspaceId,
    shopifyConnectionId,
    clientAccountId,
    externalOrderId: raw.id,
    orderNumber:     raw.name,
    orderCreatedAt:  new Date(raw.createdAt),
    currency:        raw.currencyCode,
    totalPrice:      money(raw.totalPriceSet),
    subtotalPrice:   money(raw.subtotalPriceSet),
    totalTax:        money(raw.totalTaxSet),
    totalDiscount:   money(raw.totalDiscountsSet),
    customerId:      raw.customer?.id          ?? null,
    customerEmail:   raw.customer?.email       ?? null,
    utmSource:       raw.utmParameters?.source   ?? null,
    utmMedium:       raw.utmParameters?.medium   ?? null,
    utmCampaign:     raw.utmParameters?.campaign ?? null,
    utmContent:      raw.utmParameters?.content  ?? null,
    utmTerm:         raw.utmParameters?.term      ?? null,
    landingPage:     raw.landingSite   ?? null,
    referringSite:   raw.referringSite ?? null,
  };
}

export function mapLineItemsForOrder(
  raw: RawShopifyOrder,
  shopifyOrderId: string
): MappedLineItem[] {
  return raw.lineItems.edges.map(({ node }: { node: RawShopifyLineItem }) => ({
    shopifyOrderId,
    productId: node.product?.id      ?? null,
    variantId: node.variant?.id      ?? null,
    sku:       node.variant?.sku     ?? null,
    title:     node.title,
    quantity:  node.quantity,
    price:     parseFloat(node.originalUnitPriceSet.shopMoney.amount) || 0,
  }));
}
