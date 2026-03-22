import { SHOPIFY_API_VERSION } from "./config";

// ── Rate limit / retry helpers ───────────────────────────────────────────────

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Detects Shopify token errors (401 or explicit auth error messages).
 */
export function isShopifyTokenError(status: number, body: unknown): boolean {
  if (status === 401 || status === 403) return true;
  if (body && typeof body === "object") {
    const errors = (body as { errors?: string }).errors;
    if (typeof errors === "string" && errors.includes("access token")) return true;
  }
  return false;
}

// ── Raw API types ──────────────────────────────────────────────────────────────

export interface RawShopifyMoneyBag {
  shopMoney: { amount: string };
}

export interface RawShopifyLineItem {
  id:       string;
  title:    string;
  quantity: number;
  originalUnitPriceSet: RawShopifyMoneyBag;
}

export interface RawShopifyRefund {
  id:        string; // "gid://shopify/Refund/12345"
  createdAt: string;
  note?:     string | null;
  totalRefundedSet: RawShopifyMoneyBag;
}

export interface RawShopifyOrder {
  id:           string; // "gid://shopify/Order/12345"
  name:         string; // "#1001"
  createdAt:    string; // ISO — when the order was created in Shopify
  currencyCode: string;
  displayFinancialStatus?:  string | null; // PAID | PARTIALLY_REFUNDED | REFUNDED | PENDING | VOIDED
  displayFulfillmentStatus?: string | null; // FULFILLED | PARTIAL | UNFULFILLED
  cancelledAt?:  string | null;
  cancelReason?: string | null;
  totalPriceSet:      RawShopifyMoneyBag;
  subtotalPriceSet:   RawShopifyMoneyBag;
  totalTaxSet:        RawShopifyMoneyBag;
  totalDiscountsSet:  RawShopifyMoneyBag;
  customer?: { id: string; email?: string };
  customerJourneySummary?: {
    firstVisit?: {
      utmParameters?: {
        source?:   string;
        medium?:   string;
        campaign?: string;
        content?:  string;
        term?:     string;
      };
      landingPage?:  string;
      referrerUrl?:  string;
    };
  };
  lineItems: {
    edges: Array<{ node: RawShopifyLineItem }>;
  };
  refunds?: RawShopifyRefund[];
}

interface OrdersQueryData {
  orders: {
    edges:    Array<{ node: RawShopifyOrder }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

// ── GraphQL query ──────────────────────────────────────────────────────────────

const ORDERS_QUERY = `
  query GetOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query) {
      edges {
        node {
          id
          name
          createdAt
          currencyCode
          displayFinancialStatus
          displayFulfillmentStatus
          cancelledAt
          cancelReason
          totalPriceSet      { shopMoney { amount } }
          subtotalPriceSet   { shopMoney { amount } }
          totalTaxSet        { shopMoney { amount } }
          totalDiscountsSet  { shopMoney { amount } }
          customer           { id email }
          customerJourneySummary {
            firstVisit {
              utmParameters { source medium campaign content term }
              landingPage
              referrerUrl
            }
          }
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPriceSet { shopMoney { amount } }
              }
            }
          }
          refunds(first: 10) {
            id
            createdAt
            note
            totalRefundedSet { shopMoney { amount } }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

// ── GraphQL executor ───────────────────────────────────────────────────────────

async function shopifyGraphQL<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const body = JSON.stringify({ query, variables });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type":           "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body,
      cache: "no-store",
    });

    // Rate-limited (Shopify uses 429 for REST, throttled cost for GraphQL)
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = parseFloat(res.headers.get("Retry-After") ?? "0");
      const backoff = Math.max(retryAfter * 1000, INITIAL_BACKOFF_MS * Math.pow(2, attempt));
      console.warn(`[Shopify API] 429 throttled, retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(backoff);
      continue;
    }

    // Server errors — retry with backoff
    if (res.status >= 500 && attempt < MAX_RETRIES) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      console.warn(`[Shopify API] ${res.status} server error, retrying in ${backoff}ms`);
      await sleep(backoff);
      continue;
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const err = new Error(`Shopify GraphQL HTTP ${res.status}: ${JSON.stringify(errBody)}`);
      if (isShopifyTokenError(res.status, errBody)) {
        (err as Error & { isTokenError: boolean }).isTokenError = true;
      }
      throw err;
    }

    const json = await res.json();

    // GraphQL-level throttling (Shopify returns cost info in extensions)
    if (json.extensions?.cost?.throttleStatus?.currentlyAvailable < 50 && attempt < MAX_RETRIES) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      console.warn(`[Shopify API] Low query cost budget, backing off ${backoff}ms`);
      await sleep(backoff);
    }

    if (json.errors) {
      throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
    }
    return json.data as T;
  }

  throw new Error("Shopify GraphQL: max retries exceeded");
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Stream orders page-by-page since `since`, calling `onPage` after each page.
 * This avoids accumulating all orders in memory and lets the caller write to
 * the DB incrementally — critical for large stores or tight serverless timeouts.
 */
export async function streamOrdersSince(
  shopDomain: string,
  accessToken: string,
  since: Date,
  onPage: (orders: RawShopifyOrder[]) => Promise<void>
): Promise<void> {
  const sinceStr  = since.toISOString().slice(0, 10);
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data: OrdersQueryData = await shopifyGraphQL<OrdersQueryData>(
      shopDomain,
      accessToken,
      ORDERS_QUERY,
      { first: 50, after: cursor, query: `created_at:>='${sinceStr}'` }
    );

    const orders = data.orders.edges.map((e: { node: RawShopifyOrder }) => e.node);
    if (orders.length > 0) await onPage(orders);

    hasNextPage = data.orders.pageInfo.hasNextPage;
    cursor      = data.orders.pageInfo.endCursor;
  }
}

/** @deprecated Use streamOrdersSince for large stores. Kept for compatibility. */
export async function fetchRecentOrders(
  shopDomain: string,
  accessToken: string,
  dayRange = 30
): Promise<RawShopifyOrder[]> {
  const since = new Date();
  since.setDate(since.getDate() - dayRange);
  const all: RawShopifyOrder[] = [];
  await streamOrdersSince(shopDomain, accessToken, since, async (page) => {
    all.push(...page);
  });
  return all;
}
