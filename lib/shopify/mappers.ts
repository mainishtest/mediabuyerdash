import type { RawShopifyOrder, RawShopifyLineItem, RawShopifyRefund } from "./api";

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
  financialStatus:     string | null;
  fulfillmentStatus:   string | null;
  cancelledAt:         Date | null;
  cancelReason:        string | null;
  refundTotal:         number;
  netRevenue:          number;
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

export interface MappedRefund {
  externalRefundId: string;
  refundAmount:     number;
  note:             string | null;
  refundCreatedAt:  Date;
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

/** Compute total refund amount from raw refund array. */
function sumRefunds(refunds?: RawShopifyRefund[]): number {
  if (!refunds || refunds.length === 0) return 0;
  return refunds.reduce((sum, r) => sum + money(r.totalRefundedSet), 0);
}

/** Normalize Shopify status enum to lowercase. */
function normalizeStatus(status?: string | null): string | null {
  if (!status) return null;
  return status.toLowerCase().replace(/_/g, "_");
}

export function mapOrder(
  raw: RawShopifyOrder,
  shopifyConnectionId: string,
  clientAccountId: string | null = null,
  workspaceId: string | null = null
): MappedOrder {
  const totalPrice = money(raw.totalPriceSet);
  const refundTotal = sumRefunds(raw.refunds);
  const netRevenue = Math.max(0, totalPrice - refundTotal);

  return {
    workspaceId,
    shopifyConnectionId,
    clientAccountId,
    externalOrderId: raw.id,
    orderNumber:     raw.name,
    orderCreatedAt:  new Date(raw.createdAt),
    currency:        raw.currencyCode,
    totalPrice,
    subtotalPrice:   money(raw.subtotalPriceSet),
    totalTax:        money(raw.totalTaxSet),
    totalDiscount:   money(raw.totalDiscountsSet),
    financialStatus:  normalizeStatus(raw.displayFinancialStatus),
    fulfillmentStatus: normalizeStatus(raw.displayFulfillmentStatus),
    cancelledAt:     raw.cancelledAt ? new Date(raw.cancelledAt) : null,
    cancelReason:    raw.cancelReason ?? null,
    refundTotal,
    netRevenue,
    customerId:      raw.customer?.id          ?? null,
    customerEmail:   raw.customer?.email       ?? null,
    utmSource:       raw.customerJourneySummary?.firstVisit?.utmParameters?.source   ?? null,
    utmMedium:       raw.customerJourneySummary?.firstVisit?.utmParameters?.medium   ?? null,
    utmCampaign:     raw.customerJourneySummary?.firstVisit?.utmParameters?.campaign ?? null,
    utmContent:      raw.customerJourneySummary?.firstVisit?.utmParameters?.content  ?? null,
    utmTerm:         raw.customerJourneySummary?.firstVisit?.utmParameters?.term     ?? null,
    landingPage:     raw.customerJourneySummary?.firstVisit?.landingPage  ?? null,
    referringSite:   raw.customerJourneySummary?.firstVisit?.referrerUrl  ?? null,
  };
}

export function mapRefundsForOrder(raw: RawShopifyOrder): MappedRefund[] {
  if (!raw.refunds || raw.refunds.length === 0) return [];
  return raw.refunds.map((r) => ({
    externalRefundId: r.id,
    refundAmount:     money(r.totalRefundedSet),
    note:             r.note ?? null,
    refundCreatedAt:  new Date(r.createdAt),
  }));
}

export function mapLineItemsForOrder(
  raw: RawShopifyOrder,
  shopifyOrderId: string
): MappedLineItem[] {
  return raw.lineItems.edges.map(({ node }: { node: RawShopifyLineItem }) => ({
    shopifyOrderId,
    productId: null,
    variantId: null,
    sku:       null,
    title:     node.title,
    quantity:  node.quantity,
    price:     parseFloat(node.originalUnitPriceSet.shopMoney.amount) || 0,
  }));
}
